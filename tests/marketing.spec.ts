import { test, expect } from "@playwright/test";

test.describe("Marketing Site", () => {
  test("homepage loads with hero", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Del caos ISO");
    await expect(page.getByText("NormaFlow").first()).toBeVisible();
  });

  test("navigation links work", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("link", { name: "Precios" }).first().click();
    await expect(page).toHaveURL(/\/pricing/);
  });

  test("pricing page shows 3 plans", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Starter").first()).toBeVisible();
    await expect(page.getByText("Growth").first()).toBeVisible();
    await expect(page.getByText("Enterprise").first()).toBeVisible();
  });

  test("ISO 9001 page loads", async ({ page }) => {
    await page.goto("/iso9001");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Gestión");
    await expect(page.getByText("ISO 9001:2015").first()).toBeVisible();
  });

  test("ISO 27001 page loads", async ({ page }) => {
    await page.goto("/iso27001");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Seguridad");
    await expect(page.getByText("ISO 27001:2022").first()).toBeVisible();
  });

  test("cases page shows testimonials", async ({ page }) => {
    await page.goto("/cases");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Empresas");
    await expect(page.getByText("Tecnoserv Industrial").first()).toBeVisible();
  });
});
