"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { assertNoUnnecessaryPersonalData, assertOpaqueSubjectRef } from "@/lib/medical-devices/privacy";
import {
  assertComplaintTransition,
  assertRecallTransition,
  assertRecordApproval,
  assertRecordTransition,
  assertTestResultAttribution,
} from "@/lib/medical-devices/workflows";
import type { MdComplaintStatus, MdRecallStatus, MdRecordStatus, MdTestResult } from "@prisma/client";

const MODULE = "medical-devices";
const revalidate = () => {
  revalidatePath("/app/medical-devices");
  revalidatePath("/app/activity");
};

async function assertRefInOrg(
  organizationId: string,
  refs: Partial<Record<"processId" | "documentId" | "evidenceId" | "capaId" | "supplierId", string | null | undefined>>,
) {
  const checks: Promise<unknown>[] = [];
  const guard = (p: Promise<{ id: string } | null>, label: string) =>
    checks.push(p.then((r) => { if (!r) throw new Error(`Referencia ${label} no pertenece a la organización.`); }));
  const w = (id: string) => ({ where: { id, organizationId }, select: { id: true } });
  if (refs.processId) guard(prisma.process.findFirst(w(refs.processId)), "de proceso");
  if (refs.documentId) guard(prisma.document.findFirst(w(refs.documentId)), "de documento");
  if (refs.evidenceId) guard(prisma.evidenceFile.findFirst(w(refs.evidenceId)), "de evidencia");
  if (refs.capaId) guard(prisma.cAPA.findFirst(w(refs.capaId)), "de CAPA");
  if (refs.supplierId) guard(prisma.supplier.findFirst(w(refs.supplierId)), "de proveedor");
  await Promise.all(checks);
}

async function nextCode(prefix: string, count: Promise<number>) {
  return `${prefix}-${String((await count) + 1).padStart(4, "0")}`;
}

// ─── Device / family / DMR / DHF ───

export async function createDeviceFamily(input: { code?: string; name: string; description?: string }) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({ code: z.string().max(40).optional(), name: z.string().min(1).max(200), description: z.string().max(4000).optional() }).parse(input);
  const code = data.code ?? await nextCode("FAM", prisma.deviceFamily.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.deviceFamily.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_device_family" } });
  revalidate();
  return created;
}

export async function createMedicalDevice(input: {
  code?: string; name: string; modelNumber?: string; udiDi?: string; familyId?: string;
  classification?: string; intendedUse?: string; processId?: string; documentId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), name: z.string().min(1).max(200),
    modelNumber: z.string().max(120).optional(), udiDi: z.string().max(120).optional(),
    familyId: z.string().optional(), classification: z.string().max(80).optional(),
    intendedUse: z.string().max(4000).optional(), processId: z.string().optional(), documentId: z.string().optional(),
  }).parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, documentId: data.documentId });
  if (data.familyId) {
    const f = await prisma.deviceFamily.findFirst({ where: tenantWhere(ctx, { id: data.familyId }) });
    if (!f) throw new Error("Familia de dispositivo no encontrada.");
  }
  const code = data.code ?? await nextCode("DEV", prisma.medicalDevice.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.medicalDevice.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_medical_device" } });
  revalidate();
  return created;
}

export async function createDeviceMasterRecord(input: {
  code?: string; deviceId: string; version?: string; title: string; summary?: string; documentId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().min(1), version: z.string().max(20).default("1"),
    title: z.string().min(1).max(200), summary: z.string().max(8000).optional(), documentId: z.string().optional(),
  }).parse(input);
  const device = await prisma.medicalDevice.findFirst({ where: tenantWhere(ctx, { id: data.deviceId }) });
  if (!device) throw new Error("Dispositivo médico no encontrado.");
  await assertRefInOrg(ctx.organization.id, { documentId: data.documentId });
  const code = data.code ?? await nextCode("DMR", prisma.deviceMasterRecord.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.deviceMasterRecord.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_dmr" } });
  revalidate();
  return created;
}

export async function transitionDeviceMasterRecord(id: string, to: MdRecordStatus) {
  const needsApprove = to === "APPROVED";
  const ctx = await requirePermission(needsApprove ? "medical-devices:approve" : "medical-devices:update");
  const row = await prisma.deviceMasterRecord.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Expediente maestro no encontrado.");
  assertRecordTransition(row.status, to);
  if (needsApprove) assertRecordApproval({ approvedById: ctx.user.id });
  await prisma.deviceMasterRecord.update({
    where: { id },
    data: { status: to, ...(needsApprove ? { approvedById: ctx.user.id, approvedAt: new Date() } : {}) },
  });
  await logAuditEvent({
    ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
    before: { status: row.status }, after: { status: to }, extra: { event: "transition_dmr" },
  });
  revalidate();
  return { id, status: to };
}

export async function createDesignHistoryFile(input: { code?: string; deviceId: string; title: string; documentId?: string }) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().min(1), title: z.string().min(1).max(200), documentId: z.string().optional(),
  }).parse(input);
  const device = await prisma.medicalDevice.findFirst({ where: tenantWhere(ctx, { id: data.deviceId }) });
  if (!device) throw new Error("Dispositivo médico no encontrado.");
  const code = data.code ?? await nextCode("DHF", prisma.designHistoryFile.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.designHistoryFile.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  await logAuditEvent({ ctx, action: "create", module: MODULE, recordId: created.id, after: { code }, extra: { event: "create_dhf" } });
  revalidate();
  return created;
}

export async function createDesignInput(input: { code?: string; dhfId: string; requirement: string; source?: string }) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), dhfId: z.string().min(1), requirement: z.string().min(1).max(4000), source: z.string().max(200).optional(),
  }).parse(input);
  const dhf = await prisma.designHistoryFile.findFirst({ where: tenantWhere(ctx, { id: data.dhfId }) });
  if (!dhf) throw new Error("Historial de diseño no encontrado.");
  const code = data.code ?? await nextCode("DIN", prisma.designInput.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.designInput.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  revalidate();
  return created;
}

export async function createDesignOutput(input: {
  code?: string; dhfId: string; description: string; linkedInputCodes?: string[]; documentId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), dhfId: z.string().min(1), description: z.string().min(1).max(4000),
    linkedInputCodes: z.array(z.string()).default([]), documentId: z.string().optional(),
  }).parse(input);
  const dhf = await prisma.designHistoryFile.findFirst({ where: tenantWhere(ctx, { id: data.dhfId }) });
  if (!dhf) throw new Error("Historial de diseño no encontrado.");
  const code = data.code ?? await nextCode("DOUT", prisma.designOutput.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.designOutput.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  revalidate();
  return created;
}

export async function createDesignReview(input: {
  code?: string; dhfId: string; outcome?: "PENDING" | "APPROVED" | "APPROVED_WITH_ACTIONS" | "REJECTED";
  findings?: string; documentId?: string; evidenceId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), dhfId: z.string().min(1),
    outcome: z.enum(["PENDING", "APPROVED", "APPROVED_WITH_ACTIONS", "REJECTED"]).default("PENDING"),
    findings: z.string().max(8000).optional(), documentId: z.string().optional(), evidenceId: z.string().optional(),
  }).parse(input);
  const dhf = await prisma.designHistoryFile.findFirst({ where: tenantWhere(ctx, { id: data.dhfId }) });
  if (!dhf) throw new Error("Historial de diseño no encontrado.");
  if (data.outcome !== "PENDING" && data.outcome !== "REJECTED") {
    await requirePermission("medical-devices:approve");
  }
  const code = data.code ?? await nextCode("DREV", prisma.designReview.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.designReview.create({
    data: tenantData(ctx, {
      ...data, code,
      reviewedById: data.outcome === "PENDING" ? null : ctx.user.id,
      createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createDesignVerification(input: {
  code?: string; dhfId: string; method?: string; acceptanceCriteria?: string;
  result?: MdTestResult; evidenceId?: string; documentId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), dhfId: z.string().min(1), method: z.string().max(2000).optional(),
    acceptanceCriteria: z.string().max(4000).optional(),
    result: z.enum(["PENDING", "PASS", "FAIL", "CONDITIONAL"]).default("PENDING"),
    evidenceId: z.string().optional(), documentId: z.string().optional(),
  }).parse(input);
  assertTestResultAttribution({ result: data.result, verifiedById: data.result === "PENDING" ? null : ctx.user.id });
  const dhf = await prisma.designHistoryFile.findFirst({ where: tenantWhere(ctx, { id: data.dhfId }) });
  if (!dhf) throw new Error("Historial de diseño no encontrado.");
  const code = data.code ?? await nextCode("DVER", prisma.designVerification.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.designVerification.create({
    data: tenantData(ctx, {
      ...data, code,
      verifiedAt: data.result === "PENDING" ? null : new Date(),
      verifiedById: data.result === "PENDING" ? null : ctx.user.id,
      createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createDesignValidation(input: {
  code?: string; dhfId: string; method?: string; userNeedsRef?: string;
  result?: MdTestResult; evidenceId?: string; documentId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), dhfId: z.string().min(1), method: z.string().max(2000).optional(),
    userNeedsRef: z.string().max(200).optional(),
    result: z.enum(["PENDING", "PASS", "FAIL", "CONDITIONAL"]).default("PENDING"),
    evidenceId: z.string().optional(), documentId: z.string().optional(),
  }).parse(input);
  assertTestResultAttribution({ result: data.result, validatedById: data.result === "PENDING" ? null : ctx.user.id });
  const dhf = await prisma.designHistoryFile.findFirst({ where: tenantWhere(ctx, { id: data.dhfId }) });
  if (!dhf) throw new Error("Historial de diseño no encontrado.");
  const code = data.code ?? await nextCode("DVAL", prisma.designValidation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.designValidation.create({
    data: tenantData(ctx, {
      ...data, code,
      validatedAt: data.result === "PENDING" ? null : new Date(),
      validatedById: data.result === "PENDING" ? null : ctx.user.id,
      createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createDesignTransfer(input: {
  code?: string; dhfId: string; receivingSite?: string; checklistSummary?: string; documentId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), dhfId: z.string().min(1), receivingSite: z.string().max(200).optional(),
    checklistSummary: z.string().max(8000).optional(), documentId: z.string().optional(),
  }).parse(input);
  const dhf = await prisma.designHistoryFile.findFirst({ where: tenantWhere(ctx, { id: data.dhfId }) });
  if (!dhf) throw new Error("Historial de diseño no encontrado.");
  const code = data.code ?? await nextCode("DTR", prisma.designTransfer.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.designTransfer.create({
    data: tenantData(ctx, { ...data, code, status: "IN_PROGRESS", transferredAt: new Date(), createdById: ctx.user.id }),
  });
  revalidate();
  return created;
}

export async function createDeviceRiskFile(input: {
  code?: string; deviceId: string; title: string; version?: string; methodology?: string;
  residualRiskSummary?: string; linkedRiskIds?: string[]; documentId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().min(1), title: z.string().min(1).max(200),
    version: z.string().max(20).default("1"), methodology: z.string().max(200).optional(),
    residualRiskSummary: z.string().max(8000).optional(), linkedRiskIds: z.array(z.string()).default([]),
    documentId: z.string().optional(),
  }).parse(input);
  const device = await prisma.medicalDevice.findFirst({ where: tenantWhere(ctx, { id: data.deviceId }) });
  if (!device) throw new Error("Dispositivo médico no encontrado.");
  if (data.linkedRiskIds.length) {
    const risks = await prisma.risk.findMany({
      where: { organizationId: ctx.organization.id, id: { in: data.linkedRiskIds } },
      select: { id: true },
    });
    if (risks.length !== data.linkedRiskIds.length) throw new Error("Uno o más riesgos no pertenecen a la organización.");
  }
  const code = data.code ?? await nextCode("RISK", prisma.deviceRiskFile.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.deviceRiskFile.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  revalidate();
  return created;
}

// ─── Suppliers / validations / batches ───

export async function createCriticalSupplier(input: {
  code?: string; name: string; supplierId?: string; serviceType?: string; criticality?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), name: z.string().min(1).max(200), supplierId: z.string().optional(),
    serviceType: z.string().max(200).optional(), criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("HIGH"),
  }).parse(input);
  await assertRefInOrg(ctx.organization.id, { supplierId: data.supplierId });
  const code = data.code ?? await nextCode("CSUP", prisma.criticalSupplier.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.criticalSupplier.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  revalidate();
  return created;
}

export async function createSupplierQualification(input: {
  code?: string; criticalSupplierId: string; scope?: string; status?: "PENDING" | "QUALIFIED" | "CONDITIONAL" | "DISQUALIFIED" | "EXPIRED";
  nextReviewAt?: string; evidenceId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), criticalSupplierId: z.string().min(1), scope: z.string().max(2000).optional(),
    status: z.enum(["PENDING", "QUALIFIED", "CONDITIONAL", "DISQUALIFIED", "EXPIRED"]).default("PENDING"),
    nextReviewAt: z.string().optional(), evidenceId: z.string().optional(),
  }).parse(input);
  const sup = await prisma.criticalSupplier.findFirst({ where: tenantWhere(ctx, { id: data.criticalSupplierId }) });
  if (!sup) throw new Error("Proveedor crítico no encontrado.");
  const code = data.code ?? await nextCode("QUAL", prisma.supplierQualification.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.supplierQualification.create({
    data: tenantData(ctx, {
      code, criticalSupplierId: data.criticalSupplierId, scope: data.scope, status: data.status,
      qualifiedAt: data.status === "QUALIFIED" || data.status === "CONDITIONAL" ? new Date() : null,
      nextReviewAt: data.nextReviewAt ? new Date(data.nextReviewAt) : null,
      evidenceId: data.evidenceId, createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createProcessValidation(input: {
  code?: string; title: string; deviceId?: string; processId?: string; protocolRef?: string;
  result?: MdTestResult; evidenceId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), title: z.string().min(1).max(200), deviceId: z.string().optional(),
    processId: z.string().optional(), protocolRef: z.string().max(200).optional(),
    result: z.enum(["PENDING", "PASS", "FAIL", "CONDITIONAL"]).default("PENDING"), evidenceId: z.string().optional(),
  }).parse(input);
  await assertRefInOrg(ctx.organization.id, { processId: data.processId, evidenceId: data.evidenceId });
  const code = data.code ?? await nextCode("PVAL", prisma.processValidation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.processValidation.create({
    data: tenantData(ctx, {
      ...data, code,
      validatedAt: data.result === "PENDING" ? null : new Date(),
      validatedById: data.result === "PENDING" ? null : ctx.user.id,
      createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createSterilizationValidation(input: {
  code?: string; deviceId?: string; method: string; sterilityAssuranceLevel?: string; result?: MdTestResult; evidenceId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().optional(), method: z.string().min(1).max(200),
    sterilityAssuranceLevel: z.string().max(80).optional(),
    result: z.enum(["PENDING", "PASS", "FAIL", "CONDITIONAL"]).default("PENDING"), evidenceId: z.string().optional(),
  }).parse(input);
  const code = data.code ?? await nextCode("SVAL", prisma.sterilizationValidation.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.sterilizationValidation.create({
    data: tenantData(ctx, {
      ...data, code,
      validatedAt: data.result === "PENDING" ? null : new Date(),
      validatedById: data.result === "PENDING" ? null : ctx.user.id,
      createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createProductionBatch(input: {
  code?: string; deviceId: string; lotNumber: string; quantity?: number; unit?: string;
  manufacturedAt?: string; expiryAt?: string; processValidationId?: string; notes?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().min(1), lotNumber: z.string().min(1).max(80),
    quantity: z.number().optional(), unit: z.string().max(40).optional(),
    manufacturedAt: z.string().optional(), expiryAt: z.string().optional(),
    processValidationId: z.string().optional(), notes: z.string().max(2000).optional(),
  }).parse(input);
  const device = await prisma.medicalDevice.findFirst({ where: tenantWhere(ctx, { id: data.deviceId }) });
  if (!device) throw new Error("Dispositivo médico no encontrado.");
  const code = data.code ?? await nextCode("LOT", prisma.productionBatch.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.productionBatch.create({
    data: tenantData(ctx, {
      code, deviceId: data.deviceId, lotNumber: data.lotNumber, quantity: data.quantity, unit: data.unit,
      manufacturedAt: data.manufacturedAt ? new Date(data.manufacturedAt) : new Date(),
      expiryAt: data.expiryAt ? new Date(data.expiryAt) : null,
      processValidationId: data.processValidationId, notes: data.notes, createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createDeviceTraceability(input: {
  code?: string; batchId: string; componentLot?: string; supplierLot?: string;
  distributionRef?: string; customerAccountRef?: string; previousIds?: string[];
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), batchId: z.string().min(1), componentLot: z.string().max(80).optional(),
    supplierLot: z.string().max(80).optional(), distributionRef: z.string().max(120).optional(),
    customerAccountRef: z.string().max(120).optional(), previousIds: z.array(z.string()).default([]),
  }).parse(input);
  assertOpaqueSubjectRef(data.customerAccountRef);
  const batch = await prisma.productionBatch.findFirst({ where: tenantWhere(ctx, { id: data.batchId }) });
  if (!batch) throw new Error("Lote de producción no encontrado.");
  const code = data.code ?? await nextCode("TRC", prisma.deviceTraceability.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.deviceTraceability.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  revalidate();
  return created;
}

// ─── Vigilance (md-sensitive) ───

export async function createComplaint(input: {
  code?: string; deviceId?: string; batchId?: string; source?: string; category?: string;
  description: string; anonymizedSubjectRef?: string; capaId?: string;
}) {
  const ctx = await requirePermission("md-sensitive:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().optional(), batchId: z.string().optional(),
    source: z.enum(["CUSTOMER", "DISTRIBUTOR", "HEALTHCARE_PROFESSIONAL", "AUTHORITY", "INTERNAL", "OTHER"]).default("OTHER"),
    category: z.string().max(120).optional(), description: z.string().min(1).max(8000),
    anonymizedSubjectRef: z.string().max(80).optional(), capaId: z.string().optional(),
  }).parse(input);
  assertNoUnnecessaryPersonalData({ description: data.description, anonymizedSubjectRef: data.anonymizedSubjectRef });
  await assertRefInOrg(ctx.organization.id, { capaId: data.capaId });
  const code = data.code ?? await nextCode("CMP", prisma.complaint.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.complaint.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  await logAuditEvent({ ctx, action: "create", module: "md-sensitive", recordId: created.id, after: { code }, extra: { event: "create_complaint" } });
  revalidate();
  return created;
}

export async function transitionComplaint(id: string, to: MdComplaintStatus, investigationSummary?: string) {
  const ctx = await requirePermission("md-sensitive:update");
  const row = await prisma.complaint.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Queja no encontrada.");
  assertComplaintTransition(row.status, to);
  if (investigationSummary) assertNoUnnecessaryPersonalData({ investigationSummary });
  await prisma.complaint.update({
    where: { id },
    data: {
      status: to, investigationSummary: investigationSummary ?? row.investigationSummary,
      ...(to === "CLOSED" ? { closedAt: new Date() } : {}),
    },
  });
  revalidate();
  return { id, status: to };
}

export async function createAdverseEvent(input: {
  code?: string; deviceId?: string; batchId?: string; complaintId?: string;
  severity?: "MINOR" | "MODERATE" | "SERIOUS" | "DEATH"; reportable?: boolean;
  description: string; anonymizedSubjectRef?: string; capaId?: string;
}) {
  const ctx = await requirePermission("md-sensitive:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().optional(), batchId: z.string().optional(),
    complaintId: z.string().optional(),
    severity: z.enum(["MINOR", "MODERATE", "SERIOUS", "DEATH"]).default("MODERATE"),
    reportable: z.boolean().default(false), description: z.string().min(1).max(8000),
    anonymizedSubjectRef: z.string().max(80).optional(), capaId: z.string().optional(),
  }).parse(input);
  assertNoUnnecessaryPersonalData({ description: data.description, anonymizedSubjectRef: data.anonymizedSubjectRef });
  const code = data.code ?? await nextCode("AE", prisma.adverseEvent.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.adverseEvent.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  await logAuditEvent({ ctx, action: "create", module: "md-sensitive", recordId: created.id, after: { code }, extra: { event: "create_adverse_event" } });
  revalidate();
  return created;
}

export async function createPostMarketSurveillance(input: {
  code?: string; deviceId: string; title: string; periodStart: string; periodEnd: string; findings?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().min(1), title: z.string().min(1).max(200),
    periodStart: z.string().min(1), periodEnd: z.string().min(1), findings: z.string().max(8000).optional(),
  }).parse(input);
  if (data.findings) assertNoUnnecessaryPersonalData({ findings: data.findings });
  if (new Date(data.periodEnd) < new Date(data.periodStart)) throw new Error("Periodo de vigilancia inválido.");
  const device = await prisma.medicalDevice.findFirst({ where: tenantWhere(ctx, { id: data.deviceId }) });
  if (!device) throw new Error("Dispositivo médico no encontrado.");
  const code = data.code ?? await nextCode("PMS", prisma.postMarketSurveillance.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.postMarketSurveillance.create({
    data: tenantData(ctx, {
      code, deviceId: data.deviceId, title: data.title, findings: data.findings,
      periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd),
      status: "IN_PROGRESS", createdById: ctx.user.id,
    }),
  });
  revalidate();
  return created;
}

export async function createFieldSafetyAction(input: {
  code?: string; deviceId?: string; title: string; actionType?: "FSCA" | "FSN" | "ADVISORY" | "OTHER";
  reason?: string; lotNumbers?: string[]; capaId?: string;
}) {
  const ctx = await requirePermission("md-sensitive:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().optional(), title: z.string().min(1).max(200),
    actionType: z.enum(["FSCA", "FSN", "ADVISORY", "OTHER"]).default("FSCA"),
    reason: z.string().max(4000).optional(), lotNumbers: z.array(z.string()).default([]), capaId: z.string().optional(),
  }).parse(input);
  const code = data.code ?? await nextCode("FSA", prisma.fieldSafetyAction.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.fieldSafetyAction.create({
    data: tenantData(ctx, { ...data, code, status: "INITIATED", createdById: ctx.user.id }),
  });
  revalidate();
  return created;
}

export async function createProductRecall(input: {
  code?: string; deviceId?: string; title: string; reason: string; lotNumbers: string[]; capaId?: string;
}) {
  const ctx = await requirePermission("md-sensitive:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().optional(), title: z.string().min(1).max(200),
    reason: z.string().min(1).max(4000), lotNumbers: z.array(z.string()).min(1), capaId: z.string().optional(),
  }).parse(input);
  const code = data.code ?? await nextCode("RCL", prisma.productRecall.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.productRecall.create({
    data: tenantData(ctx, { ...data, code, status: "INITIATED", createdById: ctx.user.id }),
  });
  if (data.lotNumbers.length) {
    await prisma.productionBatch.updateMany({
      where: { organizationId: ctx.organization.id, lotNumber: { in: data.lotNumbers } },
      data: { status: "RECALLED" },
    });
  }
  await logAuditEvent({ ctx, action: "create", module: "md-sensitive", recordId: created.id, after: { code }, extra: { event: "create_product_recall" } });
  revalidate();
  return created;
}

export async function transitionProductRecall(id: string, to: MdRecallStatus) {
  const ctx = await requirePermission("md-sensitive:update");
  const row = await prisma.productRecall.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Retiro de producto no encontrado.");
  assertRecallTransition(row.status, to);
  const now = new Date();
  await prisma.productRecall.update({
    where: { id },
    data: {
      status: to,
      ...(to === "NOTIFYING" || to === "IN_PROGRESS" ? { notifiedAt: row.notifiedAt ?? now } : {}),
      ...(to === "CLOSED" || to === "COMPLETED" ? { closedAt: now } : {}),
    },
  });
  revalidate();
  return { id, status: to };
}

// ─── Regulatory (configurable) ───

export async function createRegulatoryRequirement(input: {
  code?: string; jurisdiction: string; framework: string; clauseRef?: string;
  title: string; description?: string; mandatory?: boolean;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), jurisdiction: z.string().min(1).max(80),
    framework: z.string().min(1).max(80), clauseRef: z.string().max(80).optional(),
    title: z.string().min(1).max(200), description: z.string().max(4000).optional(),
    mandatory: z.boolean().default(true),
  }).parse(input);
  const code = data.code ?? await nextCode("REQ", prisma.regulatoryRequirement.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.regulatoryRequirement.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
  revalidate();
  return created;
}

export async function createRegulatorySubmission(input: {
  code?: string; deviceId?: string; jurisdiction: string; submissionType: string;
  referenceNumber?: string; summary?: string; documentId?: string;
}) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().optional(),
    jurisdiction: z.string().min(1).max(80), submissionType: z.string().min(1).max(120),
    referenceNumber: z.string().max(120).optional(), summary: z.string().max(4000).optional(),
    documentId: z.string().optional(),
  }).parse(input);
  const code = data.code ?? await nextCode("SUB", prisma.regulatorySubmission.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.regulatorySubmission.create({
    data: tenantData(ctx, { ...data, code, status: "PREPARED", createdById: ctx.user.id }),
  });
  revalidate();
  return created;
}
