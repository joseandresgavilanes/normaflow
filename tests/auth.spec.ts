import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "nf_locale", value: "es", url: "http://127.0.0.1:3200" }]);
  });

  test("login page loads correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/NormaFlow/);
    await expect(page.locator("text=Bienvenido de nuevo")).toBeVisible();
    await expect(page.locator("text=demo@normaflow.io")).toBeVisible();
  });

  test("demo login fills credentials", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Usar credenciales demo");
    const emailInput = page.locator("input[type='email']");
    await expect(emailInput).toHaveValue("demo@normaflow.io");
  });

  test("login redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 5000 });
  });

  test("signup page loads correctly", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /Empieza gratis/ })).toBeVisible();
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole("heading", { name: /Recupera tu contraseña/ })).toBeVisible();
  });

  test("signup validation works", async ({ page }) => {
    await page.goto("/signup");
    await page.click("button[type='submit']");
    await expect(page.locator("text=Completa todos los campos")).toBeVisible();
  });
});
