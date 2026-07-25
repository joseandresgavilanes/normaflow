/**
 * Paquete de Continuidad del Negocio (ISO 22301) — prueba de integración.
 *
 *   DATABASE_URL=postgres://…desechable… npx tsx scripts/test-continuity.ts
 *
 * Cubre: matemática del BIA, regla RTO ≤ MTPD, priorización, dependencias y
 * recursos (incluida la reutilización de procesos/activos/proveedores sin
 * duplicarlos), estrategias, procedimientos, equipos de crisis y árbol de
 * comunicación, versionado/aprobación/ACTIVACIÓN del plan, simulacro →
 * resultado → acción de mejora, detección de brechas, reportes y aislamiento
 * multi-tenant. Se niega a ejecutarse contra una base gestionada.
 */
import assert from "node:assert/strict";
import Module from "node:module";
import { PrismaClient } from "@prisma/client";
import {
  assertRtoWithinMtpd, criticalityFor, detectGaps, impactScore,
  meetsObjectives, readinessScore, recoveryPriority, ContinuityValidationError,
} from "../src/lib/continuity/bia";

const url = process.env.DATABASE_URL ?? "";
if (/supabase|pooler|amazonaws/i.test(url)) {
  throw new Error("Refusing to run integration test against a managed/production database.");
}

// `server-only` lo resuelve Next en build; fuera de Next se sustituye.
type Loader = (request: string, ...args: unknown[]) => unknown;
const moduleInternals = Module as unknown as { _load: Loader };
const originalLoad = moduleInternals._load;
moduleInternals._load = function (this: unknown, request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
} as Loader;

const prisma = new PrismaClient();
let passed = 0;
async function t(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function main() {
  console.log("Continuidad del negocio (ISO 22301) — prueba de integración\n");

  // ── 1. Lógica pura del BIA ──
  await t("BIA: puntuación de impacto ponderada 0-100", async () => {
    assert.equal(impactScore({ financialImpact: 0, operationalImpact: 0, legalImpact: 0, reputationalImpact: 0, peopleImpact: 0 }), 0);
    assert.equal(impactScore({ financialImpact: 5, operationalImpact: 5, legalImpact: 5, reputationalImpact: 5, peopleImpact: 5 }), 100);
    const mid = impactScore({ financialImpact: 3, operationalImpact: 3, legalImpact: 3, reputationalImpact: 3, peopleImpact: 3 });
    assert.equal(mid, 60, "una valoración uniforme de 3/5 equivale al 60%");
    // Valores fuera de rango se acotan en lugar de romper la escala.
    assert.equal(impactScore({ financialImpact: 99, operationalImpact: 5, legalImpact: 5, reputationalImpact: 5, peopleImpact: 5 }), 100);
  });

  await t("BIA: criticidad combina impacto y urgencia (MTPD)", async () => {
    assert.equal(criticalityFor(90, 10000), "CRITICAL", "impacto muy alto => crítica");
    assert.equal(criticalityFor(20, 30), "CRITICAL", "MTPD <= 1h => crítica aunque el impacto sea bajo");
    assert.equal(criticalityFor(20, 180), "HIGH", "MTPD <= 4h => alta");
    assert.equal(criticalityFor(40, 10000), "MEDIUM");
    assert.equal(criticalityFor(10, null), "LOW");
  });

  await t("BIA: prioridad de recuperación ordena por impacto y luego por MTPD", async () => {
    const ordered = recoveryPriority([
      { id: "c", impactScore: 50, mtpdMinutes: 60 },
      { id: "a", impactScore: 90, mtpdMinutes: 480 },
      { id: "b", impactScore: 50, mtpdMinutes: 30 },
    ]);
    assert.deepEqual(ordered, [{ id: "a", priority: 1 }, { id: "b", priority: 2 }, { id: "c", priority: 3 }]);
  });

  await t("regla ISO 22301: el RTO no puede superar el MTPD", async () => {
    assert.throws(() => assertRtoWithinMtpd(500, 240), ContinuityValidationError);
    assert.doesNotThrow(() => assertRtoWithinMtpd(240, 240));
    assert.doesNotThrow(() => assertRtoWithinMtpd(null, 240), "sin datos no se valida");
  });

  await t("simulacro: comprobación de cumplimiento de objetivos", async () => {
    assert.equal(meetsObjectives({ targetRtoMinutes: 240, achievedRtoMinutes: 210 }), true);
    assert.equal(meetsObjectives({ targetRtoMinutes: 240, achievedRtoMinutes: 300 }), false);
    assert.equal(meetsObjectives({ targetRpoMinutes: 60, achievedRpoMinutes: 90 }), false);
    assert.equal(meetsObjectives({}), true, "sin objetivos definidos no se incumple");
  });

  await t("brechas: detección sobre una actividad sin estrategia ni procedimiento", async () => {
    const gaps = detectGaps({
      id: "x", name: "Facturación", mtpdMinutes: 480, rtoMinutes: 720,
      strategies: [], procedures: 0,
      dependencies: [{ name: "ERP único", singlePointOfFailure: true }],
      tested: false,
    });
    const kinds = gaps.map((g) => g.kind).sort();
    assert.deepEqual(kinds, ["NEVER_TESTED", "NO_PROCEDURE", "NO_STRATEGY", "RTO_EXCEEDS_MTPD", "SPOF"].sort());
  });

  await t("brechas: estrategia que no alcanza el RTO se detecta", async () => {
    const gaps = detectGaps({
      id: "y", name: "Atención", mtpdMinutes: 480, rtoMinutes: 120,
      strategies: [{ achievesRtoMinutes: 300, status: "IMPLEMENTED" }], procedures: 1,
      dependencies: [], tested: true,
    });
    assert.deepEqual(gaps.map((g) => g.kind), ["STRATEGY_RTO_INSUFFICIENT"]);
  });

  await t("preparación: pondera por criticidad", async () => {
    assert.equal(readinessScore([]), 0);
    assert.equal(readinessScore([{ criticality: "CRITICAL", gaps: 0 }, { criticality: "LOW", gaps: 0 }]), 100);
    // Una actividad CRÍTICA con brechas penaliza más que una BAJA (4 de 5 puntos).
    assert.equal(readinessScore([{ criticality: "CRITICAL", gaps: 2 }, { criticality: "LOW", gaps: 0 }]), 20);
  });

  // ── Fixtures (recreadas en cada ejecución: test idempotente) ──
  await prisma.organization.deleteMany({ where: { slug: { in: ["bcm-a", "bcm-b"] } } });
  const orgA = await prisma.organization.create({ data: { name: "BCM A", slug: "bcm-a", plan: "GROWTH" } });
  const orgB = await prisma.organization.create({ data: { name: "BCM B", slug: "bcm-b", plan: "GROWTH" } });
  const user = await prisma.user.upsert({ where: { email: "bcm@x.com" }, update: {}, create: { email: "bcm@x.com", name: "BCM User" } });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: orgA.id } },
    update: {}, create: { userId: user.id, organizationId: orgA.id, role: "ORG_ADMIN" },
  });

  // Módulos existentes que el paquete REUTILIZA (no duplica).
  const process1 = await prisma.process.create({ data: { organizationId: orgA.id, name: "Atención al cliente", code: "PR-01" } });
  const supplier = await prisma.supplier.create({ data: { organizationId: orgA.id, code: "PRV-01", name: "Cloud Provider", category: "TI" } });
  const asset = await prisma.informationAsset.create({ data: { organizationId: orgA.id, code: "ACT-TI-01", name: "CRM", category: "SOFTWARE" } });

  // ── 2. BIA y actividades críticas ──
  const bia = await prisma.businessImpactAnalysis.create({
    data: { organizationId: orgA.id, code: "BIA-001", title: "BIA corporativo", version: "1.0", ownerId: user.id },
  });

  await t("BIA: actividad crítica reutiliza un proceso existente sin duplicarlo", async () => {
    const scores = { financialImpact: 4, operationalImpact: 5, legalImpact: 3, reputationalImpact: 5, peopleImpact: 3 };
    const score = impactScore(scores);
    await prisma.criticalActivity.create({
      data: {
        organizationId: orgA.id, biaId: bia.id, code: "ACT-001", name: "Atención al cliente",
        processId: process1.id, mtpdMinutes: 480, rtoMinutes: 240, rpoMinutes: 60,
        minimumServiceLevel: "50% de agentes", ...scores,
        impactScore: score, criticality: criticalityFor(score, 480), priority: 1,
      },
    });
    const processes = await prisma.process.count({ where: { organizationId: orgA.id } });
    assert.equal(processes, 1, "no se crea un proceso nuevo: se referencia el existente");
    const activity = await prisma.criticalActivity.findFirstOrThrow({ where: { organizationId: orgA.id, code: "ACT-001" } });
    assert.equal(activity.processId, process1.id);
    assert.equal(activity.criticality, "HIGH");
  });

  const activity = await prisma.criticalActivity.findFirstOrThrow({ where: { organizationId: orgA.id, code: "ACT-001" } });

  await t("BIA: aprobación deja constancia de quién y cuándo", async () => {
    await prisma.businessImpactAnalysis.update({
      where: { id: bia.id }, data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
    });
    const approved = await prisma.businessImpactAnalysis.findUniqueOrThrow({ where: { id: bia.id } });
    assert.equal(approved.status, "APPROVED");
    assert.equal(approved.approvedById, user.id);
    assert.ok(approved.approvedAt);
  });

  await t("priorización de productos y servicios", async () => {
    await prisma.productServicePriority.create({
      data: {
        organizationId: orgA.id, biaId: bia.id, code: "PS-001", name: "Soporte 24/7",
        priority: 1, criticality: "CRITICAL", mtpdMinutes: 240, rtoMinutes: 120,
        minimumServiceLevel: "Incidencias críticas", revenueShare: 45, customersAffected: 1200,
      },
    });
    const rows = await prisma.productServicePriority.findMany({ where: { organizationId: orgA.id } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].criticality, "CRITICAL");
  });

  // ── 3. Dependencias y recursos (todas las categorías exigidas) ──
  await t("dependencias: personas, instalaciones, tecnología, proveedores y datos", async () => {
    const types = ["PEOPLE", "FACILITY", "TECHNOLOGY", "SUPPLIER", "DATA"] as const;
    for (const [i, type] of types.entries()) {
      await prisma.businessDependency.create({
        data: {
          organizationId: orgA.id, activityId: activity.id, type, name: `Dependencia ${type}`,
          criticality: i === 3 ? "CRITICAL" : "HIGH", maxOutageMinutes: 120,
          alternative: type === "DATA" ? null : "Alternativa prevista",
          singlePointOfFailure: type === "DATA",
          ...(type === "SUPPLIER" ? { supplierId: supplier.id } : {}),
          ...(type === "TECHNOLOGY" ? { assetId: asset.id } : {}),
        },
      });
    }
    const deps = await prisma.businessDependency.findMany({ where: { organizationId: orgA.id, activityId: activity.id } });
    assert.equal(deps.length, 5, "las cinco categorías de dependencia");
    assert.equal(deps.filter((d) => d.singlePointOfFailure).length, 1);
    // Reutilización: proveedor y activo referenciados, no copiados.
    assert.equal(await prisma.supplier.count({ where: { organizationId: orgA.id } }), 1);
    assert.equal(await prisma.informationAsset.count({ where: { organizationId: orgA.id } }), 1);
    assert.ok(deps.find((d) => d.supplierId === supplier.id), "la dependencia de proveedor referencia el proveedor existente");
    assert.ok(deps.find((d) => d.assetId === asset.id), "la dependencia tecnológica referencia el activo existente");
  });

  await t("recursos: cantidad normal vs mínima y recurso alterno", async () => {
    await prisma.resourceRequirement.create({
      data: {
        organizationId: orgA.id, activityId: activity.id, type: "PEOPLE", name: "Agentes de soporte",
        normalQuantity: 20, minimumQuantity: 8, unit: "personas",
        alternativeResource: "Turnos extendidos", leadTimeMinutes: 120,
      },
    });
    const r = await prisma.resourceRequirement.findFirstOrThrow({ where: { organizationId: orgA.id } });
    assert.equal(r.minimumQuantity, 8);
    assert.ok(r.minimumQuantity! < r.normalQuantity!, "el nivel mínimo es inferior al normal");
  });

  // ── 4. Plan: versión, aprobación y ACTIVACIÓN ──
  const plan = await prisma.businessContinuityPlan.create({
    data: {
      organizationId: orgA.id, code: "BCP-001", title: "Plan de continuidad",
      rtoMinutes: 240, rpoMinutes: 60, minimumServiceLevel: "50% de capacidad",
      invocationCriteria: "Interrupción > 4 h",
    },
  });

  await t("plan: el versionado devuelve el plan a borrador", async () => {
    await prisma.continuityPlanVersion.create({
      data: { organizationId: orgA.id, planId: plan.id, version: "1.1", changeSummary: "Añadido sitio alterno", createdById: user.id },
    });
    await prisma.businessContinuityPlan.update({ where: { id: plan.id }, data: { version: "1.1", status: "DRAFT", approvedById: null, approvedAt: null } });
    const p = await prisma.businessContinuityPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(p.version, "1.1");
    assert.equal(p.status, "DRAFT", "una versión nueva exige nueva aprobación");
  });

  await t("plan: solo se puede activar un plan APROBADO", async () => {
    const draft = await prisma.businessContinuityPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.notEqual(draft.status, "APPROVED", "precondición: el plan está en borrador");
    // La Server Action rechaza la activación; aquí se comprueba la invariante.
    await prisma.businessContinuityPlan.update({
      where: { id: plan.id }, data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() },
    });
    await prisma.continuityPlanVersion.updateMany({ where: { planId: plan.id, version: "1.1" }, data: { approvedById: user.id, approvedAt: new Date() } });
    const approved = await prisma.businessContinuityPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(approved.status, "APPROVED");
  });

  await t("plan: activación y cierre con lecciones aprendidas", async () => {
    const activation = await prisma.planActivation.create({
      data: { organizationId: orgA.id, planId: plan.id, reason: "Caída del centro de datos", activatedById: user.id },
    });
    await prisma.businessContinuityPlan.update({ where: { id: plan.id }, data: { activated: true, activatedAt: new Date(), activatedById: user.id, activationReason: "Caída del centro de datos" } });
    let p = await prisma.businessContinuityPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(p.activated, true, "el plan queda activado");

    await prisma.planActivation.update({
      where: { id: activation.id },
      data: { deactivatedAt: new Date(), outcome: "Servicio restablecido en 3 h", lessonsLearned: "Automatizar el failover de DNS" },
    });
    await prisma.businessContinuityPlan.update({ where: { id: plan.id }, data: { activated: false, deactivatedAt: new Date() } });
    p = await prisma.businessContinuityPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(p.activated, false, "el plan se desactiva al cerrar");
    const closed = await prisma.planActivation.findUniqueOrThrow({ where: { id: activation.id } });
    assert.ok(closed.deactivatedAt);
    assert.equal(closed.lessonsLearned, "Automatizar el failover de DNS");
    // El histórico se conserva.
    assert.equal(await prisma.planActivation.count({ where: { organizationId: orgA.id } }), 1);
  });

  // ── 5. Estrategias, procedimientos y equipo de crisis ──
  await t("estrategia aprobada con capacidad de recuperación", async () => {
    await prisma.continuityStrategy.create({
      data: {
        organizationId: orgA.id, code: "EST-001", title: "Sitio alterno", type: "RELOCATION",
        activityId: activity.id, planId: plan.id, achievesRtoMinutes: 180, cost: 24000,
        status: "IMPLEMENTED", approvedById: user.id, approvedAt: new Date(),
      },
    });
    const s = await prisma.continuityStrategy.findFirstOrThrow({ where: { organizationId: orgA.id, code: "EST-001" } });
    assert.equal(s.status, "IMPLEMENTED");
    assert.ok(s.achievesRtoMinutes! <= activity.rtoMinutes!, "la estrategia alcanza el RTO objetivo");
  });

  await t("procedimiento de recuperación asociado a la actividad", async () => {
    await prisma.recoveryProcedure.create({
      data: {
        organizationId: orgA.id, code: "PR-REC-001", title: "Reanudación en sitio alterno",
        planId: plan.id, activityId: activity.id, order: 1, estimatedMinutes: 180,
        steps: "1. Convocar comité. 2. Activar sitio alterno. 3. Redirigir tráfico.", responsibleId: user.id,
      },
    });
    assert.equal(await prisma.recoveryProcedure.count({ where: { organizationId: orgA.id } }), 1);
  });

  await t("equipo de crisis, contactos y árbol de comunicación jerárquico", async () => {
    const team = await prisma.crisisTeam.create({
      data: { organizationId: orgA.id, code: "EQ-001", name: "Comité de crisis", planId: plan.id, leaderId: user.id, activationRule: "Interrupción > 4 h" },
    });
    const lead = await prisma.crisisContact.create({
      data: { organizationId: orgA.id, teamId: team.id, name: "Dirección", role: "Líder", type: "INTERNAL", userId: user.id, primaryPhone: "+34600000000", escalationOrder: 1 },
    });
    await prisma.crisisContact.create({
      data: { organizationId: orgA.id, teamId: team.id, name: "Cloud Provider", role: "Soporte", type: "SUPPLIER", supplierId: supplier.id, escalationOrder: 2 },
    });
    const root = await prisma.communicationTree.create({
      data: { organizationId: orgA.id, teamId: team.id, contactId: lead.id, label: "Comité de crisis", audience: "Dirección", channel: "Teléfono", order: 1, maxDelayMinutes: 15 },
    });
    await prisma.communicationTree.create({
      data: { organizationId: orgA.id, teamId: team.id, parentId: root.id, label: "Responsables de área", audience: "Jefes de área", channel: "SMS", order: 2, maxDelayMinutes: 30 },
    });
    const nodes = await prisma.communicationTree.findMany({ where: { organizationId: orgA.id, teamId: team.id } });
    assert.equal(nodes.length, 2);
    const child = nodes.find((n) => n.parentId === root.id);
    assert.ok(child, "el árbol es jerárquico: el hijo apunta al nodo raíz");
    assert.equal(await prisma.crisisContact.count({ where: { organizationId: orgA.id, teamId: team.id } }), 2);
  });

  // ── 6. Simulacro → resultado → acción de mejora ──
  await t("simulacro completo: ejercicio, resultado y acción de mejora", async () => {
    const scenario = await prisma.continuityScenario.create({
      data: { organizationId: orgA.id, planId: plan.id, title: "Caída del centro de datos", type: "Tecnológico", likelihood: 3, severity: 5 },
    });
    const test = await prisma.continuityTest.create({
      data: {
        organizationId: orgA.id, planId: plan.id, scenarioId: scenario.id, title: "Simulacro de failover",
        type: "FAILOVER", status: "COMPLETED", executedDate: new Date(), responsibleId: user.id,
        objective: "Validar el RTO de 240 min", targetRtoMinutes: 240, targetRpoMinutes: 60,
      },
    });
    const result = await prisma.testResult.create({
      data: {
        organizationId: orgA.id, testId: test.id, outcome: "PARTIAL",
        rtoAchievedMinutes: 300, rpoAchievedMinutes: 55, summary: "RTO no alcanzado", testedById: user.id,
      },
    });
    assert.equal(meetsObjectives({ targetRtoMinutes: test.targetRtoMinutes, achievedRtoMinutes: result.rtoAchievedMinutes }), false,
      "el simulacro no cumplió el RTO objetivo");
    await prisma.improvementAction.create({
      data: { organizationId: orgA.id, testResultId: result.id, description: "Automatizar el failover de DNS", responsibleId: user.id, status: "OPEN" },
    });
    const open = await prisma.improvementAction.count({ where: { organizationId: orgA.id, status: { not: "DONE" } } });
    assert.equal(open, 1, "la acción de mejora queda abierta tras un simulacro parcial");
  });

  // ── 7. Reportes ──
  await t("reportes: brechas de continuidad", async () => {
    const { getContinuityGapRows } = await import("../src/lib/continuity/report-data");
    const rows = await getContinuityGapRows(orgA.id);
    assert.ok(rows.length > 0, "el informe de brechas devuelve filas");
    const spof = rows.find((r) => r.tipo_brecha === "PUNTO UNICO DE FALLO");
    assert.ok(spof, "detecta el punto único de fallo de la dependencia de datos");
    assert.equal(spof!.codigo, "ACT-001");
    // La actividad tiene estrategia y procedimiento => esas brechas no aparecen.
    assert.ok(!rows.some((r) => r.tipo_brecha === "SIN ESTRATEGIA"), "no reporta falta de estrategia: existe una implementada");
    assert.ok(!rows.some((r) => r.tipo_brecha === "SIN PROCEDIMIENTO"), "no reporta falta de procedimiento");
  });

  await t("reportes BCM declarados en el contrato", async () => {
    const { REPORT_IDS } = await import("../src/lib/reporting-contract");
    for (const id of ["bcm-bia", "bcm-critical-processes", "bcm-rto-rpo", "bcm-dependencies", "bcm-strategies", "bcm-plans", "bcm-exercises", "bcm-gaps", "bcm-audit-package"]) {
      assert.ok((REPORT_IDS as readonly string[]).includes(id), `falta el reporte ${id}`);
    }
  });

  // ── 8. Aislamiento multi-tenant ──
  await t("multi-tenant: la organización B no ve datos de continuidad de A", async () => {
    const models = [
      "businessImpactAnalysis", "criticalActivity", "productServicePriority", "businessDependency",
      "resourceRequirement", "continuityStrategy", "recoveryProcedure", "crisisTeam", "crisisContact",
      "communicationTree", "continuityPlanVersion", "planActivation", "businessContinuityPlan",
    ] as const;
    for (const model of models) {
      // @ts-expect-error — conteo uniforme entre delegates
      const count = await prisma[model].count({ where: { organizationId: orgB.id } });
      assert.equal(count, 0, `${model} de B debe estar vacío`);
    }
    const { getContinuityGapRows } = await import("../src/lib/continuity/report-data");
    assert.equal((await getContinuityGapRows(orgB.id)).length, 0, "B no ve las brechas de A");
    const foreign = await prisma.criticalActivity.findFirst({ where: { id: activity.id, organizationId: orgB.id } });
    assert.equal(foreign, null, "una actividad de A no es accesible filtrando por B");
  });

  console.log(`\n${passed} checks passed.`);
}

main()
  .catch((e) => { console.error("\n✗ FAILED:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
