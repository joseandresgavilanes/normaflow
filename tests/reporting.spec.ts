import { test, expect } from "@playwright/test";
import { roleCan } from "@/lib/permissions/matrix";

test.describe("informes y paquete de auditoría", () => {
  test("protege exportación por permiso específico", () => {
    expect(roleCan("ADMIN", "reporting:export")).toBe(true);
    expect(roleCan("AUDITOR", "reporting:export")).toBe(true);
    expect(roleCan("AUDITOR", "reporting:read")).toBe(true);
    expect(roleCan("VIEWER", "reporting:read")).toBe(true);
    expect(roleCan("VIEWER", "reporting:export")).toBe(false);
  });

  test("muestra el centro live de informes en el workspace demo", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/reporting");
    await expect(page.getByText(/Informes y paquetes de auditoría/i)).toBeVisible();
    await expect(page.getByText(/Paquete completo de auditoría/i)).toBeVisible();
  });
});
