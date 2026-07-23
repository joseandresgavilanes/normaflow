import { test as base, type Page } from "@playwright/test";

type Fixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Cada test recibe un workspace demo limpio; no depende del orden de ejecución.
    await page.addInitScript(() => {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith("normaflow:workspace:")) localStorage.removeItem(key);
      }
    });
    await page.goto("/login");
    await page.getByRole("button", { name: /Usar credenciales demo/i }).click();
    await page.getByRole("button", { name: /^Entrar/i }).click();
    await page.waitForURL(/\/app\/dashboard/);
    await use(page);
  },
});

export { expect } from "@playwright/test";
