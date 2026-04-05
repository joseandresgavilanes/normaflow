import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Authentication", () => {
  test("login page loads correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveTitle(/NormaFlow/);
    await expect(page.locator("text=Bienvenido de nuevo")).toBeVisible();
    await expect(page.locator("text=demo@normaflow.io")).toBeVisible();
  });

  test("demo login fills credentials", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.click("text=Usar credenciales demo");
    const emailInput = page.locator("input[type='email']");
    await expect(emailInput).toHaveValue("demo@normaflow.io");
  });

  test("login redirects to dashboard", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 5000 });
  });

  test("signup page loads correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await expect(page.locator("text=Empieza gratis 14 días")).toBeVisible();
  });

  test("signup validation works", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await page.click("button[type='submit']");
    await expect(page.locator("text=Completa todos los campos")).toBeVisible();
  });
});
