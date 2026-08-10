/**
 * Lifecycle comercial de paquetes normativos.
 *
 * Separado de StandardEditionStatus (DRAFT|ACTIVE|SUPERSEDED|WITHDRAWN), que
 * describe el ciclo editorial del catálogo. Aqui se controla qué puede venderse
 * y activarse en una organización.
 *
 * Objetivo de producto: todos los packs listados terminan en LIVE.
 * DEVELOPMENT → PILOT → LIVE, en ese orden, sin saltos hacia atrás implícitos.
 *
 * No existe un estado "DISABLED": un pack nunca termina el lifecycle en un
 * estado deshabilitado. Retirar un pack del catálogo comercial es un acto
 * aparte — `StandardPack.archivedAt` — ortogonal a en qué punto del lifecycle
 * está (ver `isPackListed`).
 *
 * Activación real de una organización = lifecycle LIVE + `OrganizationPackEntitlement`
 * habilitado + plan que incluya el pack + permiso del usuario. Ver `entitlements.ts`.
 */
export const PACK_LIFECYCLE_STATUSES = ["DEVELOPMENT", "PILOT", "LIVE"] as const;
export type PackLifecycleStatus = (typeof PACK_LIFECYCLE_STATUSES)[number];

const LIFECYCLE_RANK: Record<PackLifecycleStatus, number> = {
  DEVELOPMENT: 0,
  PILOT: 1,
  LIVE: 2,
};

export type PackActivationContext = {
  /** Permite activar packs PILOT (piloto controlado, org con entitlement PILOT_PROGRAM). */
  allowPilotPacks?: boolean;
};

export function isPackLifecycleStatus(value: string): value is PackLifecycleStatus {
  return (PACK_LIFECYCLE_STATUSES as readonly string[]).includes(value);
}

/** ¿Es esta una transición de lifecycle hacia adelante o una regresión válida? */
export function isForwardLifecycleTransition(
  from: PackLifecycleStatus,
  to: PackLifecycleStatus,
): boolean {
  return LIFECYCLE_RANK[to] > LIFECYCLE_RANK[from];
}

/** Packs visibles en catálogo comercial: no archivados (independiente del lifecycle). */
export function isPackListed(pack: { archivedAt?: Date | string | null }): boolean {
  return !pack.archivedAt;
}

/**
 * ¿Puede una organización activar este pack, dado solo su lifecycle?
 * Esto es una precondición necesaria pero no suficiente: la activación real
 * también exige un `OrganizationPackEntitlement` habilitado y el plan
 * correspondiente — ver `assertPackEntitlement` en `entitlements.ts`.
 *
 * - LIVE: sí, sujeto a plan/entitlement.
 * - PILOT: solo con allowPilotPacks (organizaciones en piloto controlado).
 * - DEVELOPMENT: nunca activable por una organización — aún no vendible.
 */
export function assertPackActivatable(
  lifecycle: PackLifecycleStatus,
  ctx: PackActivationContext = {},
): void {
  if (lifecycle === "LIVE") return;
  if (lifecycle === "PILOT") {
    if (ctx.allowPilotPacks) return;
    throw new Error(
      "Este paquete está en PILOT. Actívalo solo en organizaciones de piloto (allowPilotPacks) o espera el estado LIVE.",
    );
  }
  throw new Error(
    "Este paquete normativo está en DEVELOPMENT y aún no puede activarse. No está disponible comercialmente hasta PILOT/LIVE.",
  );
}

/** Defaults de entorno para labs / staging. Enterprise puede abrir PILOT. */
export function packActivationFlagsFromEnv(
  extra?: PackActivationContext,
): PackActivationContext {
  return {
    allowPilotPacks:
      Boolean(extra?.allowPilotPacks)
      || process.env.NORMAFLOW_ALLOW_PILOT_PACKS === "true",
  };
}
