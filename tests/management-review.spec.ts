import { test, expect } from "@playwright/test";
import { roleCan } from "@/lib/permissions/matrix";

test.describe("revisión por la dirección", () => {
  test("protege edición, acciones derivadas y exportación por rol", () => {
    expect(roleCan("MANAGER", "mgmt-review:update")).toBe(true);
    expect(roleCan("MANAGER", "mgmt-review:export")).toBe(true);
    expect(roleCan("AUDITOR", "mgmt-review:read")).toBe(true);
    expect(roleCan("AUDITOR", "mgmt-review:export")).toBe(true);
    expect(roleCan("AUDITOR", "actions:create")).toBe(true);
    expect(roleCan("VIEWER", "mgmt-review:update")).toBe(false);
    expect(roleCan("VIEWER", "mgmt-review:export")).toBe(false);
  });

  test("la pantalla live de revisión por la dirección es accesible en demo", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/management-review");
    await expect(page.getByText(/Revisión por la dirección/i).first()).toBeVisible();
  });
});
