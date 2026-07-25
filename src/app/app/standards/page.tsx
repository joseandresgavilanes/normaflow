import AccessDenied from "@/components/app/AccessDenied";
import LiveDataUnavailable from "@/components/app/LiveDataUnavailable";
import ServerPermissionGate from "@/components/admin/ServerPermissionGate";
import StandardsEngineClient from "@/components/standards/StandardsEngineClient";
import { getAppContext } from "@/lib/app-context";
import { getStandardsEnginePayload, type StandardsEnginePayload } from "@/lib/standards-engine";
import { isAuthorizationError } from "@/lib/permissions/server";
import { STANDARD_PACKS } from "@/lib/standard-packs";

export const metadata = { title: "Normas ISO | NormaFlow" };
export const dynamic = "force-dynamic";

export default async function StandardsPage() {
  const context = await getAppContext();
  if (context?.mode === "live") {
    return <ServerPermissionGate permission="standards:read">{await renderLive()}</ServerPermissionGate>;
  }
  return <StandardsEngineClient initial={demoPayload()} demo />;
}

async function renderLive() {
  try {
    return <StandardsEngineClient initial={await getStandardsEnginePayload()} />;
  } catch (error) {
    if (isAuthorizationError(error)) return <AccessDenied />;
    console.error("[standards] live payload failed:", error);
    return <LiveDataUnavailable section="Normas ISO" />;
  }
}

/** Catalog-only payload for demo mode (no organization data). */
function demoPayload(): StandardsEnginePayload {
  return {
    canActivate: false,
    canInstall: false,
    families: STANDARD_PACKS.map((p) => ({
      code: p.editions[0].familyCode,
      name: p.editions[0].familyName,
      category: p.editions[0].category ?? null,
      editions: p.editions.map((e, i) => ({
        id: `demo-${e.familyCode}-${e.editionCode}`,
        editionCode: e.editionCode, version: e.version, status: e.status ?? "ACTIVE",
        requirementCount: e.requirements.length, active: i === 0, score: 68, implementationStatus: "IN_PROGRESS",
      })),
    })),
    active: STANDARD_PACKS.map((p) => ({
      orgStandardId: `demo-${p.code}`, editionId: `demo-${p.editions[0].familyCode}`,
      familyCode: p.editions[0].familyCode, name: p.editions[0].name, editionCode: p.editions[0].editionCode,
      score: 68, implementationStatus: "IN_PROGRESS", scope: "Toda la organización", responsibleName: "Ana García",
      nextAuditDate: null, certified: false, requirementCount: p.editions[0].requirements.length, coveredRequirements: 4,
    })),
    matrix: STANDARD_PACKS.map((p) => ({
      editionId: `demo-${p.editions[0].familyCode}`, familyCode: p.editions[0].familyCode,
      label: `${p.editions[0].familyCode} ${p.editions[0].editionCode}`,
      requirements: p.editions[0].requirements.map((r) => ({
        id: `demo-${p.editions[0].familyCode}-${r.code}`, code: r.code, title: r.title,
        level: r.code.split(".").length, mandatory: r.mandatory ?? true,
        gapStatus: null, gapScore: null, coverageCount: 0,
      })),
    })),
    correspondence: (STANDARD_PACKS.flatMap((p) => p.mappings ?? [])).map((m, i) => ({
      id: `demo-map-${i}`, sourceFamily: m.sourceFamily, sourceCode: m.sourceCode, sourceTitle: "",
      targetFamily: m.targetFamily, targetCode: m.targetCode, targetTitle: "",
      relationType: m.relationType ?? "RELATED", equivalencePercent: m.equivalencePercent ?? null,
    })),
    availablePacks: STANDARD_PACKS.map((p) => ({
      code: p.code, name: p.name, version: p.version,
      editions: p.editions.map((e) => ({ familyCode: e.familyCode, editionCode: e.editionCode })),
    })),
    members: [],
  };
}
