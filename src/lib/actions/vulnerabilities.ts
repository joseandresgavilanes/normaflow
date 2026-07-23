"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { queueReportForContext } from "@/lib/report-queue";
import { parseInput } from "@/lib/validation/common";
import {
  parseVulnFilters,
  remediationSchema,
  remediationUpdateSchema,
  verificationSchema,
  vulnAssetSchema,
  vulnCreateSchema,
  vulnExportSchema,
  vulnUpdateSchema,
} from "@/lib/validation/vulnerabilities";

const PATH = "/app/vulnerabilities";

export type VulnerabilitiesPayload = Awaited<ReturnType<typeof getVulnerabilitiesPayload>>;

function dateValue(v: Date | null | undefined) { return v?.toISOString().slice(0, 10) ?? null; }
function toDate(v: string | null | undefined) { if (!v) return null; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00.000Z`) : new Date(v); }
async function ensureMember(organizationId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const m = await prisma.membership.findFirst({ where: { organizationId, userId, active: true } });
  if (!m) throw new Error("El usuario no pertenece a la organización.");
  return userId;
}

export async function getVulnerabilitiesPayload(input?: unknown) {
  const authorization = await requireAuthorization("vulnerabilities:read");
  const organizationId = authorization.ctx.organization.id;
  const filters = parseVulnFilters(input);
  const now = new Date();

  const [rows, members, assetOptions, evidenceOptions] = await Promise.all([
    prisma.vulnerability.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.query ? { OR: [{ code: { contains: filters.query, mode: "insensitive" } }, { cve: { contains: filters.query, mode: "insensitive" } }, { description: { contains: filters.query, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ severity: "desc" }, { discoveredAt: "desc" }],
      include: {
        responsible: { select: { id: true, name: true } },
        assets: { include: { asset: { select: { id: true, code: true, name: true } } } },
        remediations: { orderBy: { createdAt: "desc" }, include: { responsible: { select: { id: true, name: true } }, evidence: { select: { id: true, title: true } }, verifications: { orderBy: { verifiedAt: "desc" }, include: { verifiedBy: { select: { id: true, name: true } } } } } },
      },
    }),
    authorization.can("members:read") ? prisma.membership.findMany({ where: { organizationId, active: true }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
    prisma.informationAsset.findMany({ where: { organizationId }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" }, take: 500 }),
    prisma.evidenceFile.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  const open = rows.filter((r) => !["CLOSED", "ACCEPTED"].includes(r.status));
  return {
    filters,
    canCreate: authorization.can("vulnerabilities:create"),
    canUpdate: authorization.can("vulnerabilities:update"),
    canExport: authorization.can("vulnerabilities:export"),
    summary: {
      total: rows.length,
      open: open.length,
      critical: open.filter((r) => r.severity === "CRITICAL").length,
      overdue: open.filter((r) => r.targetDate && r.targetDate < now).length,
      severityCounts: rows.reduce<Record<string, number>>((acc, r) => { acc[r.severity] = (acc[r.severity] ?? 0) + 1; return acc; }, {}),
    },
    vulnerabilities: rows.map((r) => ({
      id: r.id, code: r.code, source: r.source, cve: r.cve, severity: r.severity, exposure: r.exposure, description: r.description,
      responsible: r.responsible, targetDate: dateValue(r.targetDate), status: r.status, discoveredAt: dateValue(r.discoveredAt),
      overdue: !!(r.targetDate && r.targetDate < now && !["CLOSED", "ACCEPTED"].includes(r.status)),
      assets: r.assets.map((a) => ({ id: a.id, asset: a.asset, exposure: a.exposure })),
      remediations: r.remediations.map((m) => ({ id: m.id, description: m.description, responsible: m.responsible, targetDate: dateValue(m.targetDate), status: m.status, evidence: m.evidence, verifications: m.verifications.map((v) => ({ id: v.id, result: v.result, notes: v.notes, verifiedBy: v.verifiedBy, verifiedAt: v.verifiedAt.toISOString() })) })),
    })),
    members: members.map((m) => m.user),
    assetOptions, evidenceOptions,
  };
}

export async function createVulnerability(input: unknown) {
  const data = parseInput(vulnCreateSchema, input);
  const ctx = await requirePermission("vulnerabilities:create");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.responsibleId);
  const result = await prisma.$transaction(async (tx) => {
    const dup = await tx.vulnerability.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe una vulnerabilidad con el código ${data.code}.`);
    const v = await tx.vulnerability.create({ data: { organizationId, code: data.code, source: data.source, cve: data.cve ?? null, severity: data.severity, exposure: data.exposure ?? null, description: data.description ?? null, responsibleId: data.responsibleId ?? null, targetDate: toDate(data.targetDate) } });
    await writeAuditLog(tx, { ctx, action: "create", module: "vulnerability", recordId: v.id, after: { code: v.code, severity: v.severity } });
    return v;
  });
  revalidatePath(PATH);
  return { id: result.id, code: result.code };
}

export async function updateVulnerability(input: unknown) {
  const data = parseInput(vulnUpdateSchema, input);
  const ctx = await requirePermission("vulnerabilities:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.responsibleId);
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.vulnerability.findFirst({ where: { id: data.id, organizationId } });
    if (!before) throw new Error("Vulnerabilidad no encontrada.");
    const updated = await tx.vulnerability.updateMany({ where: { id: data.id, organizationId }, data: { code: data.code, source: data.source, cve: data.cve ?? null, severity: data.severity, exposure: data.exposure ?? null, description: data.description ?? null, responsibleId: data.responsibleId ?? null, targetDate: toDate(data.targetDate), status: data.status } });
    if (updated.count !== 1) throw new Error("La vulnerabilidad cambió mientras se editaba; vuelve a cargarla.");
    await writeAuditLog(tx, { ctx, action: "update", module: "vulnerability", recordId: data.id, before: { status: before.status }, after: { status: data.status } });
    return { id: data.id };
  });
  revalidatePath(PATH);
  return result;
}

export async function linkVulnerabilityAsset(input: unknown) {
  const data = parseInput(vulnAssetSchema, input);
  const ctx = await requirePermission("vulnerabilities:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const [v, asset] = await Promise.all([
      tx.vulnerability.findFirst({ where: { id: data.vulnerabilityId, organizationId } }),
      tx.informationAsset.findFirst({ where: { id: data.assetId, organizationId } }),
    ]);
    if (!v || !asset) throw new Error("Vulnerabilidad o activo no pertenecen a la organización.");
    const link = await tx.vulnerabilityAsset.create({ data: { organizationId, vulnerabilityId: v.id, assetId: asset.id, exposure: data.exposure ?? null } });
    await writeAuditLog(tx, { ctx, action: "link_asset", module: "vulnerability", recordId: v.id, after: { assetId: asset.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function unlinkVulnerabilityAsset(id: string) {
  const ctx = await requirePermission("vulnerabilities:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.vulnerabilityAsset.findFirst({ where: { id, organizationId } });
    if (!link) throw new Error("Vinculación no encontrada.");
    await tx.vulnerabilityAsset.delete({ where: { id: link.id } });
    await writeAuditLog(tx, { ctx, action: "unlink_asset", module: "vulnerability", recordId: link.vulnerabilityId });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function addRemediation(input: unknown) {
  const data = parseInput(remediationSchema, input);
  const ctx = await requirePermission("vulnerabilities:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.responsibleId);
  const result = await prisma.$transaction(async (tx) => {
    const v = await tx.vulnerability.findFirst({ where: { id: data.vulnerabilityId, organizationId } });
    if (!v) throw new Error("Vulnerabilidad no encontrada.");
    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia no pertenece a la organización.");
    }
    const rem = await tx.remediation.create({ data: { organizationId, vulnerabilityId: v.id, description: data.description, responsibleId: data.responsibleId ?? null, targetDate: toDate(data.targetDate), status: data.status, evidenceId: data.evidenceId ?? null } });
    if (v.status === "OPEN") await tx.vulnerability.update({ where: { id: v.id }, data: { status: "IN_PROGRESS" } });
    await writeAuditLog(tx, { ctx, action: "add_remediation", module: "vulnerability", recordId: v.id, after: { remediationId: rem.id } });
    return rem;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function updateRemediation(input: unknown) {
  const data = parseInput(remediationUpdateSchema, input);
  const ctx = await requirePermission("vulnerabilities:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.responsibleId);
  const result = await prisma.$transaction(async (tx) => {
    const rem = await tx.remediation.findFirst({ where: { id: data.id, organizationId } });
    if (!rem) throw new Error("Remediación no encontrada.");
    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia no pertenece a la organización.");
    }
    await tx.remediation.update({ where: { id: rem.id }, data: { description: data.description, responsibleId: data.responsibleId ?? null, targetDate: toDate(data.targetDate), status: data.status, evidenceId: data.evidenceId ?? null } });
    if (data.status === "DONE") await tx.vulnerability.update({ where: { id: rem.vulnerabilityId }, data: { status: "REMEDIATED" } });
    await writeAuditLog(tx, { ctx, action: "update_remediation", module: "vulnerability", recordId: rem.vulnerabilityId, after: { remediationId: rem.id, status: data.status } });
    return { id: rem.id };
  });
  revalidatePath(PATH);
  return result;
}

export async function addVerification(input: unknown) {
  const data = parseInput(verificationSchema, input);
  const ctx = await requirePermission("vulnerabilities:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const rem = await tx.remediation.findFirst({ where: { id: data.remediationId, organizationId } });
    if (!rem) throw new Error("Remediación no encontrada.");
    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia no pertenece a la organización.");
    }
    const ver = await tx.verification.create({ data: { organizationId, remediationId: rem.id, result: data.result, notes: data.notes ?? null, verifiedById: ctx.user.id, evidenceId: data.evidenceId ?? null } });
    if (data.result === "PASSED") {
      await tx.remediation.update({ where: { id: rem.id }, data: { status: "VERIFIED" } });
      await tx.vulnerability.update({ where: { id: rem.vulnerabilityId }, data: { status: "VERIFIED" } });
    }
    await writeAuditLog(tx, { ctx, action: "verify_remediation", module: "vulnerability", recordId: rem.vulnerabilityId, after: { verificationId: ver.id, result: data.result } });
    return ver;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function exportVulnerabilities(input: unknown) {
  const data = parseInput(vulnExportSchema, input);
  const ctx = await requirePermission("vulnerabilities:export");
  const now = new Date();
  const reportType = data.reportType ?? "open-vulnerabilities";
  const titles: Record<string, string> = { "open-vulnerabilities": "Vulnerabilidades abiertas", "remediation-plan": "Plan de remediación" };
  const report = await queueReportForContext({ ctx, reportType, title: titles[reportType] ?? "Vulnerabilidades", format: data.format, fileName: `${reportType}-${now.toISOString().slice(0, 10)}.${data.format === "PDF" ? "pdf" : "xlsx"}`, dateFrom: now, dateTo: now, filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) } });
  revalidatePath("/app/reporting");
  return { id: report.id, status: report.status };
}
