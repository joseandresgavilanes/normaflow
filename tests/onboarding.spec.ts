import { test, expect } from "@playwright/test";
import { onboardingProgress, trialDaysRemaining } from "@/lib/onboarding";
import { roleCan } from "@/lib/permissions/matrix";

test.describe("onboarding de trial", () => {
  test("calcula activación y vencimiento de trial", () => {
    expect(onboardingProgress([false, true, false, true, false, false])).toBe(33);
    expect(onboardingProgress([true, true, true, true, true, true])).toBe(100);
    expect(trialDaysRemaining(new Date("2026-07-24T00:00:00.000Z"), new Date("2026-07-22T00:00:00.000Z"))).toBe(2);
    expect(trialDaysRemaining(null)).toBeNull();
  });

  test("solo roles de gestión pueden completar onboarding y facturación", () => {
    expect(roleCan("OWNER", "org:update")).toBe(true);
    expect(roleCan("MANAGER", "org:update")).toBe(false);
    expect(roleCan("OWNER", "billing:*")).toBe(true);
    expect(roleCan("VIEWER", "billing:*")).toBe(false);
  });

  test("muestra el wizard de valor en la sesión demo", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
    await page.goto("/app/onboarding");
    await expect(page.getByText("Configuración inicial")).toBeVisible();
    await expect(page.getByText("¿Qué normas quieres gestionar?")).not.toBeVisible();
    await page.locator("input[placeholder='Ej. Acme Components']").fill("Demo Organization");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("¿Qué normas quieres gestionar?")).toBeVisible();
    await expect(page.getByText("ISO 9001:2015")).toBeVisible();
  });
});
