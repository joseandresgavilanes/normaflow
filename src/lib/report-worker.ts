import "server-only";
import { randomUUID } from "node:crypto";
import { ReportArtifactStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildTablePdf } from "@/lib/export/pdf";
import { buildXlsx } from "@/lib/export/xlsx";
import { completeReportArtifact, failReportArtifact, recoverStaleReportArtifacts, startReportArtifact, REPORT_WORKER_TIMEOUT_MS } from "@/lib/report-artifacts";
import { filterSummary, pdfColumns, reportRows } from "@/lib/actions/reporting";
import type { ReportFilters, ReportId } from "@/lib/reporting-contract";

type WorkerResult = { processed: number; completed: number; failed: number; recovered: number };

function normalizedReportId(reportType: string): ReportId {
  const aliases: Record<string, ReportId> = {
    audit_program: "audit-program",
    audit_report: "audit",
    management_review: "management-review",
    operations: "exec",
  };
  const reportId = aliases[reportType] ?? reportType;
  const supported: readonly string[] = ["gap", "documents", "risks", "audit-program", "audit", "capa", "actions", "indicators", "evidence", "management-review", "audit-package", "records", "security-controls", "exec", "iso", "site", "train", "changes", "soa", "excluded-controls", "pending-controls", "control-evidence", "risk-matrix", "risk-treatment-plan", "residual-risks", "assets", "asset-classification", "asset-risks", "asset-controls", "incident-log", "incident-report", "open-vulnerabilities", "remediation-plan", "continuity-plans", "bcp-dr-tests", "critical-suppliers"];
  if (!supported.includes(reportId)) throw new Error(`Tipo de reporte no soportado: ${reportType}`);
  return reportId as ReportId;
}

function filtersFromArtifact(value: Prisma.JsonValue | null): ReportFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Los filtros del reporte no son válidos.");
  const filters = value as Record<string, unknown>;
  if (typeof filters.from !== "string" || typeof filters.to !== "string") throw new Error("El reporte no contiene un rango de fechas válido.");
  return {
    from: filters.from,
    to: filters.to,
    ...(typeof filters.standardCode === "string" ? { standardCode: filters.standardCode } : {}),
    ...(typeof filters.status === "string" ? { status: filters.status } : {}),
    ...(typeof filters.recordId === "string" ? { recordId: filters.recordId } : {}),
    ...(typeof filters.ownerId === "string" ? { ownerId: filters.ownerId } : {}),
    ...(typeof filters.domain === "string" ? { domain: filters.domain } : {}),
    ...(typeof filters.applicability === "string" ? { applicability: filters.applicability } : {}),
  };
}

async function renderArtifact(artifact: { organizationId: string; generatedById: string | null; reportType: string; title: string; format: "PDF" | "EXCEL"; filters: Prisma.JsonValue | null }) {
  const reportId = normalizedReportId(artifact.reportType);
  const filters = filtersFromArtifact(artifact.filters);
  const rows = await reportRows(reportId, artifact.organizationId, filters);
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: artifact.organizationId }, select: { name: true, logoUrl: true } });
  const generatedBy = artifact.generatedById ? await prisma.user.findUnique({ where: { id: artifact.generatedById }, select: { name: true } }) : null;
  const summaries = await filterSummary(filters);
  const summary = [`${rows.length} registro${rows.length === 1 ? "" : "s"} en el periodo seleccionado.`, ...summaries];
  const bytes = artifact.format === "PDF"
    ? await buildTablePdf({ orgName: organization.name, logoUrl: organization.logoUrl, generatedBy: generatedBy?.name, filters: summaries, title: artifact.title, subtitle: "Informe corporativo NormaFlow", summary, columns: await pdfColumns(rows), rows })
    : await buildXlsx("Informe", rows, `${artifact.title} · ${organization.name} · Generado por ${generatedBy?.name ?? "NormaFlow"} · ${summaries.join(" · ")}`);
  return { bytes, rowCount: rows.length };
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`El worker de reportes superó el timeout de ${ms} ms.`)), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

export async function runReportWorker(limit = 5): Promise<WorkerResult> {
  const recovered = (await recoverStaleReportArtifacts()).count;
  const result: WorkerResult = { processed: 0, completed: 0, failed: 0, recovered };
  for (let index = 0; index < Math.max(1, Math.min(limit, 20)); index += 1) {
    const candidate = await prisma.reportExport.findFirst({ where: { status: ReportArtifactStatus.QUEUED, nextAttemptAt: { lte: new Date() } }, orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }] });
    if (!candidate) break;
    const leaseToken = randomUUID();
    try {
      await startReportArtifact(candidate.id, candidate.organizationId, leaseToken);
    } catch {
      continue;
    }
    result.processed += 1;
    try {
      const rendered = await timeout(renderArtifact({ ...candidate, title: candidate.title ?? candidate.reportType, format: candidate.format === "PDF" ? "PDF" : "EXCEL" }), REPORT_WORKER_TIMEOUT_MS);
      await completeReportArtifact(candidate.id, candidate.organizationId, leaseToken, rendered.bytes, rendered.rowCount);
      result.completed += 1;
    } catch (error) {
      await failReportArtifact(candidate.id, candidate.organizationId, leaseToken, error instanceof Error ? error.message : "Error desconocido del worker");
      result.failed += 1;
    }
  }
  return result;
}
