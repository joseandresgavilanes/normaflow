"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { encryptMdSensitiveField } from "@/lib/crypto/field-encryption";
import { assertNoUnnecessaryPersonalData, assertOpaqueSubjectRef } from "@/lib/medical-devices/privacy";
import {
  assertAdverseEventTransition,
  assertComplaintTransition,
  assertFsaTransition,
  assertMdRecordPurgeable,
  assertPmsTransition,
  assertRecallTransition,
  assertRecordApproval,
  assertRecordTransition,
  assertTestResultAttribution,
  mdRetentionUntil,
} from "@/lib/medical-devices/workflows";
import type {
  MdAdverseEventStatus, MdComplaintStatus, MdFsaStatus, MdPmsStatus,
  MdRecallStatus, MdRecordStatus, MdTestResult,
} from "@prisma/client";

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

const DEFAULT_RETENTION_YEARS = 15;

/** Años de retención configurados por la organización (o el valor por defecto si no hay política). */
async function retentionYears(organizationId: string): Promise<number> {
  const policy = await prisma.mdRetentionPolicy.findUnique({ where: { organizationId } });
  return policy?.retentionYears ?? DEFAULT_RETENTION_YEARS;
}

// ─── Retención (configurable) ───────────────────────

const retentionSchema = z.object({ retentionYears: z.number().int().min(1).max(50) });

export async function setMdRetentionPolicy(input: z.infer<typeof retentionSchema>) {
  const ctx = await requirePermission("medical-devices:approve");
  const data = retentionSchema.parse(input);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.mdRetentionPolicy.upsert({
      where: { organizationId: ctx.organization.id },
      create: tenantData(ctx, { retentionYears: data.retentionYears, updatedById: ctx.user.id }),
      update: { retentionYears: data.retentionYears, updatedById: ctx.user.id },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: row.id, after: { retentionYears: data.retentionYears }, extra: { event: "set_md_retention_policy" } });
    return row;
  });
  revalidate();
  return { id: created.id, retentionYears: created.retentionYears };
}

// ─── Device / family / DMR / DHF ───

export async function createDeviceFamily(input: { code?: string; name: string; description?: string }) {
  const ctx = await requirePermission("medical-devices:create");
  const data = z.object({ code: z.string().max(40).optional(), name: z.string().min(1).max(200), description: z.string().max(4000).optional() }).parse(input);
  const code = data.code ?? await nextCode("FAM", prisma.deviceFamily.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.deviceFamily.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_device_family" } });
    return row;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.medicalDevice.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_medical_device" } });
    return row;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.deviceMasterRecord.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_dmr" } });
    return row;
  });
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
  await prisma.$transaction(async (tx) => {
    await tx.deviceMasterRecord.update({
      where: { id },
      data: { status: to, ...(needsApprove ? { approvedById: ctx.user.id, approvedAt: new Date() } : {}) },
    });
    await writeAuditLog(tx, {
      ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_dmr" },
    });
  });
  revalidate();
  return { id, status: to };
}

export async function transitionDesignHistoryFile(id: string, to: MdRecordStatus) {
  const needsApprove = to === "APPROVED";
  const ctx = await requirePermission(needsApprove ? "medical-devices:approve" : "medical-devices:update");
  const row = await prisma.designHistoryFile.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Historial de diseño no encontrado.");
  assertRecordTransition(row.status, to);
  if (needsApprove) assertRecordApproval({ approvedById: ctx.user.id });
  await prisma.$transaction(async (tx) => {
    await tx.designHistoryFile.update({ where: { id }, data: { status: to } });
    await writeAuditLog(tx, {
      ctx, action: needsApprove ? "approve" : "update", module: MODULE, recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_dhf" },
    });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.designHistoryFile.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_dhf" } });
    return row;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.designInput.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_design_input" } });
    return row;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.designOutput.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_design_output" } });
    return row;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.designReview.create({
      data: tenantData(ctx, {
        ...data, code,
        reviewedById: data.outcome === "PENDING" ? null : ctx.user.id,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, outcome: data.outcome }, extra: { event: "create_design_review" } });
    return row;
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.designVerification.create({
      data: tenantData(ctx, {
        ...data, code,
        verifiedAt: data.result === "PENDING" ? null : new Date(),
        verifiedById: data.result === "PENDING" ? null : ctx.user.id,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, result: data.result }, extra: { event: "create_design_verification" } });
    return row;
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.designValidation.create({
      data: tenantData(ctx, {
        ...data, code,
        validatedAt: data.result === "PENDING" ? null : new Date(),
        validatedById: data.result === "PENDING" ? null : ctx.user.id,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, result: data.result }, extra: { event: "create_design_validation" } });
    return row;
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.designTransfer.create({
      data: tenantData(ctx, { ...data, code, status: "IN_PROGRESS", transferredAt: new Date(), createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_design_transfer" } });
    return row;
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.deviceRiskFile.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_device_risk_file" } });
    return row;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.criticalSupplier.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code }, extra: { event: "create_critical_supplier" } });
    return row;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.supplierQualification.create({
      data: tenantData(ctx, {
        code, criticalSupplierId: data.criticalSupplierId, scope: data.scope, status: data.status,
        qualifiedAt: data.status === "QUALIFIED" || data.status === "CONDITIONAL" ? new Date() : null,
        nextReviewAt: data.nextReviewAt ? new Date(data.nextReviewAt) : null,
        evidenceId: data.evidenceId, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, status: data.status }, extra: { event: "create_supplier_qualification" } });
    return row;
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.processValidation.create({
      data: tenantData(ctx, {
        ...data, code,
        validatedAt: data.result === "PENDING" ? null : new Date(),
        validatedById: data.result === "PENDING" ? null : ctx.user.id,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, result: data.result }, extra: { event: "create_process_validation" } });
    return row;
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.sterilizationValidation.create({
      data: tenantData(ctx, {
        ...data, code,
        validatedAt: data.result === "PENDING" ? null : new Date(),
        validatedById: data.result === "PENDING" ? null : ctx.user.id,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, result: data.result }, extra: { event: "create_sterilization_validation" } });
    return row;
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.productionBatch.create({
      data: tenantData(ctx, {
        code, deviceId: data.deviceId, lotNumber: data.lotNumber, quantity: data.quantity, unit: data.unit,
        manufacturedAt: data.manufacturedAt ? new Date(data.manufacturedAt) : new Date(),
        expiryAt: data.expiryAt ? new Date(data.expiryAt) : null,
        processValidationId: data.processValidationId, notes: data.notes, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, lotNumber: data.lotNumber }, extra: { event: "create_production_batch" } });
    return row;
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.deviceTraceability.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, batchId: data.batchId }, extra: { event: "create_device_traceability" } });
    return row;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.complaint.create({
      data: tenantData(ctx, { ...data, code, description: encryptMdSensitiveField(data.description)!, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "md-sensitive", recordId: row.id, after: { code }, extra: { event: "create_complaint" } });
    return row;
  });
  revalidate();
  return { ...created, description: data.description };
}

export async function transitionComplaint(id: string, to: MdComplaintStatus, investigationSummary?: string) {
  const ctx = await requirePermission("md-sensitive:update");
  const row = await prisma.complaint.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Queja no encontrada.");
  assertComplaintTransition(row.status, to);
  if (investigationSummary) assertNoUnnecessaryPersonalData({ investigationSummary });
  const closedAt = to === "CLOSED" ? new Date() : null;
  const until = closedAt ? mdRetentionUntil(closedAt, await retentionYears(ctx.organization.id)) : null;
  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id },
      data: {
        status: to,
        investigationSummary: investigationSummary !== undefined ? encryptMdSensitiveField(investigationSummary) : row.investigationSummary,
        ...(closedAt ? { closedAt, retentionUntil: until } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: "md-sensitive", recordId: id,
      before: { status: row.status }, after: { status: to, retentionUntil: until }, extra: { event: "transition_complaint" },
    });
  });
  revalidate();
  return { id, status: to, retentionUntil: until };
}

export async function purgeComplaint(id: string) {
  const ctx = await requirePermission("md-sensitive:delete");
  const row = await prisma.complaint.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Queja no encontrada.");
  const today = new Date();
  assertMdRecordPurgeable(row, today, "La queja");
  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id },
      data: {
        purgedAt: today,
        description: "[purgado por vencimiento del plazo de retención]",
        investigationSummary: null, anonymizedSubjectRef: null,
      },
    });
    await writeAuditLog(tx, { ctx, action: "delete", module: "md-sensitive", recordId: id, before: { code: row.code, retentionUntil: row.retentionUntil }, after: { purgedAt: today }, extra: { event: "purge_complaint" } });
  });
  revalidate();
  return { id, purgedAt: today };
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.adverseEvent.create({
      data: tenantData(ctx, { ...data, code, description: encryptMdSensitiveField(data.description)!, createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "md-sensitive", recordId: row.id, after: { code, severity: data.severity, reportable: data.reportable }, extra: { event: "create_adverse_event" } });
    return row;
  });
  revalidate();
  return { ...created, description: data.description };
}

export async function transitionAdverseEvent(id: string, to: MdAdverseEventStatus) {
  const ctx = await requirePermission("md-sensitive:update");
  const row = await prisma.adverseEvent.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Evento adverso no encontrado.");
  assertAdverseEventTransition(row.status, to);
  const closedAt = to === "CLOSED" ? new Date() : null;
  const until = closedAt ? mdRetentionUntil(closedAt, await retentionYears(ctx.organization.id)) : null;
  await prisma.$transaction(async (tx) => {
    await tx.adverseEvent.update({
      where: { id },
      data: {
        status: to,
        ...(to === "REPORTED_TO_AUTHORITY" ? { reportedToAuthority: true } : {}),
        ...(closedAt ? { closedAt, retentionUntil: until } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: "md-sensitive", recordId: id,
      before: { status: row.status }, after: { status: to, retentionUntil: until }, extra: { event: "transition_adverse_event" },
    });
  });
  revalidate();
  return { id, status: to, retentionUntil: until };
}

export async function purgeAdverseEvent(id: string) {
  const ctx = await requirePermission("md-sensitive:delete");
  const row = await prisma.adverseEvent.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Evento adverso no encontrado.");
  const today = new Date();
  assertMdRecordPurgeable(row, today, "El evento adverso");
  await prisma.$transaction(async (tx) => {
    await tx.adverseEvent.update({
      where: { id },
      data: { purgedAt: today, description: "[purgado por vencimiento del plazo de retención]", anonymizedSubjectRef: null },
    });
    await writeAuditLog(tx, { ctx, action: "delete", module: "md-sensitive", recordId: id, before: { code: row.code, retentionUntil: row.retentionUntil }, after: { purgedAt: today }, extra: { event: "purge_adverse_event" } });
  });
  revalidate();
  return { id, purgedAt: today };
}

export async function createPostMarketSurveillance(input: {
  code?: string; deviceId: string; title: string; periodStart: string; periodEnd: string; findings?: string;
}) {
  const ctx = await requirePermission("md-sensitive:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().min(1), title: z.string().min(1).max(200),
    periodStart: z.string().min(1), periodEnd: z.string().min(1), findings: z.string().max(8000).optional(),
  }).parse(input);
  if (data.findings) assertNoUnnecessaryPersonalData({ findings: data.findings });
  if (new Date(data.periodEnd) < new Date(data.periodStart)) throw new Error("Periodo de vigilancia inválido.");
  const device = await prisma.medicalDevice.findFirst({ where: tenantWhere(ctx, { id: data.deviceId }) });
  if (!device) throw new Error("Dispositivo médico no encontrado.");
  const code = data.code ?? await nextCode("PMS", prisma.postMarketSurveillance.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.postMarketSurveillance.create({
      data: tenantData(ctx, {
        code, deviceId: data.deviceId, title: data.title, findings: encryptMdSensitiveField(data.findings ?? null),
        periodStart: new Date(data.periodStart), periodEnd: new Date(data.periodEnd),
        status: "PLANNED", createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "md-sensitive", recordId: row.id, after: { code }, extra: { event: "create_pms" } });
    return row;
  });
  revalidate();
  return { ...created, findings: data.findings ?? null };
}

export async function transitionPostMarketSurveillance(id: string, to: MdPmsStatus, findings?: string) {
  const ctx = await requirePermission("md-sensitive:update");
  const row = await prisma.postMarketSurveillance.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Vigilancia post-comercialización no encontrada.");
  assertPmsTransition(row.status, to);
  if (findings) assertNoUnnecessaryPersonalData({ findings });
  await prisma.$transaction(async (tx) => {
    await tx.postMarketSurveillance.update({
      where: { id },
      data: {
        status: to,
        findings: findings !== undefined ? encryptMdSensitiveField(findings) : row.findings,
      },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: "md-sensitive", recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_pms" },
    });
  });
  revalidate();
  return { id, status: to };
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
  if (data.reason) assertNoUnnecessaryPersonalData({ description: data.reason });
  const code = data.code ?? await nextCode("FSA", prisma.fieldSafetyAction.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.fieldSafetyAction.create({
      data: tenantData(ctx, { ...data, code, reason: encryptMdSensitiveField(data.reason ?? null), status: "INITIATED", createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: "md-sensitive", recordId: row.id, after: { code, actionType: data.actionType }, extra: { event: "create_field_safety_action" } });
    return row;
  });
  revalidate();
  return { ...created, reason: data.reason ?? null };
}

export async function transitionFieldSafetyAction(id: string, to: MdFsaStatus) {
  const ctx = await requirePermission("md-sensitive:update");
  const row = await prisma.fieldSafetyAction.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Acción de campo no encontrada.");
  assertFsaTransition(row.status, to);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.fieldSafetyAction.update({
      where: { id },
      data: { status: to, ...(to === "CLOSED" ? { closedAt: now } : {}) },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: "md-sensitive", recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_fsa" },
    });
  });
  revalidate();
  return { id, status: to };
}

export async function createProductRecall(input: {
  code?: string; deviceId?: string; title: string; reason: string; lotNumbers: string[]; capaId?: string;
}) {
  const ctx = await requirePermission("md-sensitive:create");
  const data = z.object({
    code: z.string().max(40).optional(), deviceId: z.string().optional(), title: z.string().min(1).max(200),
    reason: z.string().min(1).max(4000), lotNumbers: z.array(z.string()).min(1), capaId: z.string().optional(),
  }).parse(input);
  assertNoUnnecessaryPersonalData({ description: data.reason });
  const code = data.code ?? await nextCode("RCL", prisma.productRecall.count({ where: { organizationId: ctx.organization.id } }));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.productRecall.create({
      data: tenantData(ctx, { ...data, code, reason: encryptMdSensitiveField(data.reason)!, status: "INITIATED", createdById: ctx.user.id }),
    });
    if (data.lotNumbers.length) {
      await tx.productionBatch.updateMany({
        where: { organizationId: ctx.organization.id, lotNumber: { in: data.lotNumbers } },
        data: { status: "RECALLED" },
      });
    }
    await writeAuditLog(tx, { ctx, action: "create", module: "md-sensitive", recordId: row.id, after: { code, lots: data.lotNumbers.length }, extra: { event: "create_product_recall" } });
    return row;
  });
  revalidate();
  return { ...created, reason: data.reason };
}

export async function transitionProductRecall(id: string, to: MdRecallStatus) {
  const ctx = await requirePermission("md-sensitive:update");
  const row = await prisma.productRecall.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Retiro de producto no encontrado.");
  assertRecallTransition(row.status, to);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.productRecall.update({
      where: { id },
      data: {
        status: to,
        ...(to === "NOTIFYING" || to === "IN_PROGRESS" ? { notifiedAt: row.notifiedAt ?? now } : {}),
        ...(to === "CLOSED" || to === "COMPLETED" ? { closedAt: now } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: "md-sensitive", recordId: id,
      before: { status: row.status }, after: { status: to }, extra: { event: "transition_product_recall" },
    });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.regulatoryRequirement.create({ data: tenantData(ctx, { ...data, code, createdById: ctx.user.id }) });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, framework: data.framework }, extra: { event: "create_regulatory_requirement" } });
    return row;
  });
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
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.regulatorySubmission.create({
      data: tenantData(ctx, { ...data, code, status: "PREPARED", createdById: ctx.user.id }),
    });
    await writeAuditLog(tx, { ctx, action: "create", module: MODULE, recordId: row.id, after: { code, jurisdiction: data.jurisdiction }, extra: { event: "create_regulatory_submission" } });
    return row;
  });
  revalidate();
  return created;
}

// ─── Edición controlada de expedientes ──────────────────────────────────────
// Los expedientes regulatorios no se eliminan físicamente desde la UI. Se
// corrigen sus atributos, se avanza su workflow o se desactiva el registro
// cuando el modelo lo permite, manteniendo AuditLog y trazabilidad.

export type MedicalDeviceRecordKind =
  | "family" | "device" | "dmr" | "dhf" | "input" | "output" | "review" | "verification"
  | "validation" | "transfer" | "risk" | "supplier" | "qualification" | "processValidation"
  | "sterilizationValidation" | "batch" | "trace" | "complaint" | "adverseEvent" | "pms"
  | "fieldAction" | "recall" | "requirement" | "submission";

const mdModelForKind: Record<MedicalDeviceRecordKind, string> = {
  family: "deviceFamily", device: "medicalDevice", dmr: "deviceMasterRecord", dhf: "designHistoryFile",
  input: "designInput", output: "designOutput", review: "designReview", verification: "designVerification",
  validation: "designValidation", transfer: "designTransfer", risk: "deviceRiskFile", supplier: "criticalSupplier",
  qualification: "supplierQualification", processValidation: "processValidation", sterilizationValidation: "sterilizationValidation",
  batch: "productionBatch", trace: "deviceTraceability", complaint: "complaint", adverseEvent: "adverseEvent",
  pms: "postMarketSurveillance", fieldAction: "fieldSafetyAction", recall: "productRecall",
  requirement: "regulatoryRequirement", submission: "regulatorySubmission",
};

const mdSensitiveKinds = new Set<MedicalDeviceRecordKind>(["complaint", "adverseEvent", "pms", "fieldAction", "recall"]);
const mdUpdateText = (max: number) => z.string().max(max).nullable().optional();

const mdUpdateSchemas: Record<MedicalDeviceRecordKind, z.ZodTypeAny> = {
  family: z.object({ name: z.string().min(1).max(200), description: mdUpdateText(4000), active: z.boolean() }),
  device: z.object({ name: z.string().min(1).max(200), modelNumber: mdUpdateText(120), udiDi: mdUpdateText(120), familyId: z.string().nullable().optional(), classification: mdUpdateText(80), intendedUse: mdUpdateText(4000), processId: z.string().nullable().optional(), documentId: z.string().nullable().optional(), status: z.enum(["DEVELOPMENT", "DESIGN_TRANSFER", "PRODUCTION", "ACTIVE", "OBSOLETE", "WITHDRAWN"]) }),
  dmr: z.object({ deviceId: z.string().min(1), version: z.string().min(1).max(20), title: z.string().min(1).max(200), summary: mdUpdateText(8000), documentId: z.string().nullable().optional() }),
  dhf: z.object({ deviceId: z.string().min(1), title: z.string().min(1).max(200), documentId: z.string().nullable().optional() }),
  input: z.object({ dhfId: z.string().min(1), requirement: z.string().min(1).max(4000), source: mdUpdateText(1000), status: z.enum(["OPEN", "ADDRESSED", "VERIFIED", "CLOSED"]) }),
  output: z.object({ dhfId: z.string().min(1), description: z.string().min(1).max(4000), linkedInputCodes: z.array(z.string()), documentId: z.string().nullable().optional(), status: z.enum(["OPEN", "ADDRESSED", "VERIFIED", "CLOSED"]) }),
  review: z.object({ dhfId: z.string().min(1), reviewDate: z.string().min(1), outcome: z.enum(["PENDING", "APPROVED", "APPROVED_WITH_ACTIONS", "REJECTED"]), findings: mdUpdateText(8000), documentId: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
  verification: z.object({ dhfId: z.string().min(1), method: mdUpdateText(2000), acceptanceCriteria: mdUpdateText(4000), result: z.enum(["PENDING", "PASS", "FAIL", "CONDITIONAL"]), evidenceId: z.string().nullable().optional(), documentId: z.string().nullable().optional() }),
  validation: z.object({ dhfId: z.string().min(1), method: mdUpdateText(2000), userNeedsRef: mdUpdateText(200), result: z.enum(["PENDING", "PASS", "FAIL", "CONDITIONAL"]), evidenceId: z.string().nullable().optional(), documentId: z.string().nullable().optional() }),
  transfer: z.object({ dhfId: z.string().min(1), transferredAt: z.string().nullable().optional(), receivingSite: mdUpdateText(200), checklistSummary: mdUpdateText(8000), status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]), documentId: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
  risk: z.object({ deviceId: z.string().min(1), title: z.string().min(1).max(200), version: z.string().min(1).max(20), methodology: mdUpdateText(200), residualRiskSummary: mdUpdateText(8000), linkedRiskIds: z.array(z.string()), status: z.enum(["DRAFT", "UNDER_REVIEW", "APPROVED", "SUPERSEDED"]), documentId: z.string().nullable().optional() }),
  supplier: z.object({ name: z.string().min(1).max(200), supplierId: z.string().nullable().optional(), serviceType: mdUpdateText(200), criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), status: z.enum(["ACTIVE", "UNDER_REVIEW", "SUSPENDED", "EXITING"]), documentId: z.string().nullable().optional() }),
  qualification: z.object({ criticalSupplierId: z.string().min(1), scope: mdUpdateText(2000), status: z.enum(["PENDING", "QUALIFIED", "CONDITIONAL", "DISQUALIFIED", "EXPIRED"]), nextReviewAt: z.string().nullable().optional(), evidenceId: z.string().nullable().optional(), documentId: z.string().nullable().optional() }),
  processValidation: z.object({ title: z.string().min(1).max(200), deviceId: z.string().nullable().optional(), processId: z.string().nullable().optional(), protocolRef: mdUpdateText(200), result: z.enum(["PENDING", "PASS", "FAIL", "CONDITIONAL"]), evidenceId: z.string().nullable().optional(), documentId: z.string().nullable().optional() }),
  sterilizationValidation: z.object({ deviceId: z.string().nullable().optional(), method: z.string().min(1).max(200), sterilityAssuranceLevel: mdUpdateText(80), result: z.enum(["PENDING", "PASS", "FAIL", "CONDITIONAL"]), evidenceId: z.string().nullable().optional(), documentId: z.string().nullable().optional() }),
  batch: z.object({ deviceId: z.string().min(1), lotNumber: z.string().min(1).max(80), quantity: z.number().nullable().optional(), unit: mdUpdateText(40), manufacturedAt: z.string().nullable().optional(), expiryAt: z.string().nullable().optional(), status: z.enum(["IN_PRODUCTION", "QUARANTINE", "RELEASED", "REJECTED", "RECALLED"]), processValidationId: z.string().nullable().optional(), notes: mdUpdateText(2000) }),
  trace: z.object({ batchId: z.string().min(1), componentLot: mdUpdateText(80), supplierLot: mdUpdateText(80), distributionRef: mdUpdateText(120), customerAccountRef: mdUpdateText(120), previousIds: z.array(z.string()), notes: mdUpdateText(2000) }),
  complaint: z.object({ deviceId: z.string().nullable().optional(), batchId: z.string().nullable().optional(), source: z.enum(["CUSTOMER", "DISTRIBUTOR", "HEALTHCARE_PROFESSIONAL", "AUTHORITY", "INTERNAL", "OTHER"]), category: mdUpdateText(120), description: z.string().min(1).max(8000), anonymizedSubjectRef: mdUpdateText(80), investigationSummary: mdUpdateText(8000), capaId: z.string().nullable().optional(), documentId: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
  adverseEvent: z.object({ deviceId: z.string().nullable().optional(), batchId: z.string().nullable().optional(), complaintId: z.string().nullable().optional(), severity: z.enum(["MINOR", "MODERATE", "SERIOUS", "DEATH"]), reportable: z.boolean(), description: z.string().min(1).max(8000), anonymizedSubjectRef: mdUpdateText(80), capaId: z.string().nullable().optional(), documentId: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
  pms: z.object({ deviceId: z.string().min(1), title: z.string().min(1).max(200), periodStart: z.string().min(1), periodEnd: z.string().min(1), findings: mdUpdateText(8000), documentId: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
  fieldAction: z.object({ deviceId: z.string().nullable().optional(), title: z.string().min(1).max(200), actionType: z.enum(["FSCA", "FSN", "ADVISORY", "OTHER"]), reason: mdUpdateText(4000), lotNumbers: z.array(z.string()), capaId: z.string().nullable().optional(), documentId: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
  recall: z.object({ deviceId: z.string().nullable().optional(), title: z.string().min(1).max(200), reason: z.string().min(1).max(4000), lotNumbers: z.array(z.string()).min(1), authorityNotified: z.boolean(), capaId: z.string().nullable().optional(), documentId: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
  requirement: z.object({ jurisdiction: z.string().min(1).max(80), framework: z.string().min(1).max(80), clauseRef: mdUpdateText(80), title: z.string().min(1).max(200), description: mdUpdateText(4000), mandatory: z.boolean(), active: z.boolean() }),
  submission: z.object({ deviceId: z.string().nullable().optional(), jurisdiction: z.string().min(1).max(80), submissionType: z.string().min(1).max(120), status: z.enum(["DRAFT", "PREPARED", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN"]), submittedAt: z.string().nullable().optional(), referenceNumber: mdUpdateText(120), summary: mdUpdateText(4000), documentId: z.string().nullable().optional(), evidenceId: z.string().nullable().optional() }),
};

const mdInternalRefModels: Record<string, string> = {
  familyId: "deviceFamily", deviceId: "medicalDevice", dhfId: "designHistoryFile", criticalSupplierId: "criticalSupplier",
  batchId: "productionBatch", complaintId: "complaint", processValidationId: "processValidation",
};

const mdDateFields = new Set(["reviewDate", "verifiedAt", "validatedAt", "transferredAt", "nextReviewAt", "manufacturedAt", "expiryAt", "periodStart", "periodEnd", "submittedAt"]);
const mdSensitiveFields: Partial<Record<MedicalDeviceRecordKind, string[]>> = {
  complaint: ["description", "investigationSummary"], adverseEvent: ["description"], pms: ["findings"], fieldAction: ["reason"], recall: ["reason"],
};

export async function updateMedicalDeviceRecord(id: string, kind: MedicalDeviceRecordKind, input: Record<string, unknown>) {
  if (!mdModelForKind[kind]) throw new Error("Tipo de expediente médico no válido.");
  const sensitive = mdSensitiveKinds.has(kind);
  const ctx = await requirePermission(sensitive ? "md-sensitive:update" : "medical-devices:update");
  const data = mdUpdateSchemas[kind].parse(input) as Record<string, unknown>;
  const refs = ["familyId", "deviceId", "dhfId", "criticalSupplierId", "batchId", "complaintId", "processValidationId"];
  for (const key of refs) {
    const value = data[key];
    if (typeof value !== "string" || !value) continue;
    const delegate = (prisma as unknown as Record<string, { findFirst: Function }>)[mdInternalRefModels[key]];
    const found = await delegate.findFirst({ where: tenantWhere(ctx, { id: value }), select: { id: true } });
    if (!found) throw new Error("La referencia seleccionada no pertenece a la organización.");
  }
  await assertRefInOrg(ctx.organization.id, {
    processId: typeof data.processId === "string" ? data.processId : undefined,
    documentId: typeof data.documentId === "string" ? data.documentId : undefined,
    evidenceId: typeof data.evidenceId === "string" ? data.evidenceId : undefined,
    capaId: typeof data.capaId === "string" ? data.capaId : undefined,
    supplierId: typeof data.supplierId === "string" ? data.supplierId : undefined,
  });
  if (kind === "pms" && new Date(String(data.periodEnd)) < new Date(String(data.periodStart))) throw new Error("Periodo de vigilancia inválido.");
  if (kind === "trace") assertOpaqueSubjectRef(typeof data.customerAccountRef === "string" ? data.customerAccountRef : undefined);
  if ((kind === "complaint" || kind === "adverseEvent") && data.anonymizedSubjectRef) assertOpaqueSubjectRef(String(data.anonymizedSubjectRef));
  if (kind === "review" && data.outcome !== "PENDING") await requirePermission("medical-devices:approve");
  const updateData: Record<string, unknown> = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, mdDateFields.has(key) ? (value == null || value === "" ? null : new Date(String(value))) : value]));
  for (const field of mdSensitiveFields[kind] ?? []) {
    const value = data[field];
    if (value !== undefined) {
      const checks = kind === "complaint" ? { description: field === "description" ? String(value) : undefined, investigationSummary: field === "investigationSummary" ? String(value) : undefined } : kind === "pms" ? { findings: String(value) } : kind === "fieldAction" || kind === "recall" ? { description: String(value) } : { description: String(value) };
      assertNoUnnecessaryPersonalData(checks);
      updateData[field] = encryptMdSensitiveField(value == null ? null : String(value));
    }
  }
  const rowDelegate = (prisma as unknown as Record<string, { findFirst: Function }>)[mdModelForKind[kind]];
  const row = await rowDelegate.findFirst({ where: tenantWhere(ctx, { id }) });
  if (!row) throw new Error("Expediente de dispositivo médico no encontrado.");
  if (kind === "verification" && "result" in data) Object.assign(updateData, data.result === "PENDING" ? { verifiedAt: null, verifiedById: null } : { verifiedAt: new Date(), verifiedById: ctx.user.id });
  if (kind === "validation" && "result" in data) Object.assign(updateData, data.result === "PENDING" ? { validatedAt: null, validatedById: null } : { validatedAt: new Date(), validatedById: ctx.user.id });
  if (kind === "processValidation" && "result" in data) Object.assign(updateData, data.result === "PENDING" ? { validatedAt: null, validatedById: null } : { validatedAt: new Date(), validatedById: ctx.user.id });
  if (kind === "sterilizationValidation" && "result" in data) Object.assign(updateData, data.result === "PENDING" ? { validatedAt: null, validatedById: null } : { validatedAt: new Date(), validatedById: ctx.user.id });
  if (kind === "qualification" && "status" in data) updateData.qualifiedAt = data.status === "QUALIFIED" || data.status === "CONDITIONAL" ? row.qualifiedAt ?? new Date() : null;
  const updated = await prisma.$transaction(async (tx) => {
    const delegate = (tx as unknown as Record<string, { update: Function }>)[mdModelForKind[kind]];
    const result = await delegate.update({ where: { id }, data: updateData });
    await writeAuditLog(tx, { ctx, action: "update", module: sensitive ? "md-sensitive" : MODULE, recordId: id, before: { kind, id }, after: { kind, fields: Object.keys(updateData) }, extra: { event: "update_medical_device_record" } });
    return result;
  });
  revalidate();
  return updated;
}
