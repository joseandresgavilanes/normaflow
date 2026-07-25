import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import IntegratedClient from "@/components/integrated/IntegratedClient";
import { getAppContext } from "@/lib/app-context";
import { getIntegratedPayload, type IntegratedPayload } from "@/lib/integrated/queries";
import { isAuthorizationError } from "@/lib/permissions/server";
import type { Discipline } from "@prisma/client";
import { SIG_CROSSWALK } from "@/lib/standard-packs";

export const metadata = { title: "Sistema Integrado de Gestión | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function IntegratedPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="integrated:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <IntegratedClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <IntegratedClient initial={await getIntegratedPayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[integrated] live payload failed:", error);
    return <LiveDataUnavailable section="Sistema Integrado de Gestión" />;
  }
}

/** Demo: catálogo de correspondencias, sin datos de organización. */
function demoPayload(): IntegratedPayload {
  const families = ["ISO_9001", "ISO_14001", "ISO_45001"] as const;
  const disciplineByFamily: Record<string, Discipline> = { ISO_9001: "QUALITY", ISO_14001: "ENVIRONMENT", ISO_45001: "SAFETY" };
  const crosswalk = SIG_CROSSWALK.slice(0, 40).map((m, i) => ({
    requirementId: `demo-${i}`,
    code: m.sourceCode,
    title: m.notes ?? "Requisito del sistema integrado",
    familyCode: m.sourceFamily,
    kind: (m.relationType === "EQUIVALENT" ? "EQUIVALENT" : "PARTIAL") as "EQUIVALENT" | "PARTIAL" | "SPECIFIC",
    related: [{
      requirementId: `demo-t-${i}`, code: m.targetCode, familyCode: m.targetFamily,
      relationType: (m.relationType ?? "RELATED") as "EQUIVALENT" | "PARTIAL" | "RELATED" | "SUPERSEDES",
      equivalencePercent: m.equivalencePercent ?? null,
    }],
    sharedDocuments: [], sharedEvidence: [], coverageCount: 0,
    responsibleId: null, responsibleName: null,
  }));

  return {
    canManage: false,
    canUpdate: false,
    system: {
      id: "demo", name: "Sistema Integrado de Gestión",
      scope: "Diseño, producción y distribución en la planta principal.",
      scopeExclusions: null,
      policy: "Política integrada de calidad, ambiente y seguridad y salud en el trabajo.",
      policyVersion: "1.0", policyApprovedAt: null, policyApprovedByName: null,
      boundaries: null, contextNotes: null,
      standards: families.map((f, i) => ({
        id: `demo-${i}`, standardCode: f, discipline: disciplineByFamily[f],
        scopeNote: null, exclusions: null, responsibleId: null,
      })),
    },
    activeStandards: families.map((f, i) => ({
      editionId: `demo-${i}`, familyCode: f, name: f.replace("_", " "),
      editionCode: f === "ISO_45001" ? "2018" : "2015",
      discipline: disciplineByFamily[f], score: [78, 65, 71][i], implementationStatus: "IN_PROGRESS",
    })),
    interestedParties: [], objectives: [],
    crosswalk,
    compliance: families.map((f, i) => ({
      familyCode: f, discipline: disciplineByFamily[f], total: 36,
      evaluated: 30, score: [78, 65, 71][i], covered: 22, missingEvidence: 14,
    })),
    globalScore: 71,
    integrationRate: 68,
    reuseFactor: 2.4,
    multiNormEntities: [], processes: [], members: [],
    audits: [], integratedAuditCount: 0, multiNormFindings: [],
    capas: [], risks: [], reviews: [],
    summary: {
      standards: 3, requirements: crosswalk.length,
      equivalent: crosswalk.filter((c) => c.kind === "EQUIVALENT").length,
      partial: crosswalk.filter((c) => c.kind === "PARTIAL").length,
      specific: 0, missingEvidence: 0, sharedElements: 0,
      criticalRisks: 0, openCapas: 0, integratedAudits: 0,
    },
  };
}
