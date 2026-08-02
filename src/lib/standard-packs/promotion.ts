import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { StandardPackInput } from "./pack-schema";
import { evaluatePackReadiness } from "./readiness";
import type { PackLifecycleStatus } from "./lifecycle";

export class PackPromotionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackPromotionError";
  }
}

export type PromotePackLifecycleInput = {
  toStatus: PackLifecycleStatus;
  actorId: string;
  reason?: string;
};

export type PromotePackLifecycleResult = {
  packId: string;
  fromStatus: PackLifecycleStatus;
  toStatus: PackLifecycleStatus;
  eventId: string;
  assessmentId: string | null;
};

/**
 * The one path that changes `StandardPack.lifecycleStatus`. Every transition
 * request to LIVE persists a fresh `PackReadinessAssessment` (+ its 32 `PackReadinessCheck`
 * rows) first — kept on disk even when it blocks the promotion, so a rejected
 * attempt is still auditable evidence and a LIVE pack can be independently
 * re-assessed without losing release history. The actual status flip + its
 * `StandardPackLifecycleEvent` land in one transaction: never a status change
 * without a matching history row.
 */
export async function promotePackLifecycle(
  manifest: StandardPackInput,
  input: PromotePackLifecycleInput,
  /** Runs inside the same transaction as the event + status change (e.g. the caller's audit log write). */
  onTransition?: (
    tx: Prisma.TransactionClient,
    meta: { fromStatus: PackLifecycleStatus; assessmentId: string | null },
  ) => Promise<void>,
): Promise<PromotePackLifecycleResult> {
  const pack = await prisma.standardPack.findUnique({
    where: { code: manifest.code },
    select: { id: true, lifecycleStatus: true },
  });
  if (!pack) throw new PackPromotionError(`Paquete ${manifest.code} no está instalado; instálalo antes de promoverlo.`);

  let assessmentId: string | null = null;
  const assessingLive = input.toStatus === "LIVE";
  if (assessingLive) {
    const report = evaluatePackReadiness({ ...manifest, lifecycleStatus: input.toStatus });
    const assessment = await prisma.packReadinessAssessment.create({
      data: {
        packId: pack.id,
        requestedStatus: input.toStatus,
        met: report.met,
        total: report.total,
        percent: report.percent,
        ready: report.checklistComplete,
        actorId: input.actorId,
        notes: input.reason ?? null,
        checks: { create: report.criteria.map((c) => ({ criterion: c.criterion, met: c.met, note: c.note })) },
      },
      select: { id: true },
    });
    assessmentId = assessment.id;
    if (!report.checklistComplete) {
      const missing = report.criteria.filter((c) => !c.met).map((c) => c.criterion);
      throw new PackPromotionError(
        `No promover ${manifest.code} a LIVE: faltan ${missing.length} criterios (${missing.slice(0, 8).join(", ")}…). ` +
        `Assessment ${assessment.id} queda registrado como intento bloqueado.`,
      );
    }
  }

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.standardPackLifecycleEvent.create({
      data: {
        packId: pack.id,
        fromStatus: pack.lifecycleStatus,
        toStatus: input.toStatus,
        reason: input.reason ?? null,
        actorId: input.actorId,
        assessmentId,
      },
      select: { id: true },
    });
    await tx.standardPack.update({ where: { id: pack.id }, data: { lifecycleStatus: input.toStatus } });
    if (onTransition) await onTransition(tx, { fromStatus: pack.lifecycleStatus, assessmentId });
    return created;
  });

  return { packId: pack.id, fromStatus: pack.lifecycleStatus, toStatus: input.toStatus, eventId: event.id, assessmentId };
}
