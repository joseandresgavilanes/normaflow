import type { ACPMStage } from "@prisma/client";

/**
 * ACPM is a gated workflow. The map is deliberately directional: rework is
 * only possible through an explicit rejection, never by an arbitrary jump.
 */
export const ACPM_NEXT_STAGE: Record<ACPMStage, ACPMStage | null> = {
  REQUEST: "REQUEST_APPROVAL",
  REQUEST_APPROVAL: "ANALYSIS",
  ANALYSIS: "SOLUTION_APPROVAL",
  SOLUTION_APPROVAL: "IMPLEMENTATION",
  IMPLEMENTATION: "VERIFICATION",
  VERIFICATION: "CLOSED",
  CLOSED: null,
};

export const ACPM_REJECTION_STAGE: Partial<Record<ACPMStage, ACPMStage>> = {
  REQUEST_APPROVAL: "REQUEST",
  SOLUTION_APPROVAL: "ANALYSIS",
};

export function nextACPMStage(stage: ACPMStage): ACPMStage | null {
  return ACPM_NEXT_STAGE[stage];
}

export function assertACPMTransition(from: ACPMStage, to: ACPMStage): void {
  if (ACPM_NEXT_STAGE[from] !== to) {
    throw new Error(`Transición ACPM no permitida: ${from} → ${to}.`);
  }
}

export function rejectionStage(stage: ACPMStage): ACPMStage | null {
  return ACPM_REJECTION_STAGE[stage] ?? null;
}

export function canCloseACPM(input: {
  stage: ACPMStage;
  progress: number;
  effectivenessEvidence: string | null;
  effectivenessVerifiedAt: Date | null;
}): boolean {
  return input.stage === "VERIFICATION" && input.progress >= 100 && Boolean(input.effectivenessEvidence?.trim()) && Boolean(input.effectivenessVerifiedAt);
}
