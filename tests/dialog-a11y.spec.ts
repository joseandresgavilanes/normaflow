import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/normaflow";

/**
 * Accesibilidad de los diálogos.
 *
 * El inventario del código encontró que NINGUNA de las 25 implementaciones
 * tenía trampa de foco, foco inicial ni devolución de foco, que `role="dialog"`
 * estaba en el velo en vez de en el panel, y que el velo cerraba con cualquier
 * `click` —así que arrastrar una selección de texto hacia fuera descartaba el
 * formulario. Estos casos fijan ese contrato.
 */

async function openRiskModal(page: Page) {
  await page.goto("/app/risks");
  const trigger = page.getByRole("button", { name: /Nuevo Riesgo/i });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return trigger;
}

test.describe("Accesibilidad de diálogos", () => {
  test.describe.configure({ mode: "serial" });

  test("la semántica vive en el panel, no en el velo", async ({ authenticatedPage: page }) => {
    await openRiskModal(page);
    const dialog = page.getByRole("dialog");
    // El elemento con role=dialog debe ser el panel.
    await expect(dialog).toHaveClass(/nf-modal-panel/);
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    // Y debe tener nombre accesible.
    const name = await dialog.getAttribute("aria-labelledby");
    expect(name).toBeTruthy();
    await expect(page.locator(`#${name}`)).not.toHaveText("");
  });

  test("el foco entra en el diálogo al abrir", async ({ authenticatedPage: page }) => {
    await openRiskModal(page);
    // El foco se aplica en el siguiente frame (el panel puede no estar aún en
    // el layout), así que se espera en vez de leerlo una sola vez: bajo carga
    // la aserción inmediata gana la carrera al frame.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
        }),
      )
      .toBe(true);
  });

  test("el foco queda atrapado: Tab no escapa al fondo", async ({ authenticatedPage: page }) => {
    await openRiskModal(page);
    // Una vuelta completa larga; si hubiera fuga, el foco acabaría en el sidebar.
    for (let i = 0; i < 30; i += 1) await page.keyboard.press("Tab");
    const stillInside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return Boolean(dialog && document.activeElement && dialog.contains(document.activeElement));
    });
    expect(stillInside, "tras 30 tabulaciones el foco sigue dentro").toBe(true);
  });

  test("el fondo queda fuera del árbol de accesibilidad", async ({ authenticatedPage: page }) => {
    await openRiskModal(page);
    // El portal se monta dentro de .nf-app-shell, así que lo que debe quedar
    // inerte son sus HERMANOS: la navegación y el contenido.
    const inert = await page.evaluate(() => ({
      nav: document.querySelector(".nf-sidenav")?.hasAttribute("inert") ?? null,
      main: document.querySelector(".nf-app-main")?.hasAttribute("inert") ?? null,
    }));
    expect(inert.main, "aria-modal exige aislar el contenido de fondo").toBe(true);
    expect(inert.nav, "y también la navegación").toBe(true);
  });

  test("Escape cierra y devuelve el foco al disparador", async ({ authenticatedPage: page }) => {
    const trigger = await openRiskModal(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    // Y el fondo vuelve a ser navegable.
    const shellInert = await page.evaluate(() =>
      document.querySelector(".nf-app-shell")?.hasAttribute("inert") ?? false,
    );
    expect(shellInert).toBe(false);
  });

  test("arrastrar una selección hacia fuera NO cierra el diálogo", async ({ authenticatedPage: page }) => {
    await openRiskModal(page);
    const dialog = page.getByRole("dialog");
    const field = dialog.locator("input").first();
    await field.fill("Texto que no se debe perder");

    const box = await field.boundingBox();
    const overlay = await page.locator(".nf-modal-overlay").boundingBox();
    expect(box && overlay).toBeTruthy();

    // mousedown dentro del campo -> mouseup fuera del panel.
    await page.mouse.move(box!.x + 8, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(overlay!.x + 6, overlay!.y + 6, { steps: 8 });
    await page.mouse.up();

    await expect(dialog, "el gesto empezó dentro: no debe cerrar").toBeVisible();
    await expect(field).toHaveValue("Texto que no se debe perder");
  });

  test("clic limpio en el velo sí cierra", async ({ authenticatedPage: page }) => {
    await openRiskModal(page);
    const overlay = await page.locator(".nf-modal-overlay").boundingBox();
    await page.mouse.click(overlay!.x + 6, overlay!.y + 6);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("el scroll del fondo se bloquea y se restaura", async ({ authenticatedPage: page }) => {
    await page.goto("/app/risks");
    const before = await page.evaluate(() => document.body.style.overflow);
    await page.getByRole("button", { name: /Nuevo Riesgo/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(before);
  });
});
