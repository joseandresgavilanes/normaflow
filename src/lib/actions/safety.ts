"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import { computeOccupationalRisk } from "@/lib/safety/risk";
import { assertIncidentTransition } from "@/lib/safety/incident-workflow";
import { encryptHealthField } from "@/lib/crypto/field-encryption";
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
  active: z.boolean().optional(),
});

export async function createHazard(input: z.infer<typeof hazardSchema>) {
  const ctx = await requirePermission("safety:create");
  const data = hazardSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });
  const code = data.code ?? await nextCode(ctx.organization.id, "PEL", prisma.occupationalHazard.count({ where: { organizationId: ctx.organization.id } }));

  const created = await prisma.$transaction(async (tx) => {
    const hazard = await tx.occupationalHazard.create({
      data: tenantData(ctx, {
        code, processId: data.processId ?? null, activity: data.activity, task: data.task ?? null,
        hazard: data.hazard, category: data.category, exposedWorkers: data.exposedWorkers ?? null,
        existingControls: data.existingControls ?? null, responsibleId: data.responsibleId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: hazard.id, after: { code, hazard: data.hazard }, extra: { event: "create_hazard" } });
    return hazard;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateHazard(id: string, input: Partial<z.infer<typeof hazardSchema>>) {
  const ctx = await requirePermission("safety:update");
  const existing = await prisma.occupationalHazard.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Peligro no encontrado.");
  const data = hazardSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId });

  await prisma.$transaction(async (tx) => {
    await tx.occupationalHazard.update({ where: { id }, data: {
      ...(data.processId !== undefined ? { processId: data.processId } : {}),
      ...(data.activity !== undefined ? { activity: data.activity } : {}),
      ...(data.task !== undefined ? { task: data.task } : {}),
      ...(data.hazard !== undefined ? { hazard: data.hazard } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.exposedWorkers !== undefined ? { exposedWorkers: data.exposedWorkers } : {}),
      ...(data.existingControls !== undefined ? { existingControls: data.existingControls } : {}),
      ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, after: data, extra: { event: "update_hazard" } });
  });
  revalidate();
  return { id };
}

export async function deleteHazard(id: string) {
  const ctx = await requirePermission("safety:delete");
  const existing = await prisma.occupationalHazard.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true } });
  if (!existing) throw new Error("Peligro no encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.occupationalHazard.delete({ where: { id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: id, extra: { event: "delete_hazard" } });
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const assessment = await tx.occupationalRiskAssessment.create({
      data: tenantData(ctx, {
        hazardId: data.hazardId, probability: data.probability, consequence: data.consequence, exposure: data.exposure,
        inherentMagnitude: r.inherentMagnitude, inherentLevel: r.inherentLevel, controls: data.controls ?? null,
        residualMagnitude: r.residualMagnitude, residualLevel: r.residualLevel, acceptability: r.acceptability,
        assessorId: data.assessorId ?? null, riskId: data.riskId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: assessment.id, after: { hazardId: data.hazardId, inherentLevel: r.inherentLevel, residualLevel: r.residualLevel, acceptability: r.acceptability }, extra: { event: "assess_occupational_risk" } });
    return assessment;
  });
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

  const created = await prisma.$transaction(async (tx) => {
    const consultation = await tx.workerConsultation.create({
      data: tenantData(ctx, {
        code, topic: data.topic, method: data.method, participants: data.participants ?? null,
        participantsNote: data.participantsNote ?? null, heldAt: data.heldAt ? new Date(data.heldAt) : new Date(),
        conclusions: data.conclusions ?? null, decisions: data.decisions ?? null, documentId: data.documentId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: consultation.id, after: { code, topic: data.topic }, extra: { event: "create_consultation" } });
    return consultation;
  });
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

  const created = await prisma.$transaction(async (tx) => {
    const inspection = await tx.safetyInspection.create({
      data: tenantData(ctx, {
        code, locationId: data.locationId ?? null, area: data.area ?? null, type: data.type,
        inspectorId: data.inspectorId ?? null, checklist: data.checklist ?? undefined, findings: data.findings ?? null,
        actions: data.actions ?? null, evidenceId: data.evidenceId ?? null, capaId: data.capaId ?? null,
        inspectedAt: data.inspectedAt ? new Date(data.inspectedAt) : new Date(), createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: inspection.id, after: { code, type: data.type }, extra: { event: "create_inspection" } });
    return inspection;
  });
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

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.pPEItem.create({
      data: tenantData(ctx, {
        code, name: data.name, ppeType: data.ppeType, technicalStandard: data.technicalStandard ?? null,
        lifespanMonths: data.lifespanMonths ?? null, maintenance: data.maintenance ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: item.id, after: { code, name: data.name }, extra: { event: "create_ppe_item" } });
    return item;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const assignment = await tx.pPEAssignment.create({
      data: tenantData(ctx, {
        ppeItemId: data.ppeItemId, personnelId: data.personnelId ?? null, workerName: data.workerName ?? null,
        deliveredAt, quantity: data.quantity, trainingProvided: data.trainingProvided,
        trainingCourseId: data.trainingCourseId ?? null, replacementDate, evidenceId: data.evidenceId ?? null,
        signatureNote: data.signatureNote ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: assignment.id, after: { ppeItemId: data.ppeItemId, personnelId: data.personnelId }, extra: { event: "assign_ppe" } });
    return assignment;
  });
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

  const created = await prisma.$transaction(async (tx) => {
    const permit = await tx.permitToWork.create({
      data: tenantData(ctx, {
        code, workType: data.workType, locationId: data.locationId ?? null, area: data.area ?? null,
        hazards: data.hazards ?? null, controls: data.controls ?? null, authorizerId: data.authorizerId ?? null,
        validFrom: data.validFrom ? new Date(data.validFrom) : null, validTo: data.validTo ? new Date(data.validTo) : null,
        status: "DRAFT", createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: permit.id, after: { code, workType: data.workType }, extra: { event: "create_permit" } });
    return permit;
  });
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

  await prisma.$transaction(async (tx) => {
    await tx.permitToWork.update({ where: { id }, data: {
      status: to,
      ...(to === "CLOSED" || to === "EXPIRED" ? { closedAt: new Date(), closureNote: closureNote ?? null } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "status_change", module: MODULE, recordId: id, before: { status: permit.status }, after: { status: to }, extra: { event: "permit_status" } });
  });
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

  const created = await prisma.$transaction(async (tx) => {
    const incident = await tx.occupationalIncident.create({
      data: tenantData(ctx, {
        code, type: data.type, severity: data.severity, title: data.title, description: data.description ?? null,
        injury: data.injury ?? null, illness: data.illness ?? null, occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
        locationId: data.locationId ?? null, area: data.area ?? null, personnelId: data.personnelId ?? null, workerName: data.workerName ?? null,
        lostDays: data.lostDays, status: "REPORTED", reporterId: data.reporterId ?? ctx.user.id, responsibleId: data.responsibleId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: incident.id, after: { code, type: data.type, severity: data.severity, status: "REPORTED" }, extra: { event: "report_incident" } });
    return incident;
  });

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

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.occupationalIncident.update({ where: { id }, data: {
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
    await writeAuditLog(tx, { ctx, action: "status_change", module: MODULE, recordId: id, before: { status: incident.status }, after: { status: data.to }, extra: { event: "transition_incident", note: data.note } });
    return row;
  });

  if (incident.responsibleId) {
    await safeNotify({ organizationId: ctx.organization.id, userId: incident.responsibleId, title: `Incidente ${incident.code}: ${data.to}`, body: `El incidente "${incident.title}" avanzó a ${data.to}.`, type: data.to === "CLOSED" ? "SUCCESS" : "INFO", link: "/app/safety", idempotencyKey: `incident:${id}:${data.to}` });
  }
  revalidate();
  return { id, status: updated.status };
}

// ─────────────────────────────────────────────────────
// Emergency drills, contractors
// ─────────────────────────────────────────────────────

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

  const created = await prisma.$transaction(async (tx) => {
    const drill = await tx.emergencyDrill.create({
      data: tenantData(ctx, {
        code, scenario: data.scenario, participants: data.participants ?? null, participantsNote: data.participantsNote ?? null,
        responseTimeMinutes: data.responseTimeMinutes ?? null, outcome: data.outcome ?? null, failures: data.failures ?? null,
        actions: data.actions ?? null, drillDate: data.drillDate ? new Date(data.drillDate) : new Date(), evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: drill.id, after: { code, scenario: data.scenario }, extra: { event: "create_drill" } });
    return drill;
  });
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

  const created = await prisma.$transaction(async (tx) => {
    const assessment = await tx.contractorSafetyAssessment.create({
      data: tenantData(ctx, {
        code, supplierId: data.supplierId ?? null, contractorName: data.contractorName ?? null, risks: data.risks ?? null,
        requirements: data.requirements ?? null, documentation: data.documentation ?? null, outcome: data.outcome,
        score: data.score ?? null, incidents: data.incidents, assessedAt: data.assessedAt ? new Date(data.assessedAt) : null,
        nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null, evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: assessment.id, after: { code, outcome: data.outcome }, extra: { event: "create_contractor_assessment" } });
    return assessment;
  });
  revalidate();
  return { id: created.id, code };
}

// ─────────────────────────────────────────────────────
// Health surveillance (SENSITIVE — safety-sensitive:* permission, not the
// generic safety:*; exposure/protocol/restrictions encrypted at rest).
// Never expose these fields through the general safety payload.
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
  const ctx = await requirePermission("safety-sensitive:create");
  const data = surveillanceSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { personnelId: data.personnelId, positionId: data.positionId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode(ctx.organization.id, "VS", prisma.occupationalHealthSurveillance.count({ where: { organizationId: ctx.organization.id } }));

  const created = await prisma.$transaction(async (tx) => {
    const record = await tx.occupationalHealthSurveillance.create({
      data: tenantData(ctx, {
        code, personnelId: data.personnelId ?? null, workerName: data.workerName ?? null, positionId: data.positionId ?? null,
        exposure: encryptHealthField(data.exposure), protocol: encryptHealthField(data.protocol), fitness: data.fitness,
        restrictions: encryptHealthField(data.restrictions),
        examinedAt: data.examinedAt ? new Date(data.examinedAt) : null, nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
        evidenceId: data.evidenceId ?? null, createdById: ctx.user.id,
      }),
    });
    // Audit metadata never carries the sensitive content itself — only that a
    // record was created and its non-health-detail fields.
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: record.id, after: { code, fitness: data.fitness }, extra: { event: "create_health_surveillance" } });
    return record;
  });
  revalidate();
  return { id: created.id, code };
}

export async function updateHealthSurveillance(id: string, input: Partial<z.infer<typeof surveillanceSchema>>) {
  const ctx = await requirePermission("safety-sensitive:update");
  const existing = await prisma.occupationalHealthSurveillance.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, fitness: true } });
  if (!existing) throw new Error("Registro de vigilancia de la salud no encontrado.");
  const data = surveillanceSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { personnelId: data.personnelId, positionId: data.positionId, evidenceId: data.evidenceId });

  await prisma.$transaction(async (tx) => {
    await tx.occupationalHealthSurveillance.update({ where: { id }, data: {
      ...(data.workerName !== undefined ? { workerName: data.workerName } : {}),
      ...(data.personnelId !== undefined ? { personnelId: data.personnelId } : {}),
      ...(data.positionId !== undefined ? { positionId: data.positionId } : {}),
      ...(data.exposure !== undefined ? { exposure: encryptHealthField(data.exposure) } : {}),
      ...(data.protocol !== undefined ? { protocol: encryptHealthField(data.protocol) } : {}),
      ...(data.restrictions !== undefined ? { restrictions: encryptHealthField(data.restrictions) } : {}),
      ...(data.fitness !== undefined ? { fitness: data.fitness } : {}),
      ...(data.examinedAt !== undefined ? { examinedAt: data.examinedAt ? new Date(data.examinedAt) : null } : {}),
      ...(data.nextReviewDate !== undefined ? { nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null } : {}),
      ...(data.evidenceId !== undefined ? { evidenceId: data.evidenceId } : {}),
    } });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { fitness: existing.fitness }, after: { fitness: data.fitness ?? existing.fitness }, extra: { event: "update_health_surveillance" } });
  });
  revalidate();
  return { id };
}

export async function deleteHealthSurveillance(id: string) {
  const ctx = await requirePermission("safety-sensitive:delete");
  const existing = await prisma.occupationalHealthSurveillance.findFirst({ where: tenantWhere(ctx, { id }), select: { id: true, code: true } });
  if (!existing) throw new Error("Registro de vigilancia de la salud no encontrado.");
  await prisma.$transaction(async (tx) => {
    await tx.occupationalHealthSurveillance.delete({ where: { id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: id, before: { code: existing.code }, extra: { event: "delete_health_surveillance" } });
  });
  revalidate();
  return { id };
}

// ─────────────────────────────────────────────────────
// Edición y altas desde la UI SST
// ─────────────────────────────────────────────────────

export type SafetyRecordKind = "riskAssessment" | "consultation" | "inspection" | "ppeItem" | "ppeAssignment" | "permit" | "incident" | "drill" | "contractor" | "health";

/** Unifica las altas de las entidades SST que comparten el mismo módulo UI. */
export async function createSafetyRecord(kind: SafetyRecordKind, input: Record<string, unknown>) {
  switch (kind) {
    case "riskAssessment": return assessOccupationalRisk(input as never);
    case "consultation": return createConsultation(input as never);
    case "inspection": return createInspection(input as never);
    case "ppeItem": return createPPEItem(input as never);
    case "ppeAssignment": return assignPPE(input as never);
    case "permit": return createPermit(input as never);
    case "incident": return reportIncident(input as never);
    case "drill": return createEmergencyDrill(input as never);
    case "contractor": return createContractorAssessment(input as never);
    case "health": return createHealthSurveillance(input as never);
    default: throw new Error("Tipo de registro SST no válido.");
  }
}

const safetyUpdateSchemas: Record<Exclude<SafetyRecordKind, "health">, z.ZodTypeAny> = {
  riskAssessment: z.object({ hazardId: z.string().min(1), probability: z.number().min(0).max(10), consequence: z.number().min(0).max(100), exposure: z.number().min(0).max(10), controls: z.string().max(2000).nullable().optional(), controlEffectiveness: z.number().int().min(0).max(100).nullable().optional(), assessorId: z.string().nullable().optional(), riskId: z.string().nullable().optional() }),
  consultation: z.object({ topic: z.string().min(1).max(400), method: z.enum(["MEETING", "SURVEY", "COMMITTEE", "SUGGESTION", "TRAINING", "OTHER"]), participants: z.number().int().min(0).nullable().optional(), participantsNote: z.string().max(1000).nullable().optional(), heldAt: z.string().nullable().optional(), conclusions: z.string().max(4000).nullable().optional(), decisions: z.string().max(4000).nullable().optional(), documentId: z.string().nullable().optional() }),
  inspection: z.object({ locationId: z.string().nullable().optional(), area: z.string().max(200).nullable().optional(), type: z.enum(["PLANNED", "UNPLANNED", "BEHAVIORAL", "CONDITION", "LEGAL", "OTHER"]), inspectorId: z.string().nullable().optional(), checklist: z.any().optional(), findings: z.string().max(4000).nullable().optional(), actions: z.string().max(4000).nullable().optional(), evidenceId: z.string().nullable().optional(), capaId: z.string().nullable().optional(), inspectedAt: z.string().nullable().optional() }),
  ppeItem: z.object({ name: z.string().min(1).max(200), ppeType: z.string().min(1).max(200), technicalStandard: z.string().max(200).nullable().optional(), lifespanMonths: z.number().int().min(0).nullable().optional(), maintenance: z.string().max(2000).nullable().optional(), active: z.boolean() }),
  ppeAssignment: z.object({ ppeItemId: z.string().min(1), personnelId: z.string().nullable().optional(), workerName: z.string().max(200).nullable().optional(), deliveredAt: z.string().nullable().optional(), quantity: z.number().int().min(1), trainingProvided: z.boolean(), trainingCourseId: z.string().nullable().optional(), replacementDate: z.string().nullable().optional(), evidenceId: z.string().nullable().optional(), signatureNote: z.string().max(600).nullable().optional() }),
  permit: z.object({ workType: z.enum(["HOT_WORK", "CONFINED_SPACE", "WORK_AT_HEIGHT", "ELECTRICAL", "EXCAVATION", "LOCKOUT_TAGOUT", "LIFTING", "OTHER"]), locationId: z.string().nullable().optional(), area: z.string().max(200).nullable().optional(), hazards: z.string().max(2000).nullable().optional(), controls: z.string().max(2000).nullable().optional(), authorizerId: z.string().nullable().optional(), validFrom: z.string().nullable().optional(), validTo: z.string().nullable().optional() }),
  incident: z.object({ type: z.enum(["ACCIDENT", "INCIDENT", "NEAR_MISS", "OCCUPATIONAL_ILLNESS"]), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), title: z.string().min(1).max(300), description: z.string().max(4000).nullable().optional(), injury: z.string().max(600).nullable().optional(), illness: z.string().max(600).nullable().optional(), occurredAt: z.string().nullable().optional(), locationId: z.string().nullable().optional(), area: z.string().max(200).nullable().optional(), personnelId: z.string().nullable().optional(), workerName: z.string().max(200).nullable().optional(), lostDays: z.number().int().min(0), responsibleId: z.string().nullable().optional() }),
  drill: z.object({ scenario: z.string().min(1).max(400), participants: z.number().int().min(0).nullable().optional(), participantsNote: z.string().max(1000).nullable().optional(), responseTimeMinutes: z.number().int().min(0).nullable().optional(), outcome: z.enum(["PASSED", "PARTIAL", "FAILED"]).nullable().optional(), failures: z.string().max(2000).nullable().optional(), actions: z.string().max(2000).nullable().optional(), drillDate: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
  contractor: z.object({ supplierId: z.string().nullable().optional(), contractorName: z.string().max(200).nullable().optional(), risks: z.string().max(2000).nullable().optional(), requirements: z.string().max(2000).nullable().optional(), documentation: z.string().max(2000).nullable().optional(), outcome: z.enum(["APPROVED", "CONDITIONAL", "REJECTED", "UNDER_REVIEW"]), score: z.number().int().min(0).max(100).nullable().optional(), incidents: z.number().int().min(0), assessedAt: z.string().nullable().optional(), nextReviewDate: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
};

const safetyModelForKind: Record<Exclude<SafetyRecordKind, "health">, string> = {
  riskAssessment: "occupationalRiskAssessment", consultation: "workerConsultation", inspection: "safetyInspection", ppeItem: "pPEItem", ppeAssignment: "pPEAssignment", permit: "permitToWork", incident: "occupationalIncident", drill: "emergencyDrill", contractor: "contractorSafetyAssessment",
};

export async function updateSafetyRecord(id: string, kind: Exclude<SafetyRecordKind, "health">, input: Record<string, unknown>) {
  const ctx = await requirePermission("safety:update");
  const data = safetyUpdateSchemas[kind].parse(input) as Record<string, unknown>;
  const internalRefs: Record<string, string> = { hazardId: "occupationalHazard", ppeItemId: "pPEItem" };
  for (const key of Object.keys(internalRefs)) {
    if (typeof data[key] !== "string" || !data[key]) continue;
    const delegate = (prisma as unknown as Record<string, { findFirst: Function }>)[internalRefs[key]];
    if (!await delegate.findFirst({ where: tenantWhere(ctx, { id: data[key] }), select: { id: true } })) throw new Error("La referencia seleccionada no pertenece a la organización.");
  }
  await assertRefInOrg(ctx.organization.id, {
    processId: typeof data.processId === "string" ? data.processId : undefined,
    riskId: typeof data.riskId === "string" ? data.riskId : undefined,
    capaId: typeof data.capaId === "string" ? data.capaId : undefined,
    evidenceId: typeof data.evidenceId === "string" ? data.evidenceId : undefined,
    documentId: typeof data.documentId === "string" ? data.documentId : undefined,
    trainingCourseId: typeof data.trainingCourseId === "string" ? data.trainingCourseId : undefined,
    supplierId: typeof data.supplierId === "string" ? data.supplierId : undefined,
    personnelId: typeof data.personnelId === "string" ? data.personnelId : undefined,
    positionId: typeof data.positionId === "string" ? data.positionId : undefined,
    locationId: typeof data.locationId === "string" ? data.locationId : undefined,
  });
  const delegate = (prisma as unknown as Record<string, { findFirst: Function; update: Function }>)[safetyModelForKind[kind]];
  const existing = await delegate.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!existing) throw new Error("Registro SST no encontrado.");
  const dateFields = new Set(["heldAt", "inspectedAt", "deliveredAt", "replacementDate", "validFrom", "validTo", "occurredAt", "drillDate", "assessedAt", "nextReviewDate"]);
  const updateData = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, dateFields.has(key) ? (value == null || value === "" ? null : new Date(String(value))) : value]));
  if (kind === "riskAssessment") {
    const result = computeOccupationalRisk({ probability: Number(data.probability), consequence: Number(data.consequence), exposure: Number(data.exposure), controlEffectiveness: typeof data.controlEffectiveness === "number" ? data.controlEffectiveness : undefined });
    Object.assign(updateData, result);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const txDelegate = (tx as unknown as Record<string, { update: Function }>)[safetyModelForKind[kind]];
    const row = await txDelegate.update({ where: { id }, data: updateData });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { kind, id }, after: { kind, fields: Object.keys(updateData) }, extra: { event: "update_safety_record" } });
    return row;
  });
  revalidate();
  return updated;
}
