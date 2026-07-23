"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { queueReportForContext } from "@/lib/report-queue";
import { ensureOrganizationControlSet } from "@/lib/security-control-catalog";
import { parseInput } from "@/lib/validation/common";
import {
  controlEvidenceLinkSchema,
  controlEvidenceValidationSchema,
  controlReviewSchema,
  organizationControlUpdateSchema,
  parseSecurityControlFilters,
  riskControlLinkSchema,
  securityControlExportSchema,
} from "@/lib/validation/security-controls";

const PATH = "/app/security-controls";

export type SecurityControlsPayload = Awaited<ReturnType<typeof getSecurityControlsPayload>>;

function dateValue(value: Date | null | undefined) { return value?.toISOString().slice(0, 10) ?? null; }

async function ensureSet(organizationId: string) {
  return ensureOrganizationControlSet(organizationId);
}

export async function getSecurityControlsPayload(input?: unknown) {
  const authorization = await requireAuthorization("security-controls:read");
  const filters = parseSecurityControlFilters(input);
  await ensureSet(authorization.ctx.organization.id);
  const now = new Date();
  const controlWhere: Prisma.SecurityControlWhereInput = {
    active: true,
    ...(filters.domain ? { domain: filters.domain } : {}),
    ...(filters.query ? { OR: [{ code: { contains: filters.query, mode: "insensitive" } }, { title: { contains: filters.query, mode: "insensitive" } }] } : {}),
  };
  const where: Prisma.OrganizationControlWhereInput = {
    organizationId: authorization.ctx.organization.id,
    control: controlWhere,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.applicability ? { applicability: filters.applicability } : {}),
    ...(filters.responsibleId ? { responsibleId: filters.responsibleId } : {}),
    ...(filters.overdue ? { nextReviewDate: { lt: now } } : {}),
  };
  const [rows, version, evidenceOptions, riskOptions, members] = await Promise.all([
    prisma.organizationControl.findMany({
      where,
      include: {
        control: { include: { catalogVersion: { select: { version: true, catalogDate: true, status: true } } } },
        responsible: { select: { id: true, name: true } },
        evidence: { include: { evidence: { select: { id: true, title: true, status: true, expiresAt: true, fileUrl: true } } }, orderBy: { createdAt: "desc" } },
        reviews: { orderBy: { reviewedAt: "desc" }, take: 3, include: { reviewer: { select: { id: true, name: true } } } },
        riskLinks: { include: { risk: { select: { id: true, title: true, score: true, status: true } } } },
      },
      orderBy: [{ control: { sortOrder: "asc" } }],
    }),
    prisma.controlCatalogVersion.findFirst({ where: { standard: { code: "ISO_27001" }, active: true }, select: { id: true, version: true, catalogDate: true, status: true } }),
    prisma.evidenceFile.findMany({ where: { organizationId: authorization.ctx.organization.id, deletedAt: null }, select: { id: true, title: true, status: true, expiresAt: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.risk.findMany({ where: { organizationId: authorization.ctx.organization.id }, select: { id: true, title: true, score: true, status: true }, orderBy: { score: "desc" }, take: 500 }),
    authorization.can("members:read") ? prisma.membership.findMany({ where: { organizationId: authorization.ctx.organization.id, active: true }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
  ]);
  const total = rows.length;
  const counts = rows.reduce<Record<string, number>>((acc, row) => { acc[row.status] = (acc[row.status] ?? 0) + 1; return acc; }, {});
  const domainCounts = rows.reduce<Record<string, number>>((acc, row) => { acc[row.control.domain] = (acc[row.control.domain] ?? 0) + 1; return acc; }, {});
  const included = rows.filter((row) => row.applicability === "INCLUDED").length;
  const implemented = rows.filter((row) => ["IMPLEMENTED", "EFFECTIVE"].includes(row.status)).length;
  const overdue = rows.filter((row) => row.nextReviewDate && row.nextReviewDate < now).length;
  return {
    filters,
    canUpdate: authorization.can("security-controls:update"),
    canApprove: authorization.can("security-controls:approve"),
    canExport: authorization.can("security-controls:export"),
    catalogVersion: version ? { ...version, catalogDate: version.catalogDate.toISOString() } : null,
    summary: { total, included, implemented, coverage: included ? Math.round((implemented / included) * 100) : 0, overdue, statusCounts: counts, domainCounts },
    controls: rows.map((row) => ({
      id: row.id,
      controlId: row.controlId,
      code: row.control.code,
      domain: row.control.domain,
      title: row.control.title,
      descriptionInternal: row.control.descriptionInternal,
      objective: row.control.objective,
      applicability: row.applicability,
      status: row.status,
      implementationLevel: row.implementationLevel,
      responsible: row.responsible,
      reviewDate: dateValue(row.reviewDate),
      nextReviewDate: dateValue(row.nextReviewDate),
      notes: row.notes,
      evidence: row.evidence.map((item) => ({ id: item.id, evidenceId: item.evidenceId, period: item.period, status: item.status, title: item.evidence.title, expiresAt: dateValue(item.evidence.expiresAt) })),
      risks: row.riskLinks.map((link) => ({ id: link.id, riskId: link.riskId, title: link.risk.title, score: link.risk.score, status: link.risk.status })),
      reviews: row.reviews.map((review) => ({ id: review.id, result: review.result, effectiveness: review.effectiveness, comments: review.comments, reviewer: review.reviewer, reviewedAt: review.reviewedAt.toISOString() })),
    })),
    evidenceOptions,
    riskOptions,
    members: members.map((item) => item.user),
  };
}

export async function updateOrganizationControl(input: unknown) {
  const data = parseInput(organizationControlUpdateSchema, input);
  const ctx = await requirePermission("security-controls:update");
  const before = await prisma.organizationControl.findFirst({ where: { id: data.id, organizationId: ctx.organization.id }, include: { control: true, responsible: { select: { id: true, name: true } } } });
  if (!before) throw new Error("Control no encontrado.");
  if (data.responsibleId) {
    const member = await prisma.membership.findFirst({ where: { organizationId: ctx.organization.id, userId: data.responsibleId, active: true } });
    if (!member) throw new Error("El responsable no pertenece a la organización.");
  }
  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.organizationControl.updateMany({ where: { id: data.id, organizationId: ctx.organization.id }, data: { applicability: data.applicability, status: data.status, responsibleId: data.responsibleId ?? null, reviewDate: data.reviewDate ? new Date(data.reviewDate) : null, nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null, implementationLevel: data.implementationLevel, notes: data.notes ?? null } });
    if (updated.count !== 1) throw new Error("El control cambió mientras se editaba; vuelve a cargarlo.");
    const current = await tx.organizationControl.findUniqueOrThrow({ where: { id: data.id }, include: { control: true, responsible: { select: { id: true, name: true } } } });
    await writeAuditLog(tx, { ctx, action: "update", module: "security_control", recordId: current.id, before: before as unknown as Record<string, unknown>, after: current as unknown as Record<string, unknown> });
    return current;
  });
  revalidatePath(PATH);
  return { id: after.id, status: after.status, implementationLevel: after.implementationLevel };
}

export async function linkControlEvidence(input: unknown) {
  const data = parseInput(controlEvidenceLinkSchema, input);
  const ctx = await requirePermission("security-controls:update");
  const result = await prisma.$transaction(async (tx) => {
    const control = await tx.organizationControl.findFirst({ where: { id: data.organizationControlId, organizationId: ctx.organization.id } });
    const evidence = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId: ctx.organization.id, deletedAt: null } });
    if (!control || !evidence) throw new Error("Control o evidencia no pertenecen a la organización.");
    const created = await tx.controlEvidence.create({ data: { organizationId: ctx.organization.id, organizationControlId: control.id, evidenceId: evidence.id, period: data.period } });
    await writeAuditLog(tx, { ctx, action: "attach_evidence", module: "security_control", recordId: control.id, after: { controlEvidenceId: created.id, evidenceId: evidence.id, period: data.period } });
    return created;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function validateControlEvidence(input: unknown) {
  const data = parseInput(controlEvidenceValidationSchema, input);
  const ctx = await requirePermission("security-controls:approve");
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.controlEvidence.findFirst({ where: { id: data.id, organizationId: ctx.organization.id } });
    if (!current) throw new Error("Evidencia de control no encontrada.");
    const updated = await tx.controlEvidence.updateMany({ where: { id: current.id, organizationId: ctx.organization.id, status: "PENDING_VALIDATION" }, data: { status: data.status, validatorId: ctx.user.id, validatedAt: new Date() } });
    if (updated.count !== 1) throw new Error("La evidencia ya fue validada por otro usuario.");
    const after = await tx.controlEvidence.findUniqueOrThrow({ where: { id: current.id } });
    await writeAuditLog(tx, { ctx, action: "validate_evidence", module: "security_control", recordId: current.organizationControlId, before: current as unknown as Record<string, unknown>, after: after as unknown as Record<string, unknown> });
    return after;
  });
  revalidatePath(PATH);
  return { id: result.id, status: result.status };
}

export async function reviewSecurityControl(input: unknown) {
  const data = parseInput(controlReviewSchema, input);
  const ctx = await requirePermission("security-controls:approve");
  const result = await prisma.$transaction(async (tx) => {
    const control = await tx.organizationControl.findFirst({ where: { id: data.organizationControlId, organizationId: ctx.organization.id } });
    if (!control) throw new Error("Control no encontrado.");
    const review = await tx.controlReview.create({ data: { organizationId: ctx.organization.id, organizationControlId: control.id, result: data.result, effectiveness: data.effectiveness, comments: data.comments ?? null, reviewerId: ctx.user.id } });
    const nextStatus = data.effectiveness === "EFFECTIVE" ? "EFFECTIVE" : data.effectiveness === "INEFFECTIVE" ? "NOT_EFFECTIVE" : data.result === "CONFORMING" ? "IMPLEMENTED" : data.result === "PARTIALLY_CONFORMING" ? "PARTIALLY_IMPLEMENTED" : control.status;
    await tx.organizationControl.update({ where: { id: control.id }, data: { status: nextStatus, reviewDate: new Date() } });
    await writeAuditLog(tx, { ctx, action: "review", module: "security_control", recordId: control.id, before: { status: control.status }, after: { status: nextStatus, reviewId: review.id, result: data.result, effectiveness: data.effectiveness } });
    return review;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function linkRiskToSecurityControl(input: unknown) {
  const data = parseInput(riskControlLinkSchema, input);
  const ctx = await requirePermission("security-controls:update");
  const result = await prisma.$transaction(async (tx) => {
    const [control, risk] = await Promise.all([
      tx.organizationControl.findFirst({ where: { id: data.organizationControlId, organizationId: ctx.organization.id } }),
      tx.risk.findFirst({ where: { id: data.riskId, organizationId: ctx.organization.id } }),
    ]);
    if (!control || !risk) throw new Error("Control o riesgo no pertenecen a la organización.");
    const link = await tx.riskControlLink.create({ data: { organizationId: ctx.organization.id, riskId: risk.id, organizationControlId: control.id, purpose: data.purpose, expectedEffectiveness: data.expectedEffectiveness ?? null, observedEffectiveness: data.observedEffectiveness ?? null } });
    await writeAuditLog(tx, { ctx, action: "link_risk", module: "security_control", recordId: control.id, after: { riskControlLinkId: link.id, riskId: risk.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function unlinkRiskFromSecurityControl(id: string) {
  const ctx = await requirePermission("security-controls:update");
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.riskControlLink.findFirst({ where: { id, organizationId: ctx.organization.id } });
    if (!link) throw new Error("Vinculación no encontrada.");
    await tx.riskControlLink.delete({ where: { id: link.id } });
    await writeAuditLog(tx, { ctx, action: "unlink_risk", module: "security_control", recordId: link.organizationControlId, before: link as unknown as Record<string, unknown> });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function exportSecurityControls(input: unknown) {
  const data = parseInput(securityControlExportSchema, input);
  const ctx = await requirePermission("security-controls:export");
  const now = new Date();
  const filters = data.filters ?? {};
  const report = await queueReportForContext({ ctx, reportType: "security-controls", title: "Catálogo operativo de controles ISO 27001", format: data.format, fileName: `controles-iso-27001-${now.toISOString().slice(0, 10)}.${data.format === "PDF" ? "pdf" : "xlsx"}`, dateFrom: now, dateTo: now, filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10), status: filters.status, domain: filters.domain, applicability: filters.applicability, ownerId: filters.responsibleId } });
  revalidatePath("/app/reporting");
  return { id: report.id, status: report.status };
}
