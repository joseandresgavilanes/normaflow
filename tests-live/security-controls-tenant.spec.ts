import { expect, test } from "@playwright/test";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";

test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;

test.describe("ISO 27001 controls live tenant boundary", () => {
  test.beforeAll(() => { state = readLiveState(); });

  test("creates exactly 93 active controls per organization and hides the other tenant", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);
    const controlsA = await clientA.from("organization_controls").select("id,organizationId,security_controls(code)");
    const controlsB = await clientB.from("organization_controls").select("id,organizationId,security_controls(code)");
    expect(controlsA.error).toBeNull();
    expect(controlsB.error).toBeNull();
    expect(controlsA.data).toHaveLength(93);
    expect(controlsB.data).toHaveLength(93);
    expect(controlsA.data?.every((row) => row.organizationId === state.actorA.organizationId)).toBe(true);
    expect(controlsA.data?.map((row) => row.id)).not.toEqual(expect.arrayContaining(controlsB.data?.map((row) => row.id) ?? []));
  });

  test("rejects cross-tenant updates and cross-linked evidence through direct Supabase RLS", async () => {
    const clientA = await actorClient(state.actorA);
    const admin = adminClient();
    const other = await admin.from("organization_controls").select("id").eq("organizationId", state.actorB.organizationId).limit(1).single();
    expect(other.error).toBeNull();
    const crossRead = await clientA.from("organization_controls").select("id").eq("id", other.data?.id);
    expect(crossRead.error).toBeNull();
    expect(crossRead.data).toEqual([]);
    const crossUpdate = await clientA.from("organization_controls").update({ notes: "CROSS TENANT" }).eq("id", other.data?.id).select("id");
    expect(crossUpdate.error).toBeNull();
    expect(crossUpdate.data).toEqual([]);
    const own = await clientA.from("organization_controls").select("id").eq("organizationId", state.actorA.organizationId).limit(1).single();
    expect(own.error).toBeNull();
    const crossEvidence = await clientA.from("control_evidences").insert({ organizationId: state.actorA.organizationId, organizationControlId: other.data?.id, evidenceId: state.actorA.evidenceId, period: "2026-01" });
    expect(crossEvidence.error).not.toBeNull();
    const crossRisk = await clientA.from("risk_control_links").insert({ organizationId: state.actorA.organizationId, riskId: state.actorA.riskId, organizationControlId: other.data?.id, purpose: "CROSS TENANT" });
    expect(crossRisk.error).not.toBeNull();
    expect(own.data?.id).not.toBe(other.data?.id);
  });

  test("keeps viewer read-only and limits auditor to review/export permissions", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const controls = await viewer.from("organization_controls").select("id").limit(1);
    expect(controls.error).toBeNull();
    const own = controls.data?.[0]?.id;
    expect(own).toBeTruthy();
    const viewerUpdate = await viewer.from("organization_controls").update({ status: "IMPLEMENTED" }).eq("id", own).select("id");
    expect(viewerUpdate.error).not.toBeNull();
    const auditor = await actorClient(state.actorAAuditor);
    const auditorRead = await auditor.from("organization_controls").select("id").limit(1);
    expect(auditorRead.error).toBeNull();
    const auditorUpdate = await auditor.from("organization_controls").update({ status: "IMPLEMENTED" }).eq("id", auditorRead.data?.[0]?.id).select("id");
    expect(auditorUpdate.error).not.toBeNull();
  });
});
