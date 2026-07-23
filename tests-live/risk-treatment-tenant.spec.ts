import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { actorClient, readLiveState, type LiveFixtureState } from "./support";

test.describe.configure({ mode: "serial" });

let state: LiveFixtureState;
let prisma: PrismaClient;
let planId: string;
let itemId: string;

test.describe("risk treatment live tenant boundary", () => {
  test.beforeAll(async () => {
    state = readLiveState();
    prisma = new PrismaClient();
    const plan = await prisma.riskTreatmentPlan.create({ data: { organizationId: state.actorA.organizationId, version: 1, title: "Plan de tratamiento", ownerId: state.actorA.userId } });
    planId = plan.id;
    const item = await prisma.riskTreatmentItem.create({ data: { organizationId: state.actorA.organizationId, planId: plan.id, reference: "R-001", title: "Fuga de datos", impact: 5, probability: 3, inherentRisk: 15, ownerId: state.actorA.userId } });
    itemId = item.id;
  });

  test.afterAll(async () => {
    await prisma.riskTreatmentPlan.deleteMany({ where: { id: planId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  test("aísla el registro de riesgos del otro tenant", async () => {
    const clientA = await actorClient(state.actorA);
    const clientB = await actorClient(state.actorB);
    const itemsA = await clientA.from("risk_treatment_items").select("id,organizationId").eq("planId", planId);
    expect(itemsA.error).toBeNull();
    expect(itemsA.data).toHaveLength(1);
    const crossItems = await clientB.from("risk_treatment_items").select("id").eq("planId", planId);
    expect(crossItems.error).toBeNull();
    expect(crossItems.data).toEqual([]);
  });

  test("un riesgo residual sin aceptación no puede cerrarse", async () => {
    // Sin evaluación residual aprobada ni aceptación, el trigger bloquea el cierre.
    await expect(prisma.riskTreatmentItem.update({ where: { id: itemId }, data: { status: "CLOSED" } })).rejects.toThrow();

    // Con evaluación residual aprobada + aceptación formal, el cierre procede.
    await prisma.residualRiskAssessment.create({ data: { organizationId: state.actorA.organizationId, itemId, residualImpact: 2, residualProbability: 2, residualRisk: 4, assessedById: state.actorA.userId, approved: true } });
    await prisma.riskAcceptance.create({ data: { organizationId: state.actorA.organizationId, itemId, justification: "Residual dentro del umbral.", acceptedById: state.actorA.userId } });
    const closed = await prisma.riskTreatmentItem.update({ where: { id: itemId }, data: { status: "CLOSED" } });
    expect(closed.status).toBe("CLOSED");
  });

  test("un visor no puede escribir en el registro de riesgos", async () => {
    const viewer = await actorClient(state.actorAViewer);
    const insert = await viewer.from("risk_treatment_items").insert({ organizationId: state.actorA.organizationId, planId, reference: "R-999", title: "intento", impact: 1, probability: 1, inherentRisk: 1 });
    expect(insert.error).not.toBeNull();
    const update = await viewer.from("risk_treatment_items").update({ title: "hack" }).eq("id", itemId).select("id");
    expect(update.error).not.toBeNull();
  });
});
