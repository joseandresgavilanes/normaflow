"use server";

import { revalidatePath } from "next/cache";
import { ClauseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

const PATH = "/app/gap";

/** Default clause status derived from a 0–100 score when not set explicitly. */
function statusFromScore(score: number): ClauseStatus {
  if (score >= 80) return "COMPLIANT";
  if (score >= 40) return "PARTIALLY_COMPLIANT";
  return "NON_COMPLIANT";
}

/**
 * Recompute the assessment's global score (and the headline OrganizationStandard
 * score the dashboard reads) from its answers. NOT_APPLICABLE clauses are excluded.
 */
async function recomputeAssessmentScore(assessmentId: string): Promise<number> {
  const answers = await prisma.assessmentAnswer.findMany({
    where: { assessmentId, status: { not: "NOT_APPLICABLE" } },
    select: { score: true },
  });
  const globalScore = answers.length
    ? Math.round(answers.reduce((sum, a) => sum + a.score, 0) / answers.length)
    : 0;
  const assessment = await prisma.assessment.update({
    where: { id: assessmentId },
    data: { globalScore },
    select: { organizationId: true, standardId: true },
  });
  await prisma.organizationStandard.updateMany({
    where: { organizationId: assessment.organizationId, standardId: assessment.standardId },
    data: { score: globalScore },
  });
  return globalScore;
}

export type UpdateAssessmentAnswerInput = {
  score?: number;
  status?: ClauseStatus;
  comment?: string | null;
};

/**
 * Persist a GAP assessment answer (score / status / comment) for one clause and
 * recompute the assessment + standard scores. Tenant- and permission-checked.
 */
export async function updateAssessmentAnswer(answerId: string, input: UpdateAssessmentAnswerInput) {
  const ctx = await requirePermission("gap:update");

  const answer = await prisma.assessmentAnswer.findUnique({
    where: { id: answerId },
    include: {
      assessment: { select: { organizationId: true } },
      clause: { select: { code: true } },
    },
  });
  if (!answer || answer.assessment.organizationId !== ctx.organization.id) {
    throw new Error("Respuesta de evaluación no encontrada.");
  }

  const before = { score: answer.score, status: answer.status, comment: answer.comment };

  const score =
    input.score !== undefined ? Math.max(0, Math.min(100, Math.round(input.score))) : answer.score;
  const status =
    input.status !== undefined
      ? input.status
      : input.score !== undefined
        ? statusFromScore(score)
        : answer.status;
  const comment =
    input.comment !== undefined ? input.comment?.trim() || null : answer.comment;

  await prisma.assessmentAnswer.update({
    where: { id: answerId },
    data: { score, status, comment },
  });

  const globalScore = await recomputeAssessmentScore(answer.assessmentId);

  await logAuditEvent({
    ctx,
    action: "update",
    module: "gap",
    recordId: answerId,
    before,
    after: { score, status, comment, clause: answer.clause.code },
  });

  revalidatePath(PATH);
  return { score, status, comment, globalScore };
}
