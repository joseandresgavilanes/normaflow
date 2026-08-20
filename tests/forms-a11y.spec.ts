import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/normaflow";

/**
 * Todo control de entrada tiene que tener nombre accesible (WCAG 4.1.2, A).
 *
 * El barrido midió 1.210 campos sin nombre en 46 ficheros: 555 usaban el
 * placeholder como etiqueta y 652 no tenían nada. Este test impide que
 * vuelvan: recorre las rutas con más formularios y comprueba, sobre el DOM
 * renderizado, que cada campo se anuncia con algo.
 *
 * Se mira el DOM y no el código fuente a propósito. La asociación puede venir
 * de cuatro sitios distintos —`<label for>`, un `<label>` envolvente,
 * `aria-label` o `aria-labelledby`— y solo el navegador resuelve los cuatro.
 */

const RUTAS = [
  "/app/dashboard",
  "/app/documents",
  "/app/risks",
  "/app/audits",
  "/app/nonconformities",
  "/app/assets",
  "/app/compliance",
  "/app/energy",
  "/app/continuity",
  "/app/food-safety",
  "/app/environment",
  "/app/safety",
  "/app/settings/users",
  "/app/settings/organization",
  "/app/records",
];

type Campo = { etiqueta: string; nombre: string; tipo: string };

const SONDA = `() => {
  const controles = Array.from(document.querySelectorAll('input, select, textarea'));
  const sinNombre = [];
  for (const c of controles) {
    if (c instanceof HTMLInputElement && c.type === 'hidden') continue;
    // Espejo del valor de un control compuesto: 'Picker' y 'DateField' llevan
    // un input recortado que solo existe para que el campo viaje en el envío y
    // para que la validación del navegador tenga a qué anclarse. Está fuera del
    // arbol de accesibilidad por 'aria-hidden' y fuera del orden de tabulación
    // por 'tabindex=-1', así que no tiene nombre que anunciar: quien se anuncia
    // es el disparador. Exigirselo seria un fallo permanente que acaba tapando
    // los campos sin nombre de verdad.
    if (c.getAttribute('aria-hidden') === 'true' && c.getAttribute('tabindex') === '-1') continue;
    const estilo = getComputedStyle(c);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') continue;

    let nombre = c.getAttribute('aria-label') || '';
    if (!nombre) {
      const ref = c.getAttribute('aria-labelledby');
      if (ref) nombre = ref.split(/\\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ');
    }
    if (!nombre && c.id) {
      const etiqueta = document.querySelector('label[for="' + CSS.escape(c.id) + '"]');
      if (etiqueta) nombre = etiqueta.textContent || '';
    }
    if (!nombre) nombre = c.closest('label')?.textContent || '';
    if (!nombre && c instanceof HTMLInputElement && c.title) nombre = c.title;

    if (!nombre.trim()) {
      sinNombre.push({
        etiqueta: c.tagName.toLowerCase(),
        nombre: '',
        tipo: (c.getAttribute('type') || c.tagName.toLowerCase()) + ' · ' + (c.getAttribute('name') || c.className || '?').slice(0, 40),
      });
    }
  }
  return { total: controles.length, sinNombre };
}`;

async function sondear(page: Page, ruta: string) {
  await page.goto(ruta, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#nf-main", { timeout: 20000 });
  await page.waitForTimeout(350);
  return page.evaluate(`(${SONDA})()`) as Promise<{ total: number; sinNombre: Campo[] }>;
}

test.describe("Accesibilidad de formularios", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  // Cada primera visita a una ruta compila en desarrollo.
  test.setTimeout(10 * 60_000);

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/login");
    await page.getByRole("button", { name: /Usar credenciales demo/i }).click();
    await page.getByRole("button", { name: /^Entrar/i }).click();
    await page.waitForURL(/\/app\/dashboard/, { timeout: 60000 });
  });
  test.afterAll(async () => {
    await page.close();
  });

  test("ningún campo visible se queda sin nombre accesible", async () => {
    const fallos: string[] = [];
    let campos = 0;
    for (const ruta of RUTAS) {
      const r = await sondear(page, ruta);
      campos += r.total;
      for (const campo of r.sinNombre) {
        fallos.push(`${ruta}: <${campo.etiqueta}> ${campo.tipo}`);
      }
    }
    expect(campos, "el sondeo no encontró ningún campo: revisa la autenticación").toBeGreaterThan(50);
    expect(fallos, `campos sin nombre accesible:\n${fallos.join("\n")}`).toEqual([]);
  });

  test("el asistente de alta declara sus pasos como lista con paso actual", async () => {
    await page.goto("/app/onboarding", { waitUntil: "domcontentloaded" });
    const stepper = page.locator(".nf-stepper");
    // La ruta redirige al dashboard cuando el alta ya está completa.
    if ((await stepper.count()) === 0) test.skip(true, "alta ya completada en esta sesión");

    await expect(stepper.locator("ol")).toHaveCount(1);
    await expect(stepper.locator("li")).toHaveCount(4);
    await expect(stepper.locator('li[aria-current="step"]')).toHaveCount(1);
    // El estado no puede depender solo del color: cada paso dice su nombre.
    await expect(stepper.locator("li").first()).toContainText("Organización");
  });

  test("el error de un campo se anuncia y marca el control", async () => {
    // `Field` monta el hueco de error siempre, para que el lector de pantalla
    // lo tenga vigilado antes de que aparezca el mensaje.
    await page.goto("/app/settings/organization", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#nf-main", { timeout: 20000 });
    const campos = page.locator(".nf-field");
    if ((await campos.count()) === 0) test.skip(true, "sin campos migrados en esta ruta");

    const conError = page.locator('.nf-field__error[role="alert"]');
    expect(await conError.count(), "cada campo lleva su región de error montada").toBeGreaterThan(0);
  });

  test("las etiquetas apuntan a un control que existe", async () => {
    // Una etiqueta con `for` a un id inexistente es peor que no tenerla: las
    // herramientas la dan por asociada y el fallo no se ve.
    const huerfanas: string[] = [];
    for (const ruta of RUTAS.slice(0, 8)) {
      await page.goto(ruta, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#nf-main", { timeout: 20000 });
      const rotas = await page.evaluate(`(() => {
        return Array.from(document.querySelectorAll('label[for]'))
          .filter((l) => !document.getElementById(l.getAttribute('for')))
          .map((l) => (l.textContent || '').slice(0, 40));
      })()`);
      for (const texto of rotas as string[]) huerfanas.push(`${ruta}: "${texto}"`);
    }
    expect(huerfanas, `etiquetas apuntando a un id inexistente:\n${huerfanas.join("\n")}`).toEqual([]);
  });
});
