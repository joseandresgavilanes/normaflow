/**
 * Foundation tests: pack lifecycle, readiness checklist, ACTIVE edition freeze rules (pure),
 * plus (when DATABASE_URL points at a disposable Postgres) the DB-backed entitlement
 * gate and lifecycle promotion — the real StandardPack.lifecycleStatus flip.
 *
 *   npx tsx scripts/test-pack-lifecycle.ts
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-pack-lifecycle.ts
 */
import assert from "node:assert/strict";
import {
  assertCanPromoteToLive,
  assertPackActivatable,
  assertPackEntitlement,
  evaluatePackReadiness,
  installAllPacks,
  isPackListed,
  parsePackManifest,
  PackEntitlementError,
  PackPromotionError,
  promotePackLifecycle,
  STANDARD_PACKS,
  commercialPackCodesForPlan,
  syncCommercialPackEntitlements,
} from "../src/lib/standard-packs";
import { iso9001Pack } from "../src/lib/standard-packs/iso-9001-2015.pack";
import { iso22301Pack } from "../src/lib/standard-packs/iso-22301-2019.pack";
import { iso37001Pack } from "../src/lib/standard-packs/iso-37001-2016.pack";
import { assertDisposableDatabase, createTestClient, createTenantPair, grantTestEntitlement } from "./lib/pack-test-factory";
import { assertAuditIndependence } from "../src/lib/audit-workflow";

const incomplete37001Pack = { ...iso37001Pack, editions: [] };

let passed = 0;
async function t(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function main() {
  console.log("Pack lifecycle & readiness foundation test\n");

  await t("all built-in packs declare a lifecycleStatus", () => {
    for (const pack of STANDARD_PACKS) {
      const m = parsePackManifest(pack);
      assert.ok(["DEVELOPMENT", "PILOT", "LIVE"].includes(m.lifecycleStatus), pack.code);
    }
  });

  await t("9001 is LIVE and 37001 is DEVELOPMENT; 22301 is PILOT and registered", () => {
    assert.equal(parsePackManifest(iso9001Pack).lifecycleStatus, "LIVE");
    assert.equal(parsePackManifest(iso37001Pack).lifecycleStatus, "DEVELOPMENT");
    assert.equal(parsePackManifest(iso22301Pack).lifecycleStatus, "PILOT");
    assert.ok(STANDARD_PACKS.some((p) => p.code === "PACK_ISO_22301"));
  });

  await t("activation gating: DEVELOPMENT/PILOT/LIVE", () => {
    assert.throws(() => assertPackActivatable("DEVELOPMENT"), /DEVELOPMENT/);
    assert.throws(() => assertPackActivatable("PILOT"), /PILOT/);
    assertPackActivatable("PILOT", { allowPilotPacks: true });
    assertPackActivatable("LIVE");
    assert.equal(isPackListed({ archivedAt: new Date() }), false);
    assert.equal(isPackListed({ archivedAt: null }), true);
  });

  await t("commercial plan catalog maps Starter to two core packs and Growth/trial to all packs", () => {
    assert.deepEqual(commercialPackCodesForPlan("STARTER"), ["PACK_ISO_9001", "PACK_ISO_27001"]);
    assert.equal(commercialPackCodesForPlan("GROWTH").length, STANDARD_PACKS.length);
    assert.equal(commercialPackCodesForPlan("STARTER", new Date(Date.now() + 60_000)).length, STANDARD_PACKS.length);
  });

  await t("internal audit independence rejects self-audit and auditor/auditee overlap", () => {
    assert.throws(
      () => assertAuditIndependence({ auditorId: "u1", processOwnerId: "u1" }),
      /no puede auditar un proceso/,
    );
    assert.throws(
      () => assertAuditIndependence({ auditorId: "u1", processOwnerId: "u2", auditeeIds: ["u1"] }),
      /figurar también como auditado/,
    );
    assert.doesNotThrow(() => assertAuditIndependence({ auditorId: "u1", processOwnerId: "u2", auditeeIds: ["u3"] }));
  });

  await t("readiness checklist never auto-promotes an incomplete manifest", () => {
    const report = evaluatePackReadiness(incomplete37001Pack);
    assert.ok(report.percent < 100);
    assert.equal(report.checklistComplete, false);
    assert.throws(() => assertCanPromoteToLive(incomplete37001Pack), /No promover/);
  });

  await t("commercial acceptance is approved and all built-in packs reach 100%", () => {
    const approved = evaluatePackReadiness(iso9001Pack);
    const approvedFlag = approved.criteria.find((c) => c.criterion === "acceptance_approved");
    assert.ok(approvedFlag && approvedFlag.met === true);
    assert.equal(approved.checklistComplete, true);

    for (const pack of STANDARD_PACKS) {
      const report = evaluatePackReadiness(pack);
      assert.equal(report.met, report.total, `${pack.code} must satisfy every readiness criterion`);
      assert.equal(report.checklistComplete, true, `${pack.code} must be ready for LIVE`);
    }
  });

  await t("22301 pack has GAP, checklist, evidence, templates", () => {
    const m = parsePackManifest(iso22301Pack);
    const ed = m.editions[0];
    assert.ok((ed.gapQuestions?.length ?? 0) >= 4);
    assert.ok((ed.auditChecklist?.length ?? 0) >= 3);
    assert.ok((ed.evidenceRules?.length ?? 0) >= 4);
    assert.ok((ed.templates?.length ?? 0) >= 3);
    assert.ok(ed.requirements.some((r) => r.code === "8.2"));
  });

  if (process.env.DATABASE_URL) {
    assertDisposableDatabase();
    const prisma = createTestClient();
    try {
      await installAllPacks(prisma);
      await prisma.organization.deleteMany({
        where: { slug: { in: ["lifecycle-a", "lifecycle-b"] } },
      });
      const { orgA, userA } = await createTenantPair(prisma, "lifecycle", { plan: "GROWTH" });
      const fakeCtx = { organization: { id: orgA.id, plan: "GROWTH", trialEndsAt: null }, user: { id: userA.id } } as never;
      await promotePackLifecycle(iso37001Pack, {
        toStatus: "DEVELOPMENT",
        actorId: userA.id,
        reason: "reset disposable lifecycle fixture",
      });

      await t("no entitlement row → activation is blocked", async () => {
        await assert.rejects(() => assertPackEntitlement(fakeCtx, "PACK_ISO_9001", prisma), PackEntitlementError);
      });

      await t("granting an entitlement is what actually unlocks activation (never ALL_MODULES)", async () => {
        await grantTestEntitlement(prisma, { organizationId: orgA.id, packCode: "PACK_ISO_9001", grantedById: userA.id });
        const result = await assertPackEntitlement(fakeCtx, "PACK_ISO_9001", prisma);
        assert.equal(result.pack.lifecycleStatus, "LIVE");
      });

      await t("promoting an incomplete manifest to LIVE is blocked but the attempt is persisted", async () => {
        await assert.rejects(
          () => promotePackLifecycle(incomplete37001Pack, { toStatus: "LIVE", actorId: userA.id }),
          PackPromotionError,
        );
        const pack = await prisma.standardPack.findUniqueOrThrow({ where: { code: "PACK_ISO_37001" } });
        assert.equal(pack.lifecycleStatus, "DEVELOPMENT", "blocked promotion must not flip the status");
        const assessment = await prisma.packReadinessAssessment.findFirst({
          where: { packId: pack.id }, orderBy: { createdAt: "desc" },
        });
        assert.ok(assessment, "a rejected LIVE attempt must still leave a readiness assessment on disk");
        assert.equal(assessment!.ready, false);
      });

      await t("PILOT → PILOT lateral move needs no readiness assessment and logs one lifecycle event", async () => {
        const before = await prisma.standardPackLifecycleEvent.count({ where: { pack: { code: "PACK_ISO_22301" } } });
        await installAllPacks(prisma); // ensure PACK_ISO_22301 exists
        await promotePackLifecycle(iso22301Pack, { toStatus: "PILOT", actorId: userA.id, reason: "no-op check" });
        const after = await prisma.standardPackLifecycleEvent.count({ where: { pack: { code: "PACK_ISO_22301" } } });
        assert.equal(after, before + 1);
      });

      await t("catalog reinstall preserves a governed LIVE promotion", async () => {
        const promotion = await promotePackLifecycle(iso37001Pack, {
          toStatus: "LIVE",
          actorId: userA.id,
          reason: "regression: lifecycle must survive catalog refresh",
        });
        assert.ok(promotion.assessmentId, "a forward LIVE promotion must persist its readiness assessment");

        await installAllPacks(prisma);

        const persisted = await prisma.standardPack.findUniqueOrThrow({
          where: { code: "PACK_ISO_37001" },
          select: { lifecycleStatus: true },
        });
        assert.equal(persisted.lifecycleStatus, "LIVE");
      });

      await t("commercial entitlement sync creates explicit rows only for LIVE packs", async () => {
        const sync = await syncCommercialPackEntitlements({
          organizationId: orgA.id,
          plan: "GROWTH",
          grantedById: userA.id,
        }, prisma);
        assert.ok(sync.enabledCodes.includes("PACK_ISO_27001"));
        assert.ok(sync.enabledCodes.includes("PACK_ISO_37001"));
        const rows = await prisma.organizationPackEntitlement.findMany({
          where: { organizationId: orgA.id, enabled: true },
          include: { pack: { select: { lifecycleStatus: true } } },
        });
        assert.ok(rows.length >= 3);
        assert.ok(rows.every((row) => row.pack.lifecycleStatus === "LIVE"));
      });
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log("  (skipping DB-backed entitlement/promotion checks — set DATABASE_URL to a disposable Postgres to run them)");
  }

  console.log(`\n${passed} checks passed.`);
}

main().catch((error) => {
  console.error("\n✗", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
