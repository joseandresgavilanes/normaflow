"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { buildTablePdf, type PdfColumn } from "@/lib/export/pdf";
import { buildXlsx } from "@/lib/export/xlsx";

const REPORT_IDS = ["exec", "iso", "site", "capa", "train", "changes", "auditpack"] as const;
type ReportId = (typeof REPORT_IDS)[number];
type ExportFormat = "PDF" | "EXCEL" | "CSV";
type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

function cleanCell(value: Cell) { return value == null ? "" : String(value); }
function csvCell(value: Cell) { const text = cleanCell(value); return `"${text.replaceAll('"', '""')}"`; }
function csv(rows: Row[]) {
  const headers = rows.length ? Object.keys(rows[0]) : ["resultado"];
  // BOM para que Excel abra el CSV como UTF-8 y respete los acentos.
  return "\ufeff" + [headers.map(csvCell).join(","), ...rows.map(row => headers.map(key => csvCell(row[key])).join(","))].join("\r\n");
}

function pdfColumns(rows: Row[]): PdfColumn<Row>[] {
  const headers = rows.length ? Object.keys(rows[0]) : ["resultado"];
  return headers.map((key) => {
    const numeric = rows.every((row) => row[key] == null || typeof row[key] === "number" || typeof row[key] === "boolean");
    const longest = Math.max(key.length, ...rows.slice(0, 100).map((row) => cleanCell(row[key]).length));
    return {
      key,
      label: key.replaceAll("_", " "),
      width: numeric ? 1 : Math.min(Math.max(longest / 8, 1), 4),
      align: numeric ? "right" : "left",
    };
  });
}

async function reportRows(reportId: ReportId, organizationId: string, from: Date, to: Date): Promise<Row[]> {
  const range = { gte: from, lte: to };
  if (reportId === "exec") {
    const [documents, risks, audits, nc, training, changes, actions] = await Promise.all([
      prisma.document.count({ where: { organizationId } }), prisma.risk.count({ where: { organizationId } }),
      prisma.audit.count({ where: { organizationId, createdAt: range } }), prisma.nonconformity.count({ where: { organizationId, createdAt: range } }),
      prisma.trainingAssignment.count({ where: { organizationId, createdAt: range } }), prisma.changeRequest.count({ where: { organizationId, createdAt: range } }),
      prisma.action.count({ where: { organizationId, createdAt: range } }),
    ]);
    return [{ documentos: documents, riesgos: risks, auditorias_periodo: audits, no_conformidades_periodo: nc, formaciones_periodo: training, cambios_periodo: changes, acciones_periodo: actions }];
  }
  if (reportId === "iso") return (await prisma.organizationStandard.findMany({ where: { organizationId }, include: { standard: true } })).map(item => ({ norma: item.standard.code, nombre: item.standard.name, version: item.standard.version, avance_pct: item.score }));
  if (reportId === "site") return (await prisma.location.findMany({ where: { organizationId }, include: { _count: { select: { documents: true } } } })).map(item => ({ sede: item.name, activa: item.active, documentos: item._count.documents, descripcion: item.description }));
  if (reportId === "capa") return (await prisma.nonconformity.findMany({ where: { organizationId, createdAt: range } })).map(item => ({ titulo: item.title, fuente: item.source, severidad: item.severity, estado: item.status, vencimiento: item.dueDate?.toISOString().slice(0, 10) ?? "", eficacia_validada: item.effectivenessValidated }));
  if (reportId === "train") return (await prisma.trainingAssignment.findMany({ where: { organizationId, createdAt: range }, include: { course: true, personnel: true } })).map(item => ({ curso: item.course.title, persona: `${item.personnel.firstName} ${item.personnel.lastName}`, estado: item.status, asignada: item.assignedAt.toISOString().slice(0, 10), vence: item.dueAt.toISOString().slice(0, 10), completada: item.completedAt?.toISOString().slice(0, 10) ?? "" }));
  if (reportId === "changes") return (await prisma.changeRequest.findMany({ where: { organizationId, createdAt: range } })).map(item => ({ codigo: item.code, titulo: item.title, categoria: item.category, tipo: item.changeType, impacto: item.impact, estado: item.status, solicitante: item.requesterName }));
  return (await prisma.audit.findMany({ where: { organizationId, createdAt: range }, include: { _count: { select: { findings: true, nonconformities: true, checklistItems: true } } } })).map(item => ({ auditoria: item.title, tipo: item.type, norma: item.standardCode, estado: item.status, fecha: item.scheduledDate?.toISOString().slice(0, 10) ?? "", hallazgos: item._count.findings, no_conformidades: item._count.nonconformities, checklist: item._count.checklistItems, informe: item.reportUrl }));
}

export async function exportReport(input: { reportId: string; title: string; format: ExportFormat; from: string; to: string }) {
  const { ctx } = await requireAuthorization("reporting:read");
  if (!REPORT_IDS.includes(input.reportId as ReportId)) throw new Error("Tipo de informe no válido.");
  if (!(["PDF", "EXCEL", "CSV"] as string[]).includes(input.format)) throw new Error("Formato no válido.");
  const from = new Date(`${input.from}T00:00:00.000Z`);
  const to = new Date(`${input.to}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new Error("El rango de fechas no es válido.");
  const rows = await reportRows(input.reportId as ReportId, ctx.organization.id, from, to);
  const slug = input.reportId.replace(/[^a-z0-9-]/gi, "-");
  const extension = input.format === "PDF" ? "pdf" : input.format === "EXCEL" ? "xlsx" : "csv";
  const fileName = `${slug}-${input.from}-${input.to}.${extension}`;

  let base64: string;
  let mimeType: string;
  if (input.format === "PDF") {
    const bytes = await buildTablePdf({
      orgName: ctx.organization.name,
      title: input.title,
      subtitle: `Periodo: ${input.from} — ${input.to}`,
      summary: [`${rows.length} registro${rows.length === 1 ? "" : "s"} en el periodo seleccionado.`],
      columns: pdfColumns(rows),
      rows,
    });
    base64 = Buffer.from(bytes).toString("base64");
    mimeType = "application/pdf";
  } else if (input.format === "EXCEL") {
    const buffer = await buildXlsx("Informe", rows, `${input.title} · ${input.from} — ${input.to}`);
    base64 = buffer.toString("base64");
    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    base64 = Buffer.from(csv(rows), "utf8").toString("base64");
    mimeType = "text/csv;charset=utf-8";
  }

  const record = await prisma.reportExport.create({ data: { organizationId: ctx.organization.id, generatedById: ctx.user.id, reportType: input.reportId, format: input.format, dateFrom: from, dateTo: to, rowCount: rows.length, fileName } });
  await logAuditEvent({ ctx, action: "export", module: "reporting", recordId: record.id, extra: { reportType: input.reportId, format: input.format, rowCount: rows.length, dateFrom: input.from, dateTo: input.to } });
  revalidatePath("/app/reporting");
  revalidatePath("/app/activity");
  return { fileName, mimeType, base64, rowCount: rows.length };
}
