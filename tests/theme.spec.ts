import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/normaflow";

/**
 * Contrato del tema visual.
 *
 * El bloque de tokens oscuros llevaba en el repositorio sin ejecutarse nunca:
 * sin media query, sin conmutador y sin persistencia. Nadie lo había visto
 * funcionar, así que nada impedía que volviera a quedarse muerto.
 *
 * Estos casos fijan lo que tiene que seguir siendo cierto: que la preferencia
 * se guarda, que `system` obedece al sistema operativo, que el HTML llega ya
 * con el tema puesto —sin destello— y que lo que se pinta por portal lo hereda.
 */

const COOKIE = "nf_theme";

async function fijarTema(page: Page, valor: "light" | "dark" | "system") {
  const origen = new URL(page.url()).origin;
  await page.context().addCookies([{ name: COOKIE, value: valor, url: origen }]);
}

async function temaAplicado(page: Page) {
  return page.evaluate(() => document.documentElement.getAttribute("data-theme"));
}

async function fondoDelCuerpo(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

/** Luminancia relativa, para decidir si una pantalla es clara u oscura. */
async function luminanciaDelCuerpo(page: Page) {
  return page.evaluate(() => {
    const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b] = m.slice(0, 3).map((n) => Number(n) / 255);
    const f = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  });
}

test.describe("Tema visual", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(6 * 60_000);

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

  test("el conmutador lleva de claro a oscuro y lo persiste", async () => {
    await fijarTema(page, "light");
    await page.goto("/app/dashboard");
    expect(await temaAplicado(page)).toBe("light");

    const conmutador = page.locator(".nf-theme-switch").last();
    await conmutador.getByRole("radio").nth(1).click();

    await expect.poll(() => temaAplicado(page)).toBe("dark");
    // La cookie es lo que hace que el SERVIDOR pinte el tema en la siguiente
    // carga; sin ella habría destello en cada navegación.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === COOKIE)?.value).toBe("dark");
  });

  test("la preferencia sobrevive a la recarga y llega en el HTML inicial", async () => {
    await fijarTema(page, "dark");
    // `domcontentloaded` sin esperar a hidratar: si el atributo ya está aquí,
    // no puede haber destello blanco.
    await page.goto("/app/dashboard", { waitUntil: "domcontentloaded" });
    expect(await temaAplicado(page)).toBe("dark");

    const lum = await luminanciaDelCuerpo(page);
    expect(lum, `el fondo debería ser oscuro, es ${await fondoDelCuerpo(page)}`).toBeLessThan(0.1);
  });

  test("con `system` no se escribe el atributo, para que mande el sistema operativo", async () => {
    await fijarTema(page, "system");
    await page.goto("/app/dashboard", { waitUntil: "domcontentloaded" });
    // Escribir `data-theme="light"` por defecto anularía la media query por
    // especificidad y el oscuro del sistema no se activaría nunca solo.
    expect(await temaAplicado(page)).toBeNull();
  });

  test("`system` responde a la preferencia del sistema operativo", async ({ browser }) => {
    await fijarTema(page, "system");
    for (const [esquema, esperado] of [["dark", true], ["light", false]] as const) {
      const ctx = await browser.newContext({ colorScheme: esquema });
      await ctx.addCookies([{ name: COOKIE, value: "system", url: new URL(page.url()).origin }]);
      const p = await ctx.newPage();
      await p.goto("/home", { waitUntil: "domcontentloaded" });
      const lum = await p.evaluate(() => {
        const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
        if (!m) return 1;
        const [r, g, b] = m.slice(0, 3).map((n) => Number(n) / 255);
        const f = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      });
      expect(lum < 0.1, `con el sistema en ${esquema} la página debería ser ${esperado ? "oscura" : "clara"}`).toBe(esperado);
      await ctx.close();
    }
  });

  test("una elección explícita gana a la preferencia del sistema", async ({ browser }) => {
    // El sistema en oscuro y el usuario eligiendo claro: manda el usuario.
    const ctx = await browser.newContext({ colorScheme: "dark" });
    await ctx.addCookies([{ name: COOKIE, value: "light", url: new URL(page.url()).origin }]);
    const p = await ctx.newPage();
    await p.goto("/home", { waitUntil: "domcontentloaded" });
    expect(await p.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("light");
    await ctx.close();
  });

  test("no hay aviso de hidratación al aplicar el tema", async () => {
    const errores: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /hydrat|did not match|Text content does not match/i.test(m.text())) {
        errores.push(m.text().slice(0, 200));
      }
    });
    await fijarTema(page, "dark");
    await page.goto("/app/dashboard");
    await page.waitForTimeout(1200);
    expect(errores, `avisos de hidratación:\n${errores.join("\n")}`).toEqual([]);
  });

  test("lo que se pinta por portal hereda el tema", async () => {
    await fijarTema(page, "dark");
    await page.goto("/app/actions");
    await page.waitForSelector("#nf-main", { timeout: 30000 });

    // El contenedor de modales vive dentro del shell, bajo `<html>`: hereda las
    // variables por cascada. Se comprueba que EXISTE y que resuelve oscuro.
    const raiz = page.locator("#nf-modal-root");
    await expect(raiz).toHaveCount(1);

    const heredado = await page.evaluate(() => {
      const r = document.getElementById("nf-modal-root");
      if (!r) return null;
      return getComputedStyle(r).getPropertyValue("--nf-surface").trim();
    });
    expect(heredado, "el portal no resuelve los tokens del tema").toBe("#1a1c20");
  });

  test("los campos de formulario son legibles en oscuro", async () => {
    await fijarTema(page, "dark");
    await page.goto("/app/settings/organization");
    await page.waitForSelector("#nf-main", { timeout: 30000 });

    const legible = await page.evaluate(() => {
      const campo = document.querySelector<HTMLElement>(".nf-input, .nf-app-input");
      if (!campo) return null;
      const cs = getComputedStyle(campo);
      const lum = (c: string) => {
        const m = c.match(/[\d.]+/g);
        if (!m) return null;
        const [r, g, b] = m.slice(0, 3).map((n) => Number(n) / 255);
        const f = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const lf = lum(cs.color), lb = lum(cs.backgroundColor);
      if (lf === null || lb === null) return null;
      return (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
    });
    // Aquí estaba el bloqueante: `background: #fff !important` con el texto del
    // tema encima daba 1.11:1 en 49 ficheros.
    expect(legible ?? 0, "el campo no llega al mínimo de texto").toBeGreaterThanOrEqual(4.5);
  });

  test("la tabla de datos es legible en oscuro", async () => {
    await fijarTema(page, "dark");
    await page.goto("/app/documents");
    await page.waitForSelector("#nf-main", { timeout: 30000 });

    const claras = await page.evaluate(() => {
      const lum = (c: string) => {
        const m = c.match(/[\d.]+/g);
        if (!m) return 0;
        const [r, g, b] = m.slice(0, 3).map((n) => Number(n) / 255);
        const f = (x: number) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      return [...document.querySelectorAll("table, thead, tbody, tr, th, td")]
        .filter((e) => {
          const bg = getComputedStyle(e).backgroundColor;
          const m = bg.match(/[\d.]+/g);
          const a = m && m.length > 3 ? Number(m[3]) : 1;
          return a > 0.5 && lum(bg) > 0.55;
        })
        .map((e) => e.tagName.toLowerCase() + "." + (e.className || "").toString().slice(0, 40));
    });
    expect(claras, `partes claras de la tabla en oscuro:\n${claras.join("\n")}`).toEqual([]);
  });

  test("los reportes imprimibles conservan el papel blanco", async () => {
    await fijarTema(page, "dark");
    await page.goto("/app/reporting");
    await page.waitForSelector("#nf-main", { timeout: 30000 });
    await page.emulateMedia({ media: "print" });

    const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ media: "screen" });
    // El oscuro es de pantalla: imprimirlo gasta tinta y se lee peor.
    expect(fondo).toMatch(/rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0\)/);
  });
});
