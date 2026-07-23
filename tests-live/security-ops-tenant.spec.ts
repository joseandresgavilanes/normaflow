import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, readLiveState, type LiveFixtureState } from "./support";

test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;
let incidentId: string;
let vulnId: string;
let bcpId: string;
let supplierAId: string;
let supplierBId: string;

test.describe("security operations live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();
    const inc = await prisma.securityIncident.create({ data: { organizationId: state.actorA.organizationId, code: "INC-A1", detectedAt: new Date(), severity: "HIGH", category: "MALWARE", description: "test incident" } });
    incidentId = inc.id;
    const v = await prisma.vulnerability.create({ data: { organizationId: state.actorA.organizationId, code: "VULN-A1", source: "scanner", severity: "CRITICAL" } });
    vulnId = v.id;
    const bcp = await prisma.businessContinuityPlan.create({ data: { organizationId: state.actorA.organizationId, code: "BCP-A1", title: "Plan A" } });
    bcpId = bcp.id;
    const sa = await prisma.supplier.create({ data: { organizationId: state.actorA.organizationId, code: "SUP-A1", name: "Prov A", category: "IT" } });
    supplierAId = sa.id;
    const sb = await prisma.supplier.create({ data: { organizationId: state.actorB.organizationId, code: "SUP-B1", name: "Prov B", category: "IT" } });
    supplierBId = sb.id;
  });

  test.afterAll(async () => {
    await prisma.securityIncident.deleteMany({ where: { id: incidentId } }).catch(() => undefined);
    await prisma.vulnerability.deleteMany({ where: { id: vulnId } }).catch(() => undefined);
    await prisma.businessContinuityPlan.deleteMany({ where: { id: bcpId } }).catch(() => undefined);
    await prisma.supplier.deleteMany({ where: { id: { in: [supplierAId, supplierBId] } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("el flujo de incidentes no permite saltos (trigger)", async () => {
    await expect(prisma.securityIncident.update({ where: { id: incidentId }, data: { status: "INVESTIGATING" } })).rejects.toThrow();
    const ok = await prisma.securityIncident.update({ where: { id: incidentId }, data: { status: "TRIAGED" } });
    expect(ok.status).toBe("TRIAGED");
  });

  test("aísla incidentes, vulnerabilidades y planes del otro tenant", async () => {
    const clientB = await actorClient(state.actorB);
    for (const table of [["security_incidents", incidentId], ["vulnerabilities", vulnId], ["business_continuity_plans", bcpId]] as const) {
      const res = await clientB.from(table[0]).select("id").eq("id", table[1]);
      expect(res.error).toBeNull();
      expect(res.data).toEqual([]);
    }
    const clientA = await actorClient(state.actorA);
    const own = await clientA.from("security_incidents").select("id").eq("id", incidentId);
    expect(own.data).toHaveLength(1);
  });

  test("rechaza un perfil de proveedor que apunta a otro tenant (trigger)", async () => {
    await expect(prisma.supplierSecurityProfile.create({ data: { organizationId: state.actorA.organizationId, supplierId: supplierBId, securityCriticality: "HIGH" } })).rejects.toThrow();
    const ok = await prisma.supplierSecurityProfile.create({ data: { organizationId: state.actorA.organizationId, supplierId: supplierAId, securityCriticality: "HIGH" } });
    expect(ok.id).toBeTruthy();
  });

  test("un visor no puede escribir incidentes", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const insert = await viewer.from("security_incidents").insert({ organizationId: state.actorA.organizationId, code: "INC-V", detectedAt: new Date().toISOString(), severity: "LOW", category: "OTHER", description: "x" });
    expect(insert.error).not.toBeNull();
  });
});
