import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const baseURL = process.env.MANUAL_BASE_URL ?? "http://127.0.0.1:3200";
const outputDir = process.env.MANUAL_SCREENSHOTS_DIR ?? "docs/manual/screenshots";

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: "es-ES",
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();

async function save(name, path, options = {}) {
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1, h2").first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await page.screenshot({
    path: `${outputDir}/${name}.png`,
    fullPage: true,
    ...options,
  });
  const heading = await page.locator("h1, h2").first().textContent().catch(() => "");
  console.log(`${name}: ${path} — ${heading?.trim() ?? ""}`);
}

await save("01-login", "/login");

await page.locator("input[type='email']").fill("demo@normaflow.io");
await page.locator("input[type='password']").fill("NormaFlow2025!");
await page.locator("button[type='submit']").click();
await page.waitForURL(/\/app\/dashboard/);

await page.screenshot({ path: `${outputDir}/02-dashboard.png`, fullPage: true });

const pages = [
  ["03-setup", "/app/setup"],
  ["04-gap", "/app/gap"],
  ["05-documents", "/app/documents"],
  ["06-processes", "/app/processes"],
  ["07-risks", "/app/risks"],
  ["08-audits", "/app/audits"],
  ["09-nonconformities", "/app/nonconformities"],
  ["10-actions", "/app/actions"],
  ["11-indicators", "/app/indicators"],
  ["12-evidence", "/app/evidence"],
  ["13-training", "/app/training"],
  ["14-reporting", "/app/reporting"],
  ["15-management-review", "/app/management-review"],
  ["16-notifications", "/app/notifications"],
  ["20-records", "/app/records"],
  ["21-suppliers", "/app/suppliers"],
  ["22-changes", "/app/changes"],
  ["23-audit-program", "/app/audit-program"],
  ["24-integrations", "/app/integrations"],
  ["25-activity", "/app/activity"],
  ["26-billing", "/app/billing"],
  ["27-settings", "/app/settings"],
];

for (const [name, path] of pages) await save(name, path);

await page.goto(`${baseURL}/app/documents`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /nuevo documento/i }).click();
await page.screenshot({ path: `${outputDir}/17-new-document.png`, fullPage: true });

await page.goto(`${baseURL}/app/risks`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /nuevo riesgo/i }).click();
await page.screenshot({ path: `${outputDir}/18-new-risk.png`, fullPage: true });

await page.goto(`${baseURL}/app/gap`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /sugerencia|plan de acción|analizar/i }).first().click().catch(() => {});
await page.screenshot({ path: `${outputDir}/19-gap-interaction.png`, fullPage: true });

await browser.close();
