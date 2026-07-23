"use server";

import { revalidatePath } from "next/cache";
import { AssetCategory, AssetCriticality, AssetStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { queueReportForContext } from "@/lib/report-queue";
import { parseInput } from "@/lib/validation/common";
import {
  assetControlSchema,
  assetCreateSchema,
  assetExportSchema,
  assetImportSchema,
  assetReviewSchema,
  assetRiskSchema,
  assetUpdateSchema,
  classificationSchema,
  dependencySchema,
  parseAssetCsv,
  parseAssetFilters,
} from "@/lib/validation/assets";

const PATH = "/app/assets";

export type AssetsPayload = Awaited<ReturnType<typeof getAssetsPayload>>;

function dateValue(value: Date | null | undefined) { return value?.toISOString().slice(0, 10) ?? null; }
function toParsedDate(value: string | null | undefined) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value);
}
async function ensureMember(organizationId: string, userId: string | null | undefined) {
  if (!userId) return null;
  const member = await prisma.membership.findFirst({ where: { organizationId, userId, active: true } });
  if (!member) throw new Error("El usuario no pertenece a la organización.");
  return userId;
}

export async function getAssetsPayload(input?: unknown) {
  const authorization = await requireAuthorization("assets:read");
  const organizationId = authorization.ctx.organization.id;
  const filters = parseAssetFilters(input);
  const now = new Date();

  const where: Prisma.InformationAssetWhereInput = {
    organizationId,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.criticality ? { criticality: filters.criticality } : {}),
    ...(filters.overdue ? { nextReviewDate: { lt: now } } : {}),
    ...(filters.query ? { OR: [{ code: { contains: filters.query, mode: "insensitive" } }, { name: { contains: filters.query, mode: "insensitive" } }] } : {}),
  };

  const [rows, members, processes, locations, evidenceOptions, orgControlOptions, riskOptions] = await Promise.all([
    prisma.informationAsset.findMany({
      where,
      orderBy: [{ criticality: "desc" }, { code: "asc" }],
      include: {
        owner: { select: { id: true, name: true } },
        custodian: { select: { id: true, name: true } },
        process: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        classification: true,
        risks: { include: { risk: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" } },
        controls: { include: { organizationControl: { select: { id: true, control: { select: { code: true, title: true } } } }, evidence: { select: { id: true, title: true } } } },
        dependencies: { include: { dependentAsset: { select: { id: true, code: true, name: true } } } },
        dependents: { include: { sourceAsset: { select: { id: true, code: true, name: true } } } },
      },
    }),
    authorization.can("members:read") ? prisma.membership.findMany({ where: { organizationId, active: true }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
    prisma.process.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.evidenceFile.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.organizationControl.findMany({ where: { organizationId }, select: { id: true, control: { select: { code: true, title: true } } }, orderBy: { control: { sortOrder: "asc" } }, take: 200 }),
    prisma.risk.findMany({ where: { organizationId }, select: { id: true, title: true }, orderBy: { score: "desc" }, take: 500 }),
  ]);

  const categoryCounts = rows.reduce<Record<string, number>>((acc, a) => { acc[a.category] = (acc[a.category] ?? 0) + 1; return acc; }, {});
  const overdue = rows.filter((a) => a.nextReviewDate && a.nextReviewDate < now);

  return {
    filters,
    canCreate: authorization.can("assets:create"),
    canUpdate: authorization.can("assets:update"),
    canDelete: authorization.can("assets:delete"),
    canExport: authorization.can("assets:export"),
    summary: {
      total: rows.length,
      critical: rows.filter((a) => a.criticality === "CRITICAL").length,
      classified: rows.filter((a) => a.classification).length,
      overdue: overdue.length,
      categoryCounts,
    },
    overdueAlerts: overdue.map((a) => ({ id: a.id, code: a.code, name: a.name, nextReviewDate: dateValue(a.nextReviewDate) })),
    assets: rows.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      description: a.description,
      category: a.category,
      status: a.status,
      criticality: a.criticality,
      owner: a.owner,
      custodian: a.custodian,
      process: a.process,
      location: a.location,
      reviewDate: dateValue(a.reviewDate),
      nextReviewDate: dateValue(a.nextReviewDate),
      overdue: !!(a.nextReviewDate && a.nextReviewDate < now),
      classification: a.classification ? { confidentiality: a.classification.confidentiality, integrity: a.classification.integrity, availability: a.classification.availability, classification: a.classification.classification, legalRequirements: a.classification.legalRequirements, retention: a.classification.retention } : null,
      risks: a.risks.map((r) => ({ id: r.id, riskId: r.riskId, riskTitle: r.risk?.title ?? null, threat: r.threat, vulnerability: r.vulnerability, description: r.description })),
      controls: a.controls.map((c) => ({ id: c.id, organizationControlId: c.organizationControlId, code: c.organizationControl.control.code, title: c.organizationControl.control.title, status: c.status, evidence: c.evidence, note: c.note })),
      dependencies: a.dependencies.map((d) => ({ id: d.id, type: d.type, asset: d.dependentAsset })),
      dependents: a.dependents.map((d) => ({ id: d.id, type: d.type, asset: d.sourceAsset })),
    })),
    members: members.map((m) => m.user),
    processes,
    locations,
    evidenceOptions,
    orgControlOptions: orgControlOptions.map((c) => ({ id: c.id, code: c.control.code, title: c.control.title })),
    riskOptions,
  };
}

export async function getAssetHistory(assetId: string) {
  const authorization = await requireAuthorization("assets:read");
  const organizationId = authorization.ctx.organization.id;
  const asset = await prisma.informationAsset.findFirst({ where: { id: assetId, organizationId }, select: { id: true } });
  if (!asset) throw new Error("Activo no encontrado.");
  const logs = await prisma.auditLog.findMany({
    where: { organizationId, module: { in: ["asset", "asset_classification", "asset_risk", "asset_control", "asset_dependency"] }, recordId: assetId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true } } },
  });
  return logs.map((l) => ({ id: l.id, action: l.action, module: l.module, at: l.createdAt.toISOString(), by: l.user?.name ?? "Sistema" }));
}

export async function createAsset(input: unknown) {
  const data = parseInput(assetCreateSchema, input);
  const ctx = await requirePermission("assets:create");
  const organizationId = ctx.organization.id;
  await Promise.all([ensureMember(organizationId, data.ownerId), ensureMember(organizationId, data.custodianId)]);

  const result = await prisma.$transaction(async (tx) => {
    await assertRefs(tx, organizationId, data.processId, data.locationId);
    const dup = await tx.informationAsset.findFirst({ where: { organizationId, code: data.code } });
    if (dup) throw new Error(`Ya existe un activo con el código ${data.code}.`);
    const asset = await tx.informationAsset.create({ data: mapAssetData(organizationId, data) });
    await writeAuditLog(tx, { ctx, action: "create", module: "asset", recordId: asset.id, after: { code: asset.code, category: asset.category } });
    return asset;
  });
  revalidatePath(PATH);
  return { id: result.id, code: result.code };
}

export async function updateAsset(input: unknown) {
  const data = parseInput(assetUpdateSchema, input);
  const ctx = await requirePermission("assets:update");
  const organizationId = ctx.organization.id;
  await Promise.all([ensureMember(organizationId, data.ownerId), ensureMember(organizationId, data.custodianId)]);

  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.informationAsset.findFirst({ where: { id: data.id, organizationId } });
    if (!before) throw new Error("Activo no encontrado.");
    await assertRefs(tx, organizationId, data.processId, data.locationId);
    if (data.code !== before.code) {
      const dup = await tx.informationAsset.findFirst({ where: { organizationId, code: data.code, id: { not: data.id } } });
      if (dup) throw new Error(`Ya existe un activo con el código ${data.code}.`);
    }
    const updated = await tx.informationAsset.updateMany({ where: { id: data.id, organizationId }, data: mapAssetData(organizationId, data) });
    if (updated.count !== 1) throw new Error("El activo cambió mientras se editaba; vuelve a cargarlo.");
    await writeAuditLog(tx, { ctx, action: "update", module: "asset", recordId: data.id, before: { status: before.status, criticality: before.criticality }, after: { status: data.status, criticality: data.criticality } });
    return { id: data.id };
  });
  revalidatePath(PATH);
  return result;
}

export async function deleteAsset(id: string) {
  const ctx = await requirePermission("assets:delete");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const asset = await tx.informationAsset.findFirst({ where: { id, organizationId } });
    if (!asset) throw new Error("Activo no encontrado.");
    await tx.informationAsset.delete({ where: { id: asset.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: "asset", recordId: id, before: { code: asset.code } });
    return { id };
  });
  revalidatePath(PATH);
  return result;
}

export async function upsertAssetClassification(input: unknown) {
  const data = parseInput(classificationSchema, input);
  const ctx = await requirePermission("assets:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const asset = await tx.informationAsset.findFirst({ where: { id: data.assetId, organizationId } });
    if (!asset) throw new Error("Activo no encontrado.");
    const payload = { confidentiality: data.confidentiality, integrity: data.integrity, availability: data.availability, classification: data.classification, legalRequirements: data.legalRequirements ?? null, retention: data.retention ?? null };
    const saved = await tx.assetClassification.upsert({ where: { assetId: asset.id }, update: payload, create: { organizationId, assetId: asset.id, ...payload } });
    await writeAuditLog(tx, { ctx, action: "classify", module: "asset_classification", recordId: asset.id, after: { classification: data.classification, cia: `${data.confidentiality}/${data.integrity}/${data.availability}` } });
    return saved;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function addAssetDependency(input: unknown) {
  const data = parseInput(dependencySchema, input);
  const ctx = await requirePermission("assets:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const [source, dependent] = await Promise.all([
      tx.informationAsset.findFirst({ where: { id: data.sourceAssetId, organizationId } }),
      tx.informationAsset.findFirst({ where: { id: data.dependentAssetId, organizationId } }),
    ]);
    if (!source || !dependent) throw new Error("Uno de los activos no pertenece a la organización.");
    const link = await tx.assetDependency.create({ data: { organizationId, sourceAssetId: source.id, dependentAssetId: dependent.id, type: data.type, description: data.description ?? null } });
    await writeAuditLog(tx, { ctx, action: "link_dependency", module: "asset_dependency", recordId: source.id, after: { dependencyId: link.id, dependentAssetId: dependent.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function removeAssetDependency(id: string) {
  const ctx = await requirePermission("assets:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.assetDependency.findFirst({ where: { id, organizationId } });
    if (!link) throw new Error("Dependencia no encontrada.");
    await tx.assetDependency.delete({ where: { id: link.id } });
    await writeAuditLog(tx, { ctx, action: "unlink_dependency", module: "asset_dependency", recordId: link.sourceAssetId, before: { dependencyId: link.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function addAssetRisk(input: unknown) {
  const data = parseInput(assetRiskSchema, input);
  const ctx = await requirePermission("assets:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const asset = await tx.informationAsset.findFirst({ where: { id: data.assetId, organizationId } });
    if (!asset) throw new Error("Activo no encontrado.");
    if (data.riskId) {
      const risk = await tx.risk.findFirst({ where: { id: data.riskId, organizationId } });
      if (!risk) throw new Error("El riesgo no pertenece a la organización.");
    }
    const created = await tx.assetRisk.create({ data: { organizationId, assetId: asset.id, riskId: data.riskId ?? null, threat: data.threat ?? null, vulnerability: data.vulnerability ?? null, description: data.description ?? null } });
    await writeAuditLog(tx, { ctx, action: "link_risk", module: "asset_risk", recordId: asset.id, after: { assetRiskId: created.id, riskId: data.riskId ?? null } });
    return created;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function removeAssetRisk(id: string) {
  const ctx = await requirePermission("assets:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.assetRisk.findFirst({ where: { id, organizationId } });
    if (!link) throw new Error("Riesgo de activo no encontrado.");
    await tx.assetRisk.delete({ where: { id: link.id } });
    await writeAuditLog(tx, { ctx, action: "unlink_risk", module: "asset_risk", recordId: link.assetId, before: { assetRiskId: link.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function upsertAssetControl(input: unknown) {
  const data = parseInput(assetControlSchema, input);
  const ctx = await requirePermission("assets:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const [asset, control] = await Promise.all([
      tx.informationAsset.findFirst({ where: { id: data.assetId, organizationId } }),
      tx.organizationControl.findFirst({ where: { id: data.organizationControlId, organizationId } }),
    ]);
    if (!asset || !control) throw new Error("Activo o control no pertenecen a la organización.");
    if (data.evidenceId) {
      const ev = await tx.evidenceFile.findFirst({ where: { id: data.evidenceId, organizationId, deletedAt: null } });
      if (!ev) throw new Error("La evidencia no pertenece a la organización.");
    }
    const saved = await tx.assetControl.upsert({
      where: { assetId_organizationControlId: { assetId: asset.id, organizationControlId: control.id } },
      update: { status: data.status, evidenceId: data.evidenceId ?? null, note: data.note ?? null },
      create: { organizationId, assetId: asset.id, organizationControlId: control.id, status: data.status, evidenceId: data.evidenceId ?? null, note: data.note ?? null },
    });
    await writeAuditLog(tx, { ctx, action: "link_control", module: "asset_control", recordId: asset.id, after: { assetControlId: saved.id, organizationControlId: control.id, status: data.status } });
    return saved;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function removeAssetControl(id: string) {
  const ctx = await requirePermission("assets:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.assetControl.findFirst({ where: { id, organizationId } });
    if (!link) throw new Error("Control de activo no encontrado.");
    await tx.assetControl.delete({ where: { id: link.id } });
    await writeAuditLog(tx, { ctx, action: "unlink_control", module: "asset_control", recordId: link.assetId, before: { assetControlId: link.id } });
    return link;
  });
  revalidatePath(PATH);
  return { id: result.id };
}

export async function markAssetReviewed(input: unknown) {
  const data = parseInput(assetReviewSchema, input);
  const ctx = await requirePermission("assets:update");
  const organizationId = ctx.organization.id;
  const result = await prisma.$transaction(async (tx) => {
    const asset = await tx.informationAsset.findFirst({ where: { id: data.id, organizationId } });
    if (!asset) throw new Error("Activo no encontrado.");
    const next = data.nextReviewDate ? toParsedDate(data.nextReviewDate) : new Date(Date.now() + 365 * 86400000);
    await tx.informationAsset.update({ where: { id: asset.id }, data: { reviewDate: new Date(), nextReviewDate: next } });
    await writeAuditLog(tx, { ctx, action: "review", module: "asset", recordId: asset.id, after: { nextReviewDate: next?.toISOString().slice(0, 10) ?? null } });
    return { id: asset.id };
  });
  revalidatePath(PATH);
  return result;
}

export async function importAssetsCsv(input: unknown) {
  const data = parseInput(assetImportSchema, input);
  const ctx = await requirePermission("assets:create");
  const organizationId = ctx.organization.id;
  const parsed = parseAssetCsv(data.csv);
  if (!parsed.length) throw new Error("El CSV no contiene filas de datos.");

  const validCategories = new Set(Object.values(AssetCategory) as string[]);
  const validCriticality = new Set(Object.values(AssetCriticality) as string[]);
  const errors: string[] = [];
  const seen = new Set<string>();
  const toCreate = parsed.flatMap((row, index) => {
    const line = index + 2;
    if (!row.code || !row.name) { errors.push(`Fila ${line}: code y name son obligatorios.`); return []; }
    if (!validCategories.has(row.category)) { errors.push(`Fila ${line}: categoría inválida "${row.category}".`); return []; }
    if (row.criticality && !validCriticality.has(row.criticality)) { errors.push(`Fila ${line}: criticidad inválida "${row.criticality}".`); return []; }
    if (seen.has(row.code)) { errors.push(`Fila ${line}: código duplicado "${row.code}" en el archivo.`); return []; }
    seen.add(row.code);
    return [{ organizationId, code: row.code, name: row.name, description: row.description || null, category: row.category as AssetCategory, criticality: (row.criticality || "MEDIUM") as AssetCriticality }];
  });

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.informationAsset.createMany({ data: toCreate, skipDuplicates: true });
    await writeAuditLog(tx, { ctx, action: "import", module: "asset", after: { requested: parsed.length, created: created.count, errors: errors.length } });
    return created;
  });
  revalidatePath(PATH);
  return { created: result.count, total: parsed.length, errors };
}

export async function exportAssets(input: unknown) {
  const data = parseInput(assetExportSchema, input);
  const ctx = await requirePermission("assets:export");
  const now = new Date();
  const reportType = data.reportType ?? "assets";
  const titles: Record<string, string> = {
    "assets": "Inventario de activos de información",
    "asset-classification": "Clasificación de activos (CIA)",
    "asset-risks": "Riesgos asociados a activos",
    "asset-controls": "Controles asociados a activos",
  };
  const report = await queueReportForContext({
    ctx,
    reportType,
    title: titles[reportType] ?? "Inventario de activos",
    format: data.format,
    fileName: `${reportType}-${now.toISOString().slice(0, 10)}.${data.format === "PDF" ? "pdf" : "xlsx"}`,
    dateFrom: now,
    dateTo: now,
    filters: { from: now.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
  });
  revalidatePath("/app/reporting");
  return { id: report.id, status: report.status };
}

// ── helpers ──
type AssetInput = {
  code: string; name: string; description?: string | null; category: AssetCategory;
  ownerId?: string | null; custodianId?: string | null; processId?: string | null; locationId?: string | null;
  status?: AssetStatus; criticality?: AssetCriticality; reviewDate?: string | null; nextReviewDate?: string | null;
};
function mapAssetData(organizationId: string, data: AssetInput): Prisma.InformationAssetUncheckedCreateInput {
  return {
    organizationId,
    code: data.code,
    name: data.name,
    description: data.description ?? null,
    category: data.category,
    ownerId: data.ownerId ?? null,
    custodianId: data.custodianId ?? null,
    processId: data.processId ?? null,
    locationId: data.locationId ?? null,
    status: data.status ?? "ACTIVE",
    criticality: data.criticality ?? "MEDIUM",
    reviewDate: toParsedDate(data.reviewDate),
    nextReviewDate: toParsedDate(data.nextReviewDate),
  };
}
async function assertRefs(tx: Prisma.TransactionClient, organizationId: string, processId?: string | null, locationId?: string | null) {
  if (processId) {
    const p = await tx.process.findFirst({ where: { id: processId, organizationId } });
    if (!p) throw new Error("El proceso no pertenece a la organización.");
  }
  if (locationId) {
    const l = await tx.location.findFirst({ where: { id: locationId, organizationId } });
    if (!l) throw new Error("La ubicación no pertenece a la organización.");
  }
}
