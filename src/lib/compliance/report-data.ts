import "server-only";
import { prisma } from "@/lib/prisma";
import { calendarState } from "@/lib/compliance/calendar";
import { deadlineBreaches } from "@/lib/compliance/speak-up";
import { notificationOverdue } from "@/lib/compliance/breach";
import { effectiveStatus } from "@/lib/compliance/remediation";
import { buildGoverningBodyDigest, trainingCoverage } from "@/lib/compliance/governing-body";
import { rollupApplicability } from "@/lib/compliance/applicability";

type Row = Record<string, string | number | boolean | null>;

const YES = (value: boolean) => (value ? "SI" : "NO");
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? "";

async function userNames(organizationId: string): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({
    where: { memberships: { some: { organizationId } } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user.name]));
}

/** Registro de obligaciones con jurisdicción, fuente, aplicabilidad y estado (§4.6). */
export async function getComplianceObligationRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.complianceObligation.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
      include: {
        jurisdiction: { select: { code: true, name: true } },
        source: { select: { code: true, name: true } },
        applicabilityAssessments: { include: { jurisdiction: { select: { code: true } } } },
        _count: { select: { risks: true, controls: true, evaluations: true, breaches: true } },
      },
    }),
  ]);
  return rows.map((row) => {
    const rollup = rollupApplicability(
      row.applicabilityAssessments.map((a) => ({ jurisdictionCode: a.jurisdiction.code, decision: a.decision })),
    );
    return {
      codigo: row.code,
      obligacion: row.title,
      tipo: row.obligationType,
      categoria: row.category,
      criticidad: row.criticality,
      jurisdiccion: row.jurisdiction?.code ?? "",
      fuente: row.source?.code ?? "",
      articulo: row.articleReference ?? "",
      aplicabilidad: row.applicability,
      aplicabilidad_agregada: rollup.decision,
      jurisdicciones_aplicables: rollup.applicableIn.join(", "),
      pendientes_aplicabilidad: rollup.pending,
      estado_cumplimiento: row.complianceStatus,
      estado_ciclo: row.status,
      responsable: row.ownerId ? names.get(row.ownerId) ?? "" : "",
      accountable: row.accountableId ? names.get(row.accountableId) ?? "" : "",
      sancion_maxima: row.maxSanctionAmount ?? "",
      frecuencia_evaluacion: row.evaluationFrequency,
      ultima_evaluacion: date(row.lastEvaluatedAt),
      proxima_evaluacion: date(row.nextEvaluationDate),
      riesgos: row._count.risks,
      controles: row._count.controls,
      evaluaciones: row._count.evaluations,
      incumplimientos: row._count.breaches,
      sin_control: YES(row.applicability !== "NOT_APPLICABLE" && row._count.controls === 0),
    } satisfies Row;
  });
}

/** Riesgos de compliance: inherente, residual, aceptabilidad y exposición (§6.1). */
export async function getComplianceRiskRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.complianceRisk.findMany({
      where: { organizationId },
      orderBy: [{ residualScore: "desc" }, { code: "asc" }],
      include: { obligation: { select: { code: true } }, _count: { select: { controls: true } } },
    }),
  ]);
  return rows.map((row) => ({
    codigo: row.code,
    riesgo: row.title,
    obligacion: row.obligation?.code ?? "",
    categoria: row.category,
    probabilidad: row.likelihood,
    impacto: row.impact,
    riesgo_inherente: row.inherentScore,
    nivel_inherente: row.inherentLevel,
    eficacia_controles: row.controlEffectiveness ?? "",
    controles: row._count.controls,
    riesgo_residual: row.residualScore,
    nivel_residual: row.residualLevel,
    aceptabilidad: row.acceptability,
    tratamiento: row.treatment,
    exposicion_sancion: row.sanctionExposure ?? "",
    impacto_reputacional: row.reputationalImpact,
    propietario: row.ownerId ? names.get(row.ownerId) ?? "" : "",
    estado: row.status,
    vencimiento: date(row.dueDate),
    aceptado_por: row.acceptedById ? names.get(row.acceptedById) ?? "" : "",
    aceptado_el: date(row.acceptedAt),
    justificacion_aceptacion: row.acceptanceRationale ?? "",
  } satisfies Row));
}

/** Evaluaciones de cumplimiento con revisión humana (§9.1.4). */
export async function getComplianceEvaluationRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.complianceEvaluation.findMany({
      where: { organizationId },
      orderBy: [{ evaluatedAt: "desc" }, { code: "asc" }],
      include: {
        obligation: { select: { code: true, title: true } },
        control: { select: { code: true } },
      },
    }),
  ]);
  return rows.map((row) => ({
    codigo: row.code,
    obligacion: row.obligation?.code ?? "",
    titulo_obligacion: row.obligation?.title ?? "",
    control: row.control?.code ?? "",
    alcance: row.scope,
    metodo: row.method,
    periodo: row.period,
    resultado: row.result,
    puntaje: row.score ?? "",
    hallazgos: row.findings ?? "",
    brechas: row.gapsIdentified ?? "",
    recomendacion: row.recommendation ?? "",
    evaluador: row.evaluatedById ? names.get(row.evaluatedById) ?? "" : "",
    evaluado_el: date(row.evaluatedAt),
    estado_revision: row.reviewStatus,
    revisor: row.reviewerId ? names.get(row.reviewerId) ?? "" : "",
    revisado_el: date(row.reviewedAt),
    nota_decision: row.decisionNote ?? "",
  } satisfies Row));
}

/** Calendario de obligaciones con estado calculado y alertas (§8.1). */
export async function getComplianceCalendarRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.complianceCalendar.findMany({
      where: { organizationId },
      orderBy: { dueDate: "asc" },
      include: {
        obligation: { select: { code: true } },
        jurisdiction: { select: { code: true } },
      },
    }),
  ]);
  const today = new Date();
  return rows.map((row) => {
    const state = calendarState({
      dueDate: row.dueDate,
      leadTimeDays: row.leadTimeDays,
      completedAt: row.completedAt,
      cancelled: row.status === "CANCELLED",
      today,
    });
    return {
      codigo: row.code,
      vencimiento: row.title,
      obligacion: row.obligation?.code ?? "",
      jurisdiccion: row.jurisdiction?.code ?? "",
      autoridad: row.authority ?? "",
      fecha: date(row.dueDate),
      recurrencia: row.recurrence,
      aviso_previo_dias: row.leadTimeDays,
      criticidad: row.criticality,
      responsable: row.responsibleId ? names.get(row.responsibleId) ?? "" : "",
      estado: state.status,
      dias_restantes: state.daysRemaining,
      dias_retraso: state.overdueDays,
      alerta: YES(state.alertDue),
      alerta_enviada: YES(Boolean(row.alertSentAt)),
      cumplido_el: date(row.completedAt),
      referencia_presentacion: row.submissionReference ?? "",
    } satisfies Row;
  });
}

/**
 * Canal de denuncias — solo agregados.
 *
 * Nunca exporta código de caso, relato, informado, señalado ni evidencia.
 * Un informe al consejo o a un auditor no debe poder reconstruir un expediente.
 */
export async function getComplianceSpeakUpRows(organizationId: string): Promise<Row[]> {
  const today = new Date();
  const cases = await prisma.speakUpReport.findMany({
    where: { organizationId },
    select: {
      category: true,
      status: true,
      outcome: true,
      severity: true,
      identificationMode: true,
      acknowledgementDueAt: true,
      acknowledgedAt: true,
      feedbackDueAt: true,
      feedbackProvidedAt: true,
      closedAt: true,
      retentionUntil: true,
      purgedAt: true,
      retaliationRisk: true,
    },
  });

  type Bucket = {
    category: string;
    status: string;
    mode: string;
    severity: string;
    outcome: string;
    count: number;
    anonymous: number;
    ack_overdue: number;
    feedback_overdue: number;
    retaliation_flagged: number;
    purged: number;
  };
  const map = new Map<string, Bucket>();
  for (const row of cases) {
    const key = [row.category, row.status, row.identificationMode, row.severity, row.outcome ?? "OPEN"].join("|");
    const current = map.get(key) ?? {
      category: row.category,
      status: row.status,
      mode: row.identificationMode,
      severity: row.severity,
      outcome: row.outcome ?? "",
      count: 0,
      anonymous: 0,
      ack_overdue: 0,
      feedback_overdue: 0,
      retaliation_flagged: 0,
      purged: 0,
    };
    const overdue = deadlineBreaches(row, today);
    current.count += 1;
    if (row.identificationMode === "ANONYMOUS") current.anonymous += 1;
    if (overdue.acknowledgementOverdue) current.ack_overdue += 1;
    if (overdue.feedbackOverdue) current.feedback_overdue += 1;
    if (row.retaliationRisk) current.retaliation_flagged += 1;
    if (row.purgedAt) current.purged += 1;
    map.set(key, current);
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    .map((row) => ({
      categoria: row.category,
      estado: row.status,
      modo_identificacion: row.mode,
      severidad: row.severity,
      resultado: row.outcome,
      casos: row.count,
      anonimos: row.anonymous,
      acuses_fuera_plazo: row.ack_overdue,
      respuestas_fuera_plazo: row.feedback_overdue,
      riesgo_represalia_senalado: row.retaliation_flagged,
      purgados: row.purged,
    } satisfies Row));
}

/**
 * Investigaciones — metadatos operativos sin identidades de informante ni
 * señalado. El instructor aparece solo como id interno vacío en el export
 * público del módulo (nombre sí, porque es personal de compliance, no el
 * denunciante).
 */
export async function getComplianceInvestigationRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.investigation.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
      include: {
        report: { select: { code: true, category: true, status: true } },
        breach: { select: { code: true } },
      },
    }),
  ]);
  return rows.map((row) => ({
    codigo: row.code,
    titulo: row.title,
    caso_canal: row.report?.code ?? "",
    categoria_caso: row.report?.category ?? "",
    estado_caso: row.report?.status ?? "",
    incumplimiento: row.breach?.code ?? "",
    instructor: row.leadInvestigatorId ? names.get(row.leadInvestigatorId) ?? "" : "",
    reasignado_a: row.reassignedToId ? names.get(row.reassignedToId) ?? "" : "",
    independencia_confirmada: YES(row.independenceConfirmed),
    conflicto_comprobado: YES(row.conflictChecked),
    conflicto_detectado: YES(row.conflictDetected),
    estado: row.status,
    confidencialidad: row.confidentiality,
    iniciado_el: date(row.startedAt),
    vence: date(row.dueDate),
    concluido_el: date(row.concludedAt),
    // Hallazgos y conclusión sí: son el producto de la investigación, no la identidad del informante.
    tiene_hallazgos: YES(Boolean(row.findings)),
    tiene_conclusion: YES(Boolean(row.conclusion)),
  } satisfies Row));
}

/** Incumplimientos con notificación a la autoridad y exposición (§10.2). */
export async function getComplianceBreachRows(organizationId: string): Promise<Row[]> {
  const today = new Date();
  const rows = await prisma.complianceBreach.findMany({
    where: { organizationId },
    orderBy: { detectedAt: "desc" },
    include: {
      obligation: { select: { code: true, title: true } },
      _count: { select: { investigations: true, remediationPlans: true } },
    },
  });
  return rows.map((row) => ({
    codigo: row.code,
    incumplimiento: row.title,
    obligacion: row.obligation?.code ?? "",
    titulo_obligacion: row.obligation?.title ?? "",
    fuente_deteccion: row.detectionSource,
    severidad: row.severity,
    estado: row.status,
    detectado_el: date(row.detectedAt),
    causa_raiz: row.rootCause ?? "",
    recurrente: YES(row.recurrence),
    exposicion_financiera: row.financialExposure ?? "",
    sancion_impuesta: YES(row.sanctionImposed),
    importe_sancion: row.sanctionAmount ?? "",
    notificacion_requerida: YES(row.notificationRequired),
    plazo_notificacion: date(row.notificationDeadline),
    notificado_el: date(row.authorityNotifiedAt),
    notificacion_fuera_plazo: YES(notificationOverdue(row, today)),
    cerrado_el: date(row.closedAt),
    investigaciones: row._count.investigations,
    planes_remediacion: row._count.remediationPlans,
  } satisfies Row));
}

/** Planes de remediación con avance y verificación de eficacia (§10.2). */
export async function getComplianceRemediationRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.remediationPlan.findMany({
      where: { organizationId },
      orderBy: [{ dueDate: "asc" }, { code: "asc" }],
      include: { breach: { select: { code: true, title: true } } },
    }),
  ]);
  const today = new Date();
  return rows.map((row) => ({
    codigo: row.code,
    plan: row.title,
    incumplimiento: row.breach?.code ?? "",
    titulo_incumplimiento: row.breach?.title ?? "",
    responsable: row.ownerId ? names.get(row.ownerId) ?? "" : "",
    inicio: date(row.startDate),
    vence: date(row.dueDate),
    avance_pct: row.progressPercent,
    estado: row.status,
    estado_efectivo: effectiveStatus(row, today),
    aprobado_por: row.approvedById ? names.get(row.approvedById) ?? "" : "",
    aprobado_el: date(row.approvedAt),
    completado_el: date(row.completedAt),
    eficacia_verificada: YES(row.effectivenessVerified),
    verificado_por: row.effectivenessVerifiedById ? names.get(row.effectivenessVerifiedById) ?? "" : "",
    verificado_el: date(row.effectivenessVerifiedAt),
    coste: row.cost ?? "",
  } satisfies Row));
}

/**
 * Revisión de dirección / informe al órgano de gobierno (§5.1.2, §9.3).
 * El canal entra solo como agregados ya despersonalizados.
 */
export async function getComplianceManagementReviewRows(organizationId: string): Promise<Row[]> {
  const [names, obligations, risks, evaluations, calendar, cases, investigations, breaches, plans, trainings, reports] =
    await Promise.all([
      userNames(organizationId),
      prisma.complianceObligation.findMany({
        where: { organizationId },
        select: { complianceStatus: true, criticality: true },
      }),
      prisma.complianceRisk.findMany({
        where: { organizationId },
        select: { residualLevel: true, acceptability: true },
      }),
      prisma.complianceEvaluation.findMany({
        where: { organizationId },
        select: { result: true, reviewStatus: true },
      }),
      prisma.complianceCalendar.findMany({
        where: { organizationId },
        select: { dueDate: true, leadTimeDays: true, completedAt: true, status: true },
      }),
      prisma.speakUpReport.findMany({
        where: { organizationId },
        select: {
          category: true,
          status: true,
          outcome: true,
          identificationMode: true,
          acknowledgementDueAt: true,
          acknowledgedAt: true,
          feedbackDueAt: true,
          feedbackProvidedAt: true,
        },
      }),
      prisma.investigation.findMany({
        where: { organizationId },
        select: { status: true, conflictDetected: true },
      }),
      prisma.complianceBreach.findMany({
        where: { organizationId },
        select: { status: true, severity: true, sanctionAmount: true },
      }),
      prisma.remediationPlan.findMany({
        where: { organizationId },
        select: {
          status: true,
          dueDate: true,
          completedAt: true,
          progressPercent: true,
          effectivenessVerified: true,
        },
      }),
      prisma.complianceTraining.findMany({
        where: { organizationId },
        select: { targetCount: true, completedCount: true, mandatory: true },
      }),
      prisma.governingBodyReport.findMany({
        where: { organizationId },
        orderBy: [{ period: "desc" }, { code: "asc" }],
      }),
    ]);

  const today = new Date();
  const calendarStates = calendar.map((row) =>
    calendarState({
      dueDate: row.dueDate,
      leadTimeDays: row.leadTimeDays,
      completedAt: row.completedAt,
      cancelled: row.status === "CANCELLED",
      today,
    }),
  );
  const overdue = calendarStates.filter((s) => s.status === "OVERDUE").length;
  const dueSoon = calendarStates.filter((s) => s.status === "DUE_SOON").length;
  const completed = calendar.filter((row) => row.completedAt);
  const onTime = completed.filter((row) => row.completedAt && row.completedAt.getTime() <= row.dueDate.getTime());

  const digest = buildGoverningBodyDigest({
    obligations,
    risks,
    evaluations,
    calendar: {
      overdue,
      dueSoon,
      onTimeRate: completed.length === 0 ? null : Math.round((onTime.length / completed.length) * 100),
    },
    cases: cases.map((row) => {
      const overdueDeadlines = deadlineBreaches(row, today);
      return {
        category: row.category,
        status: row.status,
        outcome: row.outcome,
        anonymous: row.identificationMode === "ANONYMOUS",
        acknowledgementOverdue: overdueDeadlines.acknowledgementOverdue,
        feedbackOverdue: overdueDeadlines.feedbackOverdue,
      };
    }),
    investigations,
    breaches,
    remediation: {
      completed: plans.filter((row) => effectiveStatus(row, today) === "COMPLETED").length,
      overdue: plans.filter((row) => effectiveStatus(row, today) === "OVERDUE").length,
      completedNotVerified: plans.filter(
        (row) => effectiveStatus(row, today) === "COMPLETED" && !row.effectivenessVerified,
      ).length,
    },
    training: trainings,
  });

  const digestRows: Row[] = [
    {
      seccion: "resumen",
      indicador: "obligaciones_total",
      valor: digest.obligations.total,
      detalle: "",
    },
    {
      seccion: "resumen",
      indicador: "obligaciones_no_cumplen",
      valor: digest.obligations.nonCompliant,
      detalle: "",
    },
    {
      seccion: "resumen",
      indicador: "obligaciones_sin_evaluar",
      valor: digest.obligations.notEvaluated,
      detalle: "",
    },
    {
      seccion: "resumen",
      indicador: "riesgos_alto_o_critico",
      valor: digest.risks.highOrCritical,
      detalle: "",
    },
    {
      seccion: "resumen",
      indicador: "riesgos_no_aceptables",
      valor: digest.risks.notAcceptable,
      detalle: "",
    },
    {
      seccion: "resumen",
      indicador: "evaluaciones_pendientes_revision",
      valor: digest.evaluations.pendingReview,
      detalle: "",
    },
    {
      seccion: "resumen",
      indicador: "calendario_vencidos",
      valor: digest.calendar.overdue,
      detalle: "",
    },
    {
      seccion: "resumen",
      indicador: "canal_casos",
      valor: digest.speakUp.total,
      detalle: `abiertos=${digest.speakUp.open}; anonimos=${digest.speakUp.anonymous}; fundados=${digest.speakUp.substantiated}`,
    },
    {
      seccion: "resumen",
      indicador: "canal_plazos_incumplidos",
      valor: digest.speakUp.overdueAcknowledgement + digest.speakUp.overdueFeedback,
      detalle: `acuses=${digest.speakUp.overdueAcknowledgement}; respuestas=${digest.speakUp.overdueFeedback}`,
    },
    {
      seccion: "resumen",
      indicador: "investigaciones_con_conflicto",
      valor: digest.investigations.withConflict,
      detalle: "",
    },
    {
      seccion: "resumen",
      indicador: "incumplimientos_abiertos",
      valor: digest.breaches.open,
      detalle: `graves=${digest.breaches.severe}; sanciones=${digest.breaches.sanctions}`,
    },
    {
      seccion: "resumen",
      indicador: "remediacion_sin_verificar",
      valor: digest.remediation.completedNotVerified,
      detalle: "",
    },
    {
      seccion: "resumen",
      indicador: "formacion_cobertura_pct",
      valor: digest.training.coverageRate ?? "",
      detalle: `obligatorias=${digest.training.mandatory}`,
    },
    ...digest.escalations.map((item, index) => ({
      seccion: "escalaciones",
      indicador: `escalacion_${index + 1}`,
      valor: item,
      detalle: "",
    } satisfies Row)),
    ...digest.speakUp.byCategory.map((row) => ({
      seccion: "canal_por_categoria",
      indicador: row.category,
      valor: row.count,
      detalle: "",
    } satisfies Row)),
  ];

  const reportRows: Row[] = reports.map((row) => ({
    seccion: "informe",
    indicador: row.code,
    valor: row.reviewStatus,
    detalle: [
      `periodo=${row.period}`,
      `presentado_a=${row.presentedTo}`,
      `preparado_por=${row.preparedById ? names.get(row.preparedById) ?? "" : ""}`,
      `enviado=${date(row.submittedAt)}`,
      `presentado=${date(row.presentedAt)}`,
      `acuse=${date(row.acknowledgedAt)}`,
      `acusado_por=${row.acknowledgedById ? names.get(row.acknowledgedById) ?? "" : ""}`,
      `cobertura_formacion=${trainings.map((t) => trainingCoverage(t)).filter((c): c is number => c !== null).join("|")}`,
      // El resumen del canal ya es agregado en el propio informe.
      `resumen_canal=${row.speakUpSummary ?? ""}`,
      `decisiones_solicitadas=${row.decisionsRequested ?? ""}`,
      `decisiones_tomadas=${row.decisionsTaken ?? ""}`,
    ].join("; "),
  }));

  return [...digestRows, ...reportRows];
}
