/**
 * Capturas de QA visual del tema, en las dos apariencias y cuatro anchos.
 *
 * Se hace en una sola sesión de navegador y no repartiendo agentes: el servidor
 * de desarrollo es un recurso compartido y varias sesiones en paralelo compiten
 * por él, así que el resultado sería más lento y menos reproducible.
 *
 * El tema se fija por la MISMA cookie que usa el producto, no con un
 * `setAttribute`: así se captura el camino real —servidor pinta `data-theme` en
 * el HTML inicial— y una captura sin destello es prueba de que no lo hay.
 *
 * Uso:  npx tsx scripts/dark-mode-shots.ts [outDir]
 *       SHOT_ROUTES=/app/documents,/home   (acota)
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3000";
const OUT = process.argv[2] ?? path.join(process.cwd(), "dark-shots");

/** Los cuatro anchos del contrato responsive que pide el QA. */
const ANCHOS = [
  { nombre: "390", width: 390, height: 844 },
  { nombre: "768", width: 768, height: 1024 },
  { nombre: "1280", width: 1280, height: 800 },
  { nombre: "1440", width: 1440, height: 900 },
];

/** Una ruta representativa de cada familia de pantalla. */
const RUTAS = [
  "/home",
  "/pricing",
  "/login",
  "/app/dashboard",
  "/app/documents",
  "/app/risks",
  "/app/actions",
  "/app/standards",
  "/app/settings/organization",
  "/app/reporting",
];

const rutas = (process.env.SHOT_ROUTES ?? "").split(",").map((r) => r.trim()).filter(Boolean);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const navegador = await chromium.launch();
  const objetivo = rutas.length ? rutas : RUTAS;
  let n = 0;

  for (const tema of ["light", "dark"] as const) {
    for (const ancho of ANCHOS) {
      const ctx = await navegador.newContext({
        viewport: { width: ancho.width, height: ancho.height },
        deviceScaleFactor: 1,
      });
      const login = await ctx.request.post(BASE + "/api/auth/login", {
        data: { email: "demo@normaflow.io", password: "NormaFlow2025!" },
        timeout: 120000,
      });
      if (!login.ok()) throw new Error(`login falló: ${login.status()}`);
      await ctx.addCookies([{ name: "nf_theme", value: tema, url: BASE }]);
      const page = await ctx.newPage();

      for (const ruta of objetivo) {
        const nombre = ruta.replace(/^\//, "").replace(/\//g, "-") || "raiz";
        try {
          await page.goto(BASE + ruta, { waitUntil: "domcontentloaded", timeout: 60000 });
          await page.waitForTimeout(800);
          const aplicado = await page.evaluate(() => document.documentElement.dataset.theme ?? "sistema");
          if (aplicado !== tema) {
            console.warn(`  ⚠ ${ruta} @${ancho.nombre} pedía ${tema} y aplicó ${aplicado}`);
          }
          await page.screenshot({
            path: path.join(OUT, `${nombre}__${tema}__${ancho.nombre}.png`),
            fullPage: false,
          });
          n += 1;
        } catch (e) {
          console.warn(`  ✗ ${ruta} @${ancho.nombre} ${tema}: ${(e as Error).message.slice(0, 90)}`);
        }
      }
      console.log(`${tema} @${ancho.nombre}: ${objetivo.length} rutas`);
      await ctx.close();
    }
  }

  await navegador.close();
  console.log(`\n${n} capturas en ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
