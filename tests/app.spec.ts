import { test, expect } from "@playwright/test";

test.describe("SaaS Application", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/, { timeout: 10000 });
  });

  test("dashboard shows KPIs and modules", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Módulos" })).toBeVisible();
    await expect(page.getByText("Actividad reciente")).toBeVisible();
    // Al menos un KPI porcentual visible (score de cumplimiento)
    await expect(page.locator("text=/\\d+%/").first()).toBeVisible();
  });

  test("sidebar navigation to risks", async ({ page }) => {
    await page.getByRole("link", { name: "Riesgos", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/risks/);
    await expect(page.getByRole("heading", { name: "Gestión de Riesgos" })).toBeVisible();
  });

  test("sidebar navigation to documents", async ({ page }) => {
    await page.getByRole("link", { name: "Documentos", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/documents/);
    await expect(page.getByRole("heading", { name: "Control de Documentos" })).toBeVisible();
  });

  test("documents filter works", async ({ page }) => {
    await page.goto("/app/documents");
    await expect(page.getByRole("heading", { name: "Control de Documentos" })).toBeVisible();
    await page.getByRole("button", { name: "Aprobados" }).first().click();
    await expect(page.getByRole("button", { name: "Aprobados" }).first()).toBeVisible();
  });

  test("GAP assessment shows chart", async ({ page }) => {
    await page.goto("/app/gap");
    await expect(page.getByRole("heading", { name: "GAP Assessment" })).toBeVisible();
    await expect(page.getByText("Cumplimiento Global")).toBeVisible();
    await expect(page.getByRole("button", { name: "ISO 27001:2022" })).toBeVisible();
  });

  test("setup guide shows implementation checklist", async ({ page }) => {
    await page.goto("/app/setup");
    await expect(page.getByRole("heading", { name: "Implementación guiada" })).toBeVisible();
    await expect(page.getByText("Base organizativa")).toBeVisible();
  });

  test("billing page shows current plan", async ({ page }) => {
    await page.goto("/app/billing");
    await expect(page.getByRole("heading", { name: /Billing y suscripción/i })).toBeVisible();
    await expect(page.getByText("Growth").first()).toBeVisible();
  });
});
