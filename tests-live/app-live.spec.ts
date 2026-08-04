import { expect, test, type Page } from "@playwright/test";
import { actorClient, readLiveState, type LiveActor, type LiveFixtureState } from "./support";

test.describe.configure({ mode: "serial" });
let state: LiveFixtureState;

async function login(page: Page, actor: LiveActor) {
  await page.goto("/login");
  await page.locator("input[type='email']").fill(actor.email);
  await page.locator("input[type='password']").fill(actor.password);
  await page.getByRole("button", { name: /^Entrar/ }).click();
  await page.waitForURL(/\/app\/dashboard/);
}

test.describe("NormaFlow live application", () => {
  test.beforeAll(() => { state = readLiveState(); });
  test("renders only organization A data and persists live actions", async ({ page }) => {
    await login(page, state.actorA);

    await page.goto("/app/documents");
    await expect(page.getByText(state.actorA.documentTitle)).toBeVisible();
    await expect(page.getByText(state.actorB.documentTitle)).toHaveCount(0);

    await page.goto("/app/notifications");
    await expect(page.getByText(state.actorA.notificationTitle)).toBeVisible();
    await expect(page.getByText(state.actorB.notificationTitle)).toHaveCount(0);

    await page.goto("/app/billing");
    await expect(page.getByRole("heading", { name: "Billing y suscripción" })).toBeVisible();
    await expect(page.getByText(state.actorA.invoiceNumber)).toBeVisible();
    await expect(page.getByText(state.actorB.invoiceNumber)).toHaveCount(0);

    await page.goto("/app/reporting");
    await expect(page.getByText(state.actorA.reportFileName)).toBeVisible();
    await expect(page.getByText(state.actorB.reportFileName)).toHaveCount(0);

    await page.goto("/app/settings");
    await expect(page.getByText("Perfil vinculado a tu identidad y organización en Supabase.")).toBeVisible();
    const name = `Live A UI ${state.runId}`;
    await page.getByPlaceholder("Tu nombre").fill(name);
    await page.getByRole("button", { name: "Guardar nombre" }).click();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    const clientA = await actorClient(state.actorA);
    const profile = await clientA.from("users").select("name").eq("id", state.actorA.userId).single();
    expect(profile.data?.name).toBe(name);
  });

  test("keeps organization B isolated and enforces server permissions", async ({ page }) => {
    await login(page, state.actorB);

    await page.goto("/app/documents");
    await expect(page.getByText(state.actorB.documentTitle)).toBeVisible();
    await expect(page.getByText(state.actorA.documentTitle)).toHaveCount(0);

    await page.goto("/app/reporting");
    await expect(page.getByText(state.actorB.reportFileName)).toBeVisible();
    await expect(page.getByText(state.actorA.reportFileName)).toHaveCount(0);

    await page.goto("/app/billing");
    await expect(page).toHaveURL(/\/app\/dashboard\?error=forbidden/);
    await expect(page.getByText(state.actorA.invoiceNumber)).toHaveCount(0);
    await expect(page.getByText(state.actorB.invoiceNumber)).toHaveCount(0);
  });
});
