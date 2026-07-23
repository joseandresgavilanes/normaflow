import { test, expect } from "@playwright/test";
import { reportArtifactChecksum, reportArtifactPath } from "@/lib/report-artifact-contract";
import { assertTenantStoragePath } from "@/lib/storage-path";
import { canClaimReport, nextReportState, reportRetryDelayMs } from "@/lib/report-worker-contract";

test.describe("report artifact contracts", () => {
  test("persists deterministic tenant-scoped path and checksum", () => {
    const path = reportArtifactPath("tenant-a", "artifact-1", "Matriz documental 2026.pdf");
    expect(path).toBe("org-tenant-a/reports/artifact-1/Matriz-documental-2026.pdf");
    expect(reportArtifactChecksum(Buffer.from("report-bytes"))).toHaveLength(64);
  });
  test("denies another tenant from re-downloading an artifact path", () => {
    const path = reportArtifactPath("tenant-a", "artifact-1", "report.pdf");
    expect(() => assertTenantStoragePath("tenant-b", path)).toThrow();
  });
  test("worker lifecycle uses due claims and bounded exponential retry", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(canClaimReport("QUEUED", new Date("2025-12-31T23:59:59.000Z"), now)).toBe(true);
    expect(canClaimReport("PROCESSING", new Date("2025-12-31T23:59:59.000Z"), now)).toBe(false);
    expect(reportRetryDelayMs(1)).toBe(5_000);
    expect(reportRetryDelayMs(3)).toBe(20_000);
    expect(nextReportState(2, 3)).toBe("QUEUED");
    expect(nextReportState(3, 3)).toBe("FAILED");
  });
});
