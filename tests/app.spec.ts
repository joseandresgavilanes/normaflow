import { test, expect } from "@playwright/test";

type Page = import("@playwright/test").Page;

/**
 * Despliega un grupo del sidebar si está plegado.
 *
 * La navegación pasó de 35 enlaces planos + 11 grupos de norma a 8 grupos
 * semánticos colapsables, así que llegar a un módulo exige abrir su grupo.
 */
async function openGroup(page: Page, group: string) {
  const toggle = page.locator(".nf-sidenav__group-toggle", { hasText: group }).first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

/**
 * Abre un módulo normativo desde el grupo "Normas".
 *
 * Se localiza por `href` y no por etiqueta: `I18nDomBridge` reescribe los
 * nodos de texto del DOM ya renderizado (por ejemplo "Compliance" pasa a
 * "Conformidad"), así que el nombre accesible no es estable.
 *
 * Cada norma es un único destino en el sidebar. La sub-navegación vive ahora
 * en las pestañas del propio módulo (`ModuleTabs`), no en la columna global.
 */
async function openIsoModule(page: Page, href: string) {
  await openGroup(page, "Normas");
  await page.locator(`.nf-sidenav__link[href="${href}"]`).click();
}

/** Cambia de sección usando las pestañas del módulo. */
async function openSection(page: Page, section: string) {
  await page.getByRole("tab", { name: section, exact: true }).click();
  await expect(page.getByRole("tab", { name: section, exact: true })).toHaveAttribute("aria-selected", "true");
}

test.describe("SaaS Application", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto("/login");
    await page.fill("input[type='email']", "demo@normaflow.io");
    await page.fill("input[type='password']", "NormaFlow2025!");
    await page.click("button[type='submit']");
    await page.waitForURL(/\/app\/dashboard/, { timeout: 30000 });
  });

  test("dashboard shows KPIs and modules", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Módulos" })).toBeVisible();
    await expect(page.getByText("Actividad reciente")).toBeVisible();
    // Al menos un KPI porcentual visible (score de cumplimiento)
    await expect(page.locator("text=/\\d+%/").first()).toBeVisible();
  });

  test("sidebar navigation to risks", async ({ page }) => {
    await openGroup(page, "Riesgo y cumplimiento");
    await page.getByRole("link", { name: "Riesgos", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/risks/);
    await expect(page.getByRole("heading", { name: "Gestión de Riesgos" })).toBeVisible();
  });

  test("sidebar navigation to documents", async ({ page }) => {
    await openGroup(page, "Sistema de gestión");
    await page.getByRole("link", { name: "Documentos", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/documents/);
    await expect(page.getByRole("heading", { name: "Control de Documentos" })).toBeVisible();
  });

  test("documents filter works", async ({ page }) => {
    await page.goto("/app/documents");
    await expect(page.getByRole("heading", { name: "Control de Documentos" })).toBeVisible();
    await page.getByRole("button", { name: "Aprobados" }).first().click();
    await expect(page.getByRole("button", { name: "Aprobados" }).first()).toBeVisible();
  });

  test("GAP assessment shows chart", async ({ page }) => {
    await page.goto("/app/gap");
    await expect(page.getByRole("heading", { name: "GAP Assessment" })).toBeVisible();
    await expect(page.getByText("Cumplimiento Global")).toBeVisible();
    await expect(page.getByRole("button", { name: "ISO 27001:2022" })).toBeVisible();
  });

  test("setup guide shows implementation checklist", async ({ page }) => {
    await page.goto("/app/setup");
    await expect(page.getByRole("heading", { name: "Implementación guiada" })).toBeVisible();
    await expect(page.getByText("Base organizativa")).toBeVisible();
  });

  test("billing page shows current plan", async ({ page }) => {
    await page.goto("/app/billing");
    await expect(page.getByRole("heading", { name: /Billing y suscripción/i })).toBeVisible();
    // Acotado al contenido: el sidebar también rotula "Growth" en el badge de
    // los módulos bloqueados por plan.
    await expect(page.locator("#nf-main").getByText("Growth").first()).toBeVisible();
  });

  test("sidebar navigation to environmental management (ISO 14001)", async ({ page }) => {
    await openIsoModule(page, "/app/environment");
    await expect(page).toHaveURL(/\/app\/environment/);
    await expect(page.getByRole("heading", { name: "Gestión Ambiental" })).toBeVisible();
    await openSection(page, "Biodiversidad");
    await expect(page.getByRole("heading", { name: "Biodiversidad", level: 1 })).toBeVisible();
    await expect(page.getByText("Reserva Río Claro")).toBeVisible();
  });

  test("sidebar navigation to occupational health & safety (ISO 45001)", async ({ page }) => {
    await openIsoModule(page, "/app/safety");
    await expect(page).toHaveURL(/\/app\/safety/);
    await expect(page.getByRole("heading", { name: "Seguridad y Salud en el Trabajo" })).toBeVisible();
  });

  test("sidebar navigation to the Integrated Management System (SIG)", async ({ page }) => {
    await openIsoModule(page, "/app/integrated");
    await expect(page).toHaveURL(/\/app\/integrated/);
    await expect(page.getByRole("heading", { name: "Sistema Integrado de Gestión" })).toBeVisible();
  });

  test("sidebar navigation to business continuity (ISO 22301)", async ({ page }) => {
    await openIsoModule(page, "/app/continuity");
    await expect(page).toHaveURL(/\/app\/continuity/);
    await expect(page.getByRole("heading", { name: "Continuidad de negocio" })).toBeVisible();
    await openSection(page, "BIA y actividades");
    await expect(page.getByText("Análisis de Impacto en el Negocio")).toBeVisible();
  });

  test("sidebar navigation to AI management (ISO/IEC 42001)", async ({ page }) => {
    await openIsoModule(page, "/app/aims");
    await expect(page).toHaveURL(/\/app\/aims/);
    await expect(page.getByRole("heading", { name: "Sistema de Gestión de Inteligencia Artificial" })).toBeVisible();
    await openSection(page, "Sistemas y casos de uso");
    await expect(page.getByText("IA-0001").first()).toBeVisible();
  });

  test("sidebar navigation to compliance management (ISO 37301)", async ({ page }) => {
    await openIsoModule(page, "/app/compliance");
    await expect(page).toHaveURL(/\/app\/compliance/);
    await expect(page.getByRole("heading", { name: "Sistema de Gestión de Compliance" })).toBeVisible();
    await openSection(page, "Obligaciones de compliance");
    await expect(page.getByText("OBL-0001").first()).toBeVisible();
    await openSection(page, "Canal de denuncias");
    await expect(page.getByText("Configuración del canal")).toBeVisible();
  });

  test("sidebar navigation to energy management (ISO 50001)", async ({ page }) => {
    await openIsoModule(page, "/app/energy");
    await expect(page).toHaveURL(/\/app\/energy/);
    await expect(page.getByRole("heading", { name: "Gestión de la Energía" })).toBeVisible();
    await openSection(page, "Fuentes y usos");
    await expect(page.getByText("FUE-0001").first()).toBeVisible();
  });

  test("sidebar navigation to food safety management (ISO 22000)", async ({ page }) => {
    await openIsoModule(page, "/app/food-safety");
    await expect(page).toHaveURL(/\/app\/food-safety/);
    await expect(page.getByRole("heading", { name: "Inocuidad alimentaria (HACCP)" })).toBeVisible();
    await openSection(page, "Trazabilidad");
    await expect(page.getByText("LOT-0001").first()).toBeVisible();
  });

  test("sidebar navigation to IT service management (ISO/IEC 20000)", async ({ page }) => {
    await openIsoModule(page, "/app/itsm");
    await expect(page).toHaveURL(/\/app\/itsm/);
    await expect(page.getByRole("heading", { name: "Gestión de servicios TI (ITSM)" })).toBeVisible();
    await openSection(page, "Incidentes de servicio");
    await expect(page.getByText("INC-0001").first()).toBeVisible();
  });

  test("sidebar navigation to medical device QMS (ISO 13485)", async ({ page }) => {
    await openIsoModule(page, "/app/medical-devices");
    await expect(page).toHaveURL(/\/app\/medical-devices/);
    await expect(page.getByRole("heading", { name: "Calidad de dispositivos médicos" })).toBeVisible();
    await openSection(page, "Expedientes de diseño (DHF)");
    await expect(page.getByText("DHF-0001").first()).toBeVisible();
  });

  test("sidebar navigation to anti-bribery management (ISO 37001)", async ({ page }) => {
    await openIsoModule(page, "/app/antibribery");
    await expect(page).toHaveURL(/\/app\/antibribery/);
    await expect(page.getByRole("heading", { name: "Sistema de Gestión Antisoborno" })).toBeVisible();
    await openSection(page, "Beneficiarios finales");
    await expect(page.getByText("UBO-0001").first()).toBeVisible();
  });
});
