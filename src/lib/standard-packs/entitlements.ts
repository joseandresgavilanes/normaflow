import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LiveAppContext } from "@/lib/app-context";
import { canUseModule } from "@/lib/plan-entitlements";
import type { PackLifecycleStatus } from "./lifecycle";

/**
 * Real activation gate for a pack, per organization.
 *
 * Combines every axis the spec requires: plan (`requiredModules`), pack
 * lifecycle (LIVE always eligible; PILOT only with a PILOT_PROGRAM
 * entitlement or Enterprise plan; DEVELOPMENT never), a live
 * `OrganizationPackEntitlement` row, and — the caller's responsibility via
 * `requirePermission("standards:activate")` before calling this — the
 * user's own permission. Never grants access from `ALL_MODULES` or an env
 * flag alone: every organization needs its own entitlement row.
 */
export class PackEntitlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackEntitlementError";
  }
}

type Db = PrismaClient | Prisma.TransactionClient;

export const COMMERCIAL_PACK_CODES = [
  "PACK_ISO_9001", "PACK_ISO_27001", "PACK_ISO_14001", "PACK_ISO_45001",
  "PACK_SIG_9001_14001_45001", "PACK_ISO_22301", "PACK_ISO_42001",
  "PACK_ISO_37301", "PACK_ISO_37001", "PACK_ISO_50001", "PACK_ISO_22000",
  "PACK_ISO_20000", "PACK_ISO_13485",
] as const;

const STARTER_PACK_CODES = new Set<string>(["PACK_ISO_9001", "PACK_ISO_27001"]);

export function commercialPackCodesForPlan(plan: string, trialEndsAt?: Date | null, now = new Date()): string[] {
  const trialActive = Boolean(trialEndsAt && trialEndsAt > now);
  if (trialActive || plan === "GROWTH" || plan === "ENTERPRISE") return [...COMMERCIAL_PACK_CODES];
  return COMMERCIAL_PACK_CODES.filter((code) => STARTER_PACK_CODES.has(code));
}

/**
 * Materializa el catálogo comercial en filas explícitas por tenant. Solo
 * concede packs LIVE y nunca interpreta ALL_MODULES como un entitlement.
 * Grants manuales/piloto se preservan; al bajar de plan se deshabilitan
 * únicamente filas administradas por PLAN/TRIAL que ya no correspondan.
 */
export async function syncCommercialPackEntitlements(input: {
  organizationId: string;
  plan: string;
  trialEndsAt?: Date | null;
  grantedById?: string | null;
}, db: Db = prisma) {
  const eligibleCodes = commercialPackCodesForPlan(input.plan, input.trialEndsAt);
  const packs = await db.standardPack.findMany({
    where: { code: { in: eligibleCodes }, lifecycleStatus: "LIVE", archivedAt: null },
    select: { id: true, code: true },
  });
  const source = input.trialEndsAt && input.trialEndsAt > new Date() ? "TRIAL" as const : "PLAN" as const;
  const existing = await db.organizationPackEntitlement.findMany({
    where: { organizationId: input.organizationId },
    select: { id: true, packId: true, source: true },
  });
  const existingByPackId = new Map(existing.map((row) => [row.packId, row]));
  const enabledCodes: string[] = [];

  for (const pack of packs) {
    const current = existingByPackId.get(pack.id);
    if (current && current.source !== "PLAN" && current.source !== "TRIAL") continue;
    await db.organizationPackEntitlement.upsert({
      where: { organizationId_packId: { organizationId: input.organizationId, packId: pack.id } },
      update: {
        enabled: true, source, plan: input.plan,
        expiresAt: source === "TRIAL" ? input.trialEndsAt ?? null : null,
        grantedById: input.grantedById ?? null,
        notes: "Entitlement comercial sincronizado desde el plan.",
      },
      create: {
        organizationId: input.organizationId, packId: pack.id, enabled: true,
        source, plan: input.plan,
        expiresAt: source === "TRIAL" ? input.trialEndsAt ?? null : null,
        grantedById: input.grantedById ?? null,
        notes: "Entitlement comercial sincronizado desde el plan.",
      },
    });
    enabledCodes.push(pack.code);
  }

  const eligiblePackIds = new Set(packs.map((pack) => pack.id));
  const managedToDisable = existing
    .filter((row) => (row.source === "PLAN" || row.source === "TRIAL") && !eligiblePackIds.has(row.packId))
    .map((row) => row.id);
  if (managedToDisable.length) {
    await db.organizationPackEntitlement.updateMany({
      where: { id: { in: managedToDisable } },
      data: { enabled: false },
    });
  }

  return {
    enabledCodes,
    skippedNotLive: eligibleCodes.filter((code) => !packs.some((pack) => pack.code === code)),
    disabledCount: managedToDisable.length,
  };
}

export type PackEntitlementResult = {
  pack: { id: string; code: string; lifecycleStatus: PackLifecycleStatus; requiredModules: string[] };
  entitlement: { id: string; source: string };
};

export async function assertPackEntitlement(
  ctx: LiveAppContext,
  packCode: string,
  db: Db = prisma,
): Promise<PackEntitlementResult> {
  const pack = await db.standardPack.findUnique({
    where: { code: packCode },
    select: { id: true, code: true, lifecycleStatus: true, requiredModules: true, archivedAt: true },
  });
  if (!pack || pack.archivedAt) {
    throw new PackEntitlementError(`El paquete ${packCode} no está disponible en el catálogo.`);
  }

  const missingModules = pack.requiredModules.filter((m) => !canUseModule(ctx.organization, m));
  if (missingModules.length) {
    throw new PackEntitlementError(
      `Tu plan no incluye los módulos requeridos: ${missingModules.join(", ")}. Actualiza tu plan para continuar.`,
    );
  }

  const entitlement = await db.organizationPackEntitlement.findUnique({
    where: { organizationId_packId: { organizationId: ctx.organization.id, packId: pack.id } },
  });
  if (!entitlement || !entitlement.enabled) {
    throw new PackEntitlementError(
      `Tu organización no tiene acceso concedido a ${packCode}. Contacta a soporte NormaFlow.`,
    );
  }
  const now = new Date();
  if (entitlement.startsAt > now) {
    throw new PackEntitlementError(`El acceso a ${packCode} todavía no ha comenzado.`);
  }
  if (entitlement.expiresAt && entitlement.expiresAt < now) {
    throw new PackEntitlementError(`El acceso a ${packCode} expiró el ${entitlement.expiresAt.toISOString().slice(0, 10)}.`);
  }

  if (pack.lifecycleStatus === "DEVELOPMENT") {
    throw new PackEntitlementError(`${packCode} está en DEVELOPMENT y aún no puede activarse comercialmente.`);
  }
  if (pack.lifecycleStatus === "PILOT") {
    const pilotAllowed = entitlement.source === "PILOT_PROGRAM" || ctx.organization.plan === "ENTERPRISE";
    if (!pilotAllowed) {
      throw new PackEntitlementError(
        `${packCode} está en PILOT. Requiere un entitlement de piloto (source PILOT_PROGRAM) o plan Enterprise.`,
      );
    }
  }

  return {
    pack: { id: pack.id, code: pack.code, lifecycleStatus: pack.lifecycleStatus, requiredModules: pack.requiredModules },
    entitlement: { id: entitlement.id, source: entitlement.source },
  };
}

export type GrantEntitlementInput = {
  organizationId: string;
  packCode: string;
  source?: "PLAN" | "MANUAL_GRANT" | "TRIAL" | "PILOT_PROGRAM";
  expiresAt?: Date | null;
  plan?: string | null;
  contractReference?: string | null;
  scope?: Record<string, unknown> | null;
  notes?: string | null;
  grantedById: string;
};

/** Platform-controlled grant — server actions call this after their own permission check. */
export async function upsertPackEntitlement(input: GrantEntitlementInput, db: Db = prisma) {
  const pack = await db.standardPack.findUnique({ where: { code: input.packCode }, select: { id: true } });
  if (!pack) throw new PackEntitlementError(`El paquete ${input.packCode} no existe en el catálogo.`);

  return db.organizationPackEntitlement.upsert({
    where: { organizationId_packId: { organizationId: input.organizationId, packId: pack.id } },
    update: {
      enabled: true,
      source: input.source ?? "MANUAL_GRANT",
      expiresAt: input.expiresAt ?? null,
      plan: input.plan ?? null,
      contractReference: input.contractReference ?? null,
      scope: (input.scope as Prisma.InputJsonValue) ?? undefined,
      notes: input.notes ?? null,
      grantedById: input.grantedById,
    },
    create: {
      organizationId: input.organizationId,
      packId: pack.id,
      source: input.source ?? "MANUAL_GRANT",
      expiresAt: input.expiresAt ?? null,
      plan: input.plan ?? null,
      contractReference: input.contractReference ?? null,
      scope: (input.scope as Prisma.InputJsonValue) ?? undefined,
      notes: input.notes ?? null,
      grantedById: input.grantedById,
    },
  });
}

export async function revokePackEntitlement(
  organizationId: string,
  packCode: string,
  db: Db = prisma,
) {
  const pack = await db.standardPack.findUnique({ where: { code: packCode }, select: { id: true } });
  if (!pack) throw new PackEntitlementError(`El paquete ${packCode} no existe en el catálogo.`);
  return db.organizationPackEntitlement.update({
    where: { organizationId_packId: { organizationId, packId: pack.id } },
    data: { enabled: false },
  });
}
