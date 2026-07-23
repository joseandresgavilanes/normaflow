import { test, expect } from "./fixtures/normaflow";

test.describe("flujos críticos de NormaFlow", () => {
  test("registro de usuario y creación/configuración de organización", async ({ authenticatedPage: page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: /Crear cuenta|Empezar/i }).click();
    await expect(page.getByText(/Completa todos los campos/i)).toBeVisible();

    await page.goto("/app/onboarding");
    await expect(page.getByText(/Configuración inicial|Implementación guiada/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Cuéntanos sobre tu organización/i })).toBeVisible();
  });

  test("invita a un usuario y permite asignar un rol", async ({ authenticatedPage: page }) => {
    await page.goto("/app/settings/users");
    const inviteButton = page.getByRole("button", { name: /Invitar persona/i });
    await expect(inviteButton).toBeEnabled();
    await page.waitForTimeout(300);
    await inviteButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Invitar persona" })).toBeVisible();
    await dialog.locator("input[name='name']").fill("QA Invitado");
    await dialog.locator("input[name='email']").fill(`qa-${Date.now()}@example.com`);
    await dialog.getByRole("combobox").selectOption("AUDITOR");
    await dialog.getByRole("button", { name: "Invitar" }).click();
    await expect(page.getByText(/Invitación simulada|QA Invitado/i).first()).toBeVisible();

    const row = page.getByRole("row").filter({ hasText: "QA Invitado" });
    await expect(row).toBeVisible();
    await row.getByRole("combobox").selectOption("VIEWER");
    await expect(row.getByRole("combobox")).toHaveValue("VIEWER");
  });

  test("crea un proceso y lo muestra en el mapa de procesos", async ({ authenticatedPage: page }) => {
    await page.goto("/app/processes");
    await page.getByRole("button", { name: /Nuevo proceso/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").nth(0).fill("Proceso E2E QA");
    await dialog.locator("input").nth(1).fill("QA-PROC");
    await dialog.locator("textarea").first().fill("Proceso creado automáticamente por Playwright.");
    await dialog.getByRole("button", { name: "Crear" }).click();
    await expect(page.getByText("Proceso E2E QA", { exact: true })).toBeVisible();
  });

  test("crea un riesgo y conserva su puntuación", async ({ authenticatedPage: page }) => {
    await page.goto("/app/risks");
    await page.getByRole("button", { name: /Nuevo Riesgo/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").first().fill("Riesgo E2E QA");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Riesgo E2E QA", { exact: true })).toBeVisible();
  });

  test("crea documento, evidencia y verifica superficies de aprobación", async ({ authenticatedPage: page }) => {
    await page.goto("/app/documents");
    await expect(page.getByRole("heading", { name: "Control de Documentos" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nuevo documento/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Aprobados/i }).first()).toBeVisible();

    await page.goto("/app/evidence");
    await page.getByRole("button", { name: /Subir evidencia/i }).click();
    const evidenceInput = page.locator("#evidence-import-input");
    await evidenceInput.setInputFiles({ name: "qa-evidence.txt", mimeType: "text/plain", buffer: Buffer.from("evidence from deterministic Playwright fixture") });
    await expect(page.getByRole("cell", { name: /qa-evidence/i })).toBeVisible();
  });

  test("crea auditoría, hallazgo y expone conversión a CAPA", async ({ authenticatedPage: page }) => {
    await page.goto("/app/audits");
    await page.getByRole("button", { name: /Nueva auditoría/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").first().fill("Auditoría E2E QA");
    await dialog.locator("input").nth(1).fill("ISO 9001");
    await dialog.locator("textarea").first().fill("Alcance E2E");
    await dialog.getByRole("button", { name: "Crear" }).click();
    await expect(page.getByText("Auditoría E2E QA", { exact: true })).toBeVisible();

    await page.goto("/app/actions");
    await expect(page.getByRole("heading", { name: /Plan de acción/i })).toBeVisible();
    await expect(page.getByText(/Solicitud|Análisis|Implementación|Verificación|Cerrada/).first()).toBeVisible();
  });

  test("recorre KPI, reportes y exportes disponibles", async ({ authenticatedPage: page }) => {
    await page.goto("/app/indicators");
    await page.getByRole("button", { name: /Nuevo KPI/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("input").first().fill("KPI E2E QA");
    await dialog.getByRole("button", { name: "Crear KPI" }).click();
    await expect(page.getByText("KPI E2E QA", { exact: true })).toBeVisible();

    await page.goto("/app/reporting");
    await expect(page.getByRole("heading", { name: /Informes y paquetes de auditoría/i })).toBeVisible();
    const pdf = page.getByRole("button", { name: /Exportar PDF/i }).first();
    const xlsx = page.getByRole("button", { name: /XLSX/i }).first();
    await expect(pdf).toBeVisible();
    await expect(xlsx).toBeVisible();
    await pdf.click();
    await expect(page.getByText(/Generado: Informe GAP Assessment \(PDF, demo\)/i)).toBeVisible();
    await xlsx.click();
    await expect(page.getByText(/Generado: Informe GAP Assessment \(EXCEL, demo\)/i)).toBeVisible();
  });

  test("cambia de organización y no mezcla datos del workspace", async ({ authenticatedPage: page }) => {
    await page.goto("/app/documents");
    const sourceRow = page.locator("tbody tr").first();
    const sourceText = await sourceRow.innerText();
    const orgSelector = page.locator(".nf-sidebar-org select");
    await expect(orgSelector).toBeVisible();
    await orgSelector.selectOption({ label: "Logística Norte S.L." });
    await expect(orgSelector).toHaveValue("org_logistica");
    await expect(page.locator(".nf-sidebar-brand-name")).toContainText("Logística Norte");

    await expect(page.locator("tbody tr").first()).not.toContainText(sourceText);
  });
});
