import { test, expect } from "@playwright/test";
import { checklistIsReady, criticalFindingsHaveActionPlan } from "@/lib/audit-workflow";
import { roleCan } from "@/lib/permissions/matrix";

test.describe("programa anual y auditoría interna", () => {
  test("bloquea el cierre si el checklist está vacío o pendiente", () => {
    expect(checklistIsReady([])).toBe(false);
    expect(checklistIsReady([{ status: "PENDING" }])).toBe(false);
    expect(checklistIsReady([{ status: "COMPLIANT" }, { status: "NON_COMPLIANT" }])).toBe(true);
  });

  test("exige CAPA para hallazgos críticos antes del cierre", () => {
    expect(criticalFindingsHaveActionPlan([{ severity: "CRITICAL", capaStage: null }])).toBe(false);
    expect(criticalFindingsHaveActionPlan([{ severity: "CRITICAL", capaStage: "ROOT_CAUSE" }])).toBe(false);
    expect(criticalFindingsHaveActionPlan([{ severity: "CRITICAL", capaStage: "ACTION_PLAN" }])).toBe(true);
    expect(criticalFindingsHaveActionPlan([{ severity: "MAJOR", capaStage: null }])).toBe(true);
  });

  test("separa exportación, gestión y conversión a CAPA por rol", () => {
    expect(roleCan("AUDITOR", "audit-program:export")).toBe(true);
    expect(roleCan("AUDITOR", "audits:export")).toBe(true);
    expect(roleCan("AUDITOR", "actions:create")).toBe(true);
    expect(roleCan("CONTRIBUTOR", "audits:update")).toBe(false);
    expect(roleCan("VIEWER", "audits:export")).toBe(false);
  });

  test("las páginas del programa y auditorías son accesibles en el workspace demo", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/audit-program");
    await expect(page.getByText(/Programa anual|programas de auditoría/i).first()).toBeVisible();
    await page.goto("/app/audits");
    await expect(page.getByText(/Auditorías/i).first()).toBeVisible();
  });
});
