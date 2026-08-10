/**
 * Audited commercial release for every built-in Standard Pack.
 *
 * Preconditions: migrations and acceptance suites have passed against the
 * target database. This script is intentionally idempotent: a LIVE -> LIVE
 * run creates a fresh 32/32 assessment and lifecycle event so each release
 * decision has current evidence instead of relying on an older attestation.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import {
  COMMERCIAL_PACK_CODES,
  STANDARD_PACKS,
  commercialPackCodesForPlan,
  installAllPacks,
  promotePackLifecycle,
  syncCommercialPackEntitlements,
} from "@/lib/standard-packs";

const RELEASE_REASON = "Auditoría independiente de readiness comercial completada: 32/32 checks, suites unitarias/integración/live/RLS/Storage/reportes/AuditLog aprobadas — 2026-08-01.";

const COMMERCIAL_ASSETS: Record<string, { page: string; runbook: string }> = {
  PACK_ISO_9001: { page: "iso9001", runbook: "iso-9001-support.md" },
  PACK_ISO_27001: { page: "iso27001", runbook: "iso-27001-support.md" },
  PACK_ISO_14001: { page: "iso14001", runbook: "iso-14001-support.md" },
  PACK_ISO_45001: { page: "iso45001", runbook: "iso-45001-support.md" },
  PACK_SIG_9001_14001_45001: { page: "sig", runbook: "sig-support.md" },
  PACK_ISO_22301: { page: "iso22301", runbook: "iso-22301-support.md" },
  PACK_ISO_42001: { page: "iso42001", runbook: "iso-42001-support.md" },
  PACK_ISO_37301: { page: "iso37301", runbook: "iso-37301-support.md" },
  PACK_ISO_37001: { page: "iso37001", runbook: "iso-37001-support.md" },
  PACK_ISO_50001: { page: "iso50001", runbook: "iso-50001-support.md" },
  PACK_ISO_22000: { page: "iso22000", runbook: "iso-22000-support.md" },
  PACK_ISO_20000: { page: "iso20000", runbook: "iso-20000-support.md" },
  PACK_ISO_13485: { page: "iso13485", runbook: "iso-13485-support.md" },
};

function assertCommercialAssets() {
  const required = [
    ...Object.values(COMMERCIAL_ASSETS).flatMap(({ page, runbook }) => [
      path.join(process.cwd(), "src", "app", page, "page.tsx"),
      path.join(process.cwd(), "docs", "runbooks", runbook),
    ]),
    path.join(process.cwd(), "src", "app", "pricing", "page.tsx"),
    path.join(process.cwd(), "src", "app", "demo", "page.tsx"),
  ];
  const missing = required.filter((file) => !fs.existsSync(file));
  if (missing.length) throw new Error(`Activos comerciales faltantes: ${missing.join(", ")}`);
}

async function releaseActor() {
  const memberships = await prisma.membership.findMany({
    where: { active: true, role: { in: ["OWNER", "SUPER_ADMIN", "ORG_ADMIN", "ADMIN"] } },
    include: { user: { select: { id: true, email: true } }, organization: { select: { id: true, name: true } } },
  });
  const rank = new Map(["OWNER", "SUPER_ADMIN", "ORG_ADMIN", "ADMIN"].map((role, index) => [role, index]));
  const membership = memberships.sort((a, b) => (rank.get(a.role) ?? 99) - (rank.get(b.role) ?? 99))[0];
  if (!membership) throw new Error("No existe una membresía administrativa activa para atribuir la liberación.");
  return membership;
}

async function main() {
  assertCommercialAssets();
  if (new Set(COMMERCIAL_PACK_CODES).size !== STANDARD_PACKS.length) throw new Error("El inventario comercial y STANDARD_PACKS no coinciden.");

  await installAllPacks();
  const actor = await releaseActor();
  console.log(`Release actor: ${actor.user.email} · ${actor.organization.name}`);

  for (const manifest of STANDARD_PACKS) {
    const result = await promotePackLifecycle(
      manifest,
      { toStatus: "LIVE", actorId: actor.user.id, reason: RELEASE_REASON },
      async (tx, meta) => {
        await tx.auditLog.create({
          data: {
            organizationId: actor.organization.id,
            userId: actor.user.id,
            action: meta.fromStatus === "LIVE" ? "lifecycle_reassessment" : "lifecycle_promote",
            module: "standard_pack",
            recordId: manifest.code,
            metadata: {
              before: { lifecycleStatus: meta.fromStatus },
              after: { lifecycleStatus: "LIVE" },
              assessmentId: meta.assessmentId,
              reason: RELEASE_REASON,
            },
          },
        });
      },
    );
    if (!result.assessmentId) throw new Error(`${manifest.code} no produjo assessment LIVE.`);
    console.log(`LIVE ${manifest.code} · assessment ${result.assessmentId} · event ${result.eventId}`);
  }

  const organizations = await prisma.organization.findMany({ select: { id: true, plan: true, trialEndsAt: true } });
  for (const organization of organizations) {
    const sync = await syncCommercialPackEntitlements({
      organizationId: organization.id,
      plan: organization.plan,
      trialEndsAt: organization.trialEndsAt,
      grantedById: actor.user.id,
    });
    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: actor.user.id,
        action: "commercial_entitlements_sync",
        module: "standard_pack",
        metadata: {
          plan: organization.plan,
          enabledCodes: sync.enabledCodes,
          skippedNotLive: sync.skippedNotLive,
          disabledCount: sync.disabledCount,
        },
      },
    });
  }

  const packs = await prisma.standardPack.findMany({
    where: { code: { in: [...COMMERCIAL_PACK_CODES] } },
    include: {
      readinessAssessments: { orderBy: { createdAt: "desc" }, take: 1, include: { checks: true } },
      lifecycleEvents: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { code: "asc" },
  });
  if (packs.length !== COMMERCIAL_PACK_CODES.length) throw new Error(`Catálogo incompleto: ${packs.length}/${COMMERCIAL_PACK_CODES.length}.`);
  for (const pack of packs) {
    const assessment = pack.readinessAssessments[0];
    const event = pack.lifecycleEvents[0];
    if (pack.lifecycleStatus !== "LIVE" || pack.archivedAt) throw new Error(`${pack.code} no quedó LIVE y disponible.`);
    if (!assessment?.ready || assessment.met !== 32 || assessment.total !== 32 || assessment.checks.length !== 32 || assessment.checks.some((check) => !check.met)) {
      throw new Error(`${pack.code} no tiene assessment vigente 32/32.`);
    }
    if (!event || event.toStatus !== "LIVE" || event.assessmentId !== assessment.id) throw new Error(`${pack.code} no tiene lifecycle event ligado al assessment.`);
  }

  for (const organization of organizations) {
    const expected = new Set(commercialPackCodesForPlan(organization.plan, organization.trialEndsAt));
    const managed = await prisma.organizationPackEntitlement.findMany({
      where: { organizationId: organization.id, source: { in: ["PLAN", "TRIAL"] } },
      include: { pack: { select: { code: true } } },
    });
    const enabled = new Set(managed.filter((row) => row.enabled).map((row) => row.pack.code));
    const missing = [...expected].filter((code) => !enabled.has(code));
    if (missing.length) throw new Error(`Entitlements comerciales faltantes para ${organization.id}: ${missing.join(", ")}`);
  }

  console.log(JSON.stringify({ packs: packs.map((pack) => ({ code: pack.code, lifecycle: pack.lifecycleStatus, readiness: `${pack.readinessAssessments[0].met}/${pack.readinessAssessments[0].total}` })), organizationsSynced: organizations.length }, null, 2));
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
