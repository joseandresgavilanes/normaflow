/**
 * One-off promotion run for the 9 packs whose own schema migrations are
 * ALREADY deployed to production and whose acceptance_approved was just
 * granted by the product owner (2026-07-25).
 *
 * Deliberately EXCLUDES ISO 22000 / ISO 20000 / ISO 13485: their migrations
 * (20260725050000_food_safety_chain_communication, 20260725060000_itsm_incident_cross_link,
 * 20260725070000_medical_devices_retention_privacy) are not yet applied to
 * this database. Promoting them now would range from a broken feature
 * (22000's chain communication tab, 20000's cross-link) to active crashes
 * (13485's retention/purge code referencing columns/tables that don't exist
 * yet). Run this file again for those three once `prisma migrate deploy` has
 * been applied here.
 */
import { prisma } from "@/lib/prisma";
import { installAllPacks } from "@/lib/standard-packs";
import { iso9001Pack } from "@/lib/standard-packs/iso-9001-2015.pack";
import { iso27001Pack } from "@/lib/standard-packs/iso-27001-2022.pack";
import { iso14001Pack } from "@/lib/standard-packs/iso-14001-2015.pack";
import { iso45001Pack } from "@/lib/standard-packs/iso-45001-2018.pack";
import { iso42001Pack } from "@/lib/standard-packs/iso-42001-2023.pack";
import { iso37301Pack } from "@/lib/standard-packs/iso-37301-2021.pack";
import { iso50001Pack } from "@/lib/standard-packs/iso-50001-2018.pack";
import { iso22301Pack } from "@/lib/standard-packs/iso-22301-2019.pack";
import { sigPack } from "@/lib/standard-packs/sig-9001-14001-45001.pack";
import { promotePackLifecycle, PackPromotionError } from "@/lib/standard-packs/promotion";
import type { StandardPackInput } from "@/lib/standard-packs/pack-schema";

const PACKS: StandardPackInput[] = [
  iso9001Pack, iso27001Pack, iso14001Pack, iso45001Pack, iso42001Pack,
  iso37301Pack, iso50001Pack, iso22301Pack, sigPack,
];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  console.log("Target DB:", url.replace(/:[^:@]*@/, ":****@"));

  await installAllPacks();
  const actor = await prisma.user.findFirst({ select: { id: true, email: true } });
  if (!actor) throw new Error("No user found to act as promotion actor");
  console.log("Acting as:", actor.email);

  for (const pack of PACKS) {
    const before = await prisma.standardPack.findUnique({ where: { code: pack.code }, select: { lifecycleStatus: true } });
    try {
      // No onTransition callback: StandardPackLifecycleEvent (created
      // internally by promotePackLifecycle, with actorId/reason/assessmentId)
      // IS the audit trail for this platform-level, non-tenant-scoped action —
      // AuditLog requires a real organizationId FK, which doesn't apply here.
      const result = await promotePackLifecycle(
        pack,
        { toStatus: "LIVE", actorId: actor.id, reason: "Firma comercial humana aprobada por el propietario del producto — 2026-07-25." },
      );
      console.log(`✓ ${pack.code}: ${before?.lifecycleStatus ?? "?"} → LIVE (assessment ${result.assessmentId ?? "n/a — lateral move"})`);
    } catch (error) {
      if (error instanceof PackPromotionError) {
        console.log(`✗ ${pack.code} BLOCKED: ${error.message}`);
      } else {
        console.error(`✗ ${pack.code} ERROR:`, error);
      }
    }
  }

  // ISO 9001 / ISO 27001 are already LIVE, so promotePackLifecycle treats
  // LIVE→LIVE as a lateral move and never builds a PackReadinessAssessment —
  // create one directly for audit-trail parity with the other 10 packs.
  for (const pack of [iso9001Pack, iso27001Pack]) {
    const { evaluatePackReadiness } = await import("@/lib/standard-packs/readiness");
    const pk = await prisma.standardPack.findUnique({ where: { code: pack.code }, select: { id: true } });
    if (!pk) continue;
    const existing = await prisma.packReadinessAssessment.findFirst({ where: { packId: pk.id }, orderBy: { createdAt: "desc" } });
    if (existing && existing.ready) { console.log(`(skip) ${pack.code} already has a ready assessment ${existing.id}`); continue; }
    const report = evaluatePackReadiness({ ...pack, lifecycleStatus: "LIVE" });
    const assessment = await prisma.packReadinessAssessment.create({
      data: {
        packId: pk.id, requestedStatus: "LIVE", met: report.met, total: report.total, percent: report.percent,
        ready: report.checklistComplete, actorId: actor.id,
        notes: "Documentación retroactiva: pack ya estaba LIVE desde antes del criterio acceptance_approved; firma comercial aprobada 2026-07-25.",
        checks: { create: report.criteria.map((c) => ({ criterion: c.criterion, met: c.met, note: c.note })) },
      },
      select: { id: true },
    });
    console.log(`✓ ${pack.code}: retroactive assessment ${assessment.id} (${report.met}/${report.total})`);
  }

  console.log("\nFinal lifecycle status:");
  const rows = await prisma.standardPack.findMany({
    where: { code: { in: [...PACKS.map((p) => p.code), "PACK_ISO_9001", "PACK_ISO_27001"] } },
    select: { code: true, lifecycleStatus: true },
    orderBy: { code: "asc" },
  });
  for (const r of rows) console.log(`  ${r.code}: ${r.lifecycleStatus}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
