/**
 * Concurrency test: the report-worker lease is the one place in the codebase
 * that explicitly claims exactly-once processing under concurrent workers
 * (`startReportArtifact`'s conditional `updateMany` — see
 * src/lib/report-artifacts.ts). This proves it end-to-end: N concurrent
 * attempts to lease the same QUEUED artifact must yield exactly one winner.
 *
 *   DATABASE_URL=postgres://…disposable… npx tsx scripts/test-concurrency.ts
 */
import assert from "node:assert/strict";
import Module from "node:module";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { assertDisposableDatabase, createTenantPair, TestRunner } from "./lib/pack-test-factory";

// `server-only` lo resuelve Next en tiempo de build; fuera de Next no existe.
type Loader = (request: string, ...args: unknown[]) => unknown;
const moduleInternals = Module as unknown as { _load: Loader };
const originalLoad = moduleInternals._load;
moduleInternals._load = function (this: unknown, request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
} as Loader;

assertDisposableDatabase();
const prisma = new PrismaClient();

async function main() {
  const t = new TestRunner("Concurrency: report artifact lease");

  const { orgA, userA } = await createTenantPair(prisma, "concurrency", { plan: "GROWTH" });
  const { startReportArtifact } = await import("../src/lib/report-artifacts");

  await t.t("N concurrent leases on the same QUEUED artifact: exactly one wins", async () => {
    const artifact = await prisma.reportExport.create({
      data: {
        organizationId: orgA.id, generatedById: userA.id, reportType: "gap", format: "PDF",
        dateFrom: new Date("2026-01-01"), dateTo: new Date("2026-12-31"), rowCount: 0,
        fileName: "concurrency-test.pdf", status: "QUEUED",
      },
    });

    const attempts = 8;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () => startReportArtifact(artifact.id, orgA.id, randomUUID())),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, `expected exactly 1 winning lease out of ${attempts} concurrent attempts, got ${fulfilled.length}`);
    assert.equal(rejected.length, attempts - 1, "every other concurrent attempt must be rejected, not silently succeed");

    const final = await prisma.reportExport.findUniqueOrThrow({ where: { id: artifact.id } });
    assert.equal(final.status, "PROCESSING");
    assert.equal(final.attempts, 1, "attempts must increment exactly once, not once per concurrent racer");
  });

  await t.t("a second lease attempt after a successful one is rejected (no double-processing)", async () => {
    const artifact = await prisma.reportExport.create({
      data: {
        organizationId: orgA.id, generatedById: userA.id, reportType: "gap", format: "PDF",
        dateFrom: new Date("2026-01-01"), dateTo: new Date("2026-12-31"), rowCount: 0,
        fileName: "concurrency-test-2.pdf", status: "QUEUED",
      },
    });
    await startReportArtifact(artifact.id, orgA.id, randomUUID());
    await assert.rejects(() => startReportArtifact(artifact.id, orgA.id, randomUUID()));
  });

  t.summary();
}

main().catch((error) => {
  console.error("\n✗ FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
