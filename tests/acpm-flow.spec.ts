import { test, expect } from "@playwright/test";
import { canCloseCAPA, nextCAPAStage } from "@/lib/capa-workflow";
import { assertACPMTransition, canCloseACPM, nextACPMStage, rejectionStage } from "@/lib/acpm-workflow";
import { roleCan } from "@/lib/permissions/matrix";

test.describe("ACPM/CAPA workflow contract", () => {
  test("legacy ACPM accepts only adjacent transitions and validates closure evidence", () => {
    expect(nextACPMStage("REQUEST")).toBe("REQUEST_APPROVAL");
    expect(nextACPMStage("CLOSED")).toBeNull();
    expect(() => assertACPMTransition("REQUEST", "IMPLEMENTATION")).toThrow(/no permitida/i);
    expect(() => assertACPMTransition("VERIFICATION", "CLOSED")).not.toThrow();
    expect(rejectionStage("REQUEST_APPROVAL")).toBe("REQUEST");
    expect(rejectionStage("IMPLEMENTATION")).toBeNull();
    expect(canCloseACPM({ stage: "VERIFICATION", progress: 100, effectivenessEvidence: null, effectivenessVerifiedAt: new Date() })).toBe(false);
    expect(canCloseACPM({ stage: "VERIFICATION", progress: 100, effectivenessEvidence: "Acta/Evidencia #42", effectivenessVerifiedAt: null })).toBe(false);
    expect(canCloseACPM({ stage: "VERIFICATION", progress: 100, effectivenessEvidence: "Acta/Evidencia #42", effectivenessVerifiedAt: new Date() })).toBe(true);
  });

  test("exposes exactly six ordered stages", () => {
    expect(["REGISTERED", "ROOT_CAUSE", "ACTION_PLAN", "IMPLEMENTATION", "VERIFICATION", "CLOSED"].map((stage) => nextCAPAStage(stage as Parameters<typeof nextCAPAStage>[0]))).toEqual([
      "ROOT_CAUSE", "ACTION_PLAN", "IMPLEMENTATION", "VERIFICATION", "CLOSED", null,
    ]);
  });

  test("cannot close without effectiveness evidence and a positive verification", () => {
    expect(canCloseCAPA({ efficacyStatus: "EFFECTIVE", verifiedAt: new Date(), evidenceKinds: [] })).toBe(false);
    expect(canCloseCAPA({ efficacyStatus: "NOT_EFFECTIVE", verifiedAt: new Date(), evidenceKinds: ["EFFECTIVENESS"] })).toBe(false);
    expect(canCloseCAPA({ efficacyStatus: "EFFECTIVE", verifiedAt: new Date(), evidenceKinds: ["EFFECTIVENESS"] })).toBe(true);
  });

  test("only approval roles may verify and close", () => {
    expect(roleCan("MANAGER", "actions:approve")).toBe(true);
    expect(roleCan("COMPLIANCE_MANAGER", "actions:approve")).toBe(true);
    expect(roleCan("CONTRIBUTOR", "actions:approve")).toBe(false);
    expect(roleCan("AUDITOR", "actions:create")).toBe(true);
    expect(roleCan("VIEWER", "actions:create")).toBe(false);
  });

  test("ACPM page is reachable end to end in the demo workspace", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/actions");
    await expect(page.getByText(/ACPM|Plan de acción/).first()).toBeVisible();
  });
});
