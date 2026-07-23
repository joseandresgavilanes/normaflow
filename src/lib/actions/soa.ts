"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { queueReportForContext } from "@/lib/report-queue";
import { ensureOrganizationControlSet } from "@/lib/security-control-catalog";
import { parseInput } from "@/lib/validation/common";
import {
  createSoADraftSchema,
  soaApprovalSchema,
  soaEntryUpdateSchema,
  soaExportSchema,
  soaSubmitReviewSchema,
} from "@/lib/validation/soa";

const PATH = "/app/soa";
const EDITABLE = ["DRAFT", "UNDER_REVIEW"] as const;

export type SoAPayload = Awaited<ReturnType<typeof getSoAPayload>>;

function dateValue(value: Date | null | undefined) { return value?.toISOString().slice(0, 10) ?? null; }
function toParsedDate(value: string | null | undefined) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value);
}

async function loadMember(organizationId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const member = await prisma.membership.findFirst({ where: { organizationId, userId, active: true } });
  if (!member) throw new Error("El usuario no pertenece a la organización.");
  return userId;
}

export async function getSoAPayload() {
  const authorization = await requireAuthorization("soa:read");
  const organizationId = authorization.ctx.organization.id;
  await ensureOrganizationControlSet(organizationId);

  const [current, history, catalogVersion, members, evidenceOptions, riskItemOptions] = await Promise.all([
    prisma.statementOfApplicability.findFirst({
      where: { organizationId },
      orderBy: { version: "desc" },
      include: {
        owner: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        approvalEvidence: { select: { id: true, title: true } },
        entries: {
          orderBy: { control: { sortOrder: "asc" } },
          include: {
            responsible: { select: { id: true, name: true } },
            evidence: { select: { id: true, title: true } },
            relatedRiskItem: { select: { id: true, reference: true, title: true } },
          },
        },
      },
    }),
    prisma.statementOfApplicability.findMany({
      where: { organizationId },
      orderBy: { version: "desc" },
      select: { id: true, version: true, status: true, approvedAt: true, createdAt: true },
    }),
    prisma.controlCatalogVersion.findFirst({ where: { standard: { code: "ISO_27001" }, active: true }, select: { version: true, catalogDate: true } }),
    authorization.can("members:read") ? prisma.membership.findMany({ where: { organizationId, active: true }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
    prisma.evidenceFile.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.riskTreatmentItem.findMany({ where: { organizationId }, select: { id: true, reference: true, title: true }, orderBy: { reference: "asc" }, take: 500 }),
  ]);

  const entries = current?.entries ?? [];
  const total = entries.length;
  const included = entries.filter((e) => e.applicability === "INCLUDED").length;
  const excluded = entries.filter((e) => e.applicability === "EXCLUDED").length;
  const pending = entries.filter((e) => e.applicability === "UNDER_REVIEW").length;
  const implemented = entries.filter((e) => ["IMPLEMENTED", "EFFECTIVE"].includes(e.implementationStatus)).length;
  const domainCounts = entries.reduce<Record<string, number>>((acc, e) => { acc[e.controlDomain] = (acc[e.controlDomain] ?? 0) + 1; return acc; }, {});

  return {
    canCreate: authorization.can("soa:create"),
    canUpdate: authorization.can("soa:update"),
    canApprove: authorization.can("soa:approve"),
    canExport: authorization.can("soa:export"),
    catalogVersion: catalogVersion ? { version: catalogVersion.version, catalogDate: catalogVersion.catalogDate.toISOString() } : null,
    current: current
      ? {
          id: current.id,
          version: current.version,
          status: current.status,
          scope: current.scope,
          owner: current.owner,
          approver: current.approver,
          approvalComment: current.approvalComment,
          approvalEvidence: current.approvalEvidence,
          approvedAt: current.approvedAt?.toISOString() ?? null,
          nextReviewDate: dateValue(current.nextReviewDate),
          editable: EDITABLE.includes(current.status as (typeof EDITABLE)[number]),
        }
      : null,
    summary: { total, included, excluded, pending, implemented, domainCounts },
    entries: entries.map((e) => ({
      id: e.id,
      code: e.controlCode,
      title: e.controlTitle,
      domain: e.controlDomain,
      applicability: e.applicability,
      justification: e.justification,
      implementationStatus: e.implementationStatus,
      responsible: e.responsible,
      evidence: e.evidence,
      relatedRiskItem: e.relatedRiskItem,
      reviewDate: dateValue(e.reviewDate),
      notes: e.notes,
    })),
    history,
    members: members.map((m) => m.user),
    evidenceOptions,
    riskItemOptions,
  };
}

export async function createSoADraft(input: unknown) {
  const data = parseInput(createSoADraftSchema, input);
  const ctx = await requirePermission("soa:create");
  const organizationId = ctx.organization.id;
  await ensureOrganizationControlSet(organizationId);
  await loadMember(organizationId, data.ownerId);

  const result = await prisma.$transaction(async (tx) => {
    const open = await tx.statementOfApplicability.findFirst({ where: { organizationId, status: { in: [...EDITABLE] } } });
    if (open) throw new Error("Ya existe una versión en borrador o revisión; edítala en lugar de crear otra.");

    const version = await tx.controlCatalogVersion.findFirst({
      where: { standard: { code: "ISO_27001" }, active: true, status: "PUBLISHED" },
      include: { controls: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (!version || version.controls.length === 0) throw new Error("El catálogo de controles ISO 27001 no está disponible.");

    const states = await tx.organizationControl.findMany({ where: { organizationId }, select: { controlId: true, applicability: true, status: true, responsibleId: true } });
    const stateByControl = new Map(states.map((s) => [s.controlId, s]));

    const latest = await tx.statementOfApplicability.aggregate({ where: { organizationId }, _max: { version: true } });
    const nextVersion = (latest._max.version ?? 0) + 1;

    const soa = await tx.statementOfApplicability.create({
      data: { organizationId, version: nextVersion, status: "DRAFT", scope: data.scope ?? null, ownerId: data.ownerId ?? null },
    });

    await tx.soAControlEntry.createMany({
      data: version.controls.map((control) => {
        const state = stateByControl.get(control.id);
        return {
          organizationId,
          soaId: soa.id,
          controlId: control.id,
          controlCode: control.code,
          controlTitle: control.title,
          controlDomain: control.domain,
          applicability: state?.applicability ?? "UNDER_REVIEW",
          implementationStatus: state?.status ?? "NOT_ASSESSED",
          responsibleId: state?.responsibleId ?? null,
        };
      }),
    });

    await writeAuditLog(tx, { ctx, action: "create", module: "soa", recordId: soa.id, after: { version: nextVersion, entries: version.controls.length } });
    return { id: soa.id, version: nextVersion, entries: version.controls.length };
  });

  revalidatePath(PATH);
  return result;
}

export async function updateSoAEntry(input: unknown) {
  const data = parseInput(soaEntryUpdateSchema, input);
  const ctx = await requirePermission("soa:update");
  const organizationId = ctx.organization.id;
  await loadMember(organizationId, data.responsibleId);

  const after = await prisma.$transaction(async (tx) => {
    const entry = await tx.soAControlEntry.findFirst({ where: { id: data.id, organizationId }, include: { soa: { select: { status: true } } } });
    if (!entry) throw new Error("Entrada de SoA no encontrada.");
    if (!EDITABLE.includes(entry.soa.status as (typeof EDITABLE)[number])) throw new Error("La versión aprobada de la Declaración de Aplicabilidad es inmutable.");
    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia no pertenece a la organización.");
    }
    if (data.relatedRiskItemId) {
      const item = await tx.riskTreatmentItem.findFirst({ where: { id: data.relatedRiskItemId, organizationId } });
      if (!item) throw new Error("El riesgo relacionado no pertenece a la organización.");
    }
    const updated = await tx.soAControlEntry.updateMany({
      where: { id: data.id, organizationId },
      data: {
        applicability: data.applicability,
        justification: data.justification ?? null,
        implementationStatus: data.implementationStatus,
        relatedRiskItemId: data.relatedRiskItemId ?? null,
        evidenceId: data.evidenceId ?? null,
        responsibleId: data.responsibleId ?? null,
        reviewDate: toParsedDate(data.reviewDate),
        notes: data.notes ?? null,
      },
    });
    if (updated.count !== 1) throw new Error("La entrada cambió mientras se editaba; vuelve a cargarla.");
    const current = await tx.soAControlEntry.findUniqueOrThrow({ where: { id: data.id } });
    await writeAuditLog(tx, { ctx, action: "update", module: "soa_entry", recordId: current.id, before: { applicability: entry.applicability, implementationStatus: entry.implementationStatus }, after: { applicability: current.applicability, implementationStatus: current.implementationStatus } });
    return current;
  });

  revalidatePath(PATH);
  return { id: after.id, applicability: after.applicability };
}

export async function submitSoAForReview(input: unknown) {
  const data = parseInput(soaSubmitReviewSchema, input);
  const ctx = await requirePermission("soa:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.statementOfApplicability.updateMany({ where: { id: data.id, organizationId, status: "DRAFT" }, data: { status: "UNDER_REVIEW" } });
    if (updated.count !== 1) throw new Error("Solo un borrador puede enviarse a revisión.");
    await writeAuditLog(tx, { ctx, action: "submit_review", module: "soa", recordId: data.id });
    return { id: data.id };
  });
  revalidatePath(PATH);
  return result;
}

export async function approveSoA(input: unknown) {
  const data = parseInput(soaApprovalSchema, input);
  const ctx = await requirePermission("soa:approve");
  const organizationId = ctx.organization.id;

  const result = await prisma.$transaction(async (tx) => {
    const soa = await tx.statementOfApplicability.findFirst({ where: { id: data.id, organizationId }, include: { entries: { select: { applicability: true, justification: true } } } });
    if (!soa) throw new Error("Declaración de Aplicabilidad no encontrada.");
    if (!EDITABLE.includes(soa.status as (typeof EDITABLE)[number])) throw new Error("La versión ya está aprobada o reemplazada.");

    const activeControls = await tx.securityControl.count({ where: { active: true, catalogVersion: { standard: { code: "ISO_27001" }, active: true } } });
    if (soa.entries.length !== activeControls) throw new Error(`La SoA debe cubrir los ${activeControls} controles del catálogo.`);
    if (soa.entries.some((e) => e.applicability === "UNDER_REVIEW")) throw new Error("Cada control debe marcarse como incluido o excluido antes de aprobar.");
    const missingJustification = soa.entries.some((e) => e.applicability === "EXCLUDED" && !e.justification?.trim());
    if (missingJustification) throw new Error("Cada control excluido requiere una justificación.");

    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia de aprobación no pertenece a la organización.");
    }

    const approved = await tx.statementOfApplicability.update({
      where: { id: soa.id },
      data: { status: "APPROVED", approverId: ctx.user.id, approvedAt: new Date(), approvalComment: data.comment ?? null, approvalEvidenceId: data.evidenceId ?? null, nextReviewDate: toParsedDate(data.nextReviewDate) },
    });

    // Supersede any previously approved version.
    const superseded = await tx.statementOfApplicability.updateMany({
      where: { organizationId, status: "APPROVED", id: { not: soa.id } },
      data: { status: "SUPERSEDED", supersededById: soa.id },
    });

    await writeAuditLog(tx, { ctx, action: "approve", module: "soa", recordId: soa.id, after: { version: soa.version, approverId: ctx.user.id, supersededPrevious: superseded.count } });
    return { id: approved.id, version: approved.version, superseded: superseded.count };
  });

  revalidatePath(PATH);
  return result;
}

export async function exportSoA(input: unknown) {
  const data = parseInput(soaExportSchema, input);
  const ctx = await requirePermission("soa:export");
  const now = new Date();
  const reportType = data.reportType ?? "soa";
  const titles: Record<string, string> = {
    "soa": "Declaración de Aplicabilidad (SoA)",
    "excluded-controls": "Controles excluidos de la SoA",
    "pending-controls": "Controles pendientes de la SoA",
    "control-evidence": "Evidencias por control",
  };
  const report = await queueReportForContext({
    ctx,
    reportType,
    title: titles[reportType] ?? "Declaración de Aplicabilidad",
    format: data.format,
    fileName: `${reportType}-${now.toISOString().slice(0, 10)}.${data.format === "PDF" ? "pdf" : "xlsx"}`,
    dateFrom: now,
    dateTo: now,
    filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
  });
  revalidatePath("/app/reporting");
  return { id: report.id, status: report.status };
}
