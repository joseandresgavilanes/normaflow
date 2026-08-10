"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";
import { codeSchema, idSchema } from "@/lib/validation/common";
import {
  evaluatePackReadiness,
  getPack,
  installAllPacks,
  installPack,
  promotePackLifecycle,
  revokePackEntitlement,
  upsertPackEntitlement,
  STANDARD_PACKS,
  type PackLifecycleStatus,
} from "@/lib/standard-packs";

/**
 * Instala (o actualiza) un paquete normativo integrado en el catálogo global.
 * Operación de plataforma: requiere `packs:install` (solo OWNER / SUPER_ADMIN).
 * Idempotente; nunca borra historial de organizaciones.
 */
export async function installStandardPack(packCode: string) {
  const ctx = await requirePermission("packs:install");
  const code = codeSchema.parse(packCode);

  const pack = getPack(code);
  if (!pack) throw new Error(`Paquete ${code} no encontrado.`);

  const result = await prisma.$transaction(async (tx) => {
    // Acción explícita de administración: aquí se reinstala de verdad, aunque
    // la versión coincida. El cortocircuito de `installPack` es para el camino
    // perezoso, no para quien pulsa «instalar».
    const installed = await installPack(pack, tx, { force: true });
    await writeAuditLog(tx, {
      ctx, action: "create", module: "packs", recordId: code,
      after: installed as unknown as Record<string, unknown>,
      extra: { event: "install_pack" },
    });
    return installed;
  });

  revalidatePath("/app/standards");
  return result;
}

/** Instala todos los paquetes integrados. */
export async function installAllStandardPacks() {
  const ctx = await requirePermission("packs:install");
  const results = await installAllPacks();
  await prisma.$transaction((tx) => writeAuditLog(tx, {
    ctx, action: "create", module: "packs", recordId: "ALL",
    after: { packs: results.map((r) => r.packCode) },
    extra: { event: "install_all_packs" },
  }));
  revalidatePath("/app/standards");
  return results;
}

/** Lista los paquetes integrados disponibles (metadatos, sin datos de organización). */
export async function listAvailablePacks() {
  await requirePermission("standards:read");
  const dbPacks = await prisma.standardPack.findMany({
    select: { code: true, archivedAt: true, lifecycleStatus: true },
  });
  const installedByCode = new Map(dbPacks.map((pack) => [pack.code, pack]));
  const archived = new Set(dbPacks.filter((p) => p.archivedAt).map((p) => p.code));
  return STANDARD_PACKS
    .filter((p) => !archived.has(p.code))
    .map((p) => ({
      code: p.code,
      name: p.name,
      version: p.version,
      description: p.description ?? null,
      lifecycleStatus: installedByCode.get(p.code)?.lifecycleStatus ?? p.lifecycleStatus ?? "DEVELOPMENT",
      requiredModules: p.requiredModules ?? [],
      editions: p.editions.map((e) => ({ familyCode: e.familyCode, editionCode: e.editionCode, name: e.name })),
    }));
}

/**
 * Corre el checklist de 32 criterios sin persistir nada — vista rápida de
 * readiness. La promoción real (`promoteStandardPack`) sí persiste el intento.
 */
export async function getPackReadinessReport(packCode: string) {
  await requirePermission("packs:install");
  const code = codeSchema.parse(packCode);
  const pack = getPack(code);
  if (!pack) throw new Error(`Paquete ${code} no encontrado.`);
  return evaluatePackReadiness(pack);
}

const promoteSchema = z.object({
  packCode: codeSchema,
  toStatus: z.enum(["DEVELOPMENT", "PILOT", "LIVE"]),
  reason: z.string().max(2000).optional(),
});

/**
 * Único camino para cambiar `StandardPack.lifecycleStatus`. Persiste el
 * checklist de readiness (incluso si bloquea la promoción a LIVE) y el
 * evento de lifecycle en una transacción con el cambio de estado.
 * Operación de plataforma: requiere `packs:install`.
 */
export async function promoteStandardPack(input: z.infer<typeof promoteSchema>) {
  const ctx = await requirePermission("packs:install");
  const data = promoteSchema.parse(input);
  const pack = getPack(data.packCode);
  if (!pack) throw new Error(`Paquete ${data.packCode} no encontrado.`);

  const result = await promotePackLifecycle(
    pack,
    { toStatus: data.toStatus as PackLifecycleStatus, actorId: ctx.user.id, reason: data.reason },
    (tx, meta) => writeAuditLog(tx, {
      ctx, action: "status_change", module: "packs", recordId: pack.code,
      before: { lifecycleStatus: meta.fromStatus }, after: { lifecycleStatus: data.toStatus },
      extra: { event: "promote_pack_lifecycle", assessmentId: meta.assessmentId },
    }),
  );

  revalidatePath("/app/standards");
  return result;
}

const grantEntitlementSchema = z.object({
  organizationId: idSchema,
  packCode: codeSchema,
  source: z.enum(["PLAN", "MANUAL_GRANT", "TRIAL", "PILOT_PROGRAM"]).default("MANUAL_GRANT"),
  expiresAt: z.string().optional(),
  plan: z.string().max(60).optional(),
  contractReference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * Concede acceso a un pack a una organización. Nunca ALL_MODULES: siempre
 * una fila `OrganizationPackEntitlement` explícita por organización+pack.
 * Operación de plataforma: requiere `packs:install`.
 */
export async function grantPackEntitlement(input: z.infer<typeof grantEntitlementSchema>) {
  const ctx = await requirePermission("packs:install");
  const data = grantEntitlementSchema.parse(input);

  const result = await prisma.$transaction(async (tx) => {
    const entitlement = await upsertPackEntitlement({
      organizationId: data.organizationId,
      packCode: data.packCode,
      source: data.source,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      plan: data.plan ?? null,
      contractReference: data.contractReference ?? null,
      notes: data.notes ?? null,
      grantedById: ctx.user.id,
    }, tx);
    await writeAuditLog(tx, {
      ctx, action: "create", module: "packs", recordId: entitlement.id,
      after: { organizationId: data.organizationId, packCode: data.packCode, source: data.source },
      extra: { event: "grant_pack_entitlement" },
    });
    return entitlement;
  });

  revalidatePath("/app/admin");
  return result;
}

const revokeEntitlementSchema = z.object({
  organizationId: idSchema,
  packCode: codeSchema,
});

/** Revoca (deshabilita) el acceso de una organización a un pack. */
export async function revokePackEntitlementAction(input: z.infer<typeof revokeEntitlementSchema>) {
  const ctx = await requirePermission("packs:install");
  const data = revokeEntitlementSchema.parse(input);

  const result = await prisma.$transaction(async (tx) => {
    const entitlement = await revokePackEntitlement(data.organizationId, data.packCode, tx);
    await writeAuditLog(tx, {
      ctx, action: "update", module: "packs", recordId: entitlement.id,
      after: { organizationId: data.organizationId, packCode: data.packCode, enabled: false },
      extra: { event: "revoke_pack_entitlement" },
    });
    return entitlement;
  });

  revalidatePath("/app/admin");
  return result;
}
