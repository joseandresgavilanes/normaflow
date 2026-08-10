"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import {
  assertItsmChangeApproval,
  assertItsmChangeTransition,
  assertItsmIncidentTransition,
  assertItsmProblemTransition,
  availabilityPercent,
} from "@/lib/itsm/workflows";
import type { ITSMChangeStatus, ITSMIncidentStatus, ITSMProblemStatus, IncidentLinkDomain } from "@prisma/client";

const MODULE = "itsm";
const revalidate = () => {
  revalidatePath("/app/itsm");
  revalidatePath("/app/activity");
};

async function safeNotify(input: Parameters<typeof notifyUser>[0]) {
  try {
    await notifyUser(input);
  } catch (e) {
    console.error("[itsm] notify failed:", e instanceof Error ? e.message : e);
  }
}

async function assertRefInOrg(
  organizationId: string,
  refs: Partial<Record<
    "processId" | "locationId" | "documentId" | "evidenceId" | "capaId" | "supplierId" | "assetId" | "bcpId",
    string | null | undefined
  >>,
) {
  const checks: Promise<unknown>[] = [];
  const guard = (p: Promise<{ id: string } | null>, label: string) =>
    checks.push(p.then((r) => { if (!r) throw new Error(`Referencia ${label} no pertenece a la organización.`); }));
  const w = (id: string) => ({ where: { id, organizationId }, select: { id: true } });
  if (refs.processId) guard(prisma.process.findFirst(w(refs.processId)), "de proceso");
  if (refs.locationId) guard(prisma.location.findFirst(w(refs.locationId)), "de sede");
  if (refs.documentId) guard(prisma.document.findFirst(w(refs.documentId)), "de documento");
  if (refs.evidenceId) guard(prisma.evidenceFile.findFirst(w(refs.evidenceId)), "de evidencia");
  if (refs.capaId) guard(prisma.cAPA.findFirst(w(refs.capaId)), "de CAPA");
  if (refs.supplierId) guard(prisma.supplier.findFirst(w(refs.supplierId)), "de proveedor");
  if (refs.assetId) guard(prisma.informationAsset.findFirst(w(refs.assetId)), "de activo");
  if (refs.bcpId) guard(prisma.businessContinuityPlan.findFirst(w(refs.bcpId)), "de BCP");
  await Promise.all(checks);
}

async function nextCode(prefix: string, count: Promise<number>) {
  return `${prefix}-${String((await count) + 1).padStart(4, "0")}`;
}

const priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const criticality = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// ─── Service / catalog / SLA ───

const serviceSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  category: z.string().max(120).optional(),
  criticality: criticality.default("MEDIUM"),
  processId: z.string().optional(),
  documentId: z.string().optional(),
});

export async function createITService(input: z.infer<typeof serviceSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = serviceSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, documentId: data.documentId });
  const code = data.code ?? await nextCode("SVC", prisma.iTService.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.iTService.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_it_service" } });
    return row;
  });
  revalidate();
  return created;
}

const catalogSchema = z.object({
  code: z.string().max(40).optional(),
  serviceId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  requestable: z.boolean().default(true),
  estimatedFulfillmentHours: z.number().min(0).optional(),
});

export async function createServiceCatalogEntry(input: z.infer<typeof catalogSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = catalogSchema.parse(input);
  const service = await prisma.iTService.findFirst({ where: tenantWhere(ctx, { id: data.serviceId }) });
  if (!service) throw new Error("Servicio TI no encontrado.");
  const code = data.code ?? await nextCode("CAT", prisma.serviceCatalogEntry.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.serviceCatalogEntry.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_catalog_entry" } });
    return row;
  });
  revalidate();
  return created;
}

const ownerSchema = z.object({
  code: z.string().max(40).optional(),
  serviceId: z.string().min(1),
  userId: z.string().optional(),
  ownerName: z.string().max(200).optional(),
  ownershipRole: z.enum(["PRIMARY", "BACKUP", "DELEGATE"]).default("PRIMARY"),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});

export async function createServiceOwner(input: z.infer<typeof ownerSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = ownerSchema.parse(input);
  const service = await prisma.iTService.findFirst({ where: tenantWhere(ctx, { id: data.serviceId }) });
  if (!service) throw new Error("Servicio TI no encontrado.");
  const code = data.code ?? await nextCode("OWN", prisma.serviceOwner.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.serviceOwner.create({
      data: tenantData(ctx, {
        code, serviceId: data.serviceId, userId: data.userId ?? null, ownerName: data.ownerName,
        ownershipRole: data.ownershipRole,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_service_owner" } });
    return row;
  });
  if (data.userId && data.userId !== ctx.user.id) {
    await safeNotify({
      organizationId: ctx.organization.id, userId: data.userId, title: `Propietario de servicio asignado: ${service.code}`,
      body: `Ha sido asignado como propietario (${data.ownershipRole}) del servicio "${service.name}".`,
      type: "INFO", link: "/app/itsm", idempotencyKey: `service-owner:${created.id}`,
    });
  }
  revalidate();
  return created;
}

const slaSchema = z.object({
  code: z.string().max(40).optional(),
  serviceId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  priority: priority.default("MEDIUM"),
  responseTimeMinutes: z.number().int().positive(),
  resolutionTimeMinutes: z.number().int().positive(),
  availabilityTargetPct: z.number().min(0).max(100).optional(),
  measurementPeriod: z.string().max(120).optional(),
  documentId: z.string().optional(),
});

export async function createServiceLevelAgreement(input: z.infer<typeof slaSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = slaSchema.parse(input);
  const service = await prisma.iTService.findFirst({ where: tenantWhere(ctx, { id: data.serviceId }) });
  if (!service) throw new Error("Servicio TI no encontrado.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode("SLA", prisma.serviceLevelAgreement.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.serviceLevelAgreement.create({ data: tenantData(ctx, { ...data, code, status: "ACTIVE", createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_sla" } });
    return row;
  });
  revalidate();
  return created;
}

const olaSchema = z.object({
  code: z.string().max(40).optional(),
  serviceId: z.string().min(1),
  slaId: z.string().optional(),
  name: z.string().min(1).max(200),
  supportingTeam: z.string().max(200).optional(),
  responseTimeMinutes: z.number().int().positive().optional(),
  resolutionTimeMinutes: z.number().int().positive().optional(),
  description: z.string().max(4000).optional(),
  documentId: z.string().optional(),
});

export async function createOperationalLevelAgreement(input: z.infer<typeof olaSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = olaSchema.parse(input);
  const service = await prisma.iTService.findFirst({ where: tenantWhere(ctx, { id: data.serviceId }) });
  if (!service) throw new Error("Servicio TI no encontrado.");
  if (data.slaId) {
    const sla = await prisma.serviceLevelAgreement.findFirst({ where: tenantWhere(ctx, { id: data.slaId }) });
    if (!sla) throw new Error("SLA no encontrado.");
  }
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode("OLA", prisma.operationalLevelAgreement.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.operationalLevelAgreement.create({ data: tenantData(ctx, { ...data, code, status: "ACTIVE", createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_ola" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── Requests ───

const requestSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  serviceId: z.string().optional(),
  catalogEntryId: z.string().optional(),
  slaId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: priority.default("MEDIUM"),
  dueAt: z.string().optional(),
});

export async function createServiceRequest(input: z.infer<typeof requestSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = requestSchema.parse(input);
  if (data.serviceId) {
    const s = await prisma.iTService.findFirst({ where: tenantWhere(ctx, { id: data.serviceId }) });
    if (!s) throw new Error("Servicio TI no encontrado.");
  }
  if (data.catalogEntryId) {
    const c = await prisma.serviceCatalogEntry.findFirst({ where: tenantWhere(ctx, { id: data.catalogEntryId }) });
    if (!c) throw new Error("Entrada de catálogo no encontrada.");
  }
  const code = data.code ?? await nextCode("SRQ", prisma.serviceRequest.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.serviceRequest.create({
      data: tenantData(ctx, {
        ...data, code, requesterId: ctx.user.id,
        dueAt: data.dueAt ? new Date(data.dueAt) : null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_service_request" } });
    return row;
  });
  if (data.assigneeId && data.assigneeId !== ctx.user.id) {
    await safeNotify({
      organizationId: ctx.organization.id, userId: data.assigneeId, title: `Solicitud asignada: ${created.code}`,
      body: `Se le ha asignado la solicitud "${created.title}".`, type: "INFO", link: "/app/itsm",
      idempotencyKey: `service-request:${created.id}:assignee`,
    });
  }
  revalidate();
  return created;
}

// ─── Incidents ───

const incidentSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(8000).optional(),
  serviceId: z.string().optional(),
  slaId: z.string().optional(),
  requestId: z.string().optional(),
  problemId: z.string().optional(),
  configurationItemId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: priority.default("MEDIUM"),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  capaId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createItsmIncident(input: z.infer<typeof incidentSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = incidentSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("INC", prisma.iTSMIncident.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.iTSMIncident.create({
      data: tenantData(ctx, { ...data, code, reporterId: ctx.user.id, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_itsm_incident" } });
    return row;
  });
  if (data.assigneeId && data.assigneeId !== ctx.user.id) {
    await safeNotify({
      organizationId: ctx.organization.id, userId: data.assigneeId, title: `Incidente de servicio asignado: ${created.code}`,
      body: `Se le ha asignado el incidente "${created.title}".`, type: "WARNING", link: "/app/itsm",
      idempotencyKey: `itsm-incident:${created.id}:assignee`,
    });
  }
  revalidate();
  return created;
}

export async function transitionItsmIncident(id: string, to: ITSMIncidentStatus, resolutionNotes?: string) {
  const needsApprove = to === "CONFIRMED" || to === "CLOSED";
  const ctx = await requirePermission(needsApprove ? "itsm:approve" : "itsm:update");
  const row = await prisma.iTSMIncident.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Incidente ITSM no encontrado.");
  assertItsmIncidentTransition(row.status, to);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.iTSMIncident.update({
      where: { id },
      data: {
        status: to,
        resolutionNotes: resolutionNotes ?? row.resolutionNotes,
        ...(to === "ASSIGNED" ? { assignedAt: row.assignedAt ?? now, assigneeId: row.assigneeId ?? ctx.user.id } : {}),
        ...(to === "RESOLVED" ? { resolvedAt: row.resolvedAt ?? now } : {}),
        ...(to === "CONFIRMED" ? { confirmedAt: now, confirmedById: ctx.user.id, resolvedAt: row.resolvedAt ?? now } : {}),
        ...(to === "CLOSED" ? {
          closedAt: now,
          confirmedAt: row.confirmedAt ?? now,
          confirmedById: row.confirmedById ?? ctx.user.id,
          resolvedAt: row.resolvedAt ?? now,
        } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_itsm_incident" },
    });
  });
  revalidate();
  return { id, status: to };
}

// ─── Cross-domain incident links (integración sin fusionar workflows) ───

const crossLinkSchema = z.object({
  itsmIncidentId: z.string().min(1),
  targetDomain: z.enum(["SECURITY", "AI", "OCCUPATIONAL"]),
  targetId: z.string().min(1),
  relationType: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

async function assertCrossLinkTargetInOrg(organizationId: string, domain: IncidentLinkDomain, targetId: string) {
  const found = await (domain === "SECURITY"
    ? prisma.securityIncident.findFirst({ where: { id: targetId, organizationId }, select: { id: true } })
    : domain === "AI"
    ? prisma.aIIncident.findFirst({ where: { id: targetId, organizationId }, select: { id: true } })
    : prisma.occupationalIncident.findFirst({ where: { id: targetId, organizationId }, select: { id: true } }));
  if (!found) throw new Error("El incidente relacionado no pertenece a la organización.");
}

/**
 * Enlaza un ITSMIncident con un SecurityIncident/AIIncident/OccupationalIncident
 * ya existente. No toca el estado de ninguno de los dos — cada dominio conserva
 * su propio workflow; esto es solo trazabilidad de "están relacionados".
 */
export async function linkItsmIncidentCrossDomain(input: z.infer<typeof crossLinkSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = crossLinkSchema.parse(input);
  const incident = await prisma.iTSMIncident.findFirst({ where: tenantWhere(ctx, { id: data.itsmIncidentId }) });
  if (!incident) throw new Error("Incidente ITSM no encontrado.");
  await assertCrossLinkTargetInOrg(ctx.organization.id, data.targetDomain, data.targetId);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.incidentCrossLink.create({
      data: tenantData(ctx, {
        itsmIncidentId: data.itsmIncidentId, targetDomain: data.targetDomain, targetId: data.targetId,
        relationType: data.relationType ?? null, notes: data.notes ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, {
      ctx, action: "create", module: MODULE, recordId: row.id,
      after: { itsmIncidentId: data.itsmIncidentId, targetDomain: data.targetDomain, targetId: data.targetId },
      extra: { event: "link_itsm_incident_cross_domain" },
    });
    return row;
  });
  revalidate();
  return created;
}

// ─── Problems / known errors ───

const problemSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(8000).optional(),
  serviceId: z.string().optional(),
  rootCause: z.string().max(4000).optional(),
  workaround: z.string().max(4000).optional(),
  assigneeId: z.string().optional(),
  capaId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createItsmProblem(input: z.infer<typeof problemSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = problemSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("PRB", prisma.problem.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.problem.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_itsm_problem" } });
    return row;
  });
  if (data.assigneeId && data.assigneeId !== ctx.user.id) {
    await safeNotify({
      organizationId: ctx.organization.id, userId: data.assigneeId, title: `Problema asignado: ${created.code}`,
      body: `Se le ha asignado el problema "${created.title}".`, type: "INFO", link: "/app/itsm",
      idempotencyKey: `itsm-problem:${created.id}:assignee`,
    });
  }
  revalidate();
  return created;
}

export async function transitionItsmProblem(id: string, to: ITSMProblemStatus) {
  const ctx = await requirePermission("itsm:update");
  const row = await prisma.problem.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Problema no encontrado.");
  assertItsmProblemTransition(row.status, to);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.problem.update({
      where: { id },
      data: {
        status: to,
        ...(to === "RESOLVED" ? { resolvedAt: row.resolvedAt ?? now } : {}),
        ...(to === "CLOSED" ? { closedAt: now, resolvedAt: row.resolvedAt ?? now } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_itsm_problem" },
    });
  });
  revalidate();
  return { id, status: to };
}

const knownErrorSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(8000).optional(),
  problemId: z.string().optional(),
  configurationItemId: z.string().optional(),
  workaround: z.string().max(4000).optional(),
  permanentFix: z.string().max(4000).optional(),
});

export async function createKnownError(input: z.infer<typeof knownErrorSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = knownErrorSchema.parse(input);
  let problem: { id: string; status: string } | null = null;
  if (data.problemId) {
    problem = await prisma.problem.findFirst({ where: tenantWhere(ctx, { id: data.problemId }), select: { id: true, status: true } });
    if (!problem) throw new Error("Problema no encontrado.");
  }
  const code = data.code ?? await nextCode("KE", prisma.knownError.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.knownError.create({ data: tenantData(ctx, { ...data, code, status: "DOCUMENTED", createdById: ctx.user.id }) });
    if (problem && (problem.status === "ANALYSIS" || problem.status === "IDENTIFIED")) {
      await tx.problem.update({ where: { id: problem.id }, data: { status: "KNOWN_ERROR" } });
    }
    await writeAuditLog(tx, {
      ctx, action: "create", module: MODULE, recordId: row.id, after: { code },
      extra: { event: "create_known_error", problemAdvanced: problem && (problem.status === "ANALYSIS" || problem.status === "IDENTIFIED") ? problem.id : null },
    });
    return row;
  });
  revalidate();
  return created;
}

// ─── Changes / releases / deployments ───

const changeSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(8000).optional(),
  serviceId: z.string().optional(),
  changeType: z.enum(["STANDARD", "NORMAL", "EMERGENCY"]).default("NORMAL"),
  riskLevel: criticality.default("MEDIUM"),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  relatedIncidentId: z.string().optional(),
  relatedProblemId: z.string().optional(),
  capaId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createItsmChange(input: z.infer<typeof changeSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = changeSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId, documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("CHG", prisma.iTSMChange.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.iTSMChange.create({
      data: tenantData(ctx, {
        code, title: data.title, description: data.description, serviceId: data.serviceId,
        changeType: data.changeType, riskLevel: data.riskLevel, impact: data.impact,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
        relatedIncidentId: data.relatedIncidentId, relatedProblemId: data.relatedProblemId,
        capaId: data.capaId, documentId: data.documentId, evidenceId: data.evidenceId,
        requestedById: ctx.user.id, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_itsm_change" } });
    return row;
  });
  revalidate();
  return created;
}

export async function transitionItsmChange(id: string, to: ITSMChangeStatus) {
  const needsApprove = to === "APPROVED" || to === "CLOSED";
  const ctx = await requirePermission(needsApprove ? "itsm:approve" : "itsm:update");
  const row = await prisma.iTSMChange.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Cambio ITSM no encontrado.");
  assertItsmChangeTransition(row.status, to);
  const now = new Date();
  if (to === "APPROVED" || ["SCHEDULED","IMPLEMENTED","REVIEWED","CLOSED"].includes(to)) {
    assertItsmChangeApproval({ approvedById: to === "APPROVED" ? ctx.user.id : row.approvedById ?? ctx.user.id });
  }
  await prisma.$transaction(async (tx) => {
    await tx.iTSMChange.update({
      where: { id },
      data: {
        status: to,
        ...(to === "ASSESSED" ? { assessedById: ctx.user.id } : {}),
        ...(to === "APPROVED" ? { approvedById: ctx.user.id } : {}),
        ...(to === "IMPLEMENTED" ? { implementedAt: now, implementedById: ctx.user.id, approvedById: row.approvedById ?? ctx.user.id } : {}),
        ...(to === "REVIEWED" ? { reviewedAt: now, approvedById: row.approvedById ?? ctx.user.id } : {}),
        ...(to === "SCHEDULED" ? { approvedById: row.approvedById ?? ctx.user.id } : {}),
        ...(to === "CLOSED" ? { closedAt: now, approvedById: row.approvedById ?? ctx.user.id } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_itsm_change" },
    });
  });
  revalidate();
  return { id, status: to };
}

const releaseSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  version: z.string().min(1).max(40),
  serviceId: z.string().optional(),
  plannedAt: z.string().optional(),
  changeCodes: z.array(z.string()).default([]),
  notes: z.string().max(4000).optional(),
  documentId: z.string().optional(),
});

export async function createRelease(input: z.infer<typeof releaseSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = releaseSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode("REL", prisma.release.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.release.create({
      data: tenantData(ctx, { ...data, code, plannedAt: data.plannedAt ? new Date(data.plannedAt) : null, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_release" } });
    return row;
  });
  revalidate();
  return created;
}

const deploymentSchema = z.object({
  code: z.string().max(40).optional(),
  releaseId: z.string().min(1),
  environment: z.enum(["DEV", "TEST", "STAGING", "PROD"]).default("PROD"),
  configurationItemId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function createDeployment(input: z.infer<typeof deploymentSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = deploymentSchema.parse(input);
  const release = await prisma.release.findFirst({ where: tenantWhere(ctx, { id: data.releaseId }) });
  if (!release) throw new Error("Release no encontrado.");
  const code = data.code ?? await nextCode("DEP", prisma.deployment.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.deployment.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_deployment" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── CMDB ───

const ciSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  ciType: z.enum(["APPLICATION", "SERVER", "DATABASE", "NETWORK", "SERVICE", "DOCUMENTATION", "OTHER"]).default("OTHER"),
  serviceId: z.string().optional(),
  assetId: z.string().optional(),
  ownerId: z.string().optional(),
  locationId: z.string().optional(),
  criticality: criticality.default("MEDIUM"),
  version: z.string().max(80).optional(),
  serialNumber: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export async function createConfigurationItem(input: z.infer<typeof ciSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = ciSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { assetId: data.assetId, locationId: data.locationId });
  const code = data.code ?? await nextCode("CI", prisma.configurationItem.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.configurationItem.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_configuration_item" } });
    return row;
  });
  if (data.ownerId && data.ownerId !== ctx.user.id) {
    await safeNotify({
      organizationId: ctx.organization.id, userId: data.ownerId, title: `CI asignado: ${created.code}`,
      body: `Ha sido asignado como propietario del elemento de configuración "${created.name}".`,
      type: "INFO", link: "/app/itsm", idempotencyKey: `ci:${created.id}:owner`,
    });
  }
  revalidate();
  return created;
}

const relSchema = z.object({
  code: z.string().max(40).optional(),
  sourceCiId: z.string().min(1),
  targetCiId: z.string().min(1),
  relationType: z.enum(["DEPENDS_ON", "RUNS_ON", "CONNECTS_TO", "USES", "OWNED_BY", "OTHER"]).default("DEPENDS_ON"),
  notes: z.string().max(2000).optional(),
});

export async function createCmdbRelationship(input: z.infer<typeof relSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = relSchema.parse(input);
  if (data.sourceCiId === data.targetCiId) throw new Error("Un CI no puede relacionarse consigo mismo.");
  const [src, tgt] = await Promise.all([
    prisma.configurationItem.findFirst({ where: tenantWhere(ctx, { id: data.sourceCiId }) }),
    prisma.configurationItem.findFirst({ where: tenantWhere(ctx, { id: data.targetCiId }) }),
  ]);
  if (!src || !tgt) throw new Error("Elemento de configuración no encontrado.");
  const code = data.code ?? await nextCode("RELN", prisma.cMDBRelationship.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.cMDBRelationship.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_cmdb_relationship" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── Plans / suppliers / knowledge / reports ───

const availSchema = z.object({
  code: z.string().max(40).optional(),
  serviceId: z.string().min(1),
  title: z.string().min(1).max(200),
  targetPercent: z.number().min(0).max(100),
  measurementPeriod: z.string().max(120).optional(),
  agreedDowntimeMinutes: z.number().int().min(0).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  notes: z.string().max(4000).optional(),
  documentId: z.string().optional(),
});

export async function createAvailabilityPlan(input: z.infer<typeof availSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = availSchema.parse(input);
  const service = await prisma.iTService.findFirst({ where: tenantWhere(ctx, { id: data.serviceId }) });
  if (!service) throw new Error("Servicio TI no encontrado.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  let actualAvailabilityPct: number | undefined;
  if (data.periodStart && data.periodEnd && typeof data.agreedDowntimeMinutes === "number") {
    const periodMinutes = Math.max(1, Math.round((new Date(data.periodEnd).getTime() - new Date(data.periodStart).getTime()) / 60000));
    actualAvailabilityPct = availabilityPercent(periodMinutes, data.agreedDowntimeMinutes);
  }
  const code = data.code ?? await nextCode("AVL", prisma.availabilityPlan.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.availabilityPlan.create({
      data: tenantData(ctx, {
        code, serviceId: data.serviceId, title: data.title, targetPercent: data.targetPercent,
        measurementPeriod: data.measurementPeriod, agreedDowntimeMinutes: data.agreedDowntimeMinutes,
        actualAvailabilityPct, periodStart: data.periodStart ? new Date(data.periodStart) : null,
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : null, notes: data.notes,
        documentId: data.documentId, status: "ACTIVE", createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_availability_plan" } });
    return row;
  });
  revalidate();
  return created;
}

const capacitySchema = z.object({
  code: z.string().max(40).optional(),
  serviceId: z.string().min(1),
  title: z.string().min(1).max(200),
  metric: z.string().min(1).max(120),
  currentCapacity: z.number().optional(),
  forecastCapacity: z.number().optional(),
  thresholdPercent: z.number().min(0).max(100).optional(),
  unit: z.string().max(40).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  notes: z.string().max(4000).optional(),
  documentId: z.string().optional(),
});

export async function createCapacityPlan(input: z.infer<typeof capacitySchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = capacitySchema.parse(input);
  const service = await prisma.iTService.findFirst({ where: tenantWhere(ctx, { id: data.serviceId }) });
  if (!service) throw new Error("Servicio TI no encontrado.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode("CAP", prisma.capacityPlan.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.capacityPlan.create({
      data: tenantData(ctx, {
        ...data, code, status: "ACTIVE",
        periodStart: data.periodStart ? new Date(data.periodStart) : null,
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_capacity_plan" } });
    return row;
  });
  revalidate();
  return created;
}

const continuitySchema = z.object({
  code: z.string().max(40).optional(),
  serviceId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(8000).optional(),
  rtoMinutes: z.number().int().min(0).optional(),
  rpoMinutes: z.number().int().min(0).optional(),
  bcpId: z.string().optional(),
  lastTestedAt: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export async function createServiceContinuityPlan(input: z.infer<typeof continuitySchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = continuitySchema.parse(input);
  const service = await prisma.iTService.findFirst({ where: tenantWhere(ctx, { id: data.serviceId }) });
  if (!service) throw new Error("Servicio TI no encontrado.");
  await assertRefInOrg(ctx.organization.id, { bcpId: data.bcpId, documentId: data.documentId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("SCP", prisma.serviceContinuityPlan.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.serviceContinuityPlan.create({
      data: tenantData(ctx, {
        ...data, code, status: "ACTIVE",
        lastTestedAt: data.lastTestedAt ? new Date(data.lastTestedAt) : null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_service_continuity_plan" } });
    return row;
  });
  revalidate();
  return created;
}

const supplierSchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  serviceId: z.string().optional(),
  supplierId: z.string().optional(),
  contractRef: z.string().max(200).optional(),
  criticality: criticality.default("MEDIUM"),
  reviewDueAt: z.string().optional(),
  notes: z.string().max(4000).optional(),
  documentId: z.string().optional(),
});

export async function createServiceSupplier(input: z.infer<typeof supplierSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = supplierSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId, documentId: data.documentId });
  const code = data.code ?? await nextCode("SSP", prisma.serviceSupplier.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.serviceSupplier.create({
      data: tenantData(ctx, { ...data, code, reviewDueAt: data.reviewDueAt ? new Date(data.reviewDueAt) : null, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_service_supplier" } });
    return row;
  });
  revalidate();
  return created;
}

const articleSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  category: z.enum(["HOWTO", "KNOWN_ERROR", "FAQ", "RUNBOOK", "OTHER"]).default("HOWTO"),
  content: z.string().min(1).max(20000),
  serviceId: z.string().optional(),
  knownErrorId: z.string().optional(),
  problemId: z.string().optional(),
  incidentId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  publish: z.boolean().default(false),
});

export async function createKnowledgeArticle(input: z.infer<typeof articleSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = articleSchema.parse(input);
  const code = data.code ?? await nextCode("KB", prisma.knowledgeArticle.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.knowledgeArticle.create({
      data: tenantData(ctx, {
        code, title: data.title, category: data.category, content: data.content,
        serviceId: data.serviceId, knownErrorId: data.knownErrorId, problemId: data.problemId, incidentId: data.incidentId,
        tags: data.tags, authorId: ctx.user.id,
        status: data.publish ? "PUBLISHED" : "DRAFT",
        publishedAt: data.publish ? new Date() : null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_knowledge_article" } });
    return row;
  });
  revalidate();
  return created;
}

const reportSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(200),
  reportType: z.enum(["SLA", "INCIDENTS", "AVAILABILITY", "CAPACITY", "CONTINUITY", "SUPPLIERS", "PERFORMANCE", "CUSTOM"]).default("PERFORMANCE"),
  serviceId: z.string().optional(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  summary: z.string().max(8000).optional(),
  metrics: z.any().optional(),
  documentId: z.string().optional(),
});

export async function createServiceReport(input: z.infer<typeof reportSchema>) {
  const ctx = await requirePermission("itsm:create");
  const data = reportSchema.parse(input);
  if (new Date(data.periodEnd) < new Date(data.periodStart)) {
    throw new Error("El periodo del informe de servicio es inválido.");
  }
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode("RPT", prisma.serviceReport.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.serviceReport.create({
      data: tenantData(ctx, {
        code, title: data.title, reportType: data.reportType, serviceId: data.serviceId,
        periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd),
        summary: data.summary, metrics: data.metrics ?? undefined, documentId: data.documentId,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_service_report" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── Actualización y ciclo de vida ─────────────────────────────────────────
// Los registros operativos conservan su historial: la UI ofrece edición de
// atributos y archivado mediante estados, pero no borrado físico.

export type ItsmRecordKind =
  | "service" | "catalog" | "owner" | "sla" | "ola" | "request" | "incident"
  | "problem" | "knownError" | "change" | "release" | "deployment" | "ci"
  | "relationship" | "availability" | "capacity" | "continuity" | "supplier"
  | "article" | "report" | "crossLink";

const optionalDate = (value: unknown) => value == null || value === "" ? null : new Date(String(value));
const updateText = (max: number) => z.string().max(max).nullable().optional();

const updateSchemas: Record<ItsmRecordKind, z.ZodTypeAny> = {
  service: z.object({ name: z.string().min(1).max(200), description: updateText(4000), category: updateText(120), criticality: criticality.optional(), status: z.enum(["ACTIVE", "UNDER_REVIEW", "RETIRED"]).optional(), processId: z.string().nullable().optional(), documentId: z.string().nullable().optional() }),
  catalog: z.object({ serviceId: z.string().min(1), name: z.string().min(1).max(200), description: updateText(4000), requestable: z.boolean(), estimatedFulfillmentHours: z.number().min(0).nullable().optional(), active: z.boolean() }),
  owner: z.object({ serviceId: z.string().min(1), userId: z.string().nullable().optional(), ownerName: updateText(200), ownershipRole: z.enum(["PRIMARY", "BACKUP", "DELEGATE"]), effectiveFrom: z.string().optional(), effectiveTo: z.string().nullable().optional() }),
  sla: z.object({ serviceId: z.string().min(1), name: z.string().min(1).max(200), description: updateText(4000), priority: priority, responseTimeMinutes: z.number().int().positive(), resolutionTimeMinutes: z.number().int().positive(), availabilityTargetPct: z.number().min(0).max(100).nullable().optional(), measurementPeriod: updateText(120), status: z.enum(["DRAFT", "ACTIVE", "SUPERSEDED", "EXPIRED"]).optional(), effectiveFrom: z.string().nullable().optional(), effectiveTo: z.string().nullable().optional(), documentId: z.string().nullable().optional() }),
  ola: z.object({ serviceId: z.string().min(1), slaId: z.string().nullable().optional(), name: z.string().min(1).max(200), supportingTeam: updateText(200), responseTimeMinutes: z.number().int().positive().nullable().optional(), resolutionTimeMinutes: z.number().int().positive().nullable().optional(), description: updateText(4000), status: z.enum(["DRAFT", "ACTIVE", "SUPERSEDED", "EXPIRED"]).optional(), documentId: z.string().nullable().optional() }),
  request: z.object({ title: z.string().min(1).max(200), description: updateText(4000), serviceId: z.string().nullable().optional(), catalogEntryId: z.string().nullable().optional(), slaId: z.string().nullable().optional(), assigneeId: z.string().nullable().optional(), priority, dueAt: z.string().nullable().optional() }),
  incident: z.object({ title: z.string().min(1).max(200), description: updateText(8000), serviceId: z.string().nullable().optional(), slaId: z.string().nullable().optional(), requestId: z.string().nullable().optional(), problemId: z.string().nullable().optional(), configurationItemId: z.string().nullable().optional(), assigneeId: z.string().nullable().optional(), priority, impact: criticality, urgency: criticality, resolutionNotes: updateText(4000) }),
  problem: z.object({ title: z.string().min(1).max(200), description: updateText(8000), serviceId: z.string().nullable().optional(), rootCause: updateText(4000), workaround: updateText(4000), assigneeId: z.string().nullable().optional() }),
  knownError: z.object({ title: z.string().min(1).max(200), description: updateText(8000), problemId: z.string().nullable().optional(), configurationItemId: z.string().nullable().optional(), workaround: updateText(4000), permanentFix: updateText(4000), status: z.enum(["OPEN", "DOCUMENTED", "RESOLVED"]).optional() }),
  change: z.object({ title: z.string().min(1).max(200), description: updateText(8000), serviceId: z.string().nullable().optional(), changeType: z.enum(["STANDARD", "NORMAL", "EMERGENCY"]), riskLevel: criticality, impact: criticality, scheduledStart: z.string().nullable().optional(), scheduledEnd: z.string().nullable().optional() }),
  release: z.object({ title: z.string().min(1).max(200), version: z.string().min(1).max(40), serviceId: z.string().nullable().optional(), plannedAt: z.string().nullable().optional(), changeCodes: z.array(z.string()), notes: updateText(4000), documentId: z.string().nullable().optional() }),
  deployment: z.object({ releaseId: z.string().min(1), environment: z.enum(["DEV", "TEST", "STAGING", "PROD"]), configurationItemId: z.string().nullable().optional(), notes: updateText(2000) }),
  ci: z.object({ name: z.string().min(1).max(200), ciType: z.enum(["APPLICATION", "SERVER", "DATABASE", "NETWORK", "SERVICE", "DOCUMENTATION", "OTHER"]), serviceId: z.string().nullable().optional(), assetId: z.string().nullable().optional(), ownerId: z.string().nullable().optional(), locationId: z.string().nullable().optional(), criticality, version: updateText(80), serialNumber: updateText(120), notes: updateText(2000), status: z.enum(["IN_USE", "MAINTENANCE", "RETIRED", "PLANNED"]) }),
  relationship: z.object({ sourceCiId: z.string().min(1), targetCiId: z.string().min(1), relationType: z.enum(["DEPENDS_ON", "RUNS_ON", "CONNECTS_TO", "USES", "OWNED_BY", "OTHER"]), notes: updateText(2000) }),
  availability: z.object({ serviceId: z.string().min(1), title: z.string().min(1).max(200), targetPercent: z.number().min(0).max(100), measurementPeriod: updateText(120), agreedDowntimeMinutes: z.number().int().min(0).nullable().optional(), periodStart: z.string().nullable().optional(), periodEnd: z.string().nullable().optional(), notes: updateText(4000), status: z.enum(["DRAFT", "APPROVED", "ACTIVE", "SUPERSEDED"]), documentId: z.string().nullable().optional() }),
  capacity: z.object({ serviceId: z.string().min(1), title: z.string().min(1).max(200), metric: z.string().min(1).max(120), currentCapacity: z.number().nullable().optional(), forecastCapacity: z.number().nullable().optional(), thresholdPercent: z.number().min(0).max(100).nullable().optional(), unit: updateText(40), periodStart: z.string().nullable().optional(), periodEnd: z.string().nullable().optional(), notes: updateText(4000), status: z.enum(["DRAFT", "APPROVED", "ACTIVE", "SUPERSEDED"]), documentId: z.string().nullable().optional() }),
  continuity: z.object({ serviceId: z.string().min(1), title: z.string().min(1).max(200), description: updateText(8000), rtoMinutes: z.number().int().min(0).nullable().optional(), rpoMinutes: z.number().int().min(0).nullable().optional(), bcpId: z.string().nullable().optional(), lastTestedAt: z.string().nullable().optional(), status: z.enum(["DRAFT", "APPROVED", "ACTIVE", "SUPERSEDED"]), documentId: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
  supplier: z.object({ name: z.string().min(1).max(200), serviceId: z.string().nullable().optional(), supplierId: z.string().nullable().optional(), contractRef: updateText(200), criticality, reviewDueAt: z.string().nullable().optional(), notes: updateText(4000), status: z.enum(["ACTIVE", "UNDER_REVIEW", "EXITING", "INACTIVE"]), documentId: z.string().nullable().optional() }),
  article: z.object({ title: z.string().min(1).max(200), category: z.enum(["HOWTO", "KNOWN_ERROR", "FAQ", "RUNBOOK", "OTHER"]), content: z.string().min(1).max(20000), serviceId: z.string().nullable().optional(), knownErrorId: z.string().nullable().optional(), problemId: z.string().nullable().optional(), incidentId: z.string().nullable().optional(), tags: z.array(z.string()), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }),
  report: z.object({ title: z.string().min(1).max(200), reportType: z.enum(["SLA", "INCIDENTS", "AVAILABILITY", "CAPACITY", "CONTINUITY", "SUPPLIERS", "PERFORMANCE", "CUSTOM"]), serviceId: z.string().nullable().optional(), periodStart: z.string().min(1), periodEnd: z.string().min(1), summary: updateText(8000), metrics: z.any().optional(), documentId: z.string().nullable().optional() }),
  crossLink: z.object({ relationType: updateText(120), notes: updateText(2000) }),
};

const modelForKind: Record<ItsmRecordKind, string> = {
  service: "iTService", catalog: "serviceCatalogEntry", owner: "serviceOwner", sla: "serviceLevelAgreement", ola: "operationalLevelAgreement", request: "serviceRequest", incident: "iTSMIncident", problem: "problem", knownError: "knownError", change: "iTSMChange", release: "release", deployment: "deployment", ci: "configurationItem", relationship: "cMDBRelationship", availability: "availabilityPlan", capacity: "capacityPlan", continuity: "serviceContinuityPlan", supplier: "serviceSupplier", article: "knowledgeArticle", report: "serviceReport", crossLink: "incidentCrossLink",
};

function scopedRef(kind: ItsmRecordKind, data: Record<string, unknown>) {
  const refs = ["serviceId", "slaId", "requestId", "problemId", "configurationItemId", "catalogEntryId", "releaseId", "sourceCiId", "targetCiId", "assetId", "locationId", "bcpId", "supplierId", "knownErrorId", "incidentId", "documentId", "evidenceId"];
  return refs.filter((key) => key in data && typeof data[key] === "string" && data[key]).map((key) => ({ key, value: data[key] as string }));
}

export async function updateItsmRecord(id: string, kind: ItsmRecordKind, input: Record<string, unknown>) {
  const ctx = await requirePermission("itsm:update");
  if (!modelForKind[kind]) throw new Error("Tipo de registro ITSM no válido.");
  const data = updateSchemas[kind].parse(input) as Record<string, unknown>;
  if (kind === "relationship" && data.sourceCiId === data.targetCiId) throw new Error("Un CI no puede relacionarse consigo mismo.");
  const internalRefModels: Record<string, string> = {
    serviceId: "iTService", slaId: "serviceLevelAgreement", requestId: "serviceRequest", problemId: "problem",
    configurationItemId: "configurationItem", catalogEntryId: "serviceCatalogEntry", releaseId: "release",
    sourceCiId: "configurationItem", targetCiId: "configurationItem", knownErrorId: "knownError", incidentId: "iTSMIncident",
  };
  for (const ref of scopedRef(kind, data)) {
    if (["documentId", "evidenceId", "bcpId", "supplierId", "assetId", "locationId"].includes(ref.key)) await assertRefInOrg(ctx.organization.id, { [ref.key]: ref.value } as Parameters<typeof assertRefInOrg>[1]);
    else {
      const refDelegate = (prisma as unknown as Record<string, { findFirst: Function }>)[internalRefModels[ref.key]];
      const exists = refDelegate && await refDelegate.findFirst({ where: tenantWhere(ctx, { id: ref.value }), select: { id: true } });
      if (!exists) throw new Error("La referencia seleccionada no pertenece a la organización.");
    }
  }
  const dateFields = new Set(["effectiveFrom", "effectiveTo", "dueAt", "scheduledStart", "scheduledEnd", "plannedAt", "periodStart", "periodEnd", "lastTestedAt", "reviewDueAt"]);
  const updateData = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, dateFields.has(key) ? optionalDate(value) : value]));
  const delegate = (prisma as unknown as Record<string, { findFirst: Function; update: Function }>)[modelForKind[kind]];
  const row = await delegate.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Registro ITSM no encontrado.");
  if (kind === "article" && "status" in data) {
    updateData.publishedAt = data.status === "PUBLISHED" ? row.publishedAt ?? new Date() : data.status === "DRAFT" ? null : row.publishedAt;
  }
  const updated = await prisma.$transaction(async (tx) => {
    const txDelegate = (tx as unknown as Record<string, { update: Function }>)[modelForKind[kind]];
    const result = await txDelegate.update({ where: { id }, data: updateData });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { kind, id }, after: { kind, fields: Object.keys(updateData) }, extra: { event: "update_itsm_record" } });
    return result;
  });
  revalidate();
  return updated;
}

/**
 * Retira o reactiva registros de catálogo sin borrar trazabilidad. Los
 * incidentes, cambios, problemas y solicitudes conservan su propio workflow
 * y por eso no se fuerzan desde esta acción.
 */
const archiveUpdates: Partial<Record<ItsmRecordKind, { archive: Record<string, unknown>; restore: Record<string, unknown> }>> = {
  service: { archive: { status: "RETIRED" }, restore: { status: "ACTIVE" } },
  catalog: { archive: { active: false }, restore: { active: true } },
  owner: { archive: {}, restore: { effectiveTo: null } },
  sla: { archive: { status: "SUPERSEDED" }, restore: { status: "DRAFT" } },
  ola: { archive: { status: "SUPERSEDED" }, restore: { status: "DRAFT" } },
  knownError: { archive: { status: "RESOLVED" }, restore: { status: "OPEN", resolvedAt: null } },
  ci: { archive: { status: "RETIRED" }, restore: { status: "IN_USE" } },
  availability: { archive: { status: "SUPERSEDED" }, restore: { status: "DRAFT" } },
  capacity: { archive: { status: "SUPERSEDED" }, restore: { status: "DRAFT" } },
  continuity: { archive: { status: "SUPERSEDED" }, restore: { status: "DRAFT" } },
  supplier: { archive: { status: "INACTIVE" }, restore: { status: "ACTIVE" } },
  article: { archive: { status: "ARCHIVED" }, restore: { status: "DRAFT" } },
};

export async function setItsmRecordArchived(id: string, kind: ItsmRecordKind, archived: boolean) {
  const ctx = await requirePermission("itsm:update");
  const config = archiveUpdates[kind];
  if (!config) throw new Error("Este registro se gestiona mediante su flujo de trabajo y no se puede archivar directamente.");
  const delegate = (prisma as unknown as Record<string, { findFirst: Function; update: Function }>)[modelForKind[kind]];
  const row = await delegate.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Registro ITSM no encontrado.");
  const data = {
    ...(archived ? config.archive : config.restore),
    ...(archived && kind === "owner" ? { effectiveTo: new Date() } : {}),
    ...(archived && kind === "knownError" ? { resolvedAt: new Date() } : {}),
  };
  await prisma.$transaction(async (tx) => {
    const txDelegate = (tx as unknown as Record<string, { update: Function }>)[modelForKind[kind]];
    await txDelegate.update({ where: { id }, data });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: id,
      before: { kind, archived: !archived }, after: { kind, archived },
      extra: { event: archived ? "archive_itsm_record" : "restore_itsm_record" },
    });
  });
  revalidate();
  return { id, kind, archived };
}

/** Los vínculos y los informes se pueden retirar definitivamente; el audit trail
 * conserva el evento y el resto de los registros ITSM se archivan por estado. */
export async function deleteItsmRecord(id: string, kind: "relationship" | "crossLink" | "report") {
  const ctx = await requirePermission("itsm:update");
  const delegate = (prisma as unknown as Record<string, { findFirst: Function; delete: Function }>)[modelForKind[kind]];
  const row = await delegate.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Registro ITSM no encontrado.");
  await prisma.$transaction(async (tx) => {
    const txDelegate = (tx as unknown as Record<string, { delete: Function }>)[modelForKind[kind]];
    await txDelegate.delete({ where: { id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: id, before: { kind, id }, extra: { event: "delete_itsm_record" } });
  });
  revalidate();
  return { id, kind };
}

const lifecycleTransitions: Record<string, Record<string, string[]>> = {
  request: { NEW: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["FULFILLED", "CANCELLED"], FULFILLED: ["CLOSED"], CANCELLED: [], CLOSED: [] },
  release: { PLANNED: ["BUILDING", "ROLLED_BACK"], BUILDING: ["READY", "ROLLED_BACK"], READY: ["RELEASED", "ROLLED_BACK"], RELEASED: ["ROLLED_BACK"], ROLLED_BACK: [] },
  deployment: { PENDING: ["IN_PROGRESS", "FAILED", "ROLLED_BACK"], IN_PROGRESS: ["SUCCESS", "FAILED", "ROLLED_BACK"], SUCCESS: ["ROLLED_BACK"], FAILED: ["IN_PROGRESS", "ROLLED_BACK"], ROLLED_BACK: [] },
};

export async function transitionItsmRecord(id: string, kind: "request" | "release" | "deployment", to: string) {
  const ctx = await requirePermission("itsm:update");
  const delegate = (prisma as unknown as Record<string, { findFirst: Function }>)[modelForKind[kind]];
  const row = await delegate.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Registro ITSM no encontrado.");
  if (!(lifecycleTransitions[kind]?.[row.status] ?? []).includes(to)) throw new Error(`Transición no permitida: ${row.status} → ${to}.`);
  const data: Record<string, unknown> = { status: to };
  if (kind === "request" && to === "FULFILLED") data.fulfilledAt = new Date();
  if (kind === "request" && to === "CLOSED") data.closedAt = new Date();
  if (kind === "release" && to === "RELEASED") data.releasedAt = new Date();
  if (kind === "deployment" && to === "IN_PROGRESS") data.startedAt = new Date();
  if (kind === "deployment" && ["SUCCESS", "FAILED", "ROLLED_BACK"].includes(to)) data.completedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const txDelegate = (tx as unknown as Record<string, { update: Function }>)[modelForKind[kind]];
    await txDelegate.update({ where: { id }, data });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: id, before: { status: row.status }, after: { status: to }, extra: { event: "transition_itsm_record", kind } });
  });
  revalidate();
  return { id, kind, status: to };
}
