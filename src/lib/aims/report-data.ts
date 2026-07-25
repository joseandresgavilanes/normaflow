import "server-only";
import { prisma } from "@/lib/prisma";
import { classifySystem, missingHighRiskSafeguards } from "@/lib/aims/classification";
import { biasFlags } from "@/lib/aims/data-quality";
import { buildLineageChain } from "@/lib/aims/lineage";
import { humanReviewIntegrity } from "@/lib/aims/human-review";

type Row = Record<string, string | number | boolean | null>;

const YES = (value: boolean) => (value ? "SI" : "NO");
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? "";

async function userNames(organizationId: string): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } });
  return new Map(users.map((user) => [user.id, user.name]));
}

/** Inventario de sistemas de IA con clasificación y salvaguardas pendientes (§4.3, §A.6.2). */
export async function getAISystemInventoryRows(organizationId: string): Promise<Row[]> {
  const [names, systems, passedModels] = await Promise.all([
    userNames(organizationId),
    prisma.aISystem.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
      include: {
        useCases: { select: { title: true, decisionAutonomy: true, affectedCount: true } },
        impactAssessments: { where: { reviewStatus: "APPROVED" }, orderBy: { assessedAt: "desc" }, take: 1, select: { code: true, classification: true, overallSeverity: true, reviewedAt: true } },
        oversightControls: { where: { active: true }, select: { id: true } },
        transparency: { select: { id: true } },
        _count: { select: { risks: true, incidents: true, modelVersions: true, metrics: true } },
      },
    }),
    prisma.modelVersion.findMany({ where: { organizationId, evaluations: { some: { outcome: { in: ["PASSED", "PASSED_WITH_CONDITIONS"] } } } }, select: { systemId: true } }),
  ]);
  const evaluated = new Set(passedModels.map((model) => model.systemId));

  return systems.map((system) => {
    const assessment = system.impactAssessments[0] ?? null;
    const classification = classifySystem(system.criticality, assessment?.classification ?? system.classification);
    const missing = missingHighRiskSafeguards({
      classification,
      hasApprovedImpactAssessment: Boolean(assessment),
      hasOversightControl: system.oversightControls.length > 0,
      hasPassedEvaluation: evaluated.has(system.id),
      hasTransparencyRecord: system.transparency.length > 0,
    });
    return {
      codigo: system.code, sistema: system.name, propietario: system.ownerId ? names.get(system.ownerId) ?? "" : "",
      proveedor: system.provider ?? "", tipo_proveedor: system.providerType, proposito: system.purpose,
      usuarios: system.users ?? "", colectivos_afectados: system.affectedGroups ?? "", contexto: system.context ?? "",
      casos_uso: system.useCases.length, criticidad: system.criticality, clasificacion_riesgo: classification,
      autonomia: system.autonomy, estado: system.status,
      evaluacion_impacto: assessment?.code ?? "", severidad_impacto: assessment?.overallSeverity ?? "",
      aprobado_el: date(system.approvedAt), desplegado_el: date(system.deployedAt),
      retirado_el: date(system.retiredAt), motivo_retiro: system.retirementReason ?? "",
      riesgos: system._count.risks, incidentes: system._count.incidents, modelos: system._count.modelVersions,
      controles_supervision: system.oversightControls.length, registros_transparencia: system.transparency.length,
      mediciones_monitoreo: system._count.metrics,
      salvaguardas_faltantes: missing.join(", "), conforme: YES(missing.length === 0),
      proxima_revision: date(system.nextReviewDate),
    } satisfies Row;
  });
}

/** Evaluación de impacto: las siete dimensiones y la decisión humana (§6.1.4, §A.5.2). */
export async function getAIImpactAssessmentRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.aIImpactAssessment.findMany({
      where: { organizationId },
      orderBy: [{ code: "asc" }, { version: "desc" }],
      include: { system: { select: { code: true, name: true } } },
    }),
  ]);
  return rows.map((row) => ({
    codigo: row.code, version: row.version, sistema: row.system.code, nombre_sistema: row.system.name,
    metodologia: row.methodology ?? "",
    derechos: row.rightsImpact, derechos_nota: row.rightsNote ?? "",
    seguridad: row.safetyImpact, seguridad_nota: row.safetyNote ?? "",
    privacidad: row.privacyImpact, privacidad_nota: row.privacyNote ?? "",
    sesgo: row.biasImpact, sesgo_nota: row.biasNote ?? "",
    transparencia: row.transparencyImpact, transparencia_nota: row.transparencyNote ?? "",
    explicabilidad: row.explainabilityImpact, explicabilidad_nota: row.explainabilityNote ?? "",
    supervision_humana: row.oversightImpact, supervision_nota: row.oversightNote ?? "",
    puntaje_agregado: row.overallScore ?? "", severidad_agregada: row.overallSeverity, clasificacion: row.classification,
    salvaguardas: row.safeguards ?? "", impacto_residual: row.residualImpact ?? "",
    evaluador: row.assessorId ? names.get(row.assessorId) ?? "" : "", evaluado_el: date(row.assessedAt),
    estado_revision: row.reviewStatus, enviado_el: date(row.submittedAt),
    revisor: row.reviewerId ? names.get(row.reviewerId) ?? "" : "", decidido_el: date(row.reviewedAt),
    nota_decision: row.decisionNote ?? "", proxima_revision: date(row.nextReviewDate),
  } satisfies Row));
}

/** Riesgos de IA valorados y tratados (§6.1.2, §6.1.3). */
export async function getAIRiskRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.aIRisk.findMany({ where: { organizationId }, orderBy: [{ residualScore: "desc" }, { code: "asc" }], include: { system: { select: { code: true } } } }),
  ]);
  return rows.map((row) => ({
    codigo: row.code, sistema: row.system?.code ?? "", riesgo: row.title, categoria: row.category,
    fuente: row.source ?? "", descripcion: row.description ?? "", partes_afectadas: row.affectedParties ?? "",
    probabilidad: row.likelihood, impacto: row.impact, riesgo_inherente: row.inherentScore ?? "", nivel_inherente: row.inherentLevel,
    controles_existentes: row.existingControls ?? "", eficacia_control: row.controlEffectiveness ?? "",
    riesgo_residual: row.residualScore ?? "", nivel_residual: row.residualLevel, aceptabilidad: row.acceptability,
    tratamiento: row.treatment, plan_tratamiento: row.treatmentPlan ?? "",
    propietario: row.ownerId ? names.get(row.ownerId) ?? "" : "", vencimiento: date(row.dueDate),
    estado: row.status, aceptado_por: row.acceptedById ? names.get(row.acceptedById) ?? "" : "",
    aceptado_el: date(row.acceptedAt), justificacion_aceptacion: row.acceptanceRationale ?? "",
  } satisfies Row));
}

/** Datasets con procedencia, calidad, sesgo y privacidad (§A.7). */
export async function getAIDatasetRows(organizationId: string): Promise<Row[]> {
  const [names, datasets] = await Promise.all([
    userNames(organizationId),
    prisma.dataset.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
      include: {
        sources: { select: { name: true, type: true, license: true, licenseVerified: true, legalBasis: true } },
        lineage: { select: { step: true, operation: true, description: true, performedAt: true }, orderBy: { step: "asc" } },
        trainedModels: { select: { code: true } },
      },
    }),
  ]);
  return datasets.map((dataset) => {
    const chain = buildLineageChain(dataset.lineage, dataset.sources.length);
    return {
      codigo: dataset.code, dataset: dataset.name, proposito: dataset.purpose ?? "",
      propietario: dataset.ownerId ? names.get(dataset.ownerId) ?? "" : "",
      custodio: dataset.stewardId ? names.get(dataset.stewardId) ?? "" : "",
      clasificacion: dataset.classification,
      datos_personales: YES(dataset.containsPersonalData), categorias_datos: dataset.personalDataCategories ?? "",
      categorias_especiales: YES(dataset.containsSpecialCategories), base_legal: dataset.legalBasis,
      anonimizacion: dataset.anonymization ?? "", registros: dataset.recordCount ?? "", variables: dataset.featureCount ?? "",
      periodo: dataset.periodCovered ?? "",
      completitud: dataset.completeness ?? "", exactitud: dataset.accuracy ?? "", consistencia: dataset.consistency ?? "",
      actualidad: dataset.timeliness ?? "", representatividad: dataset.representativeness ?? "",
      puntaje_calidad: dataset.qualityScore ?? "", nivel_calidad: dataset.qualityLevel,
      sesgo_revisado: YES(dataset.biasReviewed), hallazgos_sesgo: dataset.biasFindings ?? "",
      grupos_subrepresentados: dataset.underrepresentedGroups ?? "",
      senales_sesgo: biasFlags({
        representativeness: dataset.representativeness, biasReviewed: dataset.biasReviewed,
        underrepresentedGroups: dataset.underrepresentedGroups, containsPersonalData: dataset.containsPersonalData,
        containsSpecialCategories: dataset.containsSpecialCategories,
      }).join(", "),
      fuentes: dataset.sources.map((source) => `${source.name} (${source.type})`).join(" | "),
      licencias_verificadas: YES(dataset.sources.every((source) => source.licenseVerified)),
      pasos_procedencia: chain.steps.length,
      procedencia_trazable: YES(chain.traceable), brechas_procedencia: chain.gaps.join("; "),
      operaciones_irreversibles: chain.irreversibleOperations.join(", "),
      modelos_entrenados: dataset.trainedModels.map((model) => model.code).join(", "),
      retencion_meses: dataset.retentionMonths ?? "", ubicacion: dataset.storageLocation ?? "",
    } satisfies Row;
  });
}

/** Modelos y su última evaluación: desempeño, sesgo y explicabilidad (§A.6.2.4). */
export async function getAIModelRows(organizationId: string): Promise<Row[]> {
  const [names, models] = await Promise.all([
    userNames(organizationId),
    prisma.modelVersion.findMany({
      where: { organizationId },
      orderBy: [{ modelName: "asc" }, { version: "desc" }],
      include: {
        system: { select: { code: true } },
        trainingDataset: { select: { code: true, qualityLevel: true, biasReviewed: true } },
        evaluations: { orderBy: { evaluatedAt: "desc" }, take: 1 },
      },
    }),
  ]);
  return models.map((model) => {
    const evaluation = model.evaluations[0] ?? null;
    return {
      codigo: model.code, sistema: model.system.code, modelo: model.modelName, version: model.version,
      algoritmo: model.algorithm ?? "", framework: model.framework ?? "", modelo_base: model.baseModel ?? "",
      proveedor: model.provider ?? "", dataset_entrenamiento: model.trainingDataset?.code ?? "",
      calidad_dataset: model.trainingDataset?.qualityLevel ?? "", sesgo_dataset_revisado: model.trainingDataset ? YES(model.trainingDataset.biasReviewed) : "",
      tecnica_explicabilidad: model.explainabilityMethod ?? "", nota_explicabilidad: model.explainabilityNote ?? "",
      limitaciones: model.limitations ?? "", uso_previsto: model.intendedUse ?? "", etapa: model.stage,
      estado_revision: model.reviewStatus, revisor: model.reviewerId ? names.get(model.reviewerId) ?? "" : "",
      decidido_el: date(model.reviewedAt), desplegado_el: date(model.deployedAt), retirado_el: date(model.retiredAt),
      evaluacion: evaluation?.code ?? "", resultado_evaluacion: evaluation?.outcome ?? "", evaluado_el: date(evaluation?.evaluatedAt),
      exactitud: evaluation?.accuracy ?? "", precision: evaluation?.precision ?? "", recall: evaluation?.recall ?? "",
      f1: evaluation?.f1Score ?? "", auc_roc: evaluation?.aucRoc ?? "", tasa_error: evaluation?.errorRate ?? "",
      metrica_equidad: evaluation?.fairnessMetric ?? "", puntaje_equidad: evaluation?.fairnessScore ?? "",
      sesgo_detectado: evaluation ? YES(evaluation.biasDetected) : "", grupos_sesgo: evaluation?.biasGroups ?? "",
      ratio_disparidad: evaluation?.disparityRatio ?? "", robustez: evaluation?.robustness ?? "",
      prueba_adversaria: evaluation ? YES(evaluation.adversarialTested) : "",
      explicabilidad_evaluada: evaluation ? YES(evaluation.explainabilityAssessed) : "",
      condiciones: evaluation?.conditions ?? "", hallazgos: evaluation?.findings ?? "",
    } satisfies Row;
  });
}

/** Controles de supervisión humana y su eficacia verificada (§A.9.2). */
export async function getAIControlRows(organizationId: string): Promise<Row[]> {
  const [names, controls] = await Promise.all([
    userNames(organizationId),
    prisma.humanOversightControl.findMany({ where: { organizationId }, orderBy: { code: "asc" }, include: { system: { select: { code: true, status: true } } } }),
  ]);
  return controls.map((control) => ({
    codigo: control.code, sistema: control.system.code, estado_sistema: control.system.status,
    control: control.name, tipo: control.type, descripcion: control.description ?? "",
    responsable: control.responsibleId ? names.get(control.responsibleId) ?? "" : "",
    competencia: control.competence ?? "", puede_anular: YES(control.canOverride), puede_detener: YES(control.canStop),
    escalamiento: control.escalationPath ?? "", frecuencia: control.frequency ?? "",
    eficacia: control.effectiveness ?? "", verificado_el: date(control.lastVerifiedAt),
    proxima_revision: date(control.nextReviewDate), activo: YES(control.active),
  } satisfies Row));
}

/** Incidentes de IA con investigación, notificación y cierre (§A.10.4). */
export async function getAIIncidentRows(organizationId: string, range?: { gte: Date; lte: Date }): Promise<Row[]> {
  const [names, incidents] = await Promise.all([
    userNames(organizationId),
    prisma.aIIncident.findMany({
      where: { organizationId, ...(range ? { detectedAt: range } : {}) },
      orderBy: { detectedAt: "desc" },
      include: { system: { select: { code: true } } },
    }),
  ]);
  return incidents.map((incident) => ({
    codigo: incident.code, sistema: incident.system?.code ?? "", tipo: incident.type, severidad: incident.severity,
    titulo: incident.title, descripcion: incident.description ?? "",
    detectado_el: date(incident.detectedAt), ocurrido_el: date(incident.occurredAt), detectado_por: incident.detectedBy ?? "",
    reportante: incident.reporterId ? names.get(incident.reporterId) ?? "" : "",
    partes_afectadas: incident.affectedParties ?? "", numero_afectados: incident.affectedCount ?? "",
    dano: incident.harmDescription ?? "", contencion: incident.containment ?? "",
    investigacion: incident.investigation ?? "", metodo_causa: incident.rootCauseMethod ?? "", causa_raiz: incident.rootCause ?? "",
    acciones_correctivas: incident.correctiveActions ?? "",
    notificacion_requerida: YES(incident.notificationRequired), detalle_notificacion: incident.notificationDetails ?? "",
    notificado_el: date(incident.notifiedAt), estado: incident.status,
    responsable: incident.responsibleId ? names.get(incident.responsibleId) ?? "" : "",
    vencimiento: date(incident.dueDate), cerrado_el: date(incident.closedAt),
    lecciones_aprendidas: incident.lessonsLearned ?? "",
  } satisfies Row));
}

/** Transparencia hacia usuarios, personas afectadas y reguladores (§A.8). */
export async function getAITransparencyRows(organizationId: string): Promise<Row[]> {
  const [names, records] = await Promise.all([
    userNames(organizationId),
    prisma.aITransparencyRecord.findMany({ where: { organizationId }, orderBy: { code: "asc" }, include: { system: { select: { code: true, autonomy: true } } } }),
  ]);
  return records.map((record) => ({
    codigo: record.code, sistema: record.system.code, autonomia_sistema: record.system.autonomy,
    audiencia: record.audience, informacion: record.disclosure,
    declara_uso_ia: YES(record.aiUseDisclosed), declara_limitaciones: YES(record.limitationsDisclosed),
    declara_uso_datos: YES(record.dataUseDisclosed), ofrece_contacto_humano: YES(record.humanContactOffered),
    canal: record.channel ?? "", idioma: record.language ?? "", version: record.version,
    responsable: record.responsibleId ? names.get(record.responsibleId) ?? "" : "",
    publicado_el: date(record.publishedAt), proxima_revision: date(record.nextReviewDate),
  } satisfies Row));
}

/**
 * REGLA HUMANA — trazabilidad completa de cada salida de IA: prompt, modelo,
 * versión, salida, usuario, aprobación, fecha y cambios humanos. Es el informe
 * de auditoría que demuestra que ninguna salida llegó a registro oficial sola.
 */
export async function getAIHumanReviewRows(organizationId: string, range?: { gte: Date; lte: Date }): Promise<Row[]> {
  const [names, outputs] = await Promise.all([
    userNames(organizationId),
    prisma.aIGeneratedOutput.findMany({
      where: { organizationId, ...(range ? { generatedAt: range } : {}) },
      orderBy: { generatedAt: "desc" },
      include: { system: { select: { code: true } }, modelVersion: { select: { code: true } } },
    }),
  ]);
  return outputs.map((output) => {
    const integrity = humanReviewIntegrity(output);
    return {
      codigo: output.code, sistema: output.system?.code ?? "", version_modelo_registrada: output.modelVersion?.code ?? "",
      proposito: output.purpose ?? "", registro_destino: output.targetType,
      prompt: output.prompt, modelo: output.model, version: output.modelVersionLabel,
      parametros: output.parameters ? JSON.stringify(output.parameters) : "",
      salida: output.output, tokens: output.tokensUsed ?? "",
      solicitado_por: names.get(output.requestedById) ?? output.requestedById, generado_el: date(output.generatedAt),
      datos_personales: YES(output.containsPersonalData), anonimizado: YES(output.redacted),
      estado_revision: output.reviewStatus, enviado_el: date(output.submittedAt),
      aprobado_por: output.reviewerId ? names.get(output.reviewerId) ?? "" : "", fecha_decision: date(output.reviewedAt),
      nota_decision: output.decisionNote ?? "",
      editado: YES(output.edited), cambios_humanos: output.humanEdits ?? "", resumen_cambios: output.editSummary ?? "",
      editado_por: output.editedById ? names.get(output.editedById) ?? "" : "", editado_el: date(output.editedAt),
      promovido_a: output.promotedEntityType ?? "", registro_oficial: output.promotedEntityId ?? "",
      promovido_el: date(output.promotedAt),
      // Cualquier "NO" aquí es un incumplimiento de la regla humana.
      regla_humana_cumplida: YES(integrity.valid), incumplimientos: integrity.problems.join("; "),
    } satisfies Row;
  });
}
