import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import EnergyClient from "@/components/energy/EnergyClient";
import { getAppContext } from "@/lib/app-context";
import { getEnergyPayload, type EnergyPayload } from "@/lib/energy/queries";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Gestión energética | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function EnergyPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="energy:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <EnergyClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <EnergyClient initial={await getEnergyPayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[energy] live payload failed:", error);
    return <LiveDataUnavailable section="Sistema de Gestión de la Energía" />;
  }
}

const day = 86400000;
const ago = (days: number) => new Date(Date.now() - day * days);
const ahead = (days: number) => new Date(Date.now() + day * days);
const stamps = { createdAt: ago(90), updatedAt: ago(3) };

function demoPayload(): EnergyPayload {
  return {
    can: { create: false, update: false, approve: false, export: false },
    members: [{ id: "demo-u1", name: "Ana Energía" }, { id: "demo-u2", name: "Luis Mantenimiento" }],
    sources: [{
      id: "d-s1", organizationId: "demo", code: "FUE-0001", name: "Red eléctrica",
      sourceType: "ELECTRICITY", unit: "kWh", emissionFactor: 0.00025, emissionUnit: "tCO2e",
      costPerUnit: 0.14, currency: "EUR", renewableShare: 40, supplierId: null, active: true,
      notes: null, createdById: "demo-u1", ...stamps,
    }],
    uses: [{
      id: "d-u1", organizationId: "demo", code: "USO-0001", name: "Hornos de proceso",
      description: "Línea A", sourceId: "d-s1", processId: null, locationId: null, equipment: "Horno-1",
      annualEstimate: 1200000, unit: "kWh", active: true, createdById: "demo-u1", ...stamps,
      source: { code: "FUE-0001", name: "Red eléctrica", unit: "kWh" },
    }],
    seus: [{
      id: "d-seu1", organizationId: "demo", code: "SEU-0001", energyUseId: "d-u1", reviewId: "d-r1",
      criteria: { shareThreshold: 10 }, consumptionShare: 42, improvementPotential: 12,
      significant: true, rationale: "Mayor consumidor del sitio", ownerId: "demo-u2",
      status: "ACTIVE", createdById: "demo-u1", ...stamps,
      energyUse: { code: "USO-0001", name: "Hornos de proceso", unit: "kWh" },
      review: { code: "REV-0001", title: "Revisión energética 2026" },
      autoSignificant: true,
    }],
    reviews: [{
      id: "d-r1", organizationId: "demo", code: "REV-0001", title: "Revisión energética 2026",
      periodStart: ago(365), periodEnd: ago(30), scope: "Planta principal",
      methodSummary: "Análisis de facturas + submedición", findings: "SEU: hornos y aire comprimido",
      status: "UNDER_REVIEW", reviewedById: "demo-u1", reviewedAt: ago(5),
      approvedById: null, approvedAt: null, documentId: null, evidenceId: null,
      createdById: "demo-u1", ...stamps,
    }],
    baselines: [{
      id: "d-b1", organizationId: "demo", code: "BL-0001", title: "Línea base hornos 2024",
      seuId: "d-seu1", periodStart: ago(700), periodEnd: ago(365), consumption: 1180000, unit: "kWh",
      relevantVariableValues: { production: 10000 }, staticFactorValues: null,
      normalizationMethod: "RATIO", formulaVersion: "1", formulaConfig: { normalizationMethod: "RATIO", variableKey: "production" },
      normalizedConsumption: 118, status: "ACTIVE", approvedById: "demo-u1", approvedAt: ago(360),
      documentId: null, createdById: "demo-u1", ...stamps, seu: { code: "SEU-0001" },
    }],
    enpis: [{
      id: "d-e1", organizationId: "demo", code: "EnPI-0001", name: "kWh / unidad producida",
      description: null, seuId: "d-seu1", baselineId: "d-b1", formulaKind: "INTENSITY",
      formulaVersion: "2", formulaConfig: { activity: 9500 }, unit: "kWh/ud",
      targetValue: 110, currentValue: 112.5, baselineValue: 118, deviationPercent: -4.66,
      indicatorId: null, active: true, superseded: false, approvedById: "demo-u1", approvedAt: ago(20),
      createdById: "demo-u1", ...stamps,
      seu: { code: "SEU-0001" }, baseline: { code: "BL-0001", formulaVersion: "1" },
      computed: { kind: "INTENSITY", value: 112.5, detail: { consumption: 112.5, activity: 9500 }, formulaVersion: "2" },
    }],
    meters: [{
      id: "d-m1", organizationId: "demo", code: "MED-0001", name: "Submedidor hornos",
      sourceId: "d-s1", seuId: "d-seu1", locationId: null, serialNumber: "SM-7781",
      unit: "kWh", calibrationDate: ago(200), nextCalibration: ahead(160),
      active: true, notes: null, createdById: "demo-u2", ...stamps,
      source: { code: "FUE-0001", name: "Red eléctrica" }, _count: { readings: 1 },
    }],
    readings: [{
      id: "d-rd1", organizationId: "demo", code: "LEC-0001", meterId: "d-m1",
      readingAt: ago(7), periodStart: ago(37), periodEnd: ago(7), value: 98000, unit: "kWh",
      estimated: false, relevantVariableValues: { production: 870 }, cost: 13720, emissions: 24.5,
      notes: null, createdById: "demo-u2", ...stamps,
      meter: { code: "MED-0001", name: "Submedidor hornos", unit: "kWh" },
    }],
    variables: [{
      id: "d-v1", organizationId: "demo", code: "VAR-0001", name: "Producción",
      description: "Unidades fabricadas", unit: "ud", variableType: "PRODUCTION",
      active: true, createdById: "demo-u1", ...stamps,
    }],
    factors: [{
      id: "d-f1", organizationId: "demo", code: "FAC-0001", name: "Área climatizada",
      description: null, value: 12000, unit: "m2", effectiveFrom: ago(800), effectiveTo: null,
      active: true, createdById: "demo-u1", ...stamps,
    }],
    opportunities: [{
      id: "d-o1", organizationId: "demo", code: "OPO-0001", title: "Recuperación de calor de hornos",
      description: null, seuId: "d-seu1", estimatedSaving: 90000, savingUnit: "kWh",
      estimatedCost: 45000, currency: "EUR", paybackMonths: 28, priority: "HIGH",
      status: "APPROVED", ownerId: "demo-u2", identifiedAt: ago(60), documentId: null,
      createdById: "demo-u1", ...stamps, seu: { code: "SEU-0001" }, _count: { actionPlans: 1 },
    }],
    plans: [{
      id: "d-p1", organizationId: "demo", code: "PAE-0001", title: "Instalar intercambiador",
      description: null, opportunityId: "d-o1", ownerId: "demo-u2",
      startDate: ago(40), dueDate: ahead(50), progressPercent: 40, status: "IN_PROGRESS",
      capaId: null, documentId: null, evidenceId: null, completedAt: null,
      createdById: "demo-u1", ...stamps,
      opportunity: { code: "OPO-0001", title: "Recuperación de calor de hornos" },
    }],
    verifications: [{
      id: "d-ver1", organizationId: "demo", code: "VER-0001", actionPlanId: "d-p1",
      periodStart: ago(40), periodEnd: ago(10), baselineConsumption: 118000, actualConsumption: 109000,
      absoluteSaving: 9000, normalizedSaving: 8500, unit: "kWh", costSaving: 1260, emissionSaving: 2.25,
      formulaKind: "NORMALIZED_SAVINGS", formulaVersion: "1",
      formulaConfig: { normalizationMethod: "RATIO", variableKey: "production" },
      status: "CALCULATED", verifiedById: null, verifiedAt: null, notes: null, evidenceId: null,
      createdById: "demo-u1", ...stamps, actionPlan: { code: "PAE-0001", title: "Instalar intercambiador" },
    }],
    procurement: [{
      id: "d-pr1", organizationId: "demo", code: "COM-0001", title: "Contrato electricidad 2026",
      sourceType: "ELECTRICITY", supplierId: null, supplierName: "Comercializadora Verde",
      period: "2026", evaluatedAt: ago(25), criteriaScores: { price: 70, renewable: 90, reliability: 80 },
      totalScore: 80, result: "PREFERRED", recommendation: "Preferir oferta con 80% renovable.",
      documentId: null, createdById: "demo-u1", ...stamps,
    }],
    designs: [{
      id: "d-d1", organizationId: "demo", code: "DIS-0001", title: "Ampliación línea B",
      projectReference: "CAPEX-26-04", processId: null, locationId: null,
      description: "Nueva célula de proceso", energyConsiderations: "Motores IE4 y recuperación de calor",
      opportunitiesIdentified: "Variadores de frecuencia en ventilación",
      status: "IN_REVIEW", reviewedById: null, reviewedAt: null, documentId: null, evidenceId: null,
      createdById: "demo-u1", ...stamps,
    }],
    summary: {
      sources: 1, uses: 1, significantUses: 1, reviewsOpen: 1, baselines: 1, enpisActive: 1,
      meters: 1, periodConsumption: 98000, periodCost: 13720, periodEmissions: 24.5,
      opportunitiesOpen: 1, actionsOpen: 1, savingsVerified: 0, absoluteSavings: 0,
    },
  };
}
