"use server";

import { revalidatePath } from "next/cache";
import { ClauseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { buildTablePdf } from "@/lib/export/pdf";

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

// ─── Informe GAP en PDF ────────────────────────────────────────────────────

const STATUS_PDF: Record<string, { label: string; color: [number, number, number] }> = {
  COMPLIANT: { label: "Conforme", color: [0.09, 0.64, 0.29] },
  PARTIALLY_COMPLIANT: { label: "Parcial", color: [0.85, 0.47, 0.02] },
  NON_COMPLIANT: { label: "No conforme", color: [0.86, 0.15, 0.15] },
  NOT_EVALUATED: { label: "Sin evaluar", color: [0.5, 0.5, 0.55] },
  NOT_APPLICABLE: { label: "No aplica", color: [0.5, 0.5, 0.55] },
};

export async function exportGapReport(standardCode: "ISO_9001" | "ISO_27001") {
  const ctx = await requirePermission("gap:read");
  const assessment = await prisma.assessment.findFirst({
    where: { organizationId: ctx.organization.id, standard: { code: standardCode }, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    include: { standard: true, answers: { include: { clause: true } } },
    orderBy: { updatedAt: "desc" },
  });
  if (!assessment || assessment.answers.length === 0) {
    throw new Error("No hay una evaluación GAP con datos para esta norma.");
  }

  const rows = assessment.answers
    .map(a => {
      const s = STATUS_PDF[a.status] ?? STATUS_PDF.NOT_EVALUATED;
      return { clause: a.clause.code, title: a.clause.title, score: `${a.score}%`, statusLabel: s.label, color: s.color };
    })
    .sort((x, y) => x.clause.localeCompare(y.clause, undefined, { numeric: true }));

  const evaluated = assessment.answers.filter(a => a.status !== "NOT_APPLICABLE");
  const avg = evaluated.length ? Math.round(evaluated.reduce((sum, a) => sum + a.score, 0) / evaluated.length) : 0;
  const compliant = assessment.answers.filter(a => a.status === "COMPLIANT").length;
  const partial = assessment.answers.filter(a => a.status === "PARTIALLY_COMPLIANT").length;
  const nonCompliant = assessment.answers.filter(a => a.status === "NON_COMPLIANT").length;
  const standardLabel = `${assessment.standard.code.replace("_", " ")} ${assessment.standard.version}`;

  const bytes = await buildTablePdf({
    orgName: ctx.organization.name,
    title: `Informe GAP Assessment — ${standardLabel}`,
    summary: [
      `Cumplimiento global: ${avg}%`,
      `Conforme: ${compliant}  ·  Parcial: ${partial}  ·  No conforme: ${nonCompliant}  ·  Total: ${assessment.answers.length} cláusulas`,
    ],
    columns: [
      { key: "clause", label: "Cláusula", width: 0.9, color: () => [0.32, 0.4, 0.96] },
      { key: "title", label: "Título", width: 4 },
      { key: "score", label: "Score", width: 0.7, align: "right" },
      { key: "statusLabel", label: "Estado", width: 1.2, color: (row) => row.color },
    ],
    rows,
    footerNote: "NormaFlow · Documento generado automáticamente — válido como evidencia del SGC.",
  });

  const fileName = `gap-${standardCode.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  await logAuditEvent({ ctx, action: "export", module: "gap", recordId: assessment.id, extra: { standard: standardCode, rowCount: rows.length, avg } });
  revalidatePath(PATH);
  return { fileName, mimeType: "application/pdf", base64: Buffer.from(bytes).toString("base64") };
}
