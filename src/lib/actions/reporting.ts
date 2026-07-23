"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAuthorization, requirePermission } from "@/lib/permissions/server";
import { logAuditEvent } from "@/lib/audit-log";
import { assertExportQuota } from "@/lib/plan-entitlements";
import { createReportArtifact, getReportArtifactDownload, retryReportArtifact } from "@/lib/report-artifacts";
import { createHash } from "node:crypto";
import type { PdfColumn } from "@/lib/export/pdf";
import { parseInput } from "@/lib/validation/common";
import { reportRequestSchema } from "@/lib/validation/p1";
import { REPORT_IDS, type ExportFormat, type ReportFilters, type ReportId } from "@/lib/reporting-contract";
export type { ExportFormat, ReportFilters, ReportId } from "@/lib/reporting-contract";
type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

function cleanCell(value: Cell) { return value == null ? "" : String(value); }
export async function pdfColumns(rows: Row[]): Promise<PdfColumn<Row>[]> {
  const headers = rows.length ? Object.keys(rows[0]) : ["resultado"];
  return headers.map((key) => {
    const numeric = rows.every((row) => row[key] == null || typeof row[key] === "number" || typeof row[key] === "boolean");
    const longest = Math.max(key.length, ...rows.slice(0, 100).map((row) => cleanCell(row[key]).length));
    return { key, label: key.replaceAll("_", " "), width: numeric ? 1 : Math.min(Math.max(longest / 8, 1), 4), align: numeric ? "right" : "left" };
  });
}

export async function parseFilters(filters: ReportFilters) {
  const from = new Date(`${filters.from}T00:00:00.000Z`);
  const to = new Date(`${filters.to}T23:59:59.999Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new Error("El rango de fechas no es válido.");
  return { from, to, range: { gte: from, lte: to } };
}

function rowDate(value: Date | null | undefined) { return value?.toISOString().slice(0, 10) ?? ""; }
function dateFilter(filters: ReportFilters) { return filters.standardCode ? { standardCode: filters.standardCode } : {}; }
function statusFilter(filters: ReportFilters) { return filters.status ? { status: filters.status } : {}; }

export async function reportRows(reportId: ReportId, organizationId: string, filters: ReportFilters): Promise<Row[]> {
  const { range } = await parseFilters(filters);
  if (reportId === "gap") return (await prisma.assessmentAnswer.findMany({ where: { assessment: { organizationId, createdAt: range, ...(filters.standardCode ? { standard: { code: filters.standardCode } } : {}) }, ...(filters.status ? { status: filters.status as never } : {}) }, include: { assessment: { include: { standard: true } }, clause: true }, orderBy: { clause: { code: "asc" } } })).map(item => ({ norma: item.assessment.standard.code, clausula: item.clause.code, titulo: item.clause.title, score: item.score, estado: item.status, comentario: item.comment }));
  if (reportId === "documents") return (await prisma.document.findMany({ where: ({ organizationId, createdAt: range, ...dateFilter(filters), ...statusFilter(filters) }) as Prisma.DocumentWhereInput, include: { clause: true, process: true, owner: true }, orderBy: { code: "asc" } })).map(item => ({ codigo: item.code, titulo: item.title, tipo: item.type, norma: item.standardCode, clausula: item.clause?.code ?? "", proceso: item.process?.name ?? "", responsable: item.owner?.name ?? "", version: item.currentVersion, estado: item.status, revision: rowDate(item.reviewDate) }));
  if (reportId === "risks") return (await prisma.risk.findMany({ where: ({ organizationId, createdAt: range, ...statusFilter(filters) }) as Prisma.RiskWhereInput, include: { process: true }, orderBy: [{ score: "desc" }, { createdAt: "desc" }] })).map(item => ({ titulo: item.title, categoria: item.category, proceso: item.process?.name ?? "", probabilidad: item.probability, impacto: item.impact, score: item.score, tratamiento: item.treatment, estado: item.status, vencimiento: rowDate(item.dueDate) }));
  if (reportId === "audit-program") return (await prisma.auditProgram.findMany({ where: ({ organizationId, createdAt: range, ...statusFilter(filters), ...(filters.recordId ? { id: filters.recordId } : {}) }) as Prisma.AuditProgramWhereInput, include: { audits: { include: { process: true }, orderBy: { plannedDate: "asc" } } }, orderBy: [{ year: "desc" }, { title: "asc" }] })).flatMap(program => program.audits.length ? program.audits.map(audit => ({ programa: `${program.year} · ${program.title}`, auditoria: audit.title, proceso: audit.process?.name ?? "", norma: audit.standardCode ?? "", fecha: rowDate(audit.plannedDate), auditor: audit.auditorId ?? "", estado: String(audit.status) })) : [{ programa: `${program.year} · ${program.title}`, auditoria: "Sin auditorías planificadas", proceso: "", norma: "", fecha: "", auditor: "", estado: String(program.status) }]);
  if (reportId === "audit") return (await prisma.audit.findMany({ where: ({ organizationId, createdAt: range, ...dateFilter(filters), ...statusFilter(filters), ...(filters.recordId ? { id: filters.recordId } : {}) }) as Prisma.AuditWhereInput, include: { process: true, _count: { select: { findings: true, nonconformities: true, checklistItems: true } } }, orderBy: { createdAt: "desc" } })).map(item => ({ auditoria: item.title, tipo: item.type, proceso: item.process?.name ?? "", norma: item.standardCode ?? "", estado: item.status, inicio: rowDate(item.startDate), fin: rowDate(item.endDate), hallazgos: item._count.findings, no_conformidades: item._count.nonconformities, checklist: item._count.checklistItems, informe: item.reportUrl ?? "" }));
  if (reportId === "capa") return (await prisma.cAPA.findMany({ where: ({ organizationId, createdAt: range, ...dateFilter(filters), ...statusFilter(filters), ...(filters.ownerId ? { ownerId: filters.ownerId } : {}) }) as Prisma.CAPAWhereInput, include: { owner: true, nonconformity: true }, orderBy: { createdAt: "desc" } })).map(item => ({ codigo: item.code, titulo: item.title, origen: item.origin, severidad: item.severity, prioridad: item.priority, etapa: item.stage, responsable: item.owner?.name ?? "", no_conformidad: item.nonconformity?.title ?? "", vence: rowDate(item.dueDate), avance: item.progress }));
  if (reportId === "actions") return (await prisma.action.findMany({ where: ({ organizationId, createdAt: range, ...statusFilter(filters) }) as Prisma.ActionWhereInput, orderBy: { createdAt: "desc" } })).map(item => ({ titulo: item.title, tipo: item.type, prioridad: item.priority, origen: item.source ?? "", etapa: item.stage, estado: item.status, vence: rowDate(item.dueDate), avance: item.progress }));
  if (reportId === "indicators") return (await prisma.indicator.findMany({ where: ({ organizationId, createdAt: range, ...statusFilter(filters) }) as Prisma.IndicatorWhereInput, include: { process: true, values: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { name: "asc" } })).map(item => ({ indicador: item.name, proceso: item.process?.name ?? "", unidad: item.unit, objetivo: item.target, frecuencia: item.frequency, estado: item.status, ultimo_valor: item.values[0]?.value ?? "", periodo: item.values[0]?.period ?? "" }));
  if (reportId === "evidence") return (await prisma.evidenceFile.findMany({ where: ({ organizationId, deletedAt: null, createdAt: range, ...dateFilter(filters), ...statusFilter(filters) }) as Prisma.EvidenceFileWhereInput, include: { process: true, clause: true, responsible: true }, orderBy: { createdAt: "desc" } })).map(item => ({ titulo: item.title, tipo: item.evidenceType, norma: item.standardCode ?? "", clausula: item.clause?.code ?? "", proceso: item.process?.name ?? "", responsable: item.responsible?.name ?? "", estado: item.status, emitida: rowDate(item.issuedAt), vence: rowDate(item.expiresAt) }));
  if (reportId === "management-review") return (await prisma.managementReview.findMany({ where: ({ organizationId, createdAt: range, ...statusFilter(filters), ...(filters.recordId ? { id: filters.recordId } : {}) }) as Prisma.ManagementReviewWhereInput, include: { inputs: true, decisions: true }, orderBy: { scheduledDate: "desc" } })).map(item => ({ titulo: item.title, fecha: rowDate(item.heldAt ?? item.scheduledDate), normas: item.standards.join(", "), estado: item.status, entradas: item.inputs.length, decisiones: item.decisions.length, conclusiones: item.summary ?? "" }));
  if (reportId === "records") return (await prisma.record.findMany({ where: ({ organizationId, ...(filters.status && filters.status !== "ALL" ? { active: filters.status === "ACTIVE" } : {}) }) as Prisma.RecordWhereInput, include: { process: true, clause: { include: { standard: true } }, recordType: true, retentionTime: true, disposition: true, archiveMethod: true, custodian: true, entries: { orderBy: { entryDate: "desc" }, take: 1 } }, orderBy: [{ active: "desc" }, { code: "asc" }] })).map(record => { const latest = record.entries[0]; const dueAt = latest && record.retentionTime ? new Date(latest.entryDate.getTime() + record.retentionTime.months * 30.44 * 86400000) : null; return { codigo: record.code, nombre: record.name, tipo: record.recordType?.name ?? "", norma: record.clause?.standard.code ?? "", clausula: record.clause?.code ?? "", proceso: record.process?.name ?? "", responsable: record.custodian ? `${record.custodian.firstName} ${record.custodian.lastName}`.trim() : "", vence: dueAt?.toISOString().slice(0, 10) ?? "", estado: record.active ? "ACTIVO" : "INACTIVO" }; });
  if (reportId === "security-controls") return (await prisma.organizationControl.findMany({
    where: ({ organizationId, ...(filters.status ? { status: filters.status } : {}), ...(filters.applicability ? { applicability: filters.applicability } : {}), ...(filters.ownerId ? { responsibleId: filters.ownerId } : {}), control: { active: true, ...(filters.domain ? { domain: filters.domain } : {}) } }) as Prisma.OrganizationControlWhereInput,
    include: { control: { include: { catalogVersion: true } }, responsible: true, evidence: { select: { id: true, status: true } }, riskLinks: { select: { id: true } } },
    orderBy: { control: { sortOrder: "asc" } },
  })).map(item => ({ codigo: item.control.code, dominio: item.control.domain, titulo: item.control.title, version_catalogo: item.control.catalogVersion.version, aplicabilidad: item.applicability, estado: item.status, implementacion_pct: item.implementationLevel, responsable: item.responsible?.name ?? "", revision: rowDate(item.reviewDate), proxima_revision: rowDate(item.nextReviewDate), evidencias: item.evidence.length, riesgos: item.riskLinks.length, notas: item.notes ?? "" }));
  if (reportId === "audit-package") {
    const sections: ReportId[] = ["gap", "documents", "risks", "security-controls", "audit-program", "audit", "capa", "actions", "indicators", "evidence", "management-review"];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap(group => group.rows.map(row => ({ seccion: group.section, ...row })));
  }
  if (reportId === "exec") {
    const [documents, risks, audits, nc, actions] = await Promise.all([prisma.document.count({ where: { organizationId } }), prisma.risk.count({ where: { organizationId } }), prisma.audit.count({ where: { organizationId, createdAt: range } }), prisma.nonconformity.count({ where: { organizationId, createdAt: range } }), prisma.action.count({ where: { organizationId, createdAt: range } })]);
    return [{ documentos: documents, riesgos: risks, auditorias_periodo: audits, no_conformidades_periodo: nc, acciones_periodo: actions }];
  }
  if (reportId === "iso") return (await prisma.organizationStandard.findMany({ where: { organizationId }, include: { standard: true } })).map(item => ({ norma: item.standard.code, nombre: item.standard.name, version: item.standard.version, avance_pct: item.score }));
  if (reportId === "site") return (await prisma.location.findMany({ where: { organizationId }, include: { _count: { select: { documents: true } } } })).map(item => ({ sede: item.name, activa: item.active, documentos: item._count.documents, descripcion: item.description }));
  if (reportId === "train") return (await prisma.trainingAssignment.findMany({ where: { organizationId, createdAt: range }, include: { course: true, personnel: true } })).map(item => ({ curso: item.course.title, persona: `${item.personnel.firstName} ${item.personnel.lastName}`, estado: item.status, asignada: rowDate(item.assignedAt), vence: rowDate(item.dueAt), completada: rowDate(item.completedAt) }));
  if (reportId === "soa" || reportId === "excluded-controls" || reportId === "pending-controls") {
    const soa = await prisma.statementOfApplicability.findFirst({ where: { organizationId }, orderBy: { version: "desc" }, select: { id: true } });
    if (!soa) return [];
    const where: Prisma.SoAControlEntryWhereInput = { organizationId, soaId: soa.id };
    if (reportId === "excluded-controls") where.applicability = "EXCLUDED";
    if (reportId === "pending-controls") where.OR = [{ applicability: "UNDER_REVIEW" }, { implementationStatus: { in: ["NOT_ASSESSED", "NOT_IMPLEMENTED", "PLANNED", "PARTIALLY_IMPLEMENTED"] } }];
    return (await prisma.soAControlEntry.findMany({ where, include: { responsible: true, evidence: { select: { title: true } }, relatedRiskItem: { select: { reference: true } } }, orderBy: { control: { sortOrder: "asc" } } })).map(e => ({ codigo: e.controlCode, dominio: e.controlDomain, titulo: e.controlTitle, aplicabilidad: e.applicability, justificacion: e.justification ?? "", estado_implementacion: e.implementationStatus, riesgo_relacionado: e.relatedRiskItem?.reference ?? "", responsable: e.responsible?.name ?? "", evidencia: e.evidence?.title ?? "", revision: rowDate(e.reviewDate), notas: e.notes ?? "" }));
  }
  if (reportId === "control-evidence") return (await prisma.controlEvidence.findMany({ where: { organizationId }, include: { organizationControl: { include: { control: true } }, evidence: { select: { title: true, expiresAt: true } }, validator: true }, orderBy: [{ organizationControl: { control: { sortOrder: "asc" } } }, { period: "desc" }] })).map(ce => ({ codigo: ce.organizationControl.control.code, control: ce.organizationControl.control.title, evidencia: ce.evidence.title, periodo: ce.period, estado: ce.status, validada_por: ce.validator?.name ?? "", validada: rowDate(ce.validatedAt), vence: rowDate(ce.evidence.expiresAt) }));
  if (reportId === "risk-matrix") {
    const plan = await prisma.riskTreatmentPlan.findFirst({ where: { organizationId }, orderBy: { version: "desc" }, select: { id: true } });
    if (!plan) return [];
    return (await prisma.riskTreatmentItem.findMany({ where: { organizationId, planId: plan.id }, include: { owner: true }, orderBy: [{ inherentRisk: "desc" }, { reference: "asc" }] })).map(i => ({ referencia: i.reference, riesgo: i.title, activo: i.asset ?? "", amenaza: i.threat ?? "", vulnerabilidad: i.vulnerability ?? "", impacto: i.impact, probabilidad: i.probability, riesgo_inherente: i.inherentRisk, tratamiento: i.treatment, riesgo_residual: i.residualRisk ?? "", propietario: i.owner?.name ?? "", estado: i.status }));
  }
  if (reportId === "risk-treatment-plan") {
    const plan = await prisma.riskTreatmentPlan.findFirst({ where: { organizationId }, orderBy: { version: "desc" }, select: { id: true } });
    if (!plan) return [];
    return (await prisma.riskTreatmentItem.findMany({ where: { organizationId, planId: plan.id }, include: { owner: true, controls: { include: { organizationControl: { include: { control: { select: { code: true } } } } } } }, orderBy: { reference: "asc" } })).map(i => ({ referencia: i.reference, riesgo: i.title, tratamiento: i.treatment, controles_existentes: i.existingControls ?? "", controles_propuestos: [i.proposedControls ?? "", ...i.controls.map(c => c.organizationControl.control.code)].filter(Boolean).join(", "), propietario: i.owner?.name ?? "", fecha_objetivo: rowDate(i.targetDate), estado: i.status }));
  }
  if (reportId === "residual-risks") {
    const plan = await prisma.riskTreatmentPlan.findFirst({ where: { organizationId }, orderBy: { version: "desc" }, select: { id: true } });
    if (!plan) return [];
    return (await prisma.riskTreatmentItem.findMany({ where: { organizationId, planId: plan.id, OR: [{ residualRisk: { not: null } }, { acceptances: { some: {} } }] }, include: { residualAssessments: { where: { approved: true }, orderBy: { assessedAt: "desc" }, take: 1 }, acceptances: { orderBy: { acceptedAt: "desc" }, take: 1, include: { acceptedBy: true } } }, orderBy: { reference: "asc" } })).map(i => { const acc = i.acceptances[0]; const res = i.residualAssessments[0]; return { referencia: i.reference, riesgo: i.title, riesgo_inherente: i.inherentRisk, riesgo_residual: i.residualRisk ?? "", residual_aprobado: res ? "Sí" : "No", aceptado_por: acc?.acceptedBy?.name ?? "", fecha_aceptacion: rowDate(acc?.acceptedAt ?? null), justificacion: acc?.justification ?? "", estado: i.status }; });
  }
  if (reportId === "assets") return (await prisma.informationAsset.findMany({ where: { organizationId }, include: { owner: true, custodian: true, process: true, location: true, classification: true }, orderBy: [{ criticality: "desc" }, { code: "asc" }] })).map(a => ({ codigo: a.code, nombre: a.name, categoria: a.category, criticidad: a.criticality, estado: a.status, propietario: a.owner?.name ?? "", custodio: a.custodian?.name ?? "", proceso: a.process?.name ?? "", ubicacion: a.location?.name ?? "", clasificacion: a.classification?.classification ?? "", cia: a.classification ? `${a.classification.confidentiality}/${a.classification.integrity}/${a.classification.availability}` : "", revision: rowDate(a.reviewDate), proxima_revision: rowDate(a.nextReviewDate) }));
  if (reportId === "asset-classification") return (await prisma.assetClassification.findMany({ where: { organizationId }, include: { asset: { select: { code: true, name: true, category: true } } }, orderBy: { asset: { code: "asc" } } })).map(c => ({ codigo: c.asset.code, activo: c.asset.name, categoria: c.asset.category, confidencialidad: c.confidentiality, integridad: c.integrity, disponibilidad: c.availability, clasificacion: c.classification, requisitos_legales: c.legalRequirements ?? "", retencion: c.retention ?? "" }));
  if (reportId === "asset-risks") return (await prisma.assetRisk.findMany({ where: { organizationId }, include: { asset: { select: { code: true, name: true } }, risk: { select: { title: true } } }, orderBy: { asset: { code: "asc" } } })).map(r => ({ codigo: r.asset.code, activo: r.asset.name, riesgo: r.risk?.title ?? "", amenaza: r.threat ?? "", vulnerabilidad: r.vulnerability ?? "", descripcion: r.description ?? "" }));
  if (reportId === "asset-controls") return (await prisma.assetControl.findMany({ where: { organizationId }, include: { asset: { select: { code: true, name: true } }, organizationControl: { include: { control: { select: { code: true, title: true } } } }, evidence: { select: { title: true } } }, orderBy: { asset: { code: "asc" } } })).map(c => ({ codigo_activo: c.asset.code, activo: c.asset.name, control: c.organizationControl.control.code, control_titulo: c.organizationControl.control.title, estado: c.status, evidencia: c.evidence?.title ?? "", nota: c.note ?? "" }));
  if (reportId === "incident-log" || reportId === "incident-report") {
    const rows = await prisma.securityIncident.findMany({ where: { organizationId }, include: { reporter: true, responsible: true, affectedAssets: { include: { asset: { select: { code: true } } } } }, orderBy: { detectedAt: "desc" } });
    if (reportId === "incident-report") return rows.map(i => ({ codigo: i.code, detectado: rowDate(i.detectedAt), severidad: i.severity, categoria: i.category, estado: i.status, responsable: i.responsible?.name ?? "", descripcion: i.description, impacto: i.impact ?? "", requiere_notificacion: i.notificationRequired ? "Sí" : "No", notificacion: i.notificationDetails ?? "", lecciones_aprendidas: i.lessonsLearned ?? "", activos: i.affectedAssets.map(a => a.asset.code).join(", ") }));
    return rows.map(i => ({ codigo: i.code, detectado: rowDate(i.detectedAt), ocurrido: rowDate(i.occurredAt), severidad: i.severity, categoria: i.category, estado: i.status, reportante: i.reporter?.name ?? "", responsable: i.responsible?.name ?? "", notificable: i.notificationRequired ? "Sí" : "No", activos_afectados: i.affectedAssets.length, cerrado: rowDate(i.closedAt) }));
  }
  if (reportId === "open-vulnerabilities") return (await prisma.vulnerability.findMany({ where: { organizationId, status: { notIn: ["CLOSED", "ACCEPTED"] } }, include: { responsible: true, _count: { select: { assets: true, remediations: true } } }, orderBy: [{ severity: "desc" }, { discoveredAt: "desc" }] })).map(v => ({ codigo: v.code, origen: v.source, cve: v.cve ?? "", severidad: v.severity, exposicion: v.exposure ?? "", estado: v.status, responsable: v.responsible?.name ?? "", fecha_objetivo: rowDate(v.targetDate), activos: v._count.assets, remediaciones: v._count.remediations }));
  if (reportId === "remediation-plan") return (await prisma.remediation.findMany({ where: { organizationId }, include: { vulnerability: { select: { code: true, cve: true, severity: true } }, responsible: true, _count: { select: { verifications: true } } }, orderBy: { createdAt: "desc" } })).map(m => ({ vulnerabilidad: m.vulnerability.code, cve: m.vulnerability.cve ?? "", severidad: m.vulnerability.severity, remediacion: m.description, responsable: m.responsible?.name ?? "", fecha_objetivo: rowDate(m.targetDate), estado: m.status, verificaciones: m._count.verifications }));
  if (reportId === "continuity-plans") {
    const [bcps, drps] = await Promise.all([
      prisma.businessContinuityPlan.findMany({ where: { organizationId }, include: { owner: true, _count: { select: { criticalProcesses: true, tests: true } } }, orderBy: { code: "asc" } }),
      prisma.disasterRecoveryPlan.findMany({ where: { organizationId }, include: { owner: true, bcp: { select: { code: true } } }, orderBy: { code: "asc" } }),
    ]);
    return [
      ...bcps.map(b => ({ tipo: "BCP", codigo: b.code, titulo: b.title, estado: b.status, rto_min: b.rtoMinutes ?? "", rpo_min: b.rpoMinutes ?? "", propietario: b.owner?.name ?? "", relacion: `${b._count.criticalProcesses} procesos`, revision: rowDate(b.nextReviewDate) })),
      ...drps.map(d => ({ tipo: "DRP", codigo: d.code, titulo: d.title, estado: d.status, rto_min: d.rtoMinutes ?? "", rpo_min: d.rpoMinutes ?? "", propietario: d.owner?.name ?? "", relacion: d.bcp ? `BCP ${d.bcp.code}` : "", revision: rowDate(d.nextReviewDate) })),
    ];
  }
  if (reportId === "bcp-dr-tests") return (await prisma.continuityTest.findMany({ where: { organizationId }, include: { plan: { select: { code: true } }, responsible: true, results: { orderBy: { testedAt: "desc" }, take: 1, include: { _count: { select: { improvementActions: true } } } } }, orderBy: { createdAt: "desc" } })).map(t => { const r = t.results[0]; return { plan: t.plan.code, prueba: t.title, tipo: t.type, estado: t.status, planificada: rowDate(t.plannedDate), ejecutada: rowDate(t.executedDate), responsable: t.responsible?.name ?? "", resultado: r?.outcome ?? "", rto_logrado: r?.rtoAchievedMinutes ?? "", rpo_logrado: r?.rpoAchievedMinutes ?? "", acciones_mejora: r?._count.improvementActions ?? 0 }; });
  if (reportId === "critical-suppliers") return (await prisma.supplierSecurityProfile.findMany({ where: { organizationId }, include: { supplier: { select: { code: true, name: true } } }, orderBy: [{ securityCriticality: "desc" }] })).map(p => ({ codigo: p.supplier.code, proveedor: p.supplier.name, criticidad_seguridad: p.securityCriticality, datos_tratados: p.dataProcessed ?? "", accesos: p.accessGranted ?? "", obligaciones: p.obligations ?? "", riesgo: p.riskLevel ?? "", revision: rowDate(p.nextReviewDate), vencimiento_contrato: rowDate(p.contractExpiry) }));
  return (await prisma.changeRequest.findMany({ where: ({ organizationId, createdAt: range, ...statusFilter(filters) }) as Prisma.ChangeRequestWhereInput })).map(item => ({ codigo: item.code, titulo: item.title, categoria: item.category, tipo: item.changeType, impacto: item.impact, estado: item.status, solicitante: item.requesterName ?? "" }));
}

export async function filterSummary(filters: ReportFilters) {
  return [`Desde ${filters.from}`, `Hasta ${filters.to}`, filters.standardCode ? `Norma ${filters.standardCode}` : "Todas las normas", filters.status ? `Estado ${filters.status}` : "Todos los estados", filters.domain ? `Dominio ${filters.domain}` : "Todos los dominios", filters.applicability ? `Aplicabilidad ${filters.applicability}` : "Toda aplicabilidad"];
}

export async function exportReport(input: { reportId: string; title: string; format: ExportFormat; filters: ReportFilters }) {
  input = parseInput(reportRequestSchema, input) as typeof input;
  const ctx = await requirePermission("reporting:export");
  await assertExportQuota(ctx.organization.id, ctx.organization.plan);
  if (!REPORT_IDS.includes(input.reportId as ReportId)) throw new Error("Tipo de informe no válido.");
  if (!("PDF" === input.format || "EXCEL" === input.format)) throw new Error("Formato no válido.");
  const parsed = await parseFilters(input.filters);
  const extension = input.format === "PDF" ? "pdf" : "xlsx";
  const safeId = input.reportId.replace(/[^a-z0-9-]/gi, "-");
  const fileName = `${safeId}-${input.filters.from}-${input.filters.to}.${extension}`;
  const idempotencyKey = createHash("sha256").update(JSON.stringify({ organizationId: ctx.organization.id, reportType: input.reportId, title: input.title, format: input.format, filters: input.filters })).digest("hex");
  const record = await createReportArtifact({ organizationId: ctx.organization.id, userId: ctx.user.id, reportType: input.reportId, title: input.title, format: input.format, filters: input.filters, dateFrom: parsed.from, dateTo: parsed.to, fileName, idempotencyKey, auditContext: ctx });
  revalidatePath("/app/reporting"); revalidatePath("/app/activity");
  return { id: record.id, fileName, mimeType: record.mimeType ?? (input.format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), rowCount: record.rowCount, status: record.status };
}

export async function retryReportExport(id: string) {
  const { ctx } = await requireAuthorization("reporting:export");
  const artifact = await retryReportArtifact(id, ctx.organization.id, ctx);
  revalidatePath("/app/reporting");
  return { id: artifact.id, status: artifact.status };
}

export async function downloadReportExport(id: string) {
  const ctx = await requirePermission("reporting:read");
  const artifact = await getReportArtifactDownload(id, ctx.organization.id);
  await logAuditEvent({
    ctx,
    action: "download",
    module: "reporting",
    recordId: id,
    extra: { fileName: artifact.fileName, mimeType: artifact.mimeType },
  });
  return artifact;
}

export async function getReportExportStatus(id: string) {
  const ctx = await requirePermission("reporting:read");
  const artifact = await prisma.reportExport.findFirst({ where: { id, organizationId: ctx.organization.id }, select: { id: true, status: true, error: true, rowCount: true, fileName: true, mimeType: true, completedAt: true } });
  if (!artifact) throw new Error("Reporte no encontrado.");
  return artifact;
}
