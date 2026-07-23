"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { queueReportForContext } from "@/lib/report-queue";
import { parseInput } from "@/lib/validation/common";
import { supplierSecurityExportSchema, supplierSecuritySchema } from "@/lib/validation/supplier-security";

const PATH = "/app/suppliers/security";

export type SupplierSecurityPayload = Awaited<ReturnType<typeof getSupplierSecurityPayload>>;

function dateValue(v: Date | null | undefined) { return v?.toISOString().slice(0, 10) ?? null; }
function toDate(v: string | null | undefined) { if (!v) return null; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00.000Z`) : new Date(v); }

export async function getSupplierSecurityPayload() {
  const authorization = await requireAuthorization("suppliers:read");
  const organizationId = authorization.ctx.organization.id;
  const now = new Date();
  const soon = new Date(Date.now() + 60 * 86400000);

  const [suppliers, evidenceOptions] = await Promise.all([
    prisma.supplier.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      include: { securityProfile: { include: { evidence: { select: { id: true, title: true } } } } },
    }),
    prisma.evidenceFile.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  const profiled = suppliers.filter((s) => s.securityProfile);
  return {
    canUpdate: authorization.can("suppliers:update"),
    canExport: authorization.can("suppliers:export"),
    summary: {
      total: suppliers.length,
      profiled: profiled.length,
      critical: profiled.filter((s) => s.securityProfile?.securityCriticality === "CRITICAL").length,
      expiringSoon: profiled.filter((s) => s.securityProfile?.contractExpiry && s.securityProfile.contractExpiry <= soon).length,
      reviewOverdue: profiled.filter((s) => s.securityProfile?.nextReviewDate && s.securityProfile.nextReviewDate < now).length,
    },
    suppliers: suppliers.map((s) => ({
      id: s.id, code: s.code, name: s.name, category: s.category, criticality: s.criticality,
      profile: s.securityProfile ? {
        securityCriticality: s.securityProfile.securityCriticality,
        dataProcessed: s.securityProfile.dataProcessed,
        accessGranted: s.securityProfile.accessGranted,
        obligations: s.securityProfile.obligations,
        controls: s.securityProfile.controls,
        riskLevel: s.securityProfile.riskLevel,
        reviewDate: dateValue(s.securityProfile.reviewDate),
        nextReviewDate: dateValue(s.securityProfile.nextReviewDate),
        contractExpiry: dateValue(s.securityProfile.contractExpiry),
        evidence: s.securityProfile.evidence,
        notes: s.securityProfile.notes,
        reviewOverdue: !!(s.securityProfile.nextReviewDate && s.securityProfile.nextReviewDate < now),
        contractExpiringSoon: !!(s.securityProfile.contractExpiry && s.securityProfile.contractExpiry <= soon),
      } : null,
    })),
    evidenceOptions,
  };
}

export async function upsertSupplierSecurityProfile(input: unknown) {
  const data = parseInput(supplierSecuritySchema, input);
  const ctx = await requirePermission("suppliers:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({ where: { id: data.supplierId, organizationId } });
    if (!supplier) throw new Error("Proveedor no encontrado.");
    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia no pertenece a la organización.");
    }
    const payload = {
      securityCriticality: data.securityCriticality, dataProcessed: data.dataProcessed ?? null, accessGranted: data.accessGranted ?? null,
      obligations: data.obligations ?? null, controls: data.controls ?? null, riskLevel: data.riskLevel ?? null,
      reviewDate: toDate(data.reviewDate), nextReviewDate: toDate(data.nextReviewDate), contractExpiry: toDate(data.contractExpiry),
      evidenceId: data.evidenceId ?? null, notes: data.notes ?? null,
    };
    const saved = await tx.supplierSecurityProfile.upsert({ where: { supplierId: supplier.id }, update: payload, create: { organizationId, supplierId: supplier.id, ...payload } });
    await writeAuditLog(tx, { ctx, action: "upsert_security_profile", module: "supplier", recordId: supplier.id, after: { securityCriticality: data.securityCriticality } });
    return saved;
  });
  revalidatePath(PATH);
  revalidatePath("/app/suppliers");
  return { id: result.id };
}

export async function exportSupplierSecurity(input: unknown) {
  const data = parseInput(supplierSecurityExportSchema, input);
  const ctx = await requirePermission("suppliers:export");
  const now = new Date();
  const report = await queueReportForContext({ ctx, reportType: "critical-suppliers", title: "Proveedores críticos de seguridad", format: data.format, fileName: `critical-suppliers-${now.toISOString().slice(0, 10)}.${data.format === "PDF" ? "pdf" : "xlsx"}`, dateFrom: now, dateTo: now, filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) } });
  revalidatePath("/app/reporting");
  return { id: report.id, status: report.status };
}
