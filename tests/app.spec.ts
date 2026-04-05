import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("SaaS Application", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto(`${BASE_URL}/login`);
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/, { timeout: 5000 });
  });

  test("dashboard shows compliance score", async ({ page }) => {
    await expect(page.locator("text=78%")).toBeVisible();
    await expect(page.locator("text=Panel de Control")).toBeVisible();
  });

  test("sidebar navigation to risks", async ({ page }) => {
    await page.click("text=Riesgos");
    await expect(page).toHaveURL(/\/app\/risks/);
    await expect(page.locator("text=Gestión de Riesgos")).toBeVisible();
  });

  test("sidebar navigation to documents", async ({ page }) => {
    await page.click("text=Documentos");
    await expect(page).toHaveURL(/\/app\/documents/);
    await expect(page.locator("text=Control de Documentos")).toBeVisible();
  });

  test("documents filter works", async ({ page }) => {
    await page.goto(`${BASE_URL}/app/documents`);
    await page.click("text=Aprobados");
    await expect(page.locator("text=Aprobados")).toBeVisible();
  });

  test("GAP assessment shows chart", async ({ page }) => {
    await page.goto(`${BASE_URL}/app/gap`);
    await expect(page.locator("text=GAP Assessment")).toBeVisible();
    await expect(page.locator("text=Cumplimiento Global")).toBeVisible();
  });

  test("billing page shows current plan", async ({ page }) => {
    await page.goto(`${BASE_URL}/app/billing`);
    await expect(page.locator("text=Growth")).toBeVisible();
    await expect(page.locator("text=Billing y Suscripción")).toBeVisible();
  });
});
