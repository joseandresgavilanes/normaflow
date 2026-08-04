import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readLiveState, type LiveActor, type LiveFixtureState } from "./support";

test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;

async function login(page: Page, actor: LiveActor) {
  await page.goto("/login");
  await page.locator("input[type='email']").fill(actor.email);
  await page.locator("input[type='password']").fill(actor.password);
  await page.getByRole("button", { name: /^Entrar/ }).click();
  await page.waitForURL(/\/app\/dashboard/);
}

async function gotoStable(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) throw error;
    await page.goto(url);
  }
}

async function processQueuedReport(page: Page, format: "PDF" | "EXCEL") {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) throw new Error("CRON_SECRET es obligatorio para verificar el worker de reportes live.");
  const prisma = new PrismaClient();
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await page.request.post("/api/cron/report-delivery", { headers: { authorization: `Bearer ${cronSecret}` } });
      expect(response.ok()).toBeTruthy();
      const artifact = await prisma.reportExport.findFirst({ where: { organizationId: state.actorA.organizationId, format }, orderBy: { createdAt: "desc" }, select: { status: true, error: true, attempts: true } });
      if (artifact?.status === "COMPLETED") return;
      if (artifact?.error) {
        throw new Error(`El worker no completó el reporte: ${JSON.stringify(artifact)}`);
      }
      await page.waitForTimeout(250);
    }
  } finally {
    await prisma.$disconnect();
  }
  throw new Error("El reporte no llegó a la cola del worker dentro del plazo de la prueba.");
}

const file = (name: string, contents = "deterministic Playwright evidence") => ({
  name,
  mimeType: "text/plain",
  buffer: Buffer.from(contents),
});

test.describe("NormaFlow critical live journey", () => {
  test.beforeAll(() => {
    state = readLiveState();
  });

  test("registro, organización, invitación y cambio de rol", async ({ page }) => {
    await test.step("el registro muestra validación y el usuario seed puede iniciar sesión", async () => {
      await page.goto("/signup");
      await page.getByRole("button", { name: /Crear cuenta|Empezar/i }).click();
      await expect(page.getByText(/Completa todos los campos/i)).toBeVisible();
      await login(page, state.actorA);
      await expect(page).toHaveURL(/\/app\/dashboard/);
    });

    await test.step("invitar persona y asignar rol", async () => {
      const name = `E2E Invitado ${state.runId}`;
      const email = `normaflow-invite-${state.runId}@example.com`;
      await page.goto("/app/settings/users");
      const invite = page.getByRole("button", { name: /Invitar persona/i });
      await expect(invite).toBeEnabled();
      await invite.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Invitar persona" })).toBeVisible();
      await dialog.locator("input[name='name']").fill(name);
      await dialog.locator("input[name='email']").fill(email);
      await dialog.locator("select[name='role']").selectOption("AUDITOR");
      await dialog.getByRole("button", { name: "Invitar" }).click();
      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await row.getByRole("combobox").selectOption("VIEWER");
      await expect(row.getByRole("combobox")).toHaveValue("VIEWER");
    });
  });

  test("crea proceso, riesgo, KPI y evidencia con datos deterministas", async ({ page }) => {
    await login(page, state.actorA);

    await test.step("crear proceso", async () => {
      await page.goto("/app/processes");
      await page.getByRole("button", { name: "Nuevo proceso" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("input[name='name']").fill(`Proceso E2E ${state.runId}`);
      await dialog.locator("input[name='code']").fill(`E2E-${state.runId.slice(-8)}`);
      await dialog.locator("textarea[name='description']").fill("Proceso creado por la suite live.");
      await dialog.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText(`Proceso E2E ${state.runId}`, { exact: true })).toBeVisible();
    });

    await test.step("registrar riesgo", async () => {
      await page.goto("/app/risks");
      await page.getByRole("button", { name: /Nuevo riesgo/i }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("input[name='title']").fill(`Riesgo E2E ${state.runId}`);
      await dialog.locator("textarea[name='description']").fill("Riesgo creado por Playwright.");
      await dialog.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText(`Riesgo E2E ${state.runId}`, { exact: true })).toBeVisible();
    });

    await test.step("crear KPI", async () => {
      await page.goto("/app/indicators");
      await page.getByRole("button", { name: "Nuevo indicador" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("input[name='name']").fill(`KPI E2E ${state.runId}`);
      await dialog.locator("input[name='unit']").fill("%");
      await dialog.locator("input[name='target']").fill("95");
      await dialog.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText(`KPI E2E ${state.runId}`, { exact: true })).toBeVisible();
    });

    await test.step("subir evidencia a Storage", async () => {
      await page.goto("/app/evidence");
      await page.getByRole("button", { name: "Subir evidencia" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("input[name='title']").fill(`Evidencia E2E ${state.runId}`);
      await dialog.locator("input[name='file']").setInputFiles(file(`evidence-${state.runId}.txt`));
      await dialog.getByRole("button", { name: "Subir" }).click();
      await expect(page.getByText(`Evidencia E2E ${state.runId}`, { exact: true })).toBeVisible();
    });
  });

  test("crea, versiona y aprueba un documento controlado", async ({ page }) => {
    await login(page, state.actorA);
    const title = `Documento E2E ${state.runId}`;
    const code = `E2E-DOC-${state.runId.slice(-8)}`;

    await page.goto("/app/documents");
    await page.getByRole("button", { name: /Nuevo documento/i }).click();
    let dialog = page.getByRole("dialog");
    await dialog.locator("input[name='code']").fill(code);
    await dialog.locator("input[name='title']").fill(title);
    await dialog.getByRole("button", { name: "Crear documento" }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.getByText(title, { exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Subir versión" }).click();
    dialog = page.getByRole("dialog").last();
    await dialog.locator("input[type='file']").setInputFiles(file(`document-${state.runId}.txt`, "version 1"));
    await dialog.locator("textarea").fill("Versión inicial para revisión.");
    const reviewer = dialog.locator("input[type='checkbox']").first();
    if (await reviewer.count()) await reviewer.check();
    await dialog.getByRole("button", { name: /Subir (?:versión|y enviar a revisión)/i }).click();

    await page.goto("/app/documents");
    await page.getByText(title, { exact: true }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /Aprobar/ })).toBeVisible();
    await dialog.getByRole("button", { name: /Aprobar/ }).click();
    await expect(page.getByText(/Documento aprobado|APROBADO/i).first()).toBeVisible();
  });

  test("planifica auditoría, registra hallazgo y expone conversión a CAPA", async ({ page }) => {
    await login(page, state.actorA);
    const title = `Auditoría E2E ${state.runId}`;
    await page.goto("/app/audits");
    await page.getByRole("button", { name: "Nueva auditoría" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.locator("input[name='title']").fill(title);
    await dialog.locator("input[name='standardCode']").fill("ISO_9001");
    await dialog.locator("textarea[name='scope']").fill("Alcance de auditoría live.");
    await dialog.locator("textarea[name='criteria']").fill("ISO 9001:2015");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await page.getByRole("button", { name: "Lista de ejecución" }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    await page.getByText(title, { exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Iniciar auditoría" }).click();
    await dialog.getByRole("button", { name: "Añadir pregunta" }).click();
    let nestedDialog = page.getByRole("dialog", { name: "Nueva pregunta de checklist" });
    await nestedDialog.locator("textarea[name='question']").fill("¿Se mantiene el control documentado?");
    await nestedDialog.getByRole("button", { name: "Guardar" }).click();
    await expect(nestedDialog).toBeHidden();

    await page.getByRole("heading", { name: title, exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Registrar hallazgo" }).click();
    nestedDialog = page.getByRole("dialog", { name: "Registrar hallazgo" });
    await nestedDialog.locator("input[name='title']").fill(`Hallazgo E2E ${state.runId}`);
    await nestedDialog.locator("textarea[name='description']").fill("Hallazgo creado por el flujo crítico live.");
    await nestedDialog.getByRole("button", { name: "Guardar" }).click();
    await expect(nestedDialog).toBeHidden();
    const auditCard = page.locator(".nf-operational-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(auditCard.getByText("1 hallazgos · 0 NC", { exact: true })).toBeVisible();
    await auditCard.click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`Hallazgo E2E ${state.runId}`, { exact: false })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Convertir a CAPA" })).toBeVisible();
    await dialog.getByRole("button", { name: "Convertir a CAPA" }).click();
    await expect(page.getByText(/Hallazgo convertido en CAPA/i)).toBeVisible();
  });

  test("cierra CAPA únicamente con evidencia y verificación eficaz", async ({ page }) => {
    await login(page, state.actorA);
    const capaTitle = `Hallazgo E2E ${state.runId}`;
    await page.goto("/app/actions");
    const capaRow = page.getByRole("row").filter({ hasText: capaTitle });
    await expect(capaRow).toBeVisible();
    await capaRow.click();
    let dialog = page.getByRole("dialog");

    await test.step("evidencia de la no conformidad", async () => {
      await dialog.locator("input[name='title']").fill(`Evidencia NC ${state.runId}`);
      await dialog.locator("input[type='file']").last().setInputFiles(file(`capa-nc-${state.runId}.txt`));
      await dialog.getByRole("button", { name: "Adjuntar" }).click();
      await expect(dialog.getByText(`Evidencia NC ${state.runId}`, { exact: false })).toBeVisible();
    });

    await dialog.getByRole("button", { name: "Avanzar a Causa raíz" }).click();
    await expect(dialog.getByText("2. Causa raíz", { exact: true })).toBeVisible();
    await dialog.locator("textarea[name='rootCause']").fill("Falta de revisión periódica documentada.");
    await dialog.locator("input[name='why1']").fill("No existía un calendario de revisión.");
    const saveStage = dialog.getByRole("button", { name: "Guardar etapa" });
    await saveStage.click();
    await expect(saveStage).toBeDisabled();
    await expect(saveStage).toBeEnabled();
    const approveRootCause = dialog.getByRole("button", { name: "Aprobar causa raíz" });
    await approveRootCause.click();
    await expect(approveRootCause).toBeHidden();
    const advanceToPlan = dialog.getByRole("button", { name: "Avanzar a Plan de acción" });
    await expect(advanceToPlan).toBeEnabled();
    await advanceToPlan.click();
    await expect(dialog.getByText("3. Plan de acción", { exact: true })).toBeVisible();

    await dialog.locator("textarea[name='correctiveAction']").fill("Implantar calendario y responsable de revisión.");
    await dialog.locator("select[name='ownerId']").selectOption({ index: 1 });
    await dialog.locator("input[name='dueDate']").fill("2027-01-31");
    await saveStage.click();
    await expect(saveStage).toBeDisabled();
    await expect(saveStage).toBeEnabled();
    const advanceToImplementation = dialog.getByRole("button", { name: "Avanzar a Implementación" });
    await expect(advanceToImplementation).toBeEnabled();
    await advanceToImplementation.click();
    await expect(dialog.getByText("4. Implementación", { exact: true })).toBeVisible();

    await dialog.locator("input[name='progress']").fill("100");
    await dialog.locator("textarea[name='implementationComments']").fill("Acción implementada y comunicada.");
    await saveStage.click();
    await expect(saveStage).toBeDisabled();
    await expect(saveStage).toBeEnabled();
    await dialog.locator("select").last().selectOption("IMPLEMENTATION");
    await dialog.locator("input[name='title']").fill(`Evidencia implementación ${state.runId}`);
    await dialog.locator("input[type='file']").last().setInputFiles(file(`capa-implementation-${state.runId}.txt`));
    await dialog.getByRole("button", { name: "Adjuntar" }).click();
    await expect(dialog.getByText(`Evidencia implementación ${state.runId}`, { exact: false })).toBeVisible();
    const advanceToVerification = dialog.getByRole("button", { name: "Avanzar a Eficacia" });
    await expect(advanceToVerification).toBeEnabled();
    await advanceToVerification.click();
    await expect(dialog.getByText("5. Eficacia", { exact: true })).toBeVisible();

    await dialog.locator("select").last().selectOption("EFFECTIVENESS");
    await dialog.locator("input[name='title']").fill(`Evidencia eficacia ${state.runId}`);
    await dialog.locator("input[type='file']").last().setInputFiles(file(`capa-effectiveness-${state.runId}.txt`));
    await dialog.getByRole("button", { name: "Adjuntar" }).click();
    await expect(dialog.getByText(`Evidencia eficacia ${state.runId}`, { exact: false })).toBeVisible();
    await dialog.getByPlaceholder("Comentario del verificador").fill("La acción previene la recurrencia.");
    const verifyButton = dialog.getByRole("button", { name: "Registrar verificación" });
    await expect(verifyButton).toBeEnabled();
    await verifyButton.click();
    await expect(verifyButton).toBeDisabled();
    await expect(verifyButton).toBeEnabled();
    const advanceToClose = dialog.getByRole("button", { name: "Avanzar a Cierre" });
    await expect(advanceToClose).toBeEnabled();
    await advanceToClose.click();
    await expect(dialog.getByText("6. Cierre", { exact: true })).toBeVisible();
  });

  test("genera reportes y mantiene aislamiento del tenant", async ({ page }) => {
    await login(page, state.actorA);
    await page.goto("/app/reporting");
    await expect(page.getByRole("heading", { name: /Informes y paquetes de auditoría/i })).toBeVisible();
    const pdfDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /Exportar PDF/i }).first().click();
    await processQueuedReport(page, "PDF");
    await expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/i);
    const xlsxDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /XLSX/i }).first().click();
    await processQueuedReport(page, "EXCEL");
    await expect((await xlsxDownload).suggestedFilename()).toMatch(/\.(xlsx|xls)$/i);

    await page.goto("/app/documents");
    await expect(page.getByText(state.actorA.documentTitle)).toBeVisible();
    await expect(page.getByText(state.actorB.documentTitle)).toHaveCount(0);
    await gotoStable(page, "/app/billing");
    await expect(page.getByText(state.actorA.invoiceNumber)).toBeVisible();
    await expect(page.getByText(state.actorB.invoiceNumber)).toHaveCount(0);
  });
});
