import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/normaflow";

/**
 * Cabecera de página en todas las rutas del workspace.
 *
 * El barrido inicial no encontró un solo `<h1>` en las 83 rutas: la jerarquía
 * del documento empezaba en `<h2>` y no había migas de pan en ninguna parte.
 * Estos casos fijan el contrato para que no vuelva a perderse.
 */

const RUTAS = [
  "/app/dashboard", "/app/setup", "/app/standards", "/app/context", "/app/quality-ops",
  "/app/design-dev", "/app/gap", "/app/documents", "/app/records", "/app/training",
  "/app/changes", "/app/processes", "/app/risks", "/app/opportunities", "/app/suppliers",
  "/app/audit-program", "/app/audits", "/app/management-review", "/app/nonconformities",
  "/app/actions", "/app/indicators", "/app/evidence", "/app/security-controls",
  "/app/assets", "/app/soa", "/app/risk-treatment", "/app/incidents", "/app/vulnerabilities",
  "/app/suppliers/security", "/app/integrations", "/app/reporting", "/app/activity",
  "/app/notifications", "/app/billing", "/app/settings", "/app/settings/organization",
  "/app/settings/users", "/app/settings/groups", "/app/settings/catalogs",
  "/app/info/positions", "/app/info/personnel", "/app/catalogs/locations",
  "/app/catalogs/retention", "/app/catalogs/disposition", "/app/catalogs/archive-method",
  "/app/catalogs/record-type", "/app/continuity", "/app/environment", "/app/energy",
  "/app/food-safety", "/app/itsm", "/app/medical-devices", "/app/safety", "/app/aims",
  "/app/compliance", "/app/antibribery", "/app/integrated",
];

async function sondear(page: Page, ruta: string) {
  await page.goto(ruta, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const h1s = Array.from(document.querySelectorAll("h1"));
    return {
      h1: h1s.length,
      texto: (h1s[0]?.textContent ?? "").trim(),
      // Las migas no se pintan en el panel: allí serían un nivel redundante.
      migas: document.querySelectorAll(".nf-breadcrumb").length,
      main: document.querySelectorAll("main#nf-main").length,
    };
  });
}

test.describe("Cabecera de página", () => {
  test.describe.configure({ mode: "serial" });
  // Recorre decenas de rutas y en desarrollo cada primera visita compila.
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
    await page?.context().close();
  });

  test("cada ruta declara exactamente un <h1> con texto", async () => {
    const fallos: string[] = [];
    for (const ruta of RUTAS) {
      const r = await sondear(page, ruta);
      if (r.h1 !== 1) fallos.push(`${ruta}: ${r.h1} <h1>`);
      else if (!r.texto) fallos.push(`${ruta}: <h1> vacío`);
    }
    expect(fallos, `rutas sin un único <h1> con texto:\n${fallos.join("\n")}`).toEqual([]);
  });

  test("todas las rutas tienen landmark main y migas", async () => {
    const fallos: string[] = [];
    for (const ruta of RUTAS) {
      const r = await sondear(page, ruta);
      if (r.main !== 1) fallos.push(`${ruta}: main#nf-main = ${r.main}`);
      if (ruta !== "/app/dashboard" && r.migas !== 1) fallos.push(`${ruta}: migas = ${r.migas}`);
    }
    expect(fallos, `problemas de landmark o migas:\n${fallos.join("\n")}`).toEqual([]);
  });
});
