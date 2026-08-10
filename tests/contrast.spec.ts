import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/normaflow";

/**
 * Contraste medido sobre el fondo que se pinta de verdad, en los dos temas.
 *
 * No existía ninguna comprobación automática de contraste, y por eso se
 * colaron los tres errores que el barrido manual encontró después:
 *
 *  · los ratios documentados se habían verificado contra blanco, no contra las
 *    superficies rehundidas donde el texto se pinta;
 *  · `Badge` usaba el token de RELLENO (3:1, válido para barras e iconos) como
 *    color de TEXTO, que necesita 4.5:1 — 89 apariciones;
 *  · el mismo error se repitió al tokenizar los hex: `color: var(--nf-primary)`
 *    da 4.11:1 sobre su propio fondo sutil, 79 apariciones.
 *
 * La sonda sube por el árbol hasta encontrar un fondo opaco, que es lo que el
 * usuario ve. Comprobar el color declarado contra el que uno cree que hay
 * detrás es exactamente el fallo que se está evitando aquí.
 */

const RUTAS = [
  // Aplicación: una por familia de pantalla.
  "/app/dashboard",
  "/app/documents",
  "/app/risks",
  "/app/nonconformities",
  "/app/actions",
  "/app/assets",
  "/app/standards",
  "/app/settings/organization",
  "/app/activity",
  "/app/billing",
  "/app/energy",
  "/app/integrated",
  "/app/setup",
  "/app/gap",
  // Públicas: el marketing no tenía apariencia oscura y es donde más falló.
  "/home",
  "/pricing",
  "/login",
  "/iso9001",
];

const SONDA = `() => {
  function lum(c) {
    const m = c.match(/[\\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map((n) => n / 255);
    const f = (x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function canal(c) {
    const m = c.match(/[\\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map(Number);
    return { r, g, b, a: m.length > 3 ? Number(m[3]) : 1 };
  }
  /**
   * Fondo efectivo: compone las capas semitransparentes sobre la de abajo.
   *
   * Sin componer, un \`rgba(82, 102, 246, 0.06)\` —que a la vista es blanco— se
   * medía como azul opaco y daba 1.18:1 contra un texto gris. El fallo era de
   * la sonda, no del producto.
   */
  function fondo(e) {
    const capas = [];
    let n = e;
    while (n) {
      const c = canal(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        capas.push(c);
        if (c.a >= 0.999) break;
      }
      n = n.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = capas.length - 1; i >= 0; i--) {
      const c = capas[i];
      base = {
        r: c.r * c.a + base.r * (1 - c.a),
        g: c.g * c.a + base.g * (1 - c.a),
        b: c.b * c.a + base.b * (1 - c.a),
        a: 1,
      };
    }
    return 'rgb(' + Math.round(base.r) + ', ' + Math.round(base.g) + ', ' + Math.round(base.b) + ')';
  }
  const fallos = [];
  for (const e of document.querySelectorAll('body *')) {
    const texto = [...e.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim()).join('');
    if (!texto) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.3) continue;
    // El patrón de texto con degradado recortado (background-clip: text) EXIGE
    // color: transparent, porque lo pinta el fondo. Medirlo como negro marcaba
    // invisible cada titular del hero.
    if ((cs.webkitBackgroundClip || cs.backgroundClip) === 'text') continue;
    // Un degradado propio no es evaluable: backgroundColor vale transparent y la
    // sonda seguiría subiendo hasta un fondo opaco que no es el que se ve. Los
    // avatares de /cases daban 1.04:1 por eso, con un número que era falso.
    if (cs.backgroundImage && cs.backgroundImage !== 'none') continue;
    const alfaTexto = canal(cs.color);
    if (alfaTexto && alfaTexto.a < 0.05) continue;
    const lf = lum(cs.color), lb = lum(fondo(e));
    if (lf === null || lb === null) continue;
    const cr = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
    const px = parseFloat(cs.fontSize);
    // WCAG 1.4.3: 3:1 para texto grande (24px, o 18.66px en negrita).
    const grande = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700);
    if (cr < (grande ? 3 : 4.5)) {
      fallos.push(cr.toFixed(2) + ' ' + cs.color + ' sobre ' + fondo(e) + ' — "' + texto.slice(0, 30) + '"');
    }
  }
  return fallos;
}`;

async function medir(page: Page, ruta: string) {
  await page.goto(ruta, { waitUntil: "domcontentloaded" });
  // `#nf-main` es el landmark del shell de la aplicación; las rutas públicas
  // tienen el suyo desde `NfShell`. Esperar el selector específico dejaba
  // colgadas las cuatro públicas.
  await page.waitForSelector(ruta.startsWith("/app/") ? "#nf-main" : "main", { timeout: 40000 });
  await page.waitForTimeout(400);
  return page.evaluate(`(${SONDA})()`) as Promise<string[]>;
}

test.describe("Contraste de color", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(15 * 60_000);

  let page: Page;

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

  for (const tema of ["light", "dark"] as const) {
    test(`ningún texto baja del mínimo en tema ${tema}`, async () => {
      // El tema se fija en la cookie que lee el servidor, no con un
      // setAttribute: así se comprueba el mismo camino que usa el producto.
      // La URL de la cookie tiene que salir de la propia página: la suite
      // corre contra 127.0.0.1:3200 y un dominio fijo la dejaría fuera.
      const origen = new URL(page.url()).origin;
      await page.context().addCookies([{ name: "nf_theme", value: tema, url: origen }]);

      const fallos: string[] = [];
      for (const ruta of RUTAS) {
        const encontrados = await medir(page, ruta);
        const aplicado = await page.evaluate(() => document.documentElement.dataset.theme);
        expect(aplicado, `la cookie de tema no llegó al HTML en ${ruta}`).toBe(tema);
        for (const f of encontrados) fallos.push(`${ruta}: ${f}`);
      }
      expect(fallos, `pares por debajo del mínimo WCAG:\n${fallos.join("\n")}`).toEqual([]);
    });
  }
});
