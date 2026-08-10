import { expect, test } from "@playwright/test";
import { actorClient, readLiveState, type LiveFixtureState } from "./support";

test.describe.configure({ mode: "serial" });

test.describe("Supabase RLS and multi-organization isolation", () => {
  let state: LiveFixtureState;
  test.beforeAll(() => { state = readLiveState(); });

  test("scopes organizations, users and documents to the authenticated tenant", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const orgsA = await clientA.from("organizations").select("id,name");
    const orgsB = await clientB.from("organizations").select("id,name");
    expect(orgsA.error).toBeNull();
    expect(orgsB.error).toBeNull();
    expect(orgsA.data?.map(row => row.id)).toEqual([state.actorA.organizationId]);
    expect(orgsB.data?.map(row => row.id)).toEqual([state.actorB.organizationId]);

    const docsA = await clientA.from("documents").select("id,organizationId,title");
    const docsB = await clientB.from("documents").select("id,organizationId,title");
    expect(docsA.data?.map(row => row.id)).toContain(state.actorA.documentId);
    expect(docsA.data?.map(row => row.id)).not.toContain(state.actorB.documentId);
    expect(docsB.data?.map(row => row.id)).toContain(state.actorB.documentId);
    expect(docsB.data?.map(row => row.id)).not.toContain(state.actorA.documentId);

    const usersA = await clientA.from("users").select("id,email");
    expect(usersA.data?.map(row => row.id)).toContain(state.actorA.userId);
    expect(usersA.data?.map(row => row.id)).not.toContain(state.actorB.userId);
  });

  test("combines tenant isolation with role permissions for billing and reporting", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const invoicesA = await clientA.from("billing_invoices").select("organizationId,number");
    expect(invoicesA.error).toBeNull();
    expect(invoicesA.data?.map(row => row.number)).toEqual([state.actorA.invoiceNumber]);

    const invoicesB = await clientB.from("billing_invoices").select("organizationId,number");
    expect(invoicesB.error).toBeNull();
    expect(invoicesB.data).toEqual([]);

    const reportsA = await clientA.from("report_exports").select("organizationId,fileName");
    const reportsB = await clientB.from("report_exports").select("organizationId,fileName");
    expect(reportsA.data?.map(row => row.fileName)).toContain(state.actorA.reportFileName);
    expect(reportsA.data?.every(row => row.organizationId === state.actorA.organizationId)).toBe(true);
    expect(reportsB.data?.map(row => row.fileName)).toEqual([state.actorB.reportFileName]);
    expect(reportsB.data?.every(row => row.organizationId === state.actorB.organizationId)).toBe(true);
  });

  test("rejects cross-tenant writes and viewer writes", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);
    const now = new Date().toISOString();

    const cross = await clientA.from("processes").insert({
      id: `live_cross_${state.runId}`,
      organizationId: state.actorB.organizationId,
      name: "CROSS TENANT MUST FAIL",
      inputs: [],
      outputs: [],
      updatedAt: now,
    });
    expect(cross.error).not.toBeNull();

    const viewerWrite = await clientB.from("processes").insert({
      id: `live_viewer_${state.runId}`,
      organizationId: state.actorB.organizationId,
      name: "VIEWER WRITE MUST FAIL",
      inputs: [],
      outputs: [],
      updatedAt: now,
    });
    expect(viewerWrite.error).not.toBeNull();

    const ownId = `live_own_${state.runId}`;
    const ownWrite = await clientA.from("processes").insert({
      id: ownId,
      organizationId: state.actorA.organizationId,
      name: "OWN TENANT ALLOWED",
      inputs: [],
      outputs: [],
      updatedAt: now,
    }).select("id").single();
    expect(ownWrite.error).toBeNull();
    expect(ownWrite.data?.id).toBe(ownId);
    expect((await clientA.from("processes").delete().eq("id", ownId)).error).toBeNull();
  });

  test("protects account and notification mutations by recipient", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);

    const ownProfile = await clientA.from("users").update({ name: "Live A Updated" }).eq("id", state.actorA.userId).select("id,name").single();
    expect(ownProfile.error).toBeNull();
    expect(ownProfile.data?.name).toBe("Live A Updated");

    const crossProfile = await clientA.from("users").update({ name: "MUST NOT CHANGE" }).eq("id", state.actorB.userId).select("id");
    expect(crossProfile.error).toBeNull();
    expect(crossProfile.data).toEqual([]);

    const inboxA = await clientA.from("notifications").select("id,title,read");
    expect(inboxA.data?.map(row => row.id)).toEqual([state.actorA.notificationId]);
    const crossNotification = await clientA.from("notifications").update({ read: true, readAt: new Date().toISOString() }).eq("id", state.actorB.notificationId).select("id");
    expect(crossNotification.data).toEqual([]);
    const ownNotification = await clientA.from("notifications").update({ read: true, readAt: new Date().toISOString() }).eq("id", state.actorA.notificationId).select("id,read").single();
    expect(ownNotification.error).toBeNull();
    expect(ownNotification.data?.read).toBe(true);

    const inboxB = await clientB.from("notifications").select("id,read").eq("id", state.actorB.notificationId).single();
    expect(inboxB.error).toBeNull();
    expect(inboxB.data?.read).toBe(false);
  });

  test("enforces the organization prefix in private Storage buckets", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);
    const ownPath = state.storagePaths[0];
    const crossPath = state.storagePaths[1];

    const ownUpload = await clientA.storage.from("documents").upload(ownPath, new Blob(["live isolation probe"], { type: "text/plain" }), { upsert: true });
    expect(ownUpload.error).toBeNull();

    const crossUpload = await clientA.storage.from("documents").upload(crossPath, new Blob(["must fail"], { type: "text/plain" }), { upsert: true });
    expect(crossUpload.error).not.toBeNull();

    expect((await clientA.storage.from("documents").download(ownPath)).error).toBeNull();
    expect((await clientB.storage.from("documents").download(ownPath)).error).not.toBeNull();
    const ownListing = await clientA.storage.from("documents").list(`org-${state.actorA.organizationId}/documents/live-${state.runId}`);
    expect(ownListing.error).toBeNull();
    const crossListing = await clientA.storage.from("documents").list(`org-${state.actorB.organizationId}/documents/live-${state.runId}`);
    expect(Boolean(crossListing.error) || crossListing.data?.length === 0).toBe(true);
    expect((await clientA.storage.from("documents").remove([ownPath])).error).toBeNull();
  });

  test("applies the same tenant boundary to the evidence bucket", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);
    const ownPath = `org-${state.actorA.organizationId}/evidence/live-${state.runId}/probe.txt`;
    const crossPath = `org-${state.actorB.organizationId}/evidence/live-${state.runId}/probe.txt`;

    expect((await clientA.storage.from("evidence").upload(ownPath, new Blob(["evidence A"], { type: "text/plain" }), { upsert: true })).error).toBeNull();
    expect((await clientA.storage.from("evidence").upload(crossPath, new Blob(["evidence B"], { type: "text/plain" }), { upsert: true })).error).not.toBeNull();
    expect((await clientB.storage.from("evidence").download(ownPath)).error).not.toBeNull();
    const crossListing = await clientA.storage.from("evidence").list(`org-${state.actorB.organizationId}/evidence/live-${state.runId}`);
    expect(Boolean(crossListing.error) || crossListing.data?.length === 0).toBe(true);
    expect((await clientA.storage.from("evidence").remove([ownPath])).error).toBeNull();
  });
});
