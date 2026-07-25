"use server";

/**
 * Canal de denuncias (ISO 37301 §8.3, ISO 37002).
 *
 * Módulo de permisos propio, `speakup`, separado de `compliance`: tener el
 * programa de compliance a la vista no da acceso a un caso. Y el permiso tampoco
 * basta: **toda** mutación y toda lectura de un caso comprueba que exista una
 * concesión viva en `SpeakUpCaseAccess` (necesidad de conocer), incluso para
 * roles con comodín. La base de datos lo vuelve a exigir con una política RLS
 * restrictiva y con CHECK constraints.
 */

import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import {
  DEFAULT_CHANNEL_CONFIG,
  assertAdmissibilityDecision,
  assertClosure,
  assertIdentityConsistent,
  assertModeAllowed,
  assertPurgeable,
  assertStatusTransition,
  caseDeadlines,
  chooseHandler,
  identityForMode,
  retentionUntil,
  type ChannelConfig,
} from "@/lib/compliance/speak-up";
import {
  assertConclusion,
  assertIndependence,
  assertInvestigationTransition,
  assertRecusal,
  checkIndependence,
} from "@/lib/compliance/investigation";
import type { LiveAppContext } from "@/lib/app-context";
import type { InvestigationStatus, SpeakUpStatus } from "@prisma/client";

const MODULE = "speakup";
const revalidate = () => {
  revalidatePath("/app/compliance");
  revalidatePath("/app/activity");
};

async function safeNotify(input: Parameters<typeof notifyUser>[0]) {
  try { await notifyUser(input); } catch (e) { console.error("[speakup] notify failed:", e instanceof Error ? e.message : e); }
}

async function nextCode(prefix: string, count: Promise<number>) {
  return `${prefix}-${String((await count) + 1).padStart(4, "0")}`;
}

async function channelConfig(organizationId: string): Promise<ChannelConfig & { defaultHandlerId: string | null; alternateHandlerId: string | null; externalChannelUrl: string | null }> {
  const config = await prisma.speakUpChannelConfig.findUnique({ where: { organizationId } });
  return {
    allowAnonymous: config?.allowAnonymous ?? DEFAULT_CHANNEL_CONFIG.allowAnonymous,
    allowConfidential: config?.allowConfidential ?? DEFAULT_CHANNEL_CONFIG.allowConfidential,
    acknowledgementDays: config?.acknowledgementDays ?? DEFAULT_CHANNEL_CONFIG.acknowledgementDays,
    feedbackDays: config?.feedbackDays ?? DEFAULT_CHANNEL_CONFIG.feedbackDays,
    retentionMonths: config?.retentionMonths ?? DEFAULT_CHANNEL_CONFIG.retentionMonths,
    defaultHandlerId: config?.defaultHandlerId ?? null,
    alternateHandlerId: config?.alternateHandlerId ?? null,
    externalChannelUrl: config?.externalChannelUrl ?? null,
  };
}

/**
 * Necesidad de conocer, comprobada en servidor. Devuelve el caso solo si quien
 * llama tiene una concesión viva sobre él. No hay atajo por rol: un permiso dice
 * "puede gestionar casos del canal", no "puede gestionar este caso".
 */
async function requireCaseAccess(ctx: LiveAppContext, reportId: string, permission: string) {
  const [report, grant] = await Promise.all([
    prisma.speakUpReport.findFirst({ where: { id: reportId, organizationId: ctx.organization.id } }),
    prisma.speakUpCaseAccess.findFirst({
      where: { reportId, userId: ctx.user.id, revokedAt: null, organizationId: ctx.organization.id },
      select: { id: true, caseRole: true },
    }),
  ]);
  if (!report) throw new Error("Caso no encontrado.");
  if (!grant) {
    throw new Error("No tiene acceso autorizado a este caso del canal de denuncias.");
  }
  void permission;
  return { report, caseRole: grant.caseRole };
}

// ─────────────────────────────────────────────────────
// Configuración del canal
// ─────────────────────────────────────────────────────

const configSchema = z.object({
  allowAnonymous: z.boolean(),
  allowConfidential: z.boolean(),
  acknowledgementDays: z.number().int().min(1).max(30).default(7),
  feedbackDays: z.number().int().min(1).max(365).default(90),
  retentionMonths: z.number().int().min(1).max(240).default(60),
  defaultHandlerId: z.string().optional(),
  alternateHandlerId: z.string().optional(),
  externalChannelUrl: z.string().url().max(500).optional(),
  policyDocumentId: z.string().optional(),
  retaliationStatement: z.string().max(4000).optional(),
});

/**
 * Configura el canal. Habilitar el anonimato es una decisión de gobierno, no un
 * ajuste: exige `speakup:approve`, y mientras esté deshabilitado la propia base
 * de datos rechaza cualquier denuncia anónima.
 */
export async function configureSpeakUpChannel(input: z.infer<typeof configSchema>) {
  const ctx = await requirePermission("speakup:approve");
  const data = configSchema.parse(input);
  if (data.defaultHandlerId && data.defaultHandlerId === data.alternateHandlerId) {
    throw new Error("El receptor suplente debe ser una persona distinta del titular: si no, no hay suplencia.");
  }
  for (const [label, userId] of [["titular", data.defaultHandlerId], ["suplente", data.alternateHandlerId]] as const) {
    if (!userId) continue;
    const member = await prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId, active: true }, select: { id: true } });
    if (!member) throw new Error(`El receptor ${label} no es un miembro activo de la organización.`);
  }
  if (data.policyDocumentId) {
    const document = await prisma.document.findFirst({ where: tenantWhere(ctx, { id: data.policyDocumentId }), select: { id: true } });
    if (!document) throw new Error("La política del canal no pertenece a la organización.");
  }

  const payload = {
    allowAnonymous: data.allowAnonymous,
    allowConfidential: data.allowConfidential,
    acknowledgementDays: data.acknowledgementDays,
    feedbackDays: data.feedbackDays,
    retentionMonths: data.retentionMonths,
    defaultHandlerId: data.defaultHandlerId ?? null,
    alternateHandlerId: data.alternateHandlerId ?? null,
    externalChannelUrl: data.externalChannelUrl ?? null,
    policyDocumentId: data.policyDocumentId ?? null,
    retaliationStatement: data.retaliationStatement ?? null,
    updatedById: ctx.user.id,
  };
  const config = await prisma.speakUpChannelConfig.upsert({
    where: { organizationId: ctx.organization.id },
    create: tenantData(ctx, payload),
    update: payload,
  });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: config.id, after: { allowAnonymous: data.allowAnonymous, allowConfidential: data.allowConfidential, retentionMonths: data.retentionMonths }, extra: { event: "configure_speak_up_channel" } });
  revalidate();
  return { id: config.id };
}

// ─────────────────────────────────────────────────────
// Presentación de la denuncia
// ─────────────────────────────────────────────────────

const reportSchema = z.object({
  identificationMode: z.enum(["IDENTIFIED", "CONFIDENTIAL", "ANONYMOUS"]),
  intakeChannel: z.enum(["WEB_FORM", "EMAIL", "PHONE", "IN_PERSON", "POSTAL_MAIL", "LINE_MANAGER", "EXTERNAL_PROVIDER", "OTHER"]).default("WEB_FORM"),
  category: z.enum([
    "BRIBERY_CORRUPTION", "FRAUD", "THEFT", "HARASSMENT", "DISCRIMINATION", "RETALIATION", "OCCUPATIONAL_SAFETY",
    "ENVIRONMENTAL", "DATA_PRIVACY", "INFORMATION_SECURITY", "CONFLICT_OF_INTEREST", "ACCOUNTING_IRREGULARITY",
    "COMPETITION", "HUMAN_RIGHTS", "POLICY_VIOLATION", "OTHER",
  ]).default("OTHER"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  description: z.string().min(20).max(8000),
  allegedFacts: z.string().max(8000).optional(),
  occurredAt: z.string().datetime().optional(),
  location: z.string().max(300).optional(),
  subjectDescription: z.string().max(1000).optional(),
  subjectUserId: z.string().optional(),
  witnesses: z.string().max(2000).optional(),
  reporterName: z.string().max(200).optional(),
  reporterEmail: z.string().email().max(200).optional(),
  reporterPhone: z.string().max(60).optional(),
  reporterRelationship: z.enum(["EMPLOYEE", "FORMER_EMPLOYEE", "CONTRACTOR", "SUPPLIER", "CUSTOMER", "SHAREHOLDER", "EXTERNAL_THIRD_PARTY", "UNDISCLOSED"]).optional(),
  retaliationRisk: z.boolean().default(false),
});

/**
 * Presenta una denuncia. Puntos que no son negociables:
 *   - en modo anónimo la identidad se descarta **antes** de escribir, incluido el
 *     usuario autenticado: lo que no se guarda no se puede filtrar;
 *   - el caso se asigna al receptor designado salvo que esté señalado en la
 *     denuncia o sea quien la presenta, y entonces entra el suplente;
 *   - la asignación crea la única puerta de acceso al caso, y queda registrada.
 */
export async function submitSpeakUpReport(input: z.infer<typeof reportSchema>) {
  const ctx = await requirePermission("speakup:create");
  const data = reportSchema.parse(input);
  const config = await channelConfig(ctx.organization.id);
  assertModeAllowed(data.identificationMode, config);

  const identity = identityForMode(data.identificationMode, {
    reporterUserId: ctx.user.id,
    reporterName: data.reporterName ?? (data.identificationMode === "IDENTIFIED" ? ctx.user.name : null),
    reporterEmail: data.reporterEmail ?? null,
    reporterPhone: data.reporterPhone ?? null,
  });
  assertIdentityConsistent(data.identificationMode, identity);

  if (data.subjectUserId) {
    const subject = await prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId: data.subjectUserId }, select: { id: true } });
    if (!subject) throw new Error("La persona señalada no es miembro de la organización.");
  }

  // Receptores de reserva: la función de compliance de la organización. Si el
  // titular está señalado en el caso, el suplente o esta reserva lo recogen.
  const fallbackMembers = await prisma.membership.findMany({
    where: { organizationId: ctx.organization.id, active: true, role: { in: ["COMPLIANCE_MANAGER", "ORG_ADMIN", "OWNER"] } },
    select: { userId: true, role: true },
    orderBy: { role: "asc" },
  });
  const handler = chooseHandler({
    defaultHandlerId: config.defaultHandlerId,
    alternateHandlerId: config.alternateHandlerId,
    fallbackIds: fallbackMembers.map((member) => member.userId),
    subjectUserId: data.subjectUserId ?? null,
    reporterUserId: identity.reporterUserId,
  });
  if (!handler.handlerId) {
    throw new Error(
      config.externalChannelUrl
        ? `No hay ningún receptor interno sin conflicto para este caso. Use el canal externo: ${config.externalChannelUrl}`
        : "No hay ningún receptor interno sin conflicto para este caso. Configure un canal externo o un receptor suplente antes de presentar la denuncia.",
    );
  }

  const receivedAt = new Date();
  const deadlines = caseDeadlines(receivedAt, config);
  const code = await nextCode("DEN", prisma.speakUpReport.count({ where: { organizationId: ctx.organization.id } }));
  // Código de seguimiento: se entrega una vez y solo se guarda su hash, para que
  // un informante anónimo pueda preguntar por su caso sin identificarse.
  const followUpCode = randomBytes(9).toString("base64url");

  const created = await prisma.$transaction(async (tx) => {
    const report = await tx.speakUpReport.create({
      data: tenantData(ctx, {
        code,
        identificationMode: data.identificationMode,
        intakeChannel: data.intakeChannel,
        category: data.category,
        severity: data.severity,
        receivedAt,
        description: data.description,
        allegedFacts: data.allegedFacts ?? null,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
        location: data.location ?? null,
        subjectDescription: data.subjectDescription ?? null,
        subjectUserId: data.subjectUserId ?? null,
        witnesses: data.witnesses ?? null,
        ...identity,
        reporterRelationship: data.reporterRelationship ?? (data.identificationMode === "ANONYMOUS" ? "UNDISCLOSED" : null),
        followUpCodeHash: createHash("sha256").update(followUpCode).digest("hex"),
        retaliationRisk: data.retaliationRisk,
        status: "RECEIVED",
        acknowledgementDueAt: deadlines.acknowledgementDueAt,
        feedbackDueAt: deadlines.feedbackDueAt,
      }),
    });
    await tx.speakUpCaseAccess.create({
      data: tenantData(ctx, {
        reportId: report.id,
        userId: handler.handlerId!,
        caseRole: "TRIAGE",
        reason: `Asignación de recepción: ${handler.reason}`,
        grantedById: null,
      }),
    });
    return report;
  });

  // El registro de auditoría del canal es deliberadamente pobre: quién actuó y
  // sobre qué caso, nunca el contenido ni la identidad del informante.
  await logAuditEvent({
    ctx, action: "create", module: MODULE, recordId: created.id,
    after: { code, identificationMode: data.identificationMode, category: data.category, severity: data.severity },
    extra: { event: "submit_speak_up_report", handlerDiverted: handler.divertedFromDefault },
  });
  await safeNotify({
    organizationId: ctx.organization.id, userId: handler.handlerId,
    title: `Nueva denuncia en el canal: ${code}`,
    body: `Categoría ${data.category}, severidad ${data.severity}. Acuse de recibo antes del ${deadlines.acknowledgementDueAt.toISOString().slice(0, 10)}.`,
    type: "WARNING", link: "/app/compliance", idempotencyKey: `speakup:${created.id}:intake`,
  });
  revalidate();
  return {
    id: created.id,
    code,
    /** Se muestra una sola vez: no queda almacenado en claro en ningún sitio. */
    followUpCode,
    acknowledgementDueAt: deadlines.acknowledgementDueAt,
    handlerDiverted: handler.divertedFromDefault,
  };
}

/** Acusa recibo al informante: obligatorio antes de triar el caso. */
export async function acknowledgeSpeakUpReport(id: string, note?: string) {
  const ctx = await requirePermission("speakup:update");
  const { report } = await requireCaseAccess(ctx, id, "speakup:update");
  assertStatusTransition(report.status, "ACKNOWLEDGED");
  const acknowledgedAt = new Date();
  const late = Boolean(report.acknowledgementDueAt && acknowledgedAt > report.acknowledgementDueAt);
  await prisma.speakUpReport.update({ where: { id }, data: { status: "ACKNOWLEDGED", acknowledgedAt } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, before: { status: report.status }, after: { status: "ACKNOWLEDGED", late }, extra: { event: "acknowledge_speak_up_report", note } });
  if (report.reporterUserId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: report.reporterUserId, title: `Su denuncia ${report.code} fue recibida`, body: "El canal ha registrado su denuncia y está en gestión.", type: "INFO", link: "/app/compliance", idempotencyKey: `speakup:${id}:ack` });
  }
  revalidate();
  return { id, status: "ACKNOWLEDGED" as SpeakUpStatus, late };
}

export async function startSpeakUpTriage(id: string, note?: string) {
  const ctx = await requirePermission("speakup:update");
  const { report } = await requireCaseAccess(ctx, id, "speakup:update");
  assertStatusTransition(report.status, "UNDER_TRIAGE");
  await prisma.speakUpReport.update({ where: { id }, data: { status: "UNDER_TRIAGE" } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, before: { status: report.status }, after: { status: "UNDER_TRIAGE" }, extra: { event: "start_speak_up_triage", note } });
  revalidate();
  return { id, status: "UNDER_TRIAGE" as SpeakUpStatus };
}

/** Decide si el caso entra en el ámbito del canal. Se atribuye y se motiva. */
export async function decideAdmissibility(id: string, input: { admissible: boolean; rationale: string }) {
  const ctx = await requirePermission("speakup:approve");
  const { report } = await requireCaseAccess(ctx, id, "speakup:approve");
  const target: SpeakUpStatus = input.admissible ? "ADMISSIBLE" : "INADMISSIBLE";
  assertStatusTransition(report.status, target);
  assertAdmissibilityDecision({ decidedById: ctx.user.id, rationale: input.rationale });
  await prisma.speakUpReport.update({
    where: { id },
    data: { status: target, admissibilityById: ctx.user.id, admissibilityAt: new Date(), admissibilityRationale: input.rationale },
  });
  await logAuditEvent({ ctx, action: "approve", module: MODULE, recordId: id, before: { status: report.status }, after: { status: target }, extra: { event: "decide_admissibility" } });
  revalidate();
  return { id, status: target };
}

// ─────────────────────────────────────────────────────
// Asignación restringida
// ─────────────────────────────────────────────────────

const accessSchema = z.object({
  reportId: z.string().min(1),
  userId: z.string().min(1),
  caseRole: z.enum(["TRIAGE", "INVESTIGATOR", "REVIEWER", "LEGAL_COUNSEL", "DECISION_MAKER", "OBSERVER"]),
  reason: z.string().min(3).max(1000),
});

/**
 * Autoriza a una persona sobre un caso. Solo puede hacerlo quien ya está en el
 * caso —o cualquiera con `speakup:approve` si el caso se quedó sin nadie por
 * recusaciones—, nunca se autoriza a la persona señalada en la denuncia, y toda
 * concesión lleva la justificación de la necesidad de conocer.
 */
export async function grantCaseAccess(input: z.infer<typeof accessSchema>) {
  const ctx = await requirePermission("speakup:approve");
  const data = accessSchema.parse(input);
  const report = await prisma.speakUpReport.findFirst({ where: { id: data.reportId, organizationId: ctx.organization.id } });
  if (!report) throw new Error("Caso no encontrado.");
  if (report.status === "CLOSED") throw new Error("Un caso cerrado no admite nuevas autorizaciones de acceso.");

  const [myGrant, liveGrants] = await Promise.all([
    prisma.speakUpCaseAccess.findFirst({ where: { reportId: data.reportId, userId: ctx.user.id, revokedAt: null }, select: { id: true } }),
    prisma.speakUpCaseAccess.count({ where: { reportId: data.reportId, revokedAt: null } }),
  ]);
  if (!myGrant && liveGrants > 0) {
    throw new Error("Solo quien ya gestiona el caso puede autorizar a otra persona.");
  }
  if (data.userId === report.subjectUserId) {
    throw new Error("No se puede dar acceso al caso a la persona señalada en la denuncia.");
  }

  const member = await prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId: data.userId, active: true }, select: { id: true } });
  if (!member) throw new Error("Solo un miembro activo de la organización puede recibir acceso al caso.");

  // Un conflicto declarado con abstención obligatoria impide la asignación.
  const declarations = await prisma.conflictOfInterestDeclaration.findMany({
    where: { organizationId: ctx.organization.id, declarantId: data.userId, hasConflict: true, recusalRequired: true },
    select: { declarantId: true, hasConflict: true, recusalRequired: true, reviewStatus: true, relatedParty: true },
  });
  if (data.caseRole === "INVESTIGATOR" || data.caseRole === "DECISION_MAKER") {
    assertIndependence({
      investigatorId: data.userId,
      subjectUserId: report.subjectUserId,
      reporterUserId: report.reporterUserId,
      declarations,
    });
  }

  const access = await prisma.speakUpCaseAccess.upsert({
    where: { reportId_userId_caseRole: { reportId: data.reportId, userId: data.userId, caseRole: data.caseRole } },
    create: tenantData(ctx, { reportId: data.reportId, userId: data.userId, caseRole: data.caseRole, reason: data.reason, grantedById: ctx.user.id }),
    update: { reason: data.reason, grantedById: ctx.user.id, grantedAt: new Date(), revokedAt: null, revokedReason: null },
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: access.id, after: { case: report.code, caseRole: data.caseRole, grantedTo: data.userId }, extra: { event: "grant_case_access", reason: data.reason } });
  await safeNotify({ organizationId: ctx.organization.id, userId: data.userId, title: `Acceso autorizado al caso ${report.code}`, body: `Se le ha autorizado como ${data.caseRole} en un caso del canal de denuncias.`, type: "INFO", link: "/app/compliance", idempotencyKey: `speakup-access:${access.id}` });
  revalidate();
  return { id: access.id };
}

/** Revoca un acceso. Siempre con motivo: la recusación es el caso típico. */
export async function revokeCaseAccess(id: string, input: { reason: string }) {
  const ctx = await requirePermission("speakup:approve");
  const reason = z.string().min(3).max(1000).parse(input.reason);
  const access = await prisma.speakUpCaseAccess.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { report: { select: { code: true } } } });
  if (!access) throw new Error("Autorización no encontrada.");
  if (access.revokedAt) throw new Error("La autorización ya estaba revocada.");
  await prisma.speakUpCaseAccess.update({ where: { id }, data: { revokedAt: new Date(), revokedReason: reason } });
  await logAuditEvent({ ctx, action: "delete", module: MODULE, recordId: id, before: { case: access.report.code, caseRole: access.caseRole, userId: access.userId }, after: { revoked: true }, extra: { event: "revoke_case_access", reason } });
  revalidate();
  return { id, revoked: true };
}

// ─────────────────────────────────────────────────────
// Evidencia protegida
// ─────────────────────────────────────────────────────

const evidenceSchema = z.object({
  reportId: z.string().min(1),
  investigationId: z.string().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  fileUrl: z.string().max(1000).optional(),
  mimeType: z.string().max(120).optional(),
  fileSize: z.number().int().min(0).optional(),
  sha256: z.string().length(64).optional(),
  custodyNotes: z.string().max(2000).optional(),
});

/**
 * Registra evidencia protegida del caso. No pasa por el repositorio general de
 * evidencias a propósito: quien tiene `evidence:read` no debe poder llegar a la
 * prueba de una denuncia. El hash y la cadena de custodia se guardan aquí mismo.
 */
export async function addProtectedEvidence(input: z.infer<typeof evidenceSchema>) {
  const ctx = await requirePermission("speakup:update");
  const data = evidenceSchema.parse(input);
  const { report } = await requireCaseAccess(ctx, data.reportId, "speakup:update");
  if (report.purgedAt) throw new Error("Un caso purgado no admite nueva evidencia.");
  if (data.investigationId) {
    const investigation = await prisma.investigation.findFirst({ where: { id: data.investigationId, organizationId: ctx.organization.id, reportId: data.reportId }, select: { id: true } });
    if (!investigation) throw new Error("La investigación no corresponde a este caso.");
  }
  const code = await nextCode("EVD", prisma.speakUpEvidence.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.speakUpEvidence.create({
    data: tenantData(ctx, {
      reportId: data.reportId, investigationId: data.investigationId ?? null, code, title: data.title,
      description: data.description ?? null, fileUrl: data.fileUrl ?? null, mimeType: data.mimeType ?? null,
      fileSize: data.fileSize ?? null, sha256: data.sha256 ?? null, collectedById: ctx.user.id,
      collectedAt: new Date(), custodyNotes: data.custodyNotes ?? null, sealed: true,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { case: report.code, code, sha256: data.sha256 ?? null }, extra: { event: "add_protected_evidence" } });
  revalidate();
  return { id: created.id, code };
}

// ─────────────────────────────────────────────────────
// Investigación
// ─────────────────────────────────────────────────────

const investigationSchema = z.object({
  reportId: z.string().optional(),
  breachId: z.string().optional(),
  title: z.string().min(1).max(300),
  scope: z.string().max(4000).optional(),
  plan: z.string().max(8000).optional(),
  leadInvestigatorId: z.string().min(1),
  teamDescription: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
  confidentiality: z.enum(["INTERNAL", "RESTRICTED", "CONFIDENTIAL", "STRICTLY_CONFIDENTIAL"]).default("RESTRICTED"),
});

/**
 * Abre una investigación. Si viene de una denuncia se exige acceso al caso y se
 * comprueba la independencia del investigador contra la persona señalada y contra
 * sus declaraciones de conflicto; además se le autoriza el acceso al caso en la
 * misma transacción, porque investigar sin acceso no es posible.
 */
export async function openInvestigation(input: z.infer<typeof investigationSchema>) {
  const data = investigationSchema.parse(input);
  if (!data.reportId && !data.breachId) {
    throw new Error("Una investigación debe partir de una denuncia o de un incumplimiento.");
  }
  const ctx = await requirePermission(data.reportId ? "speakup:update" : "compliance:create");

  let subjectUserId: string | null = null;
  let reporterUserId: string | null = null;
  let caseCode: string | null = null;
  if (data.reportId) {
    const { report } = await requireCaseAccess(ctx, data.reportId, "speakup:update");
    if (report.status !== "ADMISSIBLE" && report.status !== "UNDER_INVESTIGATION") {
      throw new Error("Solo un caso admitido puede pasar a investigación.");
    }
    subjectUserId = report.subjectUserId;
    reporterUserId = report.reporterUserId;
    caseCode = report.code;
  }
  if (data.breachId) {
    const breach = await prisma.complianceBreach.findFirst({ where: { id: data.breachId, organizationId: ctx.organization.id }, select: { id: true } });
    if (!breach) throw new Error("El incumplimiento no pertenece a la organización.");
  }

  const declarations = await prisma.conflictOfInterestDeclaration.findMany({
    where: { organizationId: ctx.organization.id, declarantId: data.leadInvestigatorId, hasConflict: true, recusalRequired: true },
    select: { declarantId: true, hasConflict: true, recusalRequired: true, reviewStatus: true, relatedParty: true },
  });
  assertIndependence({ investigatorId: data.leadInvestigatorId, subjectUserId, reporterUserId, declarations });

  const member = await prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId: data.leadInvestigatorId, active: true }, select: { id: true } });
  if (!member) throw new Error("El investigador principal no es un miembro activo de la organización.");

  const code = await nextCode("INV", prisma.investigation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const investigation = await tx.investigation.create({
      data: tenantData(ctx, {
        code, reportId: data.reportId ?? null, breachId: data.breachId ?? null, title: data.title,
        scope: data.scope ?? null, plan: data.plan ?? null, leadInvestigatorId: data.leadInvestigatorId,
        teamDescription: data.teamDescription ?? null, subjectUserId, independenceConfirmed: true,
        conflictChecked: true, conflictDetected: false, status: "PLANNED",
        confidentiality: data.confidentiality, dueDate: data.dueDate ? new Date(data.dueDate) : null,
        createdById: ctx.user.id,
      }),
    });
    if (data.reportId) {
      await tx.speakUpCaseAccess.upsert({
        where: { reportId_userId_caseRole: { reportId: data.reportId, userId: data.leadInvestigatorId, caseRole: "INVESTIGATOR" } },
        create: tenantData(ctx, { reportId: data.reportId, userId: data.leadInvestigatorId, caseRole: "INVESTIGATOR", reason: `Investigador principal de ${code}`, grantedById: ctx.user.id }),
        update: { revokedAt: null, revokedReason: null, grantedById: ctx.user.id, grantedAt: new Date(), reason: `Investigador principal de ${code}` },
      });
      await tx.speakUpReport.update({ where: { id: data.reportId }, data: { status: "UNDER_INVESTIGATION" } });
    }
    return investigation;
  });

  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, case: caseCode, breachId: data.breachId ?? null, leadInvestigatorId: data.leadInvestigatorId }, extra: { event: "open_investigation" } });
  if (data.leadInvestigatorId !== ctx.user.id) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.leadInvestigatorId, title: `Investigación asignada: ${code}`, body: `"${data.title}" queda bajo su dirección.`, type: "WARNING", link: "/app/compliance", idempotencyKey: `investigation:${created.id}:assigned` });
  }
  revalidate();
  return { id: created.id, code };
}

export async function setInvestigationStatus(id: string, input: { to: InvestigationStatus; findings?: string; conclusion?: string; recommendations?: string; sanctionsRecommended?: string; note?: string }) {
  const ctx = await requirePermission("compliance:update");
  const investigation = await prisma.investigation.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!investigation) throw new Error("Investigación no encontrada.");
  if (investigation.reportId) await requireCaseAccess(ctx, investigation.reportId, "speakup:update");
  assertInvestigationTransition(investigation.status, input.to);

  if (input.to === "CONCLUDED") {
    assertConclusion({
      findings: input.findings ?? investigation.findings,
      conclusion: input.conclusion ?? investigation.conclusion,
    });
  }

  await prisma.investigation.update({
    where: { id },
    data: {
      status: input.to,
      ...(input.to === "ACTIVE" && !investigation.startedAt ? { startedAt: new Date() } : {}),
      ...(input.to === "CONCLUDED" ? { concludedAt: new Date() } : {}),
      ...(input.findings !== undefined ? { findings: input.findings } : {}),
      ...(input.conclusion !== undefined ? { conclusion: input.conclusion } : {}),
      ...(input.recommendations !== undefined ? { recommendations: input.recommendations } : {}),
      ...(input.sanctionsRecommended !== undefined ? { sanctionsRecommended: input.sanctionsRecommended } : {}),
    },
  });
  await logAuditEvent({ ctx, action: "status_change", module: MODULE, recordId: id, before: { status: investigation.status }, after: { status: input.to }, extra: { event: "investigation_status", note: input.note } });
  revalidate();
  return { id, status: input.to };
}

/**
 * Recusa al investigador por conflicto de interés y reasigna la investigación.
 * La recusación revoca su acceso al caso: apartarse es dejar de ver, no dejar de
 * firmar. La base exige recusación y reasignación juntas (CHECK).
 */
export async function recuseInvestigator(id: string, input: { reason: string; reassignedToId: string }) {
  const ctx = await requirePermission("speakup:approve");
  const investigation = await prisma.investigation.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!investigation) throw new Error("Investigación no encontrada.");
  if (investigation.reportId) await requireCaseAccess(ctx, investigation.reportId, "speakup:approve");
  if (investigation.status === "CLOSED" || investigation.status === "CONCLUDED") {
    throw new Error("Una investigación concluida no se recusa: registre el hecho en el expediente.");
  }
  assertRecusal({ reason: input.reason, reassignedToId: input.reassignedToId, subjectUserId: investigation.subjectUserId });

  const declarations = await prisma.conflictOfInterestDeclaration.findMany({
    where: { organizationId: ctx.organization.id, declarantId: input.reassignedToId, hasConflict: true, recusalRequired: true },
    select: { declarantId: true, hasConflict: true, recusalRequired: true, reviewStatus: true, relatedParty: true },
  });
  const check = checkIndependence({ investigatorId: input.reassignedToId, subjectUserId: investigation.subjectUserId, declarations });
  if (check.conflictDetected) {
    throw new Error(`La persona propuesta tampoco es independiente: ${check.reasons.join("; ")}.`);
  }

  const previousLead = investigation.leadInvestigatorId;
  await prisma.$transaction(async (tx) => {
    await tx.investigation.update({
      where: { id },
      data: {
        conflictChecked: true, conflictDetected: true, conflictDescription: input.reason,
        recusedAt: new Date(), recusedById: previousLead, reassignedToId: input.reassignedToId,
        leadInvestigatorId: input.reassignedToId, independenceConfirmed: true,
      },
    });
    if (investigation.reportId) {
      if (previousLead) {
        await tx.speakUpCaseAccess.updateMany({
          where: { reportId: investigation.reportId, userId: previousLead, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: `Recusación por conflicto de interés: ${input.reason}` },
        });
      }
      await tx.speakUpCaseAccess.upsert({
        where: { reportId_userId_caseRole: { reportId: investigation.reportId, userId: input.reassignedToId, caseRole: "INVESTIGATOR" } },
        create: tenantData(ctx, { reportId: investigation.reportId, userId: input.reassignedToId, caseRole: "INVESTIGATOR", reason: `Reasignación de ${investigation.code} por recusación`, grantedById: ctx.user.id }),
        update: { revokedAt: null, revokedReason: null, grantedById: ctx.user.id, grantedAt: new Date(), reason: `Reasignación de ${investigation.code} por recusación` },
      });
    }
  });

  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, before: { leadInvestigatorId: previousLead }, after: { leadInvestigatorId: input.reassignedToId, conflictDetected: true }, extra: { event: "recuse_investigator", reason: input.reason } });
  await safeNotify({ organizationId: ctx.organization.id, userId: input.reassignedToId, title: `Investigación reasignada: ${investigation.code}`, body: "Asume la dirección de la investigación tras una recusación por conflicto de interés.", type: "WARNING", link: "/app/compliance", idempotencyKey: `investigation:${id}:reassigned` });
  revalidate();
  return { id, leadInvestigatorId: input.reassignedToId };
}

// ─────────────────────────────────────────────────────
// Cierre y retención
// ─────────────────────────────────────────────────────

/** Informa al informante del resultado, dentro del plazo de respuesta del canal. */
export async function provideCaseFeedback(id: string, input: { summary: string }) {
  const ctx = await requirePermission("speakup:update");
  const { report } = await requireCaseAccess(ctx, id, "speakup:update");
  const summary = z.string().min(10).max(4000).parse(input.summary);
  const providedAt = new Date();
  const late = Boolean(report.feedbackDueAt && providedAt > report.feedbackDueAt);
  await prisma.speakUpReport.update({ where: { id }, data: { feedbackProvidedAt: providedAt } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, after: { feedbackProvidedAt: providedAt, late }, extra: { event: "provide_case_feedback" } });
  if (report.reporterUserId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: report.reporterUserId, title: `Respuesta sobre su denuncia ${report.code}`, body: summary, type: "INFO", link: "/app/compliance", idempotencyKey: `speakup:${id}:feedback` });
  }
  revalidate();
  return { id, providedAt, late, deliveredInApp: Boolean(report.reporterUserId) };
}

const closureSchema = z.object({
  outcome: z.enum(["SUBSTANTIATED", "PARTIALLY_SUBSTANTIATED", "UNSUBSTANTIATED", "INCONCLUSIVE", "WITHDRAWN", "OUT_OF_SCOPE", "REFERRED_EXTERNALLY"]),
  closureSummary: z.string().min(10).max(8000),
  protectionMeasures: z.string().max(4000).optional(),
});

/**
 * Cierra el caso y fija su plazo de retención. Un caso fundado no se cierra con
 * investigaciones abiertas: primero se concluye, luego se cierra.
 */
export async function closeSpeakUpCase(id: string, input: z.infer<typeof closureSchema>) {
  const ctx = await requirePermission("speakup:approve");
  const data = closureSchema.parse(input);
  const { report } = await requireCaseAccess(ctx, id, "speakup:approve");

  const openInvestigations = await prisma.investigation.count({
    where: { organizationId: ctx.organization.id, reportId: id, status: { notIn: ["CONCLUDED", "CLOSED"] } },
  });
  if (openInvestigations > 0) {
    throw new Error("El caso tiene investigaciones sin concluir: no puede cerrarse.");
  }

  const closedAt = new Date();
  assertClosure({ outcome: data.outcome, summary: data.closureSummary, closedById: ctx.user.id });
  if (report.status !== "RESOLVED") assertStatusTransition(report.status, "RESOLVED");

  const config = await channelConfig(ctx.organization.id);
  const until = retentionUntil(closedAt, config);

  await prisma.speakUpReport.update({
    where: { id },
    data: {
      status: "CLOSED", outcome: data.outcome, closureSummary: data.closureSummary, closedAt, closedById: ctx.user.id,
      retentionUntil: until, feedbackProvidedAt: report.feedbackProvidedAt ?? closedAt,
      ...(data.protectionMeasures !== undefined ? { protectionMeasures: data.protectionMeasures } : {}),
    },
  });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, before: { status: report.status }, after: { status: "CLOSED", outcome: data.outcome, retentionUntil: until }, extra: { event: "close_speak_up_case" } });
  if (report.reporterUserId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: report.reporterUserId, title: `Su denuncia ${report.code} se ha cerrado`, body: data.closureSummary, type: "INFO", link: "/app/compliance", idempotencyKey: `speakup:${id}:closed` });
  }
  revalidate();
  return { id, status: "CLOSED" as SpeakUpStatus, retentionUntil: until };
}

/**
 * Purga el caso una vez vencida su retención: se borran identidad, relato,
 * evidencia y autorizaciones, y queda el esqueleto estadístico (categoría,
 * fechas, resultado) que sostiene los informes al órgano de gobierno. Antes del
 * vencimiento no se puede purgar, y la base lo vuelve a impedir con un CHECK.
 */
export async function purgeSpeakUpCase(id: string, input: { note?: string } = {}) {
  const ctx = await requirePermission("speakup:approve");
  const { report } = await requireCaseAccess(ctx, id, "speakup:approve");
  const today = new Date();
  assertPurgeable(report, today);

  await prisma.$transaction(async (tx) => {
    await tx.speakUpEvidence.deleteMany({ where: { reportId: id, organizationId: ctx.organization.id } });
    await tx.speakUpCaseAccess.updateMany({
      where: { reportId: id, revokedAt: null },
      data: { revokedAt: today, revokedReason: "Purga por vencimiento del plazo de retención" },
    });
    await tx.speakUpReport.update({
      where: { id },
      data: {
        purgedAt: today,
        reporterUserId: null, reporterName: null, reporterEmail: null, reporterPhone: null,
        subjectUserId: null, subjectDescription: null, witnesses: null, location: null,
        description: "[purgado por vencimiento del plazo de retención]",
        allegedFacts: null, followUpCodeHash: null, protectionMeasures: null,
      },
    });
  });

  await logAuditEvent({ ctx, action: "delete", module: MODULE, recordId: id, before: { case: report.code, retentionUntil: report.retentionUntil }, after: { purgedAt: today }, extra: { event: "purge_speak_up_case", note: input.note } });
  revalidate();
  return { id, purgedAt: today };
}

/**
 * Convierte un caso fundado en un incumplimiento del programa de compliance. El
 * título y la descripción los escribe quien gestiona el caso: lo que cruza al
 * módulo de compliance —visible para todo el equipo de compliance— es el hecho
 * objetivo, nunca el relato ni las personas del expediente.
 */
export async function raiseBreachFromCase(id: string, input: { title: string; description: string; severity: "MINOR" | "MODERATE" | "MAJOR" | "SEVERE"; obligationId?: string }) {
  const ctx = await requirePermission("speakup:approve");
  const { report } = await requireCaseAccess(ctx, id, "speakup:approve");
  const data = z.object({
    title: z.string().min(1).max(300),
    description: z.string().min(10).max(4000),
    severity: z.enum(["MINOR", "MODERATE", "MAJOR", "SEVERE"]),
    obligationId: z.string().optional(),
  }).parse(input);
  if (report.outcome && report.outcome !== "SUBSTANTIATED" && report.outcome !== "PARTIALLY_SUBSTANTIATED") {
    throw new Error("Solo un caso fundado o parcialmente fundado origina un incumplimiento.");
  }
  if (report.breachId) throw new Error("El caso ya tiene un incumplimiento asociado.");

  const { registerComplianceBreach } = await import("@/lib/actions/compliance");
  const breach = await registerComplianceBreach({
    title: data.title,
    description: data.description,
    obligationId: data.obligationId,
    detectionSource: "SPEAK_UP_REPORT",
    severity: data.severity,
    recurrence: false,
  });
  await prisma.speakUpReport.update({ where: { id }, data: { breachId: breach.id } });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: id, after: { breach: breach.code }, extra: { event: "raise_breach_from_case" } });
  revalidate();
  return { id, breachId: breach.id, breachCode: breach.code };
}
