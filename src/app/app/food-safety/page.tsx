import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import FoodSafetyClient from "@/components/food-safety/FoodSafetyClient";
import { getAppContext } from "@/lib/app-context";
import { getFoodSafetyPayload, type FoodSafetyPayload } from "@/lib/food-safety/queries";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Inocuidad alimentaria | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function FoodSafetyPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="food-safety:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <FoodSafetyClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <FoodSafetyClient initial={await getFoodSafetyPayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[food-safety] live payload failed:", error);
    return <LiveDataUnavailable section="Sistema de Gestión de la Inocuidad de los Alimentos" />;
  }
}

const day = 86400000;
const ago = (days: number) => new Date(Date.now() - day * days);
const stamps = { createdAt: ago(90), updatedAt: ago(3) };

function demoPayload(): FoodSafetyPayload {
  return {
    can: { create: false, update: false, approve: false, export: false },
    members: [{ id: "demo-u1", name: "María Inocuidad" }, { id: "demo-u2", name: "Carlos HACCP" }],
    products: [{
      id: "d-p1", organizationId: "demo", code: "PROD-0001", name: "Yogur natural 125 g",
      description: "Producto lácteo fermentado", category: "Lácteos", shelfLifeDays: 28,
      storageConditions: "0–4 °C", allergenCodes: ["ALR-LECHE"], processId: null, active: true,
      documentId: null, createdById: "demo-u1", ...stamps,
    }],
    materials: [{
      id: "d-m1", organizationId: "demo", code: "MP-0001", name: "Leche pasteurizada",
      description: null, supplierId: "sup-demo", specification: "3.5% grasa", allergenCodes: ["ALR-LECHE"],
      storageConditions: "0–4 °C", active: true, documentId: null, createdById: "demo-u1", ...stamps,
    }],
    intendedUses: [{
      id: "d-iu1", organizationId: "demo", code: "USO-0001", productId: "d-p1",
      consumerGroup: "Población general", preparationMethod: "Listo para consumo",
      vulnerableConsumers: true, misusePotential: "Rotura de cadena de frío", notes: null,
      createdById: "demo-u1", ...stamps, product: { code: "PROD-0001", name: "Yogur natural 125 g" },
    }],
    flows: [{
      id: "d-f1", organizationId: "demo", code: "FLU-0001", productId: "d-p1",
      title: "Flujo yogur línea A", version: "1", status: "APPROVED",
      verifiedOnSite: true, verifiedAt: ago(20), verifiedById: "demo-u2",
      notes: null, documentId: null, createdById: "demo-u1", ...stamps,
      product: { code: "PROD-0001", name: "Yogur natural 125 g" }, _count: { steps: 2 },
    }],
    steps: [{
      id: "d-s1", organizationId: "demo", code: "PAS-0001", flowId: "d-f1", sequence: 1,
      name: "Pasteurización", stepType: "COOKING", description: "72 °C / 15 s",
      processId: null, temperature: "72 °C", timeParam: "15 s", createdById: "demo-u1", ...stamps,
      flow: { code: "FLU-0001", title: "Flujo yogur línea A", version: "1" },
    }, {
      id: "d-s2", organizationId: "demo", code: "PAS-0002", flowId: "d-f1", sequence: 2,
      name: "Envasado", stepType: "PACKAGING", description: null, processId: null,
      temperature: null, timeParam: null, createdById: "demo-u1", ...stamps,
      flow: { code: "FLU-0001", title: "Flujo yogur línea A", version: "1" },
    }],
    hazards: [{
      id: "d-h1", organizationId: "demo", code: "PEL-0001", name: "Salmonella spp.",
      hazardType: "BIOLOGICAL", description: "Patógeno en leche cruda", source: "Materia prima",
      active: true, createdById: "demo-u1", ...stamps,
    }],
    assessments: [{
      id: "d-a1", organizationId: "demo", code: "EVA-0001", hazardId: "d-h1", stepId: "d-s1",
      productId: "d-p1", severity: 5, likelihood: 3, score: 15, significant: true,
      controlDecision: "CCP", justification: "Control crítico en pasteurización", existingMeasures: "Termógrafo",
      status: "APPROVED", assessedAt: ago(25), assessedById: "demo-u2", createdById: "demo-u1", ...stamps,
      hazard: { code: "PEL-0001", name: "Salmonella spp.", hazardType: "BIOLOGICAL" },
      step: { code: "PAS-0001", name: "Pasteurización", sequence: 1 },
      recomputed: { score: 15, significant: true },
    }],
    prps: [{
      id: "d-prp1", organizationId: "demo", code: "PRP-0001", name: "Higiene del personal",
      category: "HYGIENE", description: "Lavado de manos y vestimenta", responsibleId: "demo-u1",
      frequency: "Diaria", documentId: null, evidenceId: null, active: true, createdById: "demo-u1", ...stamps,
    }],
    oprps: [{
      id: "d-op1", organizationId: "demo", code: "OPRP-0001", name: "Control de metal en envasado",
      hazardAssessmentId: "d-a1", stepId: "d-s2", description: "Detector de metales",
      monitoringMethod: "Paso continuo", monitoringFrequency: "Cada lote", correctionAction: "Retener lote",
      responsibleId: "demo-u2", documentId: null, active: true, createdById: "demo-u1", ...stamps,
      step: { code: "PAS-0002", name: "Envasado" }, hazardAssessment: { code: "EVA-0001" },
    }],
    ccps: [{
      id: "d-ccp1", organizationId: "demo", code: "CCP-0001", name: "Pasteurización",
      stepId: "d-s1", hazardAssessmentId: "d-a1", justification: "Árbol de decisión CCP",
      hazardControlled: "Salmonella", active: true, createdById: "demo-u1", ...stamps,
      step: { code: "PAS-0001", name: "Pasteurización" }, hazardAssessment: { code: "EVA-0001" },
      _count: { limits: 1, monitoringPlans: 1, deviations: 1 },
    }],
    limits: [{
      id: "d-lim1", organizationId: "demo", code: "LIM-0001", ccpId: "d-ccp1",
      parameter: "Temperatura", operator: "GTE", minValue: 72, maxValue: null, targetValue: 72,
      unit: "°C", rationale: "Destrucción de patógenos", createdById: "demo-u1", ...stamps,
      ccp: { code: "CCP-0001", name: "Pasteurización" },
    }],
    plans: [{
      id: "d-mp1", organizationId: "demo", code: "MON-0001", title: "Monitoreo pasteurización",
      ccpId: "d-ccp1", oprpId: null, method: "Termógrafo continuo", frequency: "Continuo",
      responsibleId: "demo-u2", parameter: "Temperatura", active: true, createdById: "demo-u1", ...stamps,
      ccp: { code: "CCP-0001", name: "Pasteurización" }, oprp: null, _count: { records: 2 },
    }],
    records: [{
      id: "d-mr1", organizationId: "demo", code: "REG-0001", planId: "d-mp1",
      recordedAt: ago(2), valueNumeric: 73.2, valueText: null, unit: "°C", withinLimits: true,
      recordedById: "demo-u2", notes: null, evidenceId: null, ...stamps,
      plan: { code: "MON-0001", title: "Monitoreo pasteurización", ccpId: "d-ccp1" },
    }, {
      id: "d-mr2", organizationId: "demo", code: "REG-0002", planId: "d-mp1",
      recordedAt: ago(1), valueNumeric: 68.0, valueText: null, unit: "°C", withinLimits: false,
      recordedById: "demo-u2", notes: "Alarma de temperatura", evidenceId: null, ...stamps,
      plan: { code: "MON-0001", title: "Monitoreo pasteurización", ccpId: "d-ccp1" },
    }],
    deviations: [{
      id: "d-d1", organizationId: "demo", code: "DES-0001", title: "Temperatura bajo límite crítico",
      description: "68 °C registrados", ccpId: "d-ccp1", monitoringRecordId: "d-mr2",
      detectedAt: ago(1), status: "UNDER_CORRECTION", severity: "MAJOR", productHold: true,
      lotCodes: ["LOT-0003"], capaId: null, closedAt: null, createdById: "demo-u2", ...stamps,
      ccp: { code: "CCP-0001", name: "Pasteurización" }, _count: { corrections: 1 },
    }],
    corrections: [{
      id: "d-c1", organizationId: "demo", code: "COR-0001", deviationId: "d-d1",
      actionTaken: "Reproceso del lote y calibración del sensor", completedAt: ago(1),
      verifiedById: null, verifiedAt: null, effective: null, capaId: null, evidenceId: null,
      createdById: "demo-u2", ...stamps, deviation: { code: "DES-0001", title: "Temperatura bajo límite crítico" },
    }],
    validations: [{
      id: "d-v1", organizationId: "demo", code: "VAL-0001", title: "Validación pasteurización 72 °C/15 s",
      targetType: "CCP", targetCode: "CCP-0001", method: "Estudios de letalidad",
      result: "VALID", findings: "Cumple criterio de 5-log", validatedAt: ago(60),
      validatedById: "demo-u1", documentId: null, evidenceId: null, createdById: "demo-u1", ...stamps,
    }],
    verifications: [{
      id: "d-ver1", organizationId: "demo", code: "VER-0001", title: "Revisión de registros CCP",
      activityType: "RECORD_REVIEW", scheduledFor: ago(7), completedAt: ago(6),
      result: "CONFORMING", findings: "Registros completos", responsibleId: "demo-u1",
      documentId: null, evidenceId: null, createdById: "demo-u1", ...stamps,
    }],
    lots: [{
      id: "d-l1", organizationId: "demo", code: "LOT-0001", lotType: "RAW_MATERIAL",
      productId: null, rawMaterialId: "d-m1", supplierId: "sup-demo", customerName: null,
      quantity: 5000, unit: "L", producedAt: null, receivedAt: ago(10), expiresAt: ago(-5),
      previousLotIds: [], processStepCode: "PAS-0001", locationId: null, distributionRef: null,
      status: "CONSUMED", notes: null, createdById: "demo-u1", ...stamps,
      product: null, rawMaterial: { code: "MP-0001", name: "Leche pasteurizada" },
    }, {
      id: "d-l2", organizationId: "demo", code: "LOT-0002", lotType: "INTERMEDIATE",
      productId: "d-p1", rawMaterialId: null, supplierId: null, customerName: null,
      quantity: 4800, unit: "L", producedAt: ago(9), receivedAt: null, expiresAt: null,
      previousLotIds: ["d-l1"], processStepCode: "PAS-0001", locationId: null, distributionRef: null,
      status: "CONSUMED", notes: null, createdById: "demo-u1", ...stamps,
      product: { code: "PROD-0001", name: "Yogur natural 125 g" }, rawMaterial: null,
    }, {
      id: "d-l3", organizationId: "demo", code: "LOT-0003", lotType: "FINISHED",
      productId: "d-p1", rawMaterialId: null, supplierId: null, customerName: "Distribuidora Norte",
      quantity: 20000, unit: "ud", producedAt: ago(8), receivedAt: null, expiresAt: ago(-20),
      previousLotIds: ["d-l2"], processStepCode: "PAS-0002", locationId: null,
      distributionRef: "DESP-7781", status: "ON_HOLD", notes: "Retenido por desviación CCP",
      createdById: "demo-u1", ...stamps,
      product: { code: "PROD-0001", name: "Yogur natural 125 g" }, rawMaterial: null,
    }],
    recalls: [{
      id: "d-r1", organizationId: "demo", code: "RET-0001", title: "Retiro preventivo LOT-0003",
      reason: "Desviación de pasteurización", recallType: "WITHDRAWAL",
      lotCodes: ["LOT-0003"], status: "IN_PROGRESS", initiatedAt: ago(1),
      notifiedAt: ago(1), closedAt: null, customersNotified: "Distribuidora Norte",
      authorityNotified: false, quantityAffected: 20000, unit: "ud",
      capaId: null, documentId: null, evidenceId: null, createdById: "demo-u1", ...stamps,
    }],
    allergens: [{
      id: "d-al1", organizationId: "demo", code: "ALR-LECHE", name: "Leche y productos lácteos",
      category: "EU-14", description: "Alérgeno mayoritario", active: true, createdById: "demo-u1", ...stamps,
    }],
    emergencies: [{
      id: "d-e1", organizationId: "demo", code: "EME-0001", title: "Fallo de pasteurizador",
      emergencyType: "CONTAMINATION", description: "Parada de línea y retención",
      status: "CONTAINED", activatedAt: ago(1), closedAt: null, recallId: "d-r1",
      capaId: null, documentId: null, evidenceId: null, createdById: "demo-u1", ...stamps,
    }],
    lastTraceTest: {
      backward: {
        direction: "BACKWARD", rootCode: "LOT-0003",
        nodes: [
          { id: "d-l3", code: "LOT-0003", lotType: "FINISHED", previousLotIds: ["d-l2"] },
          { id: "d-l2", code: "LOT-0002", lotType: "INTERMEDIATE", previousLotIds: ["d-l1"] },
          { id: "d-l1", code: "LOT-0001", lotType: "RAW_MATERIAL", previousLotIds: [] },
        ],
        edges: [{ from: "LOT-0003", to: "LOT-0002" }, { from: "LOT-0002", to: "LOT-0001" }],
        complete: true, missingIds: [],
      },
      forward: {
        direction: "FORWARD", rootCode: "LOT-0003",
        nodes: [{ id: "d-l3", code: "LOT-0003", lotType: "FINISHED", previousLotIds: ["d-l2"] }],
        edges: [], complete: true, missingIds: [],
      },
      ok: true,
      summary: "Prueba OK: 3 nodos atrás, 1 adelante desde LOT-0003.",
    },
    summary: {
      products: 1, materials: 1, flows: 1, hazards: 1, significantHazards: 1,
      prps: 1, oprps: 1, ccps: 1, openDeviations: 1, outOfLimit: 1, lots: 3,
      openRecalls: 1, allergens: 1, openEmergencies: 1, pendingValidations: 0, pendingVerifications: 0,
    },
  };
}
