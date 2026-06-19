import { test, expect } from "@playwright/test";

test.describe("Training management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/);
  });

  test("guides the user through the next valid training action", async ({ page }) => {
    await page.goto("/app/training");
    await expect(page.getByRole("heading", { name: "Gestión de capacitación" })).toBeVisible();

    const createFirstCourse = page.getByRole("button", { name: "Crear primer curso" });
    if (await createFirstCourse.isVisible()) {
      await expect(page.getByRole("button", { name: "Nueva asignación" })).toHaveCount(0);
      await createFirstCourse.click();
      const courseDialog = page.getByRole("dialog", { name: "Nuevo curso" });
      await expect(courseDialog).toBeVisible();
      await expect(courseDialog.locator("input[name='code']")).toBeVisible();
      await expect(courseDialog.locator("input[name='title']")).toBeVisible();
      return;
    }

    await page.getByRole("button", { name: "Nueva asignación" }).click();
    const dialog = page.getByRole("dialog", { name: "Nueva asignación" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Crear asignación" }).click();

    await page.getByRole("button", { name: "Asignaciones" }).click();
    await expect(page.getByText("Ana García")).toBeVisible();
  });
});
