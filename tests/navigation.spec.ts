import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/normaflow";

/**
 * Navegación del workspace tras la reestructuración de la arquitectura de
 * información: 8 grupos colapsables, filtro, elementos fijados, cajón móvil y
 * enlace de salto al contenido.
 */

/** Despliega un grupo del sidebar si está plegado. */
async function openGroup(page: Page, group: string) {
  const toggle = page.locator(".nf-sidenav__group-toggle", { hasText: group }).first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

test.describe("Navegación del workspace", () => {
  test("presenta los ocho grupos semánticos", async ({ authenticatedPage: page }) => {
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
      await expect(page.locator(".nf-sidenav__group-toggle", { hasText: group }).first()).toBeVisible();
    }
  });

  test("el grupo que contiene la ruta activa se abre solo", async ({ authenticatedPage: page }) => {
    await page.goto("/app/documents");
    const toggle = page.locator(".nf-sidenav__group-toggle", { hasText: "Sistema de gestión" }).first();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Documentos", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("desplegar un grupo y navegar", async ({ authenticatedPage: page }) => {
    await openGroup(page, "Riesgo y cumplimiento");
    await page.getByRole("link", { name: "Riesgos", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/risks/);
  });

  test("el estado de los grupos persiste entre navegaciones", async ({ authenticatedPage: page }) => {
    await openGroup(page, "Evaluación");
    await page.goto("/app/documents");
    await expect(
      page.locator(".nf-sidenav__group-toggle", { hasText: "Evaluación" }).first(),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("el filtro reduce la navegación y avisa cuando no hay coincidencias", async ({ authenticatedPage: page }) => {
    const filter = page.getByRole("searchbox", { name: /Filtrar navegación/i });
    await filter.fill("audit");
    await expect(page.getByRole("link", { name: "Auditorías", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documentos", exact: true })).toHaveCount(0);

    await filter.fill("zzzz-no-existe");
    await expect(page.locator(".nf-sidenav__empty")).toBeVisible();
  });

  test("fijar un módulo lo eleva al bloque Fijados", async ({ authenticatedPage: page }) => {
    await openGroup(page, "Riesgo y cumplimiento");
    await page.getByRole("button", { name: /Fijar en el menú: Riesgos/i }).click();
    await expect(page.getByText("Fijados", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Riesgos", exact: true })).toHaveCount(2);
  });

  test("las secciones solo se muestran para la norma activa", async ({ authenticatedPage: page }) => {
    await openGroup(page, "Normas");
    // Con ninguna norma abierta no hay subenlaces de sección compitiendo en la
    // columna: antes podían convivir ~143.
    await expect(page.locator(".nf-sidenav__section-link")).toHaveCount(0);

    await page.locator('.nf-sidenav__link[href="/app/energy"]').click();
    await expect(page).toHaveURL(/\/app\/energy$/);

    // Ahora sí: las 13 secciones de ISO 50001, y solo esas.
    const sections = page.locator(".nf-sidenav__section-link");
    await expect(sections).toHaveCount(13);
    await expect(page.locator('.nf-sidenav__section-link[href*="/app/compliance"]')).toHaveCount(0);

    // Y siguen navegando: `useModuleSection` lee `?section=`.
    await sections.filter({ hasText: "Medidores" }).first().click();
    await expect(page).toHaveURL(/section=meters/);
  });

  test("el enlace de salto al contenido es el primer tabulable y lleva al main", async ({ authenticatedPage: page }) => {
    // Primer tabulable del shell: el usuario de teclado atravesaba ~180
    // enlaces de navegación antes de llegar al contenido.
    const firstTabbable = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('a[href], button, input, select, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null || el.classList.contains("nf-skip-link"));
      return candidates[0]?.className ?? "";
    });
    expect(firstTabbable).toContain("nf-skip-link");

    const skip = page.locator(".nf-skip-link");
    await skip.focus();
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page.locator("#nf-main")).toBeFocused();
  });

  test("el dashboard declara un único h1", async ({ authenticatedPage: page }) => {
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(/Panel de control|Dashboard/);
  });
});

/**
 * El bloque móvil comparte una sola sesión: el login está limitado a 10
 * intentos por IP cada 15 minutos y la suite completa supera esa cuota si cada
 * caso vuelve a autenticarse.
 */
test.describe("Navegación en móvil", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await context.newPage();
    await page.goto("/login");
    await page.getByRole("button", { name: /Usar credenciales demo/i }).click();
    await page.getByRole("button", { name: /^Entrar/i }).click();
    await page.waitForURL(/\/app\/dashboard/, { timeout: 60000 });
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test("el cajón arranca cerrado y no captura el foco", async () => {
    await page.goto("/app/dashboard");
    const nav = page.locator(".nf-sidenav");
    await expect(nav).not.toHaveAttribute("data-open", "true");
    // `visibility: hidden` lo saca del orden de tabulación.
    await expect(page.getByRole("link", { name: "Documentos", exact: true })).toBeHidden();
  });

  test("el botón de menú abre el cajón y Escape lo cierra", async () => {
    await page.goto("/app/dashboard");
    await page.locator(".nf-topbar-menu").click();
    await expect(page.locator(".nf-sidenav")).toHaveAttribute("data-open", "true");
    await expect(page.locator(".nf-sidenav-backdrop")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".nf-sidenav")).not.toHaveAttribute("data-open", "true");
  });

  test("no hay desplazamiento horizontal de página", async () => {
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
