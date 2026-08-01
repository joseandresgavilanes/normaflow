import { test, expect, type Page } from "@playwright/test";

/**
 * Navegación del workspace tras la reestructuración de la arquitectura de
 * información: 8 grupos colapsables, filtro, elementos fijados, cajón móvil y
 * enlace de salto al contenido.
 */

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("input[type='email']", "demo@normaflow.io");
  await page.fill("input[type='password']", "NormaFlow2025!");
  await page.click("button[type='submit']");
  await page.waitForURL(/\/app\/dashboard/, { timeout: 30000 });
}

/** Despliega un grupo del sidebar si está plegado. */
async function openGroup(page: Page, group: string) {
  const toggle = page.locator(".nf-nav__group-toggle", { hasText: group }).first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

test.describe("Navegación del workspace", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("presenta los ocho grupos semánticos", async ({ page }) => {
    const groups = [
      "Inicio",
      "Sistema de gestión",
      "Riesgo y cumplimiento",
      "Evaluación",
      "Mejora",
      "Personas y terceros",
      "Normas",
      "Administración",
    ];
    for (const group of groups) {
      await expect(page.locator(".nf-nav__group-toggle", { hasText: group }).first()).toBeVisible();
    }
  });

  test("el grupo que contiene la ruta activa se abre solo", async ({ page }) => {
    await page.goto("/app/documents");
    const toggle = page.locator(".nf-nav__group-toggle", { hasText: "Sistema de gestión" }).first();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Documentos", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("desplegar un grupo y navegar", async ({ page }) => {
    await openGroup(page, "Riesgo y cumplimiento");
    await page.getByRole("link", { name: "Riesgos", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/risks/);
  });

  test("el estado de los grupos persiste entre navegaciones", async ({ page }) => {
    await openGroup(page, "Evaluación");
    await page.goto("/app/documents");
    await expect(
      page.locator(".nf-nav__group-toggle", { hasText: "Evaluación" }).first(),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("el filtro reduce la navegación y avisa cuando no hay coincidencias", async ({ page }) => {
    const filter = page.getByRole("searchbox", { name: /Filtrar navegación/i });
    await filter.fill("audit");
    await expect(page.getByRole("link", { name: "Auditorías", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documentos", exact: true })).toHaveCount(0);

    await filter.fill("zzzz-no-existe");
    await expect(page.locator(".nf-nav__empty")).toBeVisible();
  });

  test("fijar un módulo lo eleva al bloque Fijados", async ({ page }) => {
    await openGroup(page, "Riesgo y cumplimiento");
    await page.getByRole("button", { name: /Fijar en el menú: Riesgos/i }).click();
    await expect(page.getByText("Fijados", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Riesgos", exact: true })).toHaveCount(2);
  });

  test("cada norma es un único destino, sin subenlaces ?section=", async ({ page }) => {
    await openGroup(page, "Normas");
    // Los ~143 subitems `?section=` se eliminaron: ningún cliente de norma leía
    // el parámetro, así que todos renderizaban el panel.
    await expect(page.locator('.nf-nav a[href*="?section="]')).toHaveCount(0);
    await page.getByRole("link", { name: "Gestión energética", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/energy$/);
  });

  test("el enlace de salto al contenido lleva al main", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skip = page.locator(".nf-skip-link");
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#nf-main$/);
  });

  test("el dashboard declara un único h1", async ({ page }) => {
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(/Panel de control|Dashboard/);
  });
});

test.describe("Navegación en móvil", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("el cajón arranca cerrado y no captura el foco", async ({ page }) => {
    const nav = page.locator(".nf-nav");
    await expect(nav).not.toHaveAttribute("data-open", "true");
    // `visibility: hidden` lo saca del orden de tabulación.
    await expect(page.getByRole("link", { name: "Documentos", exact: true })).toBeHidden();
  });

  test("el botón de menú abre el cajón y Escape lo cierra", async ({ page }) => {
    await page.locator(".nf-topbar-menu").click();
    await expect(page.locator(".nf-nav")).toHaveAttribute("data-open", "true");
    await expect(page.locator(".nf-nav-backdrop")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".nf-nav")).not.toHaveAttribute("data-open", "true");
  });

  test("no hay desplazamiento horizontal de página", async ({ page }) => {
    for (const route of ["/app/dashboard", "/app/documents", "/app/risks"]) {
      await page.goto(route);
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      );
      expect(overflow, `desbordamiento horizontal en ${route}`).toBe(false);
    }
  });
});
