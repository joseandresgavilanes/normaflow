import { expect, test } from "@playwright/test";
import { actorClient, adminClient, readLiveState, type LiveFixtureState } from "./support";

/**
 * Standard Pack Engine — live multi-tenant boundary.
 *
 * The global catalog (families / editions / requirements) is readable by every
 * authenticated tenant; the org-scoped requirement_coverage fabric must be RLS
 * isolated so one organization can never see or mutate another's coverage.
 */
test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let coverageA = "";
let coverageB = "";

test.describe("standards engine: catalog visibility and coverage isolation", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    const admin = adminClient();
    coverageA = `cov_a_${state.runId}`;
    coverageB = `cov_b_${state.runId}`;
    // Service-role seed: one coverage row per organization on a shared global requirement.
    const now = new Date().toISOString();
    const { error } = await admin.from("requirement_coverage").insert([
      { id: coverageA, organizationId: state.actorA.organizationId, requirementId: "cl-9001-7.5", entityType: "DOCUMENT", entityId: state.actorA.documentId, coverageType: "primary", createdAt: now, updatedAt: now },
      { id: coverageB, organizationId: state.actorB.organizationId, requirementId: "cl-27001-7.5", entityType: "DOCUMENT", entityId: state.actorB.documentId, coverageType: "primary", createdAt: now, updatedAt: now },
    ]);
    expect(error, "seed coverage rows").toBeNull();
  });

  test.afterAll(async () => {
    const admin = adminClient();
    await admin.from("requirement_coverage").delete().in("id", [coverageA, coverageB]);
  });

  test("global catalog is readable by an authenticated tenant", async () => {
    const clientA = await actorClient(state.actorA);
    for (const table of ["standard_families", "standard_editions", "standard_requirements"] as const) {
      const res = await clientA.from(table).select("id").limit(1);
      expect(res.error, `${table} must be readable`).toBeNull();
      expect(Array.isArray(res.data)).toBe(true);
    }
    const req = await clientA.from("standard_requirements").select("id,code").eq("id", "cl-9001-7.5");
    expect(req.data, "seeded requirement is visible in the global catalog").toEqual([{ id: "cl-9001-7.5", code: "7.5" }]);
  });

  test("an organization sees only its own coverage", async () => {
    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("requirement_coverage").select("id").eq("id", coverageA);
    expect(own.error).toBeNull();
    expect(own.data, "A sees its own coverage row").toEqual([{ id: coverageA }]);

    const foreign = await clientA.from("requirement_coverage").select("id,organizationId").eq("id", coverageB);
    expect(foreign.error, "cross-tenant read is evaluated by RLS").toBeNull();
    expect(foreign.data, "A must never see B's coverage").toEqual([]);
  });

  test("cross-tenant coverage mutation affects no row", async () => {
    const clientA = await actorClient(state.actorA);
    const update = await clientA.from("requirement_coverage").update({ note: `CROSS-${state.runId}` }).eq("id", coverageB).select("id");
    expect(update.error).toBeNull();
    expect(update.data, "A cannot mutate B's coverage").toEqual([]);

    const del = await clientA.from("requirement_coverage").delete().eq("id", coverageB).select("id");
    expect(del.error).toBeNull();
    expect(del.data, "A cannot delete B's coverage").toEqual([]);
  });

  test("inserting coverage into another tenant is rejected by the WITH CHECK policy", async () => {
    const clientA = await actorClient(state.actorA);
    const res = await clientA.from("requirement_coverage").insert({
      id: `cov_evil_${state.runId}`, organizationId: state.actorB.organizationId,
      requirementId: "cl-9001-7.5", entityType: "DOCUMENT", entityId: state.actorB.documentId,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).select("id");
    expect(res.data ?? [], "cross-tenant insert must not persist").toEqual([]);
    expect(res.error, "RLS rejects the cross-tenant insert").not.toBeNull();
  });
});
