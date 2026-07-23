import type { CAPAEvidenceKind, CAPAStage, ACPMEfficacyStatus } from "@prisma/client";

export const CAPA_STAGE_ORDER: CAPAStage[] = ["REGISTERED", "ROOT_CAUSE", "ACTION_PLAN", "IMPLEMENTATION", "VERIFICATION", "CLOSED"];
export const CAPA_NEXT_STAGE: Record<CAPAStage, CAPAStage | null> = { REGISTERED: "ROOT_CAUSE", ROOT_CAUSE: "ACTION_PLAN", ACTION_PLAN: "IMPLEMENTATION", IMPLEMENTATION: "VERIFICATION", VERIFICATION: "CLOSED", CLOSED: null };
export function nextCAPAStage(stage: CAPAStage): CAPAStage | null { return CAPA_NEXT_STAGE[stage]; }
export function canCloseCAPA(input: { efficacyStatus: ACPMEfficacyStatus; verifiedAt: Date | null; evidenceKinds: CAPAEvidenceKind[] }): boolean {
  return input.efficacyStatus === "EFFECTIVE" && Boolean(input.verifiedAt) && input.evidenceKinds.includes("EFFECTIVENESS");
}
