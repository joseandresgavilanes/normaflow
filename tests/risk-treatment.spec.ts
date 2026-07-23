import { expect, test } from "@playwright/test";
import { roleCan } from "@/lib/permissions/matrix";
import { REPORT_IDS } from "@/lib/reporting-contract";
import { acceptanceSchema, itemCreateSchema, residualAssessmentSchema } from "@/lib/validation/risk-treatment";

const PLAN = "plan-000000000001";

test.describe("tratamiento de riesgos", () => {
  test("valida impacto y probabilidad dentro de la escala 1-5", () => {
    const base = { planId: PLAN, title: "Fuga de datos", impact: 4, probability: 3, treatment: "MITIGATE" as const };
    expect(itemCreateSchema.safeParse(base).success).toBe(true);
    expect(itemCreateSchema.safeParse({ ...base, impact: 6 }).success).toBe(false);
    expect(itemCreateSchema.safeParse({ ...base, probability: 0 }).success).toBe(false);
  });

  test("valida evaluación residual y aceptación formal", () => {
    expect(residualAssessmentSchema.safeParse({ itemId: PLAN, residualImpact: 2, residualProbability: 2 }).success).toBe(true);
    expect(residualAssessmentSchema.safeParse({ itemId: PLAN, residualImpact: 9, residualProbability: 2 }).success).toBe(false);
    expect(acceptanceSchema.safeParse({ itemId: PLAN, justification: "Riesgo residual dentro del umbral aceptado." }).success).toBe(true);
    expect(acceptanceSchema.safeParse({ itemId: PLAN, justification: "" }).success).toBe(false);
  });

  test("aplica permisos del módulo risk-treatment", () => {
    expect(roleCan("ORG_ADMIN", "risk-treatment:approve")).toBe(true);
    expect(roleCan("COMPLIANCE_MANAGER", "risk-treatment:update")).toBe(true);
    expect(roleCan("AUDITOR", "risk-treatment:read")).toBe(true);
    expect(roleCan("AUDITOR", "risk-treatment:approve")).toBe(false);
    expect(roleCan("VIEWER", "risk-treatment:update")).toBe(false);
    expect(roleCan("VIEWER", "risk-treatment:read")).toBe(true);
  });

  test("registra los reportes de tratamiento en el contrato de exportación", () => {
    for (const id of ["risk-matrix", "risk-treatment-plan", "residual-risks"]) {
      expect(REPORT_IDS).toContain(id);
    }
  });

  test("expone el tratamiento de riesgos en demo", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/risk-treatment");
    await expect(page.getByText("Tratamiento de riesgos").first()).toBeVisible();
    await expect(page.getByText("R-001")).toBeVisible();
  });
});
