import { test as base, expect, type Locator, type Page } from "@playwright/test";

type Fixtures = {
  authenticatedPage: Page;
};

/**
 * Elige una opción en un `Picker`.
 *
 * `Picker` sustituyó al `<select>` nativo en todo el producto, así que
 * `selectOption()` ya no sirve: su disparador es un `<button role="combobox">`
 * y la lista se pinta en un portal al `body`, fuera del diálogo. Este ayudante
 * hace lo que haría una persona — abrir y pulsar la fila.
 */
export async function elegirEnPicker(disparador: Locator, opcion: string | RegExp) {
  await disparador.click();
  const panel = disparador.page().locator(".nf-picker__panel");
  await expect(panel).toBeVisible();
  await panel.getByRole("option", { name: opcion }).first().click();
  await expect(panel).toBeHidden();
}

/** Lo mismo para `DateField`, que sustituyó a `<input type="date">`. */
export async function elegirFecha(disparador: Locator, dia: number) {
  await disparador.click();
  const panel = disparador.page().locator(".nf-datefield__panel");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: String(dia), exact: true }).click();
  await expect(panel).toBeHidden();
}

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
