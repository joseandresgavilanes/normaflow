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

// ─── Informe GAP en PDF (server-side, sin dependencias externas) ──────────

type GapPdfRow = { clause: string; title: string; score: number; statusLabel: string; color: [number, number, number] };
type GapPdfMeta = { orgName: string; standardLabel: string; dateStr: string; avg: number; compliant: number; partial: number; nonCompliant: number; total: number };

function pdfEsc(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "?").replace(/([()\\])/g, "\\$1");
}
function txt(x: number, y: number, size: number, font: "F1" | "F2", text: string, color?: [number, number, number]): string {
  const c = color ? `${color[0]} ${color[1]} ${color[2]} rg ` : "0 0 0 rg ";
  return `BT ${c}/${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEsc(text)}) Tj ET`;
}
function rule(x: number, y: number, w: number, h: number, g: number): string {
  return `${g} ${g} ${g} rg ${x} ${y} ${w} ${h} re f`;
}
function clip(s: string, max: number): string { return s.length > max ? s.slice(0, max - 1) + "…" : s; }

/** Construye un PDF A4 multipágina con encabezado, resumen y tabla de cláusulas. */
function buildGapPdf(meta: GapPdfMeta, rows: GapPdfRow[]): string {
  const COL = { clause: 42, title: 92, score: 432, status: 486 };
  const TOP = 800, BOTTOM = 56, LINE = 19;
  const pages: string[] = [];
  let ops: string[] = [];
  let y = 0;

  function pageHeader(first: boolean) {
    ops.push(txt(42, 812, 15, "F2", meta.orgName || "Organización"));
    ops.push(txt(42, 794, 11, "F2", `Informe GAP Assessment — ${meta.standardLabel}`));
    ops.push(txt(42, 780, 9, "F1", `Generado: ${meta.dateStr}`, [0.4, 0.4, 0.45]));
    ops.push(rule(42, 773, 511, 0.8, 0.8));
    if (first) {
      ops.push(txt(42, 754, 10, "F2", `Cumplimiento global: ${meta.avg}%`, meta.avg >= 80 ? [0.09, 0.64, 0.29] : meta.avg >= 60 ? [0.85, 0.47, 0.02] : [0.86, 0.15, 0.15]));
      ops.push(txt(220, 754, 9, "F1", `Conforme: ${meta.compliant}    Parcial: ${meta.partial}    No conforme: ${meta.nonCompliant}    (${meta.total} cláusulas)`, [0.3, 0.3, 0.35]));
      y = 728;
    } else {
      y = 760;
    }
    // table header
    ops.push(rule(42, y + 13, 511, 0.6, 0.85));
    ops.push(txt(COL.clause, y, 8, "F2", "CLÁUSULA"));
    ops.push(txt(COL.title, y, 8, "F2", "TÍTULO"));
    ops.push(txt(COL.score, y, 8, "F2", "SCORE"));
    ops.push(txt(COL.status, y, 8, "F2", "ESTADO"));
    ops.push(rule(42, y - 5, 511, 0.6, 0.85));
    y -= LINE + 2;
  }

  pageHeader(true);
  for (const r of rows) {
    if (y < BOTTOM) { pages.push(ops.join("\n")); ops = []; pageHeader(false); }
    ops.push(txt(COL.clause, y, 9, "F2", r.clause, [0.32, 0.4, 0.96]));
    ops.push(txt(COL.title, y, 9, "F1", clip(r.title, 58)));
    ops.push(txt(COL.score, y, 9, "F1", `${r.score}%`));
    ops.push(txt(COL.status, y, 9, "F1", r.statusLabel, r.color));
    y -= LINE;
  }
  ops.push(txt(42, 40, 7, "F1", "NormaFlow · Documento generado automáticamente — válido como evidencia del SGC.", [0.5, 0.5, 0.55]));
  pages.push(ops.join("\n"));

  // Ensamblar objetos PDF
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageObjNums = pages.map((_, i) => 5 + i * 2);
  objects.push(`<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  pages.forEach((stream, i) => {
    const contentNum = 6 + i * 2;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });

  let result = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(result)); result += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return result;
}

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

  const rows: GapPdfRow[] = assessment.answers
    .map(a => {
      const s = STATUS_PDF[a.status] ?? STATUS_PDF.NOT_EVALUATED;
      return { clause: a.clause.code, title: a.clause.title, score: a.score, statusLabel: s.label, color: s.color };
    })
    .sort((x, y) => x.clause.localeCompare(y.clause, undefined, { numeric: true }));

  const evaluated = assessment.answers.filter(a => a.status !== "NOT_APPLICABLE");
  const avg = evaluated.length ? Math.round(evaluated.reduce((sum, a) => sum + a.score, 0) / evaluated.length) : 0;
  const meta: GapPdfMeta = {
    orgName: ctx.organization.name,
    standardLabel: `${assessment.standard.code.replace("_", " ")} ${assessment.standard.version}`,
    dateStr: new Date().toLocaleDateString("es"),
    avg,
    compliant: assessment.answers.filter(a => a.status === "COMPLIANT").length,
    partial: assessment.answers.filter(a => a.status === "PARTIALLY_COMPLIANT").length,
    nonCompliant: assessment.answers.filter(a => a.status === "NON_COMPLIANT").length,
    total: assessment.answers.length,
  };

  const content = buildGapPdf(meta, rows);
  const fileName = `gap-${standardCode.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
  await logAuditEvent({ ctx, action: "export", module: "gap", recordId: assessment.id, extra: { standard: standardCode, rowCount: rows.length, avg } });
  revalidatePath(PATH);
  return { fileName, mimeType: "application/pdf", base64: Buffer.from(content, "latin1").toString("base64") };
}
