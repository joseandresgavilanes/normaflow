import { expect, test, type Page } from "@playwright/test";
import { roleCan } from "@/lib/permissions/matrix";
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

test.describe("security: live tenant and role boundaries", () => {
  test.beforeAll(() => { state = readLiveState(); });

  test("A cannot read or modify B resources across every controlled module", async () => {
    const clientA = await actorClient(state.actorA);
    const resources = [
      ["documents", state.actorB.documentId],
      ["evidence_files", state.actorB.evidenceId],
      ["risks", state.actorB.riskId],
      ["audits", state.actorB.auditId],
      ["capas", state.actorB.capaId],
    ] as const;

    for (const [table, id] of resources) {
      const read = await clientA.from(table).select("id,organizationId").eq("id", id);
      expect(read.error, `${table} read should be evaluated by RLS`).toBeNull();
      expect(read.data, `${table} from organization B must be invisible to A`).toEqual([]);

      const update = await clientA.from(table).update({ title: `CROSS-TENANT-${state.runId}` }).eq("id", id).select("id");
      expect(update.error, `${table} cross-tenant mutation should not succeed`).toBeNull();
      expect(update.data, `${table} cross-tenant mutation should affect no row`).toEqual([]);
    }

    const reports = await clientA.from("report_exports").select("id,organizationId").eq("id", `live_report_b_${state.runId}`);
    expect(reports.error).toBeNull();
    expect(reports.data).toEqual([]);
  });

  test("manual organizationId changes and direct organization URLs cannot cross the tenant boundary", async ({ page }) => {
    const clientA = await actorClient(state.actorA);
    const attemptedMove = await clientA
      .from("documents")
      .update({ organizationId: state.actorB.organizationId })
      .eq("id", state.actorA.documentId)
      .select("id,organizationId");
    expect(
      Boolean(attemptedMove.error) || attemptedMove.data?.length === 0,
      "RLS must either reject the new tenant or affect no row",
    ).toBe(true);

    const ownDocument = await clientA.from("documents").select("organizationId").eq("id", state.actorA.documentId).single();
    expect(ownDocument.data?.organizationId).toBe(state.actorA.organizationId);

    await login(page, state.actorA);
    const deniedSwitch = await page.request.post("/api/auth/set-org", { data: { organizationId: state.actorB.organizationId } });
    expect(deniedSwitch.status()).toBe(403);
    await page.goto(`/app/documents?organizationId=${state.actorB.organizationId}`);
    await expect(page.getByText(state.actorA.documentTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(state.actorB.documentTitle, { exact: true })).toHaveCount(0);
  });

  test("private Supabase Storage blocks cross-tenant reads and writes", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);
    const ownPath = state.storagePaths[0];
    const crossPath = state.storagePaths[1];

    expect((await clientA.storage.from("documents").upload(ownPath, new Blob(["tenant A"], { type: "text/plain" }), { upsert: true })).error).toBeNull();
    expect((await clientA.storage.from("documents").upload(crossPath, new Blob(["tenant crossover"], { type: "text/plain" }), { upsert: true })).error).not.toBeNull();
    expect((await clientB.storage.from("documents").download(ownPath)).error).not.toBeNull();
    expect((await clientA.storage.from("documents").remove([ownPath])).error).toBeNull();
  });

  test("VIEWER has read-only UI, direct routes and minimized member payloads", async ({ page }) => {
    await login(page, state.actorAViewer);
    await page.goto("/app/documents");
    await expect(page.getByRole("button", { name: /Nuevo documento|Crear documento/i })).toHaveCount(0);
    await page.goto("/app/evidence");
    await expect(page.getByRole("button", { name: /Subir evidencia/i })).toHaveCount(0);
    await page.goto("/app/risks");
    await expect(page.getByRole("button", { name: /Nuevo riesgo/i })).toHaveCount(0);
    await page.goto("/app/audits");
    await expect(page.getByRole("button", { name: /Nueva auditoría/i })).toHaveCount(0);
    await page.goto("/app/settings/users");
    await expect(page).toHaveURL(/\/app\/dashboard\?error=forbidden/);
    await page.goto("/app/processes");
    await expect(page.getByText(state.actorA.name, { exact: true })).toHaveCount(0);

    for (const permission of ["documents:create", "documents:update", "documents:approve", "documents:delete", "members:view"]) {
      expect(roleCan("VIEWER", permission)).toBe(false);
    }
  });

  test("AUDITOR is limited to authorized audit/report functions", async ({ page }) => {
    expect(roleCan("AUDITOR", "audits:create")).toBe(true);
    expect(roleCan("AUDITOR", "documents:approve")).toBe(true);
    expect(roleCan("AUDITOR", "reporting:export")).toBe(true);
    expect(roleCan("AUDITOR", "documents:create")).toBe(false);
    expect(roleCan("AUDITOR", "members:update")).toBe(false);

    await login(page, state.actorAAuditor);
    await page.goto("/app/audits");
    await expect(page.getByRole("button", { name: /Nueva auditoría/i })).toBeVisible();
    await page.goto("/app/settings/users");
    await expect(page).toHaveURL(/\/app\/dashboard\?error=forbidden/);
  });

  test("ORG_ADMIN can manage its organization but not the other one", async ({ page }) => {
    await login(page, state.actorBAdmin);
    await page.goto("/app/settings/users");
    await expect(page.getByRole("button", { name: /Invitar persona/i })).toBeVisible();
    const deniedSwitch = await page.request.post("/api/auth/set-org", { data: { organizationId: state.actorA.organizationId } });
    expect(deniedSwitch.status()).toBe(403);
    await page.goto("/app/documents");
    await expect(page.getByText(state.actorB.documentTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(state.actorA.documentTitle, { exact: true })).toHaveCount(0);
  });
});
