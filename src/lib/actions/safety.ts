"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import { computeOccupationalRisk } from "@/lib/safety/risk";
import { assertIncidentTransition } from "@/lib/safety/incident-workflow";
import type { OccupationalIncidentStatus } from "@prisma/client";

const MODULE = "safety";
const revalidate = () => {
  revalidatePath("/app/safety");
  revalidatePath("/app/activity");
};

/** Verify an optional cross-module reference belongs to the caller's org. */
async function assertRefInOrg(
  organizationId: string,
  refs: Partial<Record<
    "processId" | "riskId" | "capaId" | "evidenceId" | "documentId" | "trainingCourseId" | "supplierId" | "personnelId" | "positionId" | "locationId" | "auditId",
    string | null | undefined
  >>,
) {
  const checks: Promise<unknown>[] = [];
  const guard = (p: Promise<{ id: string } | null>, label: string) =>
    checks.push(p.then((r) => { if (!r) throw new Error(`Referencia ${label} no pertenece a la organización.`); }));
  const w = (id: string) => ({ where: { id, organizationId }, select: { id: true } });
  if (refs.processId) guard(prisma.process.findFirst(w(refs.processId)), "de proceso");
  if (refs.riskId) guard(prisma.risk.findFirst(w(refs.riskId)), "de riesgo");
  if (refs.capaId) guard(prisma.cAPA.findFirst(w(refs.capaId)), "de CAPA");
  if (refs.evidenceId) guard(prisma.evidenceFile.findFirst(w(refs.evidenceId)), "de evidencia");
  if (refs.documentId) guard(prisma.document.findFirst(w(refs.documentId)), "de documento");
  if (refs.trainingCourseId) guard(prisma.trainingCourse.findFirst(w(refs.trainingCourseId)), "de curso");
  if (refs.supplierId) guard(prisma.supplier.findFirst(w(refs.supplierId)), "de proveedor");
  if (refs.personnelId) guard(prisma.personnel.findFirst(w(refs.personnelId)), "de trabajador");
  if (refs.positionId) guard(prisma.position.findFirst(w(refs.positionId)), "de puesto");
  if (refs.locationId) guard(prisma.location.findFirst(w(refs.locationId)), "de sede");
  if (refs.auditId) guard(prisma.audit.findFirst(w(refs.auditId)), "de auditoría");
  await Promise.all(checks);
}

async function nextCode(organizationId: string, prefix: string, count: Promise<number>) {
  return `${prefix}-${String((await count) + 1).padStart(4, "0")}`;
}

/** Best-effort in-app + email notification; never blocks the business action. */
async function safeNotify(input: Parameters<typeof notifyUser>[0]) {
  try { await notifyUser(input); } catch (e) { console.error("[safety] notify failed:", e instanceof Error ? e.message : e); }
}

// ─────────────────────────────────────────────────────
// Hazards & occupational risk assessment (IPER)
// ─────────────────────────────────────────────────────

const hazardSchema = z.object({
  code: z.string().max(40).optional(),
  processId: z.string().optional(),
  activity: z.string().min(1).max(400),
  task: z.string().max(400).optional(),
  hazard: z.string().min(1).max(400),
  category: z.enum(["PHYSICAL", "CHEMICAL", "BIOLOGICAL", "ERGONOMIC", "PSYCHOSOCIAL", "MECHANICAL", "ELECTRICAL", "FIRE_EXPLOSION", "LOCATIVE", "OTHER"]).default("OTHER"),
  exposedWorkers: z.number().int().min(0).optional(),
  existingControls: z.string().max(2000).optional(),
  responsibleId: z.string().optional(),
});

export async function createHazard(input: z.infer<typeof hazardSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = hazardSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });
  const code = data.code ?? await nextCode(ctx.organization.id, "PEL", prisma.occupationalHazard.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.occupationalHazard.create({
    data: tenantData(ctx, {
      code, processId: data.processId ?? null, activity: data.activity, task: data.task ?? null,
      hazard: data.hazard, category: data.category, exposedWorkers: data.exposedWorkers ?? null,
      existingControls: data.existingControls ?? null, responsibleId: data.responsibleId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, hazard: data.hazard }, extra: { event: "create_hazard" } });
  revalidate();
  return { id: created.id, code };
}

export async function updateHazard(id: string, input: Partial<z.infer<typeof hazardSchema>>) {
  const ctx = await requirePermission("safety:update");
  const existing = await prisma.occupationalHazard.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Peligro no encontrado.");
  const data = hazardSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });
  await prisma.occupationalHazard.update({ where: { id }, data: {
    ...(data.processId !== undefined ? { processId: data.processId } : {}),
    ...(data.activity !== undefined ? { activity: data.activity } : {}),
    ...(data.task !== undefined ? { task: data.task } : {}),
    ...(data.hazard !== undefined ? { hazard: data.hazard } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.exposedWorkers !== undefined ? { exposedWorkers: data.exposedWorkers } : {}),
    ...(data.existingControls !== undefined ? { existingControls: data.existingControls } : {}),
    ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
  } });
  await logAuditEvent({ ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_hazard" } });
  revalidate();
  return { id };
}

export async function deleteHazard(id: string) {
  const ctx = await requirePermission("safety:delete");
  const existing = await prisma.occupationalHazard.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Peligro no encontrado.");
  await prisma.occupationalHazard.delete({ where: { id } });
  await logAuditEvent({ ctx, action: "delete", module: MODULE, recordId: id, extra: { event: "delete_hazard" } });
  revalidate();
  return { id };
}

const assessmentSchema = z.object({
  hazardId: z.string().min(1),
  probability: z.number().min(0).max(10),
  consequence: z.number().min(0).max(100),
  exposure: z.number().min(0).max(10),
  controls: z.string().max(2000).optional(),
  controlEffectiveness: z.number().int().min(0).max(100).optional(),
  assessorId: z.string().optional(),
  riskId: z.string().optional(),
});

/** Evaluate a hazard (W.T. Fine); computes inherent/residual level + acceptability. */
export async function assessOccupationalRisk(input: z.infer<typeof assessmentSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = assessmentSchema.parse(input);
  const hazard = await prisma.occupationalHazard.findFirst({ where: tenantWhere(ctx, { id: data.hazardId }), select: { id: true } });
  if (!hazard) throw new Error("El peligro no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { riskId: data.riskId });

  const r = computeOccupationalRisk({ probability: data.probability, consequence: data.consequence, exposure: data.exposure, controlEffectiveness: data.controlEffectiveness });
  const created = await prisma.occupationalRiskAssessment.create({
    data: tenantData(ctx, {
      hazardId: data.hazardId, probability: data.probability, consequence: data.consequence, exposure: data.exposure,
      inherentMagnitude: r.inherentMagnitude, inherentLevel: r.inherentLevel, controls: data.controls ?? null,
      residualMagnitude: r.residualMagnitude, residualLevel: r.residualLevel, acceptability: r.acceptability,
      assessorId: data.assessorId ?? null, riskId: data.riskId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { hazardId: data.hazardId, inherentLevel: r.inherentLevel, residualLevel: r.residualLevel, acceptability: r.acceptability }, extra: { event: "assess_occupational_risk" } });
  revalidate();
  return { id: created.id, ...r };
}

// ─────────────────────────────────────────────────────
// Worker consultation & participation
// ─────────────────────────────────────────────────────

const consultationSchema = z.object({
  code: z.string().max(40).optional(),
  topic: z.string().min(1).max(400),
  method: z.enum(["MEETING", "SURVEY", "COMMITTEE", "SUGGESTION", "TRAINING", "OTHER"]).default("MEETING"),
  participants: z.number().int().min(0).optional(),
  participantsNote: z.string().max(1000).optional(),
  heldAt: z.string().datetime().optional(),
  conclusions: z.string().max(4000).optional(),
  decisions: z.string().max(4000).optional(),
  documentId: z.string().optional(),
});

export async function createConsultation(input: z.infer<typeof consultationSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = consultationSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode(ctx.organization.id, "CON", prisma.workerConsultation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.workerConsultation.create({
    data: tenantData(ctx, {
      code, topic: data.topic, method: data.method, participants: data.participants ?? null,
      participantsNote: data.participantsNote ?? null, heldAt: data.heldAt ? new Date(data.heldAt) : new Date(),
      conclusions: data.conclusions ?? null, decisions: data.decisions ?? null, documentId: data.documentId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, topic: data.topic }, extra: { event: "create_consultation" } });
  revalidate();
  return { id: created.id, code };
}

// ─────────────────────────────────────────────────────
// Safety inspections
// ─────────────────────────────────────────────────────

const inspectionSchema = z.object({
  code: z.string().max(40).optional(),
  locationId: z.string().optional(),
  area: z.string().max(200).optional(),
  type: z.enum(["PLANNED", "UNPLANNED", "BEHAVIORAL", "CONDITION", "LEGAL", "OTHER"]).default("PLANNED"),
  inspectorId: z.string().optional(),
  checklist: z.any().optional(),
  findings: z.string().max(4000).optional(),
  actions: z.string().max(4000).optional(),
  evidenceId: z.string().optional(),
  capaId: z.string().optional(),
  inspectedAt: z.string().datetime().optional(),
});

export async function createInspection(input: z.infer<typeof inspectionSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = inspectionSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { locationId: data.locationId, evidenceId: data.evidenceId, capaId: data.capaId });
  const code = data.code ?? await nextCode(ctx.organization.id, "INS", prisma.safetyInspection.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.safetyInspection.create({
    data: tenantData(ctx, {
      code, locationId: data.locationId ?? null, area: data.area ?? null, type: data.type,
      inspectorId: data.inspectorId ?? null, checklist: data.checklist ?? undefined, findings: data.findings ?? null,
      actions: data.actions ?? null, evidenceId: data.evidenceId ?? null, capaId: data.capaId ?? null,
      inspectedAt: data.inspectedAt ? new Date(data.inspectedAt) : new Date(), createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, type: data.type }, extra: { event: "create_inspection" } });
  revalidate();
  return { id: created.id, code };
}

// ─────────────────────────────────────────────────────
// PPE items & assignments
// ─────────────────────────────────────────────────────

const ppeItemSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  ppeType: z.string().min(1).max(200),
  technicalStandard: z.string().max(200).optional(),
  lifespanMonths: z.number().int().min(0).optional(),
  maintenance: z.string().max(2000).optional(),
});

export async function createPPEItem(input: z.infer<typeof ppeItemSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = ppeItemSchema.parse(input);
  const code = data.code ?? await nextCode(ctx.organization.id, "EPP", prisma.pPEItem.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.pPEItem.create({
    data: tenantData(ctx, {
      code, name: data.name, ppeType: data.ppeType, technicalStandard: data.technicalStandard ?? null,
      lifespanMonths: data.lifespanMonths ?? null, maintenance: data.maintenance ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, name: data.name }, extra: { event: "create_ppe_item" } });
  revalidate();
  return { id: created.id, code };
}

const ppeAssignmentSchema = z.object({
  ppeItemId: z.string().min(1),
  personnelId: z.string().optional(),
  workerName: z.string().max(200).optional(),
  deliveredAt: z.string().datetime().optional(),
  quantity: z.number().int().min(1).default(1),
  trainingProvided: z.boolean().default(false),
  trainingCourseId: z.string().optional(),
  replacementDate: z.string().datetime().optional(),
  evidenceId: z.string().optional(),
  signatureNote: z.string().max(600).optional(),
});

export async function assignPPE(input: z.infer<typeof ppeAssignmentSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = ppeAssignmentSchema.parse(input);
  const item = await prisma.pPEItem.findFirst({ where: tenantWhere(ctx, { id: data.ppeItemId }), select: { id: true, lifespanMonths: true } });
  if (!item) throw new Error("El EPP no pertenece a la organización.");
  await assertRefInOrg(ctx.organization.id, { personnelId: data.personnelId, trainingCourseId: data.trainingCourseId, evidenceId: data.evidenceId });

  const deliveredAt = data.deliveredAt ? new Date(data.deliveredAt) : new Date();
  let replacementDate = data.replacementDate ? new Date(data.replacementDate) : null;
  if (!replacementDate && item.lifespanMonths) {
    replacementDate = new Date(deliveredAt);
    replacementDate.setMonth(replacementDate.getMonth() + item.lifespanMonths);
  }
  const created = await prisma.pPEAssignment.create({
    data: tenantData(ctx, {
      ppeItemId: data.ppeItemId, personnelId: data.personnelId ?? null, workerName: data.workerName ?? null,
      deliveredAt, quantity: data.quantity, trainingProvided: data.trainingProvided,
      trainingCourseId: data.trainingCourseId ?? null, replacementDate, evidenceId: data.evidenceId ?? null,
      signatureNote: data.signatureNote ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { ppeItemId: data.ppeItemId, personnelId: data.personnelId }, extra: { event: "assign_ppe" } });
  revalidate();
  return { id: created.id, replacementDate };
}

// ─────────────────────────────────────────────────────
// Permits to work (lifecycle)
// ─────────────────────────────────────────────────────

const permitSchema = z.object({
  code: z.string().max(40).optional(),
  workType: z.enum(["HOT_WORK", "CONFINED_SPACE", "WORK_AT_HEIGHT", "ELECTRICAL", "EXCAVATION", "LOCKOUT_TAGOUT", "LIFTING", "OTHER"]).default("OTHER"),
  locationId: z.string().optional(),
  area: z.string().max(200).optional(),
  hazards: z.string().max(2000).optional(),
  controls: z.string().max(2000).optional(),
  authorizerId: z.string().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
});

export async function createPermit(input: z.infer<typeof permitSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = permitSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { locationId: data.locationId });
  const code = data.code ?? await nextCode(ctx.organization.id, "PTW", prisma.permitToWork.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.permitToWork.create({
    data: tenantData(ctx, {
      code, workType: data.workType, locationId: data.locationId ?? null, area: data.area ?? null,
      hazards: data.hazards ?? null, controls: data.controls ?? null, authorizerId: data.authorizerId ?? null,
      validFrom: data.validFrom ? new Date(data.validFrom) : null, validTo: data.validTo ? new Date(data.validTo) : null,
      status: "DRAFT", createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, workType: data.workType }, extra: { event: "create_permit" } });
  revalidate();
  return { id: created.id, code };
}

const PERMIT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["SUSPENDED", "CLOSED", "EXPIRED"],
  SUSPENDED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
  EXPIRED: [],
};

export async function setPermitStatus(id: string, to: "ACTIVE" | "SUSPENDED" | "CLOSED" | "EXPIRED", closureNote?: string) {
  const ctx = await requirePermission("safety:update");
  const permit = await prisma.permitToWork.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, status: true } });
  if (!permit) throw new Error("Permiso no encontrado.");
  if (!PERMIT_TRANSITIONS[permit.status]?.includes(to)) throw new Error(`Transición de permiso no permitida: ${permit.status} → ${to}.`);
  await prisma.permitToWork.update({ where: { id }, data: {
    status: to,
    ...(to === "CLOSED" || to === "EXPIRED" ? { closedAt: new Date(), closureNote: closureNote ?? null } : {}),
  } });
  await logAuditEvent({ ctx, action: "status_change", module: MODULE, recordId: id, before: { status: permit.status }, after: { status: to }, extra: { event: "permit_status" } });
  revalidate();
  return { id, status: to };
}

// ─────────────────────────────────────────────────────
// Occupational incidents (strict investigation workflow)
// ─────────────────────────────────────────────────────

const incidentSchema = z.object({
  code: z.string().max(40).optional(),
  type: z.enum(["ACCIDENT", "INCIDENT", "NEAR_MISS", "OCCUPATIONAL_ILLNESS"]).default("INCIDENT"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  injury: z.string().max(600).optional(),
  illness: z.string().max(600).optional(),
  occurredAt: z.string().datetime().optional(),
  locationId: z.string().optional(),
  area: z.string().max(200).optional(),
  personnelId: z.string().optional(),
  workerName: z.string().max(200).optional(),
  lostDays: z.number().int().min(0).default(0),
  reporterId: z.string().optional(),
  responsibleId: z.string().optional(),
});

/** Report a new incident. Always starts at REPORTED; notifies the responsible. */
export async function reportIncident(input: z.infer<typeof incidentSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = incidentSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { locationId: data.locationId, personnelId: data.personnelId });
  const code = data.code ?? await nextCode(ctx.organization.id, "INC", prisma.occupationalIncident.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.occupationalIncident.create({
    data: tenantData(ctx, {
      code, type: data.type, severity: data.severity, title: data.title, description: data.description ?? null,
      injury: data.injury ?? null, illness: data.illness ?? null, occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      locationId: data.locationId ?? null, area: data.area ?? null, personnelId: data.personnelId ?? null, workerName: data.workerName ?? null,
      lostDays: data.lostDays, status: "REPORTED", reporterId: data.reporterId ?? ctx.user.id, responsibleId: data.responsibleId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, type: data.type, severity: data.severity, status: "REPORTED" }, extra: { event: "report_incident" } });
  if (data.responsibleId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: data.responsibleId, title: `Incidente reportado: ${code}`, body: `${data.title} (${data.type}, severidad ${data.severity}).`, type: data.severity === "CRITICAL" || data.severity === "HIGH" ? "ALERT" : "WARNING", link: "/app/safety", idempotencyKey: `incident:${created.id}:reported` });
  }
  revalidate();
  return { id: created.id, code };
}

const transitionSchema = z.object({
  to: z.enum(["CLASSIFIED", "INVESTIGATING", "ROOT_CAUSE", "ACTION_PLAN", "IMPLEMENTED", "EFFECTIVENESS_VERIFIED", "CLOSED"]),
  investigation: z.string().max(8000).optional(),
  rootCause: z.string().max(4000).optional(),
  rootCauseMethod: z.string().max(120).optional(),
  causes: z.string().max(4000).optional(),
  actions: z.string().max(4000).optional(),
  dueDate: z.string().datetime().optional(),
  capaId: z.string().optional(),
  evidenceId: z.string().optional(),
  note: z.string().max(2000).optional(),
});

/**
 * Advance an incident strictly one step along the investigation workflow.
 * Jumps and backward moves are rejected (`assertIncidentTransition`).
 */
export async function transitionIncident(id: string, input: z.infer<typeof transitionSchema>) {
  const ctx = await requirePermission("safety:update");
  const data = transitionSchema.parse(input);
  const incident = await prisma.occupationalIncident.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!incident) throw new Error("Incidente no encontrado.");

  assertIncidentTransition(incident.status, data.to as OccupationalIncidentStatus);
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, evidenceId: data.evidenceId });

  const updated = await prisma.occupationalIncident.update({ where: { id }, data: {
    status: data.to,
    ...(data.investigation !== undefined ? { investigation: data.investigation } : {}),
    ...(data.rootCause !== undefined ? { rootCause: data.rootCause } : {}),
    ...(data.rootCauseMethod !== undefined ? { rootCauseMethod: data.rootCauseMethod } : {}),
    ...(data.causes !== undefined ? { causes: data.causes } : {}),
    ...(data.actions !== undefined ? { actions: data.actions } : {}),
    ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
    ...(data.capaId !== undefined ? { capaId: data.capaId } : {}),
    ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
    ...(data.to === "CLOSED" ? { closedAt: new Date() } : {}),
  } });
  await logAuditEvent({ ctx, action: "status_change", module: MODULE, recordId: id, before: { status: incident.status }, after: { status: data.to }, extra: { event: "transition_incident", note: data.note } });
  if (incident.responsibleId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: incident.responsibleId, title: `Incidente ${incident.code}: ${data.to}`, body: `El incidente "${incident.title}" avanzó a ${data.to}.`, type: data.to === "CLOSED" ? "SUCCESS" : "INFO", link: "/app/safety", idempotencyKey: `incident:${id}:${data.to}` });
  }
  revalidate();
  return { id, status: updated.status };
}

// ─────────────────────────────────────────────────────
// Health surveillance, emergency drills, contractors
// ─────────────────────────────────────────────────────

const surveillanceSchema = z.object({
  code: z.string().max(40).optional(),
  personnelId: z.string().optional(),
  workerName: z.string().max(200).optional(),
  positionId: z.string().optional(),
  exposure: z.string().max(600).optional(),
  protocol: z.string().max(600).optional(),
  fitness: z.enum(["FIT", "FIT_WITH_RESTRICTIONS", "TEMPORARILY_UNFIT", "UNFIT", "PENDING"]).default("PENDING"),
  restrictions: z.string().max(2000).optional(),
  examinedAt: z.string().datetime().optional(),
  nextReviewDate: z.string().datetime().optional(),
  evidenceId: z.string().optional(),
});

export async function createHealthSurveillance(input: z.infer<typeof surveillanceSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = surveillanceSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { personnelId: data.personnelId, positionId: data.positionId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode(ctx.organization.id, "VS", prisma.occupationalHealthSurveillance.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.occupationalHealthSurveillance.create({
    data: tenantData(ctx, {
      code, personnelId: data.personnelId ?? null, workerName: data.workerName ?? null, positionId: data.positionId ?? null,
      exposure: data.exposure ?? null, protocol: data.protocol ?? null, fitness: data.fitness, restrictions: data.restrictions ?? null,
      examinedAt: data.examinedAt ? new Date(data.examinedAt) : null, nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
      evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, fitness: data.fitness }, extra: { event: "create_health_surveillance" } });
  revalidate();
  return { id: created.id, code };
}

const drillSchema = z.object({
  code: z.string().max(40).optional(),
  scenario: z.string().min(1).max(400),
  participants: z.number().int().min(0).optional(),
  participantsNote: z.string().max(1000).optional(),
  responseTimeMinutes: z.number().int().min(0).optional(),
  outcome: z.enum(["PASSED", "PARTIAL", "FAILED"]).optional(),
  failures: z.string().max(2000).optional(),
  actions: z.string().max(2000).optional(),
  drillDate: z.string().datetime().optional(),
  evidenceId: z.string().optional(),
});

export async function createEmergencyDrill(input: z.infer<typeof drillSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = drillSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode(ctx.organization.id, "SIM", prisma.emergencyDrill.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.emergencyDrill.create({
    data: tenantData(ctx, {
      code, scenario: data.scenario, participants: data.participants ?? null, participantsNote: data.participantsNote ?? null,
      responseTimeMinutes: data.responseTimeMinutes ?? null, outcome: data.outcome ?? null, failures: data.failures ?? null,
      actions: data.actions ?? null, drillDate: data.drillDate ? new Date(data.drillDate) : new Date(), evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, scenario: data.scenario }, extra: { event: "create_drill" } });
  revalidate();
  return { id: created.id, code };
}

const contractorSchema = z.object({
  code: z.string().max(40).optional(),
  supplierId: z.string().optional(),
  contractorName: z.string().max(200).optional(),
  risks: z.string().max(2000).optional(),
  requirements: z.string().max(2000).optional(),
  documentation: z.string().max(2000).optional(),
  outcome: z.enum(["APPROVED", "CONDITIONAL", "REJECTED", "UNDER_REVIEW"]).default("UNDER_REVIEW"),
  score: z.number().int().min(0).max(100).optional(),
  incidents: z.number().int().min(0).default(0),
  assessedAt: z.string().datetime().optional(),
  nextReviewDate: z.string().datetime().optional(),
  evidenceId: z.string().optional(),
});

export async function createContractorAssessment(input: z.infer<typeof contractorSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = contractorSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode(ctx.organization.id, "CTR", prisma.contractorSafetyAssessment.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.contractorSafetyAssessment.create({
    data: tenantData(ctx, {
      code, supplierId: data.supplierId ?? null, contractorName: data.contractorName ?? null, risks: data.risks ?? null,
      requirements: data.requirements ?? null, documentation: data.documentation ?? null, outcome: data.outcome,
      score: data.score ?? null, incidents: data.incidents, assessedAt: data.assessedAt ? new Date(data.assessedAt) : null,
      nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code, outcome: data.outcome }, extra: { event: "create_contractor_assessment" } });
  revalidate();
  return { id: created.id, code };
}
