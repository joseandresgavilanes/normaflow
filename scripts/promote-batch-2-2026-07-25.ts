/**
 * Second promotion batch: the 4 packs held back from
 * promote-approved-packs-2026-07-25.ts because their own schema migrations
 * were not yet applied to production:
 *
 *   - PACK_ISO_22000 needs 20260725050000_food_safety_chain_communication
 *   - PACK_ISO_20000 needs 20260725060000_itsm_incident_cross_link
 *   - PACK_ISO_13485 needs 20260725070000_medical_devices_retention_privacy
 *   - PACK_ISO_37001 needs 20260725080000_antibribery_sensitive_privacy
 *
 * All four migrations ship together in the same pending batch, so once
 * `prisma migrate deploy` has been run against this database, all four packs
 * are safe to promote in a single pass. Do NOT run this before confirming
 * `prisma migrate status` shows those four migrations as applied — promoting
 * beforehand would range from a broken feature (22000's chain communication
 * tab, 20000's cross-link) to active crashes (13485's retention/purge code
 * referencing columns that don't exist yet).
 *
 * All four have acceptance_approved: true (commercial sign-off from the
 * product owner, 2026-07-25 — 22000/20000/13485 as part of the 12-pack batch,
 * 37001 in its own later closing round) and reach 32/32 readiness.
 */
import { prisma } from "@/lib/prisma";
import { installAllPacks } from "@/lib/standard-packs";
import { iso22000Pack } from "@/lib/standard-packs/iso-22000-2018.pack";
import { iso20000Pack } from "@/lib/standard-packs/iso-20000-2018.pack";
import { iso13485Pack } from "@/lib/standard-packs/iso-13485-2016.pack";
import { iso37001Pack } from "@/lib/standard-packs/iso-37001-2016.pack";
import { promotePackLifecycle, PackPromotionError } from "@/lib/standard-packs/promotion";
import type { StandardPackInput } from "@/lib/standard-packs/pack-schema";

const PACKS: StandardPackInput[] = [iso22000Pack, iso20000Pack, iso13485Pack, iso37001Pack];
const REQUIRED_MIGRATIONS = [
  "20260725050000_food_safety_chain_communication",
  "20260725060000_itsm_incident_cross_link",
  "20260725070000_medical_devices_retention_privacy",
  "20260725080000_antibribery_sensitive_privacy",
];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  console.log("Target DB:", url.replace(/:[^:@]*@/, ":****@"));

  const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE migration_name = ANY(${REQUIRED_MIGRATIONS}) AND finished_at IS NOT NULL
  `;
  const appliedNames = new Set(applied.map((r) => r.migration_name));
  const missing = REQUIRED_MIGRATIONS.filter((m) => !appliedNames.has(m));
  if (missing.length > 0) {
    console.error("ABORTING — required migrations not yet applied here:", missing);
    process.exit(1);
  }

  await installAllPacks();
  const actor = await prisma.user.findFirst({ select: { id: true, email: true } });
  if (!actor) throw new Error("No user found to act as promotion actor");
  console.log("Acting as:", actor.email);

  for (const pack of PACKS) {
    const before = await prisma.standardPack.findUnique({ where: { code: pack.code }, select: { lifecycleStatus: true } });
    try {
      const result = await promotePackLifecycle(
        pack,
        { toStatus: "LIVE", actorId: actor.id, reason: "Firma comercial humana aprobada por el propietario del producto — 2026-07-25 (segundo lote, tras aplicar migraciones pendientes)." },
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

  console.log("\nFinal lifecycle status:");
  const rows = await prisma.standardPack.findMany({
    where: { code: { in: PACKS.map((p) => p.code) } },
    select: { code: true, lifecycleStatus: true },
    orderBy: { code: "asc" },
  });
  for (const r of rows) console.log(`  ${r.code}: ${r.lifecycleStatus}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
