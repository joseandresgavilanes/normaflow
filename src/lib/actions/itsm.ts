"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  assertItsmChangeApproval,
  assertItsmChangeTransition,
  assertItsmIncidentTransition,
  assertItsmProblemTransition,
  availabilityPercent,
} from "@/lib/itsm/workflows";
import type { ITSMChangeStatus, ITSMIncidentStatus, ITSMProblemStatus } from "@prisma/client";

const MODULE = "itsm";
const revalidate = () => {
  revalidatePath("/app/itsm");
  revalidatePath("/app/activity");
};

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
  const created = await prisma.iTService.create({
    data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_it_service" } });
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
  const created = await prisma.serviceCatalogEntry.create({
    data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_catalog_entry" } });
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
  const created = await prisma.serviceOwner.create({
    data: tenantData(ctx, {
      code, serviceId: data.serviceId, userId: data.userId ?? null, ownerName: data.ownerName,
      ownershipRole: data.ownershipRole,
      effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_service_owner" } });
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
  const created = await prisma.serviceLevelAgreement.create({
    data: tenantData(ctx, { ...data, code, status: "ACTIVE", createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_sla" } });
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
  const created = await prisma.operationalLevelAgreement.create({
    data: tenantData(ctx, { ...data, code, status: "ACTIVE", createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_ola" } });
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
  const created = await prisma.serviceRequest.create({
    data: tenantData(ctx, {
      ...data, code, requesterId: ctx.user.id,
      dueAt: data.dueAt ? new Date(data.dueAt) : null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_service_request" } });
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
  const created = await prisma.iTSMIncident.create({
    data: tenantData(ctx, { ...data, code, reporterId: ctx.user.id, createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_itsm_incident" } });
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
  await prisma.iTSMIncident.update({
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
  await logAuditEvent({
    ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
    before: { status: row.status }, after: { status: to }, extra: { event: "transition_itsm_incident" },
  });
  revalidate();
  return { id, status: to };
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
  const created = await prisma.problem.create({
    data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_itsm_problem" } });
  revalidate();
  return created;
}

export async function transitionItsmProblem(id: string, to: ITSMProblemStatus) {
  const ctx = await requirePermission("itsm:update");
  const row = await prisma.problem.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Problema no encontrado.");
  assertItsmProblemTransition(row.status, to);
  const now = new Date();
  await prisma.problem.update({
    where: { id },
    data: {
      status: to,
      ...(to === "RESOLVED" ? { resolvedAt: row.resolvedAt ?? now } : {}),
      ...(to === "CLOSED" ? { closedAt: now, resolvedAt: row.resolvedAt ?? now } : {}),
    },
  });
  await logAuditEvent({
    ctx, action: "update", module: MODULE, recordId: id,
    before: { status: row.status }, after: { status: to }, extra: { event: "transition_itsm_problem" },
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
  if (data.problemId) {
    const p = await prisma.problem.findFirst({ where: tenantWhere(ctx, { id: data.problemId }) });
    if (!p) throw new Error("Problema no encontrado.");
    if (p.status === "ANALYSIS" || p.status === "IDENTIFIED") {
      await prisma.problem.update({ where: { id: p.id }, data: { status: "KNOWN_ERROR" } });
    }
  }
  const code = data.code ?? await nextCode("KE", prisma.knownError.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.knownError.create({
    data: tenantData(ctx, { ...data, code, status: "DOCUMENTED", createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_known_error" } });
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
  const created = await prisma.iTSMChange.create({
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
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_itsm_change" } });
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
  await prisma.iTSMChange.update({
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
  await logAuditEvent({
    ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
    before: { status: row.status }, after: { status: to }, extra: { event: "transition_itsm_change" },
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
  const created = await prisma.release.create({
    data: tenantData(ctx, {
      ...data, code, plannedAt: data.plannedAt ? new Date(data.plannedAt) : null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_release" } });
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
  const created = await prisma.deployment.create({
    data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_deployment" } });
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
  const created = await prisma.configurationItem.create({
    data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_configuration_item" } });
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
  const created = await prisma.cMDBRelationship.create({
    data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_cmdb_relationship" } });
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
  const created = await prisma.availabilityPlan.create({
    data: tenantData(ctx, {
      code, serviceId: data.serviceId, title: data.title, targetPercent: data.targetPercent,
      measurementPeriod: data.measurementPeriod, agreedDowntimeMinutes: data.agreedDowntimeMinutes,
      actualAvailabilityPct, periodStart: data.periodStart ? new Date(data.periodStart) : null,
      periodEnd: data.periodEnd ? new Date(data.periodEnd) : null, notes: data.notes,
      documentId: data.documentId, status: "ACTIVE", createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_availability_plan" } });
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
  const created = await prisma.capacityPlan.create({
    data: tenantData(ctx, {
      ...data, code, status: "ACTIVE",
      periodStart: data.periodStart ? new Date(data.periodStart) : null,
      periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_capacity_plan" } });
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
  const created = await prisma.serviceContinuityPlan.create({
    data: tenantData(ctx, {
      ...data, code, status: "ACTIVE",
      lastTestedAt: data.lastTestedAt ? new Date(data.lastTestedAt) : null,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_service_continuity_plan" } });
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
  const created = await prisma.serviceSupplier.create({
    data: tenantData(ctx, {
      ...data, code, reviewDueAt: data.reviewDueAt ? new Date(data.reviewDueAt) : null, createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_service_supplier" } });
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
  const created = await prisma.knowledgeArticle.create({
    data: tenantData(ctx, {
      code, title: data.title, category: data.category, content: data.content,
      serviceId: data.serviceId, knownErrorId: data.knownErrorId, problemId: data.problemId, incidentId: data.incidentId,
      tags: data.tags, authorId: ctx.user.id,
      status: data.publish ? "PUBLISHED" : "DRAFT",
      publishedAt: data.publish ? new Date() : null,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_knowledge_article" } });
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
  const created = await prisma.serviceReport.create({
    data: tenantData(ctx, {
      code, title: data.title, reportType: data.reportType, serviceId: data.serviceId,
      periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd),
      summary: data.summary, metrics: data.metrics ?? undefined, documentId: data.documentId,
      createdById: ctx.user.id,
    }),
  });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_service_report" } });
  revalidate();
  return created;
}
