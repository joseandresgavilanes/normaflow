import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Marketing Site", () => {
  test("homepage loads with hero", async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);
    await expect(page.locator("text=Tu sistema de gestión")).toBeVisible();
    await expect(page.locator("text=NormaFlow")).toBeVisible();
  });

  test("navigation links work", async ({ page }) => {
    await page.goto(`${BASE_URL}/home`);
    await page.click("text=Precios");
    await expect(page).toHaveURL(/\/pricing/);
  });

  test("pricing page shows 3 plans", async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);
    await expect(page.locator("text=Starter")).toBeVisible();
    await expect(page.locator("text=Growth")).toBeVisible();
    await expect(page.locator("text=Enterprise")).toBeVisible();
  });

  test("ISO 9001 page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/iso9001`);
    await expect(page.locator("text=ISO 9001:2015")).toBeVisible();
  });

  test("ISO 27001 page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/iso27001`);
    await expect(page.locator("text=ISO 27001:2022")).toBeVisible();
  });

  test("cases page shows testimonials", async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);
    await expect(page.locator("text=Tecnoserv Industrial")).toBeVisible();
  });
});
