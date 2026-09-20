import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const baseURL = process.env.MANUAL_BASE_URL ?? "http://127.0.0.1:3200";
const outputDir = process.env.MANUAL_SCREENSHOTS_DIR ?? "docs/manual/screenshots";

/** Recorte máximo: una captura más alta se vuelve ilegible al escalarla a A4. */
const MAX_HEIGHT = 2400;

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: "es-ES",
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

async function settle() {
  await page.locator("h1, h2").first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  // Los módulos live hidratan tras la primera pintura; esperar evita capturar esqueletos.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
}

async function shoot(name) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  const options = height > MAX_HEIGHT
    ? { clip: { x: 0, y: 0, width: Math.min(width, 1440), height: MAX_HEIGHT } }
    : { fullPage: true };
  await page.screenshot({ path: `${outputDir}/${name}.png`, ...options });
  const heading = await page.locator("h1, h2").first().textContent().catch(() => "");
  console.log(`${name} — ${(heading ?? "").trim().slice(0, 60)}${height > MAX_HEIGHT ? " [recortada]" : ""}`);
}

async function save(name, path) {
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await settle();
  await shoot(name);
}

// ── Acceso ────────────────────────────────────────────────────────────────
await save("01-login", "/login");

await page.locator("input[type='email']").fill(process.env.DEMO_EMAIL ?? "demo@normaflow.io");
await page.locator("input[type='password']").fill(process.env.DEMO_PASSWORD ?? "NormaFlow2025!");
await page.locator("button[type='submit']").click();
await page.waitForURL(/\/app\//, { timeout: 30000 });
await settle();

/** Rutas del sidebar, en el mismo orden que `NAV_GROUPS` en src/lib/navigation.ts. */
const pages = [
  // Inicio
  ["02-dashboard", "/app/dashboard"],
  ["03-setup", "/app/setup"],
  ["04-notifications", "/app/notifications"],
  ["05-activity", "/app/activity"],
  // Sistema de gestión
  ["06-context", "/app/context"],
  ["07-processes", "/app/processes"],
  ["08-documents", "/app/documents"],
  ["09-records", "/app/records"],
  ["10-evidence", "/app/evidence"],
  ["11-changes", "/app/changes"],
  ["12-quality-ops", "/app/quality-ops"],
  ["13-design-dev", "/app/design-dev"],
  // Riesgo y cumplimiento
  ["14-risks", "/app/risks"],
  ["15-opportunities", "/app/opportunities"],
  ["16-risk-treatment", "/app/risk-treatment"],
  ["17-security-controls", "/app/security-controls"],
  ["18-soa", "/app/soa"],
  ["19-assets", "/app/assets"],
  ["20-incidents", "/app/incidents"],
  ["21-vulnerabilities", "/app/vulnerabilities"],
  // Evaluación
  ["22-gap", "/app/gap"],
  ["23-audit-program", "/app/audit-program"],
  ["24-audits", "/app/audits"],
  ["25-indicators", "/app/indicators"],
  ["26-management-review", "/app/management-review"],
  ["27-reporting", "/app/reporting"],
  // Mejora
  ["28-nonconformities", "/app/nonconformities"],
  ["29-actions", "/app/actions"],
  // Personas y terceros
  ["30-personnel", "/app/info/personnel"],
  ["31-positions", "/app/info/positions"],
  ["32-training", "/app/training"],
  ["33-suppliers", "/app/suppliers"],
  ["34-suppliers-security", "/app/suppliers/security"],
  // Normas — panel + una sección representativa de cada una
  ["35-standards", "/app/standards"],
  ["36-standards-catalog", "/app/standards?section=catalog"],
  ["37-standards-matrix", "/app/standards?section=matrix"],
  ["38-integrated", "/app/integrated"],
  ["39-integrated-crosswalk", "/app/integrated?section=crosswalk"],
  ["40-environment", "/app/environment"],
  ["41-environment-matrix", "/app/environment?section=matrix"],
  ["42-safety", "/app/safety"],
  ["43-safety-hazards", "/app/safety?section=hazards"],
  ["44-continuity", "/app/continuity"],
  ["45-continuity-bia", "/app/continuity?section=bia"],
  ["46-aims", "/app/aims"],
  ["47-aims-systems", "/app/aims?section=systems"],
  ["48-compliance", "/app/compliance"],
  ["49-compliance-obligations", "/app/compliance?section=obligations"],
  ["50-antibribery", "/app/antibribery"],
  ["51-antibribery-due-diligence", "/app/antibribery?section=due-diligence"],
  ["52-energy", "/app/energy"],
  ["53-energy-enpi", "/app/energy?section=enpi"],
  ["54-food-safety", "/app/food-safety"],
  ["55-food-safety-ccp", "/app/food-safety?section=ccp"],
  ["56-itsm", "/app/itsm"],
  ["57-itsm-sla", "/app/itsm?section=sla"],
  ["58-medical-devices", "/app/medical-devices"],
  ["59-medical-devices-design", "/app/medical-devices?section=design"],
  // Administración
  ["60-settings-organization", "/app/settings/organization"],
  ["61-settings-users", "/app/settings/users"],
  ["62-settings-groups", "/app/settings/groups"],
  ["63-settings-catalogs", "/app/settings/catalogs"],
  ["64-catalogs-locations", "/app/catalogs/locations"],
  ["65-catalogs-retention", "/app/catalogs/retention"],
  ["66-catalogs-disposition", "/app/catalogs/disposition"],
  ["67-catalogs-archive-method", "/app/catalogs/archive-method"],
  ["68-catalogs-record-type", "/app/catalogs/record-type"],
  ["69-integrations", "/app/integrations"],
  ["70-billing", "/app/billing"],
  ["71-settings", "/app/settings"],
];

for (const [name, path] of pages) {
  try {
    await save(name, path);
  } catch (error) {
    console.error(`FALLO ${name} (${path}): ${error.message}`);
  }
}

// ── Interacciones ─────────────────────────────────────────────────────────
async function interaction(name, path, action) {
  try {
    await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
    await settle();
    await action();
    await page.waitForTimeout(900);
    await shoot(name);
  } catch (error) {
    console.error(`FALLO ${name} (${path}): ${error.message}`);
  }
}

await interaction("72-new-document", "/app/documents", async () => {
  await page.getByRole("button", { name: /nuevo documento/i }).first().click();
});

await interaction("73-new-risk", "/app/risks", async () => {
  await page.getByRole("button", { name: /nuevo riesgo/i }).first().click();
});

await interaction("74-gap-clause", "/app/gap", async () => {
  await page.getByRole("button", { name: /sugerencia|plan de acción|analizar|responder/i }).first().click();
});

await browser.close();
