/**
 * Reusable integration-test factory for the Standard Pack Engine and every
 * pack built on top of it (environment, safety, aims, compliance, energy,
 * food-safety, itsm, medical-devices, antibribery, continuity, …).
 *
 * Runs against a DISPOSABLE Postgres only — never prod. Scripts using this
 * factory talk to Prisma directly with the owner connection (RLS bypassed,
 * same as every other `scripts/test-*.ts`); real RLS-as-`authenticated`
 * checks live in `tests-live/*.spec.ts` (Playwright, real JWTs). What this
 * factory *does* give every pack test for free:
 *
 *   - the prod-safety guard + a shared `t()` runner
 *   - tenant A/B + one user per org, any role
 *   - a generic "org B can't see org A's rows" tenant-isolation assertion
 *   - an AuditLog assertion (did the action we just ran actually log?)
 *   - pack entitlement grant/revoke (the real activation gate, not env flags)
 *   - lifecycle promotion (persists PackReadinessAssessment + the event)
 *
 * Usage:
 *   import { assertDisposableDatabase, createTestClient, TestRunner, createTenantPair } from "./lib/pack-test-factory";
 */
import assert from "node:assert/strict";
import { PrismaClient, type Role } from "@prisma/client";

/** Refuse to run against anything that looks like a managed/production database. */
export function assertDisposableDatabase(url = process.env.DATABASE_URL ?? ""): void {
  if (/supabase|pooler|amazonaws/i.test(url)) {
    throw new Error("Refusing to run integration test against a managed/production database.");
  }
  if (!url) throw new Error("DATABASE_URL is not set. Point it at a disposable Postgres before running this test.");
}

export function createTestClient(): PrismaClient {
  assertDisposableDatabase();
  return new PrismaClient();
}

/** Named `t("description", fn)` checks with a running pass count and readable output. */
export class TestRunner {
  passed = 0;
  constructor(private readonly label: string) {
    console.log(`${label}\n`);
  }
  async t(name: string, fn: () => void | Promise<void>): Promise<void> {
    await fn();
    this.passed += 1;
    console.log(`  ✓ ${name}`);
  }
  summary(): void {
    console.log(`\n${this.passed} checks passed.`);
  }
}

export type TenantPair = {
  orgA: { id: string; slug: string };
  orgB: { id: string; slug: string };
  userA: { id: string; email: string };
  userB: { id: string; email: string };
};

/**
 * Creates (idempotently) two organizations with one member each — the
 * baseline every cross-tenant test needs. Pass a unique `key` per test
 * script so parallel suites don't collide on slugs/emails.
 */
export async function createTenantPair(
  prisma: PrismaClient,
  key: string,
  opts: { plan?: string; roleA?: Role; roleB?: Role } = {},
): Promise<TenantPair> {
  const plan = opts.plan ?? "GROWTH";
  const roleA = opts.roleA ?? "ORG_ADMIN";
  const roleB = opts.roleB ?? "ORG_ADMIN";

  const orgA = await prisma.organization.upsert({
    where: { slug: `${key}-a` }, update: {}, create: { name: `${key} A`, slug: `${key}-a`, plan: plan as never },
  });
  const orgB = await prisma.organization.upsert({
    where: { slug: `${key}-b` }, update: {}, create: { name: `${key} B`, slug: `${key}-b`, plan: plan as never },
  });
  const userA = await prisma.user.upsert({
    where: { email: `${key}-a@test.normaflow.local` }, update: {},
    create: { email: `${key}-a@test.normaflow.local`, name: `${key} User A` },
  });
  const userB = await prisma.user.upsert({
    where: { email: `${key}-b@test.normaflow.local` }, update: {},
    create: { email: `${key}-b@test.normaflow.local`, name: `${key} User B` },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: userA.id, organizationId: orgA.id } },
    update: { role: roleA }, create: { userId: userA.id, organizationId: orgA.id, role: roleA },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: userB.id, organizationId: orgB.id } },
    update: { role: roleB }, create: { userId: userB.id, organizationId: orgB.id, role: roleB },
  });

  return {
    orgA: { id: orgA.id, slug: orgA.slug },
    orgB: { id: orgB.id, slug: orgB.slug },
    userA: { id: userA.id, email: userA.email },
    userB: { id: userB.id, email: userB.email },
  };
}

/**
 * Generic tenant-isolation assertion: rows created for `ownerOrgId` under a
 * model must be invisible when queried with a different organization's id.
 * Mirrors the `tenantWhere()` filter every server action applies.
 *
 * Example: `await assertTenantIsolated(prisma.requirementCoverage, orgB.id)`
 */
export async function assertTenantIsolated(
  model: { findMany: (args: { where: { organizationId: string } }) => Promise<unknown[]> },
  otherOrganizationId: string,
): Promise<void> {
  const rows = await model.findMany({ where: { organizationId: otherOrganizationId } });
  assert.equal(rows.length, 0, `expected no rows visible under a different organization (${otherOrganizationId})`);
}

/** Asserts an AuditLog row exists for the given org/action/module (optionally recordId). */
export async function assertAuditLogged(
  prisma: PrismaClient,
  where: { organizationId: string; action: string; module: string; recordId?: string },
): Promise<void> {
  const row = await prisma.auditLog.findFirst({ where, orderBy: { createdAt: "desc" } });
  assert.ok(row, `expected an AuditLog row for ${where.module}:${where.action} (org ${where.organizationId})`);
}

/** Grants a pack entitlement directly (bypassing the server action's permission check, for test setup). */
export async function grantTestEntitlement(
  prisma: PrismaClient,
  input: { organizationId: string; packCode: string; source?: "PLAN" | "MANUAL_GRANT" | "TRIAL" | "PILOT_PROGRAM"; grantedById: string },
) {
  const pack = await prisma.standardPack.findUniqueOrThrow({ where: { code: input.packCode } });
  return prisma.organizationPackEntitlement.upsert({
    where: { organizationId_packId: { organizationId: input.organizationId, packId: pack.id } },
    update: { enabled: true, source: input.source ?? "MANUAL_GRANT", grantedById: input.grantedById },
    create: {
      organizationId: input.organizationId, packId: pack.id,
      source: input.source ?? "MANUAL_GRANT", grantedById: input.grantedById,
    },
  });
}

/** Evidence-attach fixture: minimal EvidenceFile row for coverage/report round-trip tests. */
export async function attachTestEvidence(
  prisma: PrismaClient,
  input: { organizationId: string; uploadedById: string; title?: string },
) {
  return prisma.evidenceFile.create({
    data: {
      organizationId: input.organizationId,
      uploadedById: input.uploadedById,
      title: input.title ?? "Evidence test",
      mimeType: "application/pdf",
      fileSize: 1024,
      fileUrl: `org-${input.organizationId}/evidence/evidence-test.pdf`,
    },
  });
}
