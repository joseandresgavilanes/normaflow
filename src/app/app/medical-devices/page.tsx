import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import MedicalDevicesClient from "@/components/medical-devices/MedicalDevicesClient";
import { getAppContext } from "@/lib/app-context";
import { getMedicalDevicesPayload, type MedicalDevicesPayload } from "@/lib/medical-devices/queries";
import { isAuthorizationError } from "@/lib/permissions/server";

export const metadata = { title: "Dispositivos médicos | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function MedicalDevicesPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="medical-devices:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <MedicalDevicesClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <MedicalDevicesClient initial={await getMedicalDevicesPayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[medical-devices] live payload failed:", error);
    return <LiveDataUnavailable section="Calidad de dispositivos médicos" />;
  }
}

const day = 86400000;
const ago = (days: number) => new Date(Date.now() - day * days);
const ahead = (days: number) => new Date(Date.now() + day * days);
const stamps = { createdAt: ago(90), updatedAt: ago(2) };

function demoPayload(): MedicalDevicesPayload {
  return {
    can: {
      create: false, update: false, approve: false, export: false,
      sensitiveRead: true, sensitiveCreate: false, sensitiveUpdate: false,
    },
    disclaimer:
      "Este módulo es una herramienta de gestión de calidad configurable. No sustituye los requisitos regulatorios nacionales aplicables (p. ej. MDR, FDA QSR/QMSR u otros).",
    members: [{ id: "demo-u1", name: "Elena QA" }, { id: "demo-u2", name: "Marco RA" }],
    families: [{
      id: "d-fam1", organizationId: "demo", code: "FAM-0001", name: "Monitores portátiles",
      description: null, active: true, createdById: "demo-u1", ...stamps,
    }],
    devices: [{
      id: "d-dev1", organizationId: "demo", code: "DEV-0001", name: "Monitor SpO2 NF-100",
      modelNumber: "NF-100", udiDi: "UDI-DI-DEMO-100", familyId: "d-fam1",
      classification: "IIa", intendedUse: "Medición no invasiva de SpO2 en adultos",
      status: "PRODUCTION", processId: null, documentId: null, createdById: "demo-u1", ...stamps,
      family: { code: "FAM-0001", name: "Monitores portátiles" },
    }],
    dmrs: [{
      id: "d-dmr1", organizationId: "demo", code: "DMR-0001", deviceId: "d-dev1",
      version: "2", title: "Expediente maestro NF-100", summary: "Especificaciones y BOM",
      status: "APPROVED", approvedById: "demo-u1", approvedAt: ago(30), documentId: null,
      createdById: "demo-u1", ...stamps, device: { code: "DEV-0001", name: "Monitor SpO2 NF-100" },
    }],
    dhfs: [{
      id: "d-dhf1", organizationId: "demo", code: "DHF-0001", deviceId: "d-dev1",
      title: "Historial de diseño NF-100", status: "UNDER_REVIEW", documentId: null,
      createdById: "demo-u1", ...stamps,
      device: { code: "DEV-0001", name: "Monitor SpO2 NF-100" },
      _count: { inputs: 2, outputs: 2, reviews: 1, verifications: 1, validations: 1 },
    }],
    inputs: [{
      id: "d-in1", organizationId: "demo", code: "DI-0001", dhfId: "d-dhf1",
      requirement: "Precisión SpO2 ±2% en rango 70–100%", source: "Cliente / norma IEC",
      status: "CLOSED", createdById: "demo-u1", ...stamps,
    }, {
      id: "d-in2", organizationId: "demo", code: "DI-0002", dhfId: "d-dhf1",
      requirement: "Alarma visual y acústica ante desaturación", source: "Uso previsto",
      status: "OPEN", createdById: "demo-u1", ...stamps,
    }],
    outputs: [{
      id: "d-out1", organizationId: "demo", code: "DO-0001", dhfId: "d-dhf1",
      description: "Firmware v1.2 con algoritmo SpO2", linkedInputCodes: ["DI-0001"],
      documentId: null, status: "CLOSED", createdById: "demo-u1", ...stamps,
    }, {
      id: "d-out2", organizationId: "demo", code: "DO-0002", dhfId: "d-dhf1",
      description: "UI de alarmas y umbrales configurables", linkedInputCodes: ["DI-0002"],
      documentId: null, status: "OPEN", createdById: "demo-u1", ...stamps,
    }],
    reviews: [{
      id: "d-rev1", organizationId: "demo", code: "DRV-0001", dhfId: "d-dhf1",
      reviewDate: ago(14), outcome: "APPROVED_WITH_ACTIONS", findings: "Completar ensayo de usabilidad",
      reviewedById: "demo-u1", documentId: null, evidenceId: null, createdById: "demo-u1", ...stamps,
    }],
    verifications: [{
      id: "d-ver1", organizationId: "demo", code: "DVE-0001", dhfId: "d-dhf1",
      method: "Ensayo de precisión vs. patrón", acceptanceCriteria: "±2% SpO2",
      result: "PASS", verifiedAt: ago(20), verifiedById: "demo-u1",
      evidenceId: null, documentId: null, createdById: "demo-u1", ...stamps,
    }],
    validations: [{
      id: "d-val1", organizationId: "demo", code: "DVA-0001", dhfId: "d-dhf1",
      method: "Validación clínica simulada (usabilidad)", userNeedsRef: "UN-ALARM-01",
      result: "PASS", validatedAt: ago(10), validatedById: "demo-u2",
      evidenceId: null, documentId: null, createdById: "demo-u2", ...stamps,
    }],
    transfers: [{
      id: "d-xfr1", organizationId: "demo", code: "DTR-0001", dhfId: "d-dhf1",
      transferredAt: null, receivingSite: "Planta contrato A", checklistSummary: "BOM + instrucciones de proceso",
      status: "IN_PROGRESS", documentId: null, evidenceId: null, createdById: "demo-u1", ...stamps,
    }],
    riskFiles: [{
      id: "d-risk1", organizationId: "demo", code: "DRF-0001", deviceId: "d-dev1",
      version: "1", title: "Archivo de riesgos NF-100", methodology: "ISO 14971 (configurable)",
      linkedRiskIds: [], residualRiskSummary: "Riesgos residuales aceptables tras mitigación",
      status: "APPROVED", documentId: null, createdById: "demo-u1", ...stamps,
      device: { code: "DEV-0001", name: "Monitor SpO2 NF-100" },
    }],
    suppliers: [{
      id: "d-sup1", organizationId: "demo", code: "MCS-0001", name: "Sensor OEM Precision",
      serviceType: "Componente crítico SpO2", criticality: "CRITICAL", status: "ACTIVE",
      supplierId: null, documentId: null, createdById: "demo-u1", ...stamps,
    }],
    qualifications: [{
      id: "d-qual1", organizationId: "demo", code: "MSQ-0001", criticalSupplierId: "d-sup1",
      scope: "Sensor SpO2", status: "QUALIFIED", qualifiedAt: ago(120), nextReviewAt: ahead(60),
      evidenceId: null, documentId: null, createdById: "demo-u1", ...stamps,
      criticalSupplier: { code: "MCS-0001", name: "Sensor OEM Precision" },
    }],
    processVals: [{
      id: "d-pv1", organizationId: "demo", code: "MPV-0001", deviceId: "d-dev1", processId: null,
      title: "Soldadura láser carcasa", protocolRef: "IQ/OQ/PQ-LASER-01", result: "PASS",
      validatedAt: ago(45), validatedById: "demo-u1", evidenceId: null, documentId: null,
      createdById: "demo-u1", ...stamps, device: { code: "DEV-0001", name: "Monitor SpO2 NF-100" },
    }],
    sterVals: [],
    batches: [{
      id: "d-bat1", organizationId: "demo", code: "BAT-0001", deviceId: "d-dev1",
      lotNumber: "L2026-0042", quantity: 500, unit: "ud", manufacturedAt: ago(7),
      expiryAt: ahead(730), status: "RELEASED", processValidationId: "d-pv1", notes: null,
      createdById: "demo-u1", ...stamps,
      device: { code: "DEV-0001", name: "Monitor SpO2 NF-100" },
    }],
    traces: [{
      id: "d-tr1", organizationId: "demo", code: "TRC-0001", batchId: "d-bat1",
      componentLot: null, supplierLot: "SUP-L-991", distributionRef: "SHIP-ACME-07",
      customerAccountRef: "DIST-ACME-01", previousIds: [], notes: "Canal hospitalario",
      createdById: "demo-u1", ...stamps,
      batch: { code: "BAT-0001", lotNumber: "L2026-0042" },
    }],
    complaints: [{
      id: "d-cmp1", organizationId: "demo", code: "CMP-0001", deviceId: "d-dev1", batchId: "d-bat1",
      source: "CUSTOMER", category: "Funcional", description: "Alarma no audible en entorno ruidoso",
      status: "INVESTIGATING", receivedAt: ago(3), anonymizedSubjectRef: "CASE-8841",
      investigationSummary: null, capaId: null, evidenceId: null, documentId: null, closedAt: null,
      createdById: "demo-u2", ...stamps,
      device: { code: "DEV-0001", name: "Monitor SpO2 NF-100" },
      batch: { code: "BAT-0001", lotNumber: "L2026-0042" },
    }],
    adverseEvents: [{
      id: "d-ae1", organizationId: "demo", code: "AE-0001", deviceId: "d-dev1", batchId: "d-bat1",
      complaintId: "d-cmp1", severity: "MODERATE", reportable: false, reportedToAuthority: false,
      description: "Retraso en detección de desaturación reportado por usuario",
      status: "UNDER_REVIEW", reportedAt: ago(2), anonymizedSubjectRef: "CASE-8841",
      capaId: null, evidenceId: null, documentId: null, closedAt: null,
      createdById: "demo-u2", ...stamps,
      device: { code: "DEV-0001", name: "Monitor SpO2 NF-100" },
      batch: { code: "BAT-0001", lotNumber: "L2026-0042" },
      complaint: { code: "CMP-0001" },
    }],
    pms: [{
      id: "d-pms1", organizationId: "demo", code: "PMS-0001", deviceId: "d-dev1",
      title: "PMS 2026-H1", periodStart: ago(180), periodEnd: ago(1),
      status: "COMPLETED", findings: "Tasa de quejas dentro de umbral",
      documentId: null, evidenceId: null, createdById: "demo-u2", ...stamps,
      device: { code: "DEV-0001", name: "Monitor SpO2 NF-100" },
    }],
    fieldActions: [],
    recalls: [],
    requirements: [{
      id: "d-req1", organizationId: "demo", code: "REG-0001",
      framework: "MDR", title: "Clasificación y evaluación de conformidad (configurable)",
      clauseRef: "Anexo VIII", jurisdiction: "UE", description: null, mandatory: true, active: true,
      createdById: "demo-u2", ...stamps,
    }],
    submissions: [{
      id: "d-sub1", organizationId: "demo", code: "SUB-0001", deviceId: "d-dev1",
      jurisdiction: "UE", submissionType: "CE_TECHNICAL_FILE", status: "SUBMITTED",
      submittedAt: ago(40), referenceNumber: "TF-NF100-26",
      summary: "Expediente técnico de demostración", documentId: null, evidenceId: null,
      createdById: "demo-u2", ...stamps,
      device: { code: "DEV-0001", name: "Monitor SpO2 NF-100" },
    }],
    coverage: { covered: ["DI-0001", "DI-0002"], uncovered: [], percent: 100 },
    summary: {
      devices: 1, dmrsApproved: 1, dhfsOpen: 1, inputCoveragePercent: 100,
      openComplaints: 1, openAdverseEvents: 1, openRecalls: 0, batchesReleased: 1,
      criticalSuppliers: 1, activeRequirements: 1, sensitiveLocked: false,
    },
  };
}
