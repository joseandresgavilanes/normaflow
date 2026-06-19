"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";

const REPORT_IDS = ["exec", "iso", "site", "capa", "train", "changes", "auditpack"] as const;
type ReportId = (typeof REPORT_IDS)[number];
type ExportFormat = "PDF" | "EXCEL" | "CSV";
type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

function cleanCell(value: Cell) { return value == null ? "" : String(value); }
function csvCell(value: Cell) { const text = cleanCell(value); return `"${text.replaceAll('"', '""')}"`; }
function csv(rows: Row[]) {
  const headers = rows.length ? Object.keys(rows[0]) : ["resultado"];
  return [headers.map(csvCell).join(","), ...rows.map(row => headers.map(key => csvCell(row[key])).join(","))].join("\r\n");
}
function xml(rows: Row[]) {
  const headers = rows.length ? Object.keys(rows[0]) : ["resultado"];
  const esc = (value: Cell) => cleanCell(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const line = (values: Cell[]) => `<Row>${values.map(value => `<Cell><Data ss:Type="String">${esc(value)}</Data></Cell>`).join("")}</Row>`;
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Informe"><Table>${line(headers)}${rows.map(row => line(headers.map(key => row[key]))).join("")}</Table></Worksheet></Workbook>`;
}
function pdf(title: string, rows: Row[]) {
  const ascii = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?").replace(/[()\\]/g, "\\$&");
  const lines = [title, "", ...csv(rows).split(/\r?\n/)].slice(0, 48).map(ascii);
  const stream = ["BT", "/F1 9 Tf", "42 800 Td", ...lines.flatMap((line, index) => index ? ["0 -15 Td", `(${line.slice(0, 110)}) Tj`] : [`(${line.slice(0, 110)}) Tj`]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let result = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(result)); result += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return result;
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
  const extension = input.format === "PDF" ? "pdf" : input.format === "EXCEL" ? "xls" : "csv";
  const fileName = `${slug}-${input.from}-${input.to}.${extension}`;
  const content = input.format === "PDF" ? pdf(input.title, rows) : input.format === "EXCEL" ? xml(rows) : csv(rows);
  const mimeType = input.format === "PDF" ? "application/pdf" : input.format === "EXCEL" ? "application/vnd.ms-excel" : "text/csv;charset=utf-8";
  const record = await prisma.reportExport.create({ data: { organizationId: ctx.organization.id, generatedById: ctx.user.id, reportType: input.reportId, format: input.format, dateFrom: from, dateTo: to, rowCount: rows.length, fileName } });
  await logAuditEvent({ ctx, action: "export", module: "reporting", recordId: record.id, extra: { reportType: input.reportId, format: input.format, rowCount: rows.length, dateFrom: input.from, dateTo: input.to } });
  revalidatePath("/app/reporting");
  revalidatePath("/app/activity");
  return { fileName, mimeType, base64: Buffer.from(content, "utf8").toString("base64"), rowCount: rows.length };
}
