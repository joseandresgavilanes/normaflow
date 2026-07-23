import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, readLiveState, type LiveFixtureState } from "./support";

test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;
let assetAId: string;
let assetBId: string;

test.describe("information assets live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();
    const a = await prisma.informationAsset.create({ data: { organizationId: state.actorA.organizationId, code: "ACT-A1", name: "CRM", category: "INFORMATION", criticality: "CRITICAL", nextReviewDate: new Date(Date.now() - 86400000) } });
    assetAId = a.id;
    const b = await prisma.informationAsset.create({ data: { organizationId: state.actorB.organizationId, code: "ACT-B1", name: "ERP", category: "SOFTWARE" } });
    assetBId = b.id;
  });

  test.afterAll(async () => {
    await prisma.informationAsset.deleteMany({ where: { id: { in: [assetAId, assetBId] } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("aísla los activos del otro tenant", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);
    const own = await clientA.from("information_assets").select("id,organizationId").eq("id", assetAId);
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);
    const cross = await clientB.from("information_assets").select("id").eq("id", assetAId);
    expect(cross.error).toBeNull();
    expect(cross.data).toEqual([]);
  });

  test("rechaza escrituras cruzadas y dependencias entre tenants", async () => {
    const clientA = await actorClient(state.actorA);
    const crossUpdate = await clientA.from("information_assets").update({ name: "HACK" }).eq("id", assetBId).select("id");
    expect(crossUpdate.error).toBeNull();
    expect(crossUpdate.data).toEqual([]);
    const crossDep = await clientA.from("asset_dependencies").insert({ organizationId: state.actorA.organizationId, sourceAssetId: assetAId, dependentAssetId: assetBId, type: "DEPENDS_ON" });
    expect(crossDep.error).not.toBeNull();
  });

  test("permite clasificar el activo propio y detecta revisión vencida", async () => {
    const clientA = await actorClient(state.actorA);
    const classify = await clientA.from("asset_classifications").insert({ organizationId: state.actorA.organizationId, assetId: assetAId, confidentiality: "HIGH", integrity: "HIGH", availability: "MEDIUM", classification: "CONFIDENTIAL" }).select("id");
    expect(classify.error).toBeNull();
    expect(classify.data).toHaveLength(1);
    const overdue = await clientA.from("information_assets").select("id,nextReviewDate").lt("nextReviewDate", new Date().toISOString());
    expect(overdue.error).toBeNull();
    expect(overdue.data?.some((r) => r.id === assetAId)).toBe(true);
  });

  test("un visor no puede escribir en el inventario", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const insert = await viewer.from("information_assets").insert({ organizationId: state.actorA.organizationId, code: "ACT-V", name: "x", category: "SOFTWARE" });
    expect(insert.error).not.toBeNull();
    const update = await viewer.from("information_assets").update({ name: "y" }).eq("id", assetAId).select("id");
    expect(update.error).not.toBeNull();
  });
});
