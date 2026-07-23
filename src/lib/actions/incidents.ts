"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { notifyUser } from "@/lib/notify";
import { queueReportForContext } from "@/lib/report-queue";
import { parseInput } from "@/lib/validation/common";
import {
  INCIDENT_ORDER,
  incidentAssetSchema,
  incidentCreateSchema,
  incidentEvidenceSchema,
  incidentExportSchema,
  incidentTransitionSchema,
  incidentUpdateSchema,
  nextIncidentStatus,
  parseIncidentFilters,
} from "@/lib/validation/incidents";

const PATH = "/app/incidents";

export type IncidentsPayload = Awaited<ReturnType<typeof getIncidentsPayload>>;

function dateValue(v: Date | null | undefined) { return v?.toISOString().slice(0, 10) ?? null; }
function toDate(v: string | null | undefined) { if (!v) return null; return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00.000Z`) : new Date(v); }
async function ensureMember(organizationId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const m = await prisma.membership.findFirst({ where: { organizationId, userId, active: true } });
  if (!m) throw new Error("El usuario no pertenece a la organización.");
  return userId;
}

export async function getIncidentsPayload(input?: unknown) {
  const authorization = await requireAuthorization("incidents:read");
  const organizationId = authorization.ctx.organization.id;
  const filters = parseIncidentFilters(input);

  const [rows, members, assetOptions, evidenceOptions] = await Promise.all([
    prisma.securityIncident.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.query ? { OR: [{ code: { contains: filters.query, mode: "insensitive" } }, { description: { contains: filters.query, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ detectedAt: "desc" }],
      include: {
        reporter: { select: { id: true, name: true } },
        responsible: { select: { id: true, name: true } },
        affectedAssets: { include: { asset: { select: { id: true, code: true, name: true } } } },
        evidenceLinks: { include: { evidence: { select: { id: true, title: true } } } },
      },
    }),
    authorization.can("members:read") ? prisma.membership.findMany({ where: { organizationId, active: true }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
    prisma.informationAsset.findMany({ where: { organizationId }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" }, take: 500 }),
    prisma.evidenceFile.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  const openStatuses = INCIDENT_ORDER.filter((s) => s !== "CLOSED");
  return {
    filters,
    canCreate: authorization.can("incidents:create"),
    canUpdate: authorization.can("incidents:update"),
    canExport: authorization.can("incidents:export"),
    summary: {
      total: rows.length,
      open: rows.filter((r) => r.status !== "CLOSED").length,
      critical: rows.filter((r) => r.severity === "CRITICAL" && r.status !== "CLOSED").length,
      notifiable: rows.filter((r) => r.notificationRequired && r.status !== "CLOSED").length,
      statusCounts: rows.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {}),
    },
    order: INCIDENT_ORDER,
    openStatuses,
    incidents: rows.map((r) => ({
      id: r.id, code: r.code, detectedAt: dateValue(r.detectedAt), occurredAt: dateValue(r.occurredAt),
      reporter: r.reporter, responsible: r.responsible, severity: r.severity, category: r.category,
      description: r.description, impact: r.impact, status: r.status, nextStatus: nextIncidentStatus(r.status),
      notificationRequired: r.notificationRequired, notificationDetails: r.notificationDetails, lessonsLearned: r.lessonsLearned,
      closedAt: dateValue(r.closedAt),
      assets: r.affectedAssets.map((a) => ({ id: a.id, asset: a.asset })),
      evidence: r.evidenceLinks.map((e) => ({ id: e.id, evidence: e.evidence })),
    })),
    members: members.map((m) => m.user),
    assetOptions, evidenceOptions,
  };
}

export async function createIncident(input: unknown) {
  const data = parseInput(incidentCreateSchema, input);
  const ctx = await requirePermission("incidents:create");
  const organizationId = ctx.organization.id;
  await Promise.all([ensureMember(organizationId, data.reporterId), ensureMember(organizationId, data.responsibleId)]);

  const result = await prisma.$transaction(async (tx) => {
    const dup = await tx.securityIncident.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe un incidente con el código ${data.code}.`);
    const incident = await tx.securityIncident.create({
      data: {
        organizationId, code: data.code, detectedAt: toDate(data.detectedAt) ?? new Date(), occurredAt: toDate(data.occurredAt),
        reporterId: data.reporterId ?? ctx.user.id, responsibleId: data.responsibleId ?? null, severity: data.severity, category: data.category,
        description: data.description, impact: data.impact ?? null, notificationRequired: data.notificationRequired, notificationDetails: data.notificationDetails ?? null,
      },
    });
    if (data.affectedAssetIds?.length) {
      const assets = await tx.informationAsset.findMany({ where: { organizationId, id: { in: data.affectedAssetIds } }, select: { id: true } });
      if (assets.length) await tx.securityIncidentAsset.createMany({ data: assets.map((a) => ({ organizationId, incidentId: incident.id, assetId: a.id })), skipDuplicates: true });
    }
    await writeAuditLog(tx, { ctx, action: "create", module: "incident", recordId: incident.id, after: { code: incident.code, severity: incident.severity } });
    return incident;
  });

  if (result.responsibleId && (data.severity === "HIGH" || data.severity === "CRITICAL")) {
    await notifyUser({ organizationId, userId: result.responsibleId, title: `Incidente ${result.code} (${data.severity})`, body: data.description.slice(0, 240), type: "ALERT", link: PATH, idempotencyKey: `incident:${result.id}:assigned` }).catch(() => undefined);
  }
  revalidatePath(PATH);
  return { id: result.id, code: result.code };
}

export async function updateIncident(input: unknown) {
  const data = parseInput(incidentUpdateSchema, input);
  const ctx = await requirePermission("incidents:update");
  const organizationId = ctx.organization.id;
  await ensureMember(organizationId, data.responsibleId);
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.securityIncident.findFirst({ where: { id: data.id, organizationId } });
    if (!before) throw new Error("Incidente no encontrado.");
    const updated = await tx.securityIncident.updateMany({ where: { id: data.id, organizationId }, data: { occurredAt: toDate(data.occurredAt), responsibleId: data.responsibleId ?? null, severity: data.severity, category: data.category, impact: data.impact ?? null, notificationRequired: data.notificationRequired, notificationDetails: data.notificationDetails ?? null, lessonsLearned: data.lessonsLearned ?? null } });
    if (updated.count !== 1) throw new Error("El incidente cambió mientras se editaba; vuelve a cargarlo.");
    await writeAuditLog(tx, { ctx, action: "update", module: "incident", recordId: data.id, before: { severity: before.severity }, after: { severity: data.severity } });
    return { id: data.id };
  });
  revalidatePath(PATH);
  return result;
}

export async function transitionIncident(input: unknown) {
  const data = parseInput(incidentTransitionSchema, input);
  const ctx = await requirePermission("incidents:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const incident = await tx.securityIncident.findFirst({ where: { id: data.id, organizationId } });
    if (!incident) throw new Error("Incidente no encontrado.");
    const expected = nextIncidentStatus(incident.status);
    if (data.toStatus !== expected) throw new Error(`Transición inválida ${incident.status} → ${data.toStatus}. El flujo no permite saltos; el siguiente estado válido es ${expected ?? "ninguno (ya cerrado)"}.`);
    await tx.securityIncident.update({ where: { id: incident.id }, data: { status: data.toStatus, closedAt: data.toStatus === "CLOSED" ? new Date() : null } });
    await writeAuditLog(tx, { ctx, action: "status_change", module: "incident", recordId: incident.id, before: { status: incident.status }, after: { status: data.toStatus } });
    return { id: incident.id, status: data.toStatus, reporterId: incident.reporterId };
  });
  if (result.status === "CLOSED" && result.reporterId) {
    await notifyUser({ organizationId, userId: result.reporterId, title: `Incidente cerrado`, body: `El incidente ha sido cerrado.`, type: "SUCCESS", link: PATH, idempotencyKey: `incident:${result.id}:closed` }).catch(() => undefined);
  }
  revalidatePath(PATH);
  return { id: result.id, status: result.status };
}

export async function linkIncidentAsset(input: unknown) {
  const data = parseInput(incidentAssetSchema, input);
  const ctx = await requirePermission("incidents:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const [incident, asset] = await Promise.all([
      tx.securityIncident.findFirst({ where: { id: data.incidentId, organizationId } }),
      tx.informationAsset.findFirst({ where: { id: data.assetId, organizationId } }),
    ]);
    if (!incident || !asset) throw new Error("Incidente o activo no pertenecen a la organización.");
    const link = await tx.securityIncidentAsset.create({ data: { organizationId, incidentId: incident.id, assetId: asset.id } });
    await writeAuditLog(tx, { ctx, action: "link_asset", module: "incident", recordId: incident.id, after: { assetId: asset.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function unlinkIncidentAsset(id: string) {
  const ctx = await requirePermission("incidents:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.securityIncidentAsset.findFirst({ where: { id, organizationId } });
    if (!link) throw new Error("Vinculación no encontrada.");
    await tx.securityIncidentAsset.delete({ where: { id: link.id } });
    await writeAuditLog(tx, { ctx, action: "unlink_asset", module: "incident", recordId: link.incidentId });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function linkIncidentEvidence(input: unknown) {
  const data = parseInput(incidentEvidenceSchema, input);
  const ctx = await requirePermission("incidents:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const [incident, ev] = await Promise.all([
      tx.securityIncident.findFirst({ where: { id: data.incidentId, organizationId } }),
      tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } }),
    ]);
    if (!incident || !ev) throw new Error("Incidente o evidencia no pertenecen a la organización.");
    const link = await tx.securityIncidentEvidence.create({ data: { organizationId, incidentId: incident.id, evidenceId: ev.id } });
    await writeAuditLog(tx, { ctx, action: "attach_evidence", module: "incident", recordId: incident.id, after: { evidenceId: ev.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function unlinkIncidentEvidence(id: string) {
  const ctx = await requirePermission("incidents:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.securityIncidentEvidence.findFirst({ where: { id, organizationId } });
    if (!link) throw new Error("Vinculación no encontrada.");
    await tx.securityIncidentEvidence.delete({ where: { id: link.id } });
    await writeAuditLog(tx, { ctx, action: "detach_evidence", module: "incident", recordId: link.incidentId });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function exportIncidents(input: unknown) {
  const data = parseInput(incidentExportSchema, input);
  const ctx = await requirePermission("incidents:export");
  const now = new Date();
  const reportType = data.reportType ?? "incident-log";
  const titles: Record<string, string> = { "incident-log": "Registro de incidentes de seguridad", "incident-report": "Informe de incidentes de seguridad" };
  const report = await queueReportForContext({ ctx, reportType, title: titles[reportType] ?? "Incidentes", format: data.format, fileName: `${reportType}-${now.toISOString().slice(0, 10)}.${data.format === "PDF" ? "pdf" : "xlsx"}`, dateFrom: now, dateTo: now, filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) } });
  revalidatePath("/app/reporting");
  return { id: report.id, status: report.status };
}
