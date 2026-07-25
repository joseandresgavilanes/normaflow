"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getPack, installAllPacks, installPack, STANDARD_PACKS } from "@/lib/standard-packs";

/**
 * Instala (o actualiza) un paquete normativo integrado en el catálogo global.
 * Operación de plataforma: requiere `packs:install` (solo OWNER / SUPER_ADMIN).
 * Idempotente; nunca borra historial de organizaciones.
 */
export async function installStandardPack(packCode: string) {
  const ctx = await requirePermission("packs:install");
  const code = z.string().min(1).parse(packCode);

  const pack = getPack(code);
  if (!pack) throw new Error(`Paquete ${code} no encontrado.`);

  const result = await installPack(pack);
  await logAuditEvent({
    ctx, action: "create", module: "packs", recordId: code,
    after: result as unknown as Record<string, unknown>,
    extra: { event: "install_pack" },
  });

  revalidatePath("/app/standards");
  return result;
}

/** Instala todos los paquetes integrados. */
export async function installAllStandardPacks() {
  const ctx = await requirePermission("packs:install");
  const results = await installAllPacks();
  await logAuditEvent({
    ctx, action: "create", module: "packs", recordId: "ALL",
    after: { packs: results.map((r) => r.packCode) },
    extra: { event: "install_all_packs" },
  });
  revalidatePath("/app/standards");
  return results;
}

/** Lista los paquetes integrados disponibles (metadatos, sin datos de organización). */
export async function listAvailablePacks() {
  await requirePermission("standards:read");
  return STANDARD_PACKS.map((p) => ({
    code: p.code, name: p.name, version: p.version, description: p.description ?? null,
    requiredModules: p.requiredModules ?? [],
    editions: p.editions.map((e) => ({ familyCode: e.familyCode, editionCode: e.editionCode, name: e.name })),
  }));
}
