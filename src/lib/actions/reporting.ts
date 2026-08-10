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
/** Resolve org user ids → display names for report rows that store scalar ids. */
async function orgUserNames(organizationId: string): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}
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
  // ── ISO 14001 environmental reports ──
  if (reportId === "env-aspects-impacts" || reportId === "env-significant-aspects") {
    const names = await orgUserNames(organizationId);
    const impacts = await prisma.environmentalImpact.findMany({
      where: { organizationId, ...(reportId === "env-significant-aspects" ? { significant: true } : {}) },
      include: { aspect: true }, orderBy: [{ significant: "desc" }, { score: "desc" }],
    });
    return impacts.map(i => ({ codigo_aspecto: i.aspect.code, actividad: i.aspect.activity, producto_servicio: i.aspect.productService ?? "", condicion: i.aspect.condition, ciclo_vida: i.aspect.lifeCycleStage ?? "", proceso: i.aspect.processId ?? "", responsable: i.aspect.responsibleId ? (names.get(i.aspect.responsibleId) ?? "") : "", tipo_impacto: i.impactType, severidad: i.severity, frecuencia: i.frequency, alcance: i.scope, control_existente: i.existingControl ?? "", efectividad_control: i.controlEffectiveness ?? "", valor: i.score ?? "", nivel: i.level, significativo: i.significant ? "Sí" : "No" }));
  }
  if (reportId === "env-legal-obligations") {
    const names = await orgUserNames(organizationId);
    return (await prisma.environmentalComplianceObligation.findMany({ where: { organizationId }, orderBy: { reviewDate: "asc" } })).map(o => ({ codigo: o.code, fuente: o.source, jurisdiccion: o.jurisdiction ?? "", obligacion: o.obligation, aplicabilidad: o.applicability ?? "", responsable: o.responsibleId ? (names.get(o.responsibleId) ?? "") : "", proxima_revision: rowDate(o.reviewDate), frecuencia_meses: o.reviewFrequencyMonths ?? "", activa: o.active ? "Sí" : "No" }));
  }
  if (reportId === "env-compliance-evaluation") {
    const names = await orgUserNames(organizationId);
    const obligations = await prisma.environmentalComplianceObligation.findMany({ where: { organizationId }, include: { evaluations: { orderBy: { evaluatedAt: "desc" }, take: 1 } }, orderBy: { code: "asc" } });
    const now = new Date();
    return obligations.map(o => { const ev = o.evaluations[0]; const overdue = o.reviewDate && o.reviewDate < now && (!ev || ev.evaluatedAt < o.reviewDate); return { codigo: o.code, obligacion: o.obligation, fuente: o.source, ultima_evaluacion: ev ? rowDate(ev.evaluatedAt) : "", resultado: ev?.result ?? "SIN EVALUAR", evaluador: ev?.evaluatorId ? (names.get(ev.evaluatorId) ?? "") : "", proxima_revision: rowDate(o.reviewDate), vencido: overdue ? "Sí" : "No", hallazgos: ev?.findings ?? "", accion_derivada: ev?.derivedActionId ?? "" }; });
  }
  if (reportId === "env-objectives") {
    const names = await orgUserNames(organizationId);
    return (await prisma.environmentalObjective.findMany({ where: { organizationId }, include: { programs: true }, orderBy: { code: "asc" } })).map(o => ({ codigo: o.code, objetivo: o.objective, linea_base: o.baseline ?? "", meta: o.target ?? "", responsable: o.responsibleId ? (names.get(o.responsibleId) ?? "") : "", recursos: o.resources ?? "", fecha: rowDate(o.dueDate), estado: o.status, avance_pct: o.progress, programas: o.programs.length }));
  }
  if (reportId === "env-resource-consumption") {
    return (await prisma.environmentalMetric.findMany({ where: { organizationId, ...(filters.recordId ? { period: filters.recordId } : {}) }, orderBy: [{ period: "asc" }] })).map(m => ({ periodo: m.period, proceso: m.processId ?? "", sede: m.locationId ?? "", agua: m.water ?? "", energia: m.energy ?? "", combustible: m.fuel ?? "", emisiones: m.emissions ?? "", vertidos: m.discharges ?? "", residuos: m.waste ?? "", materias_primas: m.rawMaterials ?? "", nota: m.unitNote ?? "" }));
  }
  if (reportId === "env-emissions") {
    return (await prisma.environmentalMetric.findMany({ where: { organizationId, emissions: { not: null } }, orderBy: [{ period: "asc" }] })).map(m => ({ periodo: m.period, proceso: m.processId ?? "", sede: m.locationId ?? "", emisiones_co2e: m.emissions ?? "", combustible: m.fuel ?? "", energia: m.energy ?? "", nota: m.unitNote ?? "" }));
  }
  if (reportId === "env-waste") {
    return (await prisma.wasteStream.findMany({ where: { organizationId }, orderBy: [{ classification: "desc" }, { code: "asc" }] })).map(w => ({ codigo: w.code, tipo: w.wasteType, clasificacion: w.classification, cantidad: w.quantity ?? "", unidad: w.unit ?? "", periodo: w.period ?? "", almacenamiento: w.storage ?? "", gestor: w.managerName ?? "", disposicion: w.disposition ?? "", manifiesto: w.manifest ?? "" }));
  }
  if (reportId === "env-emergencies") {
    const names = await orgUserNames(organizationId);
    return (await prisma.environmentalEmergencyScenario.findMany({ where: { organizationId }, orderBy: { code: "asc" } })).map(e => ({ codigo: e.code, escenario: e.scenario, impacto: e.impact ?? "", controles: e.controls ?? "", plan: e.responsePlan ?? "", responsable: e.responsibleId ? (names.get(e.responsibleId) ?? "") : "", ultimo_simulacro: rowDate(e.lastDrillAt), proximo_simulacro: rowDate(e.nextDrillAt), resultados: e.drillResults ?? "" }));
  }
  if (reportId === "env-biodiversity") {
    const names = await orgUserNames(organizationId);
    return (await prisma.environmentalBiodiversityRecord.findMany({ where: { organizationId }, orderBy: { code: "asc" } })).map(b => ({ codigo: b.code, sitio: b.site, ecosistema: b.ecosystemType ?? "", area_protegida: b.protectedArea ? (b.protectedAreaName ?? "Sí") : "No", especie_habitat: b.speciesOrHabitat ?? "", impacto: b.impactDescription ?? "", mitigacion: b.mitigationMeasures ?? "", frecuencia_monitoreo: b.monitoringFrequency ?? "", estado: b.status, responsable: b.responsibleId ? (names.get(b.responsibleId) ?? "") : "", ultimo_monitoreo: rowDate(b.lastMonitoredAt), proximo_monitoreo: rowDate(b.nextMonitoringAt) }));
  }
  if (reportId === "env-audit-package") {
    const sections: ReportId[] = ["env-aspects-impacts", "env-significant-aspects", "env-legal-obligations", "env-compliance-evaluation", "env-objectives", "env-resource-consumption", "env-waste", "env-emissions", "env-emergencies", "env-biodiversity"];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap(group => group.rows.map(row => ({ seccion: group.section, ...row })));
  }
  // ── ISO 45001 occupational health & safety reports ──
  if (reportId === "safety-hazard-matrix" || reportId === "safety-critical-risks") {
    const names = await orgUserNames(organizationId);
    const hazards = await prisma.occupationalHazard.findMany({ where: { organizationId }, include: { assessments: { orderBy: { assessedAt: "desc" }, take: 1 } }, orderBy: { code: "asc" } });
    const rows = hazards.map(h => { const a = h.assessments[0]; return { codigo: h.code, proceso: h.processId ?? "", actividad: h.activity, tarea: h.task ?? "", peligro: h.hazard, categoria: h.category, trabajadores_expuestos: h.exposedWorkers ?? "", controles_existentes: h.existingControls ?? "", probabilidad: a?.probability ?? "", consecuencia: a?.consequence ?? "", exposicion: a?.exposure ?? "", nivel_inherente: a?.inherentLevel ?? "", nivel_residual: a?.residualLevel ?? "", aceptabilidad: a?.acceptability ?? "", responsable: h.responsibleId ? (names.get(h.responsibleId) ?? "") : "" }; });
    return reportId === "safety-critical-risks" ? rows.filter(r => r.nivel_residual === "HIGH" || r.nivel_residual === "CRITICAL" || r.aceptabilidad === "NOT_ACCEPTABLE") : rows;
  }
  if (reportId === "safety-inspections") {
    const names = await orgUserNames(organizationId);
    return (await prisma.safetyInspection.findMany({ where: { organizationId, inspectedAt: range }, orderBy: { inspectedAt: "desc" } })).map(i => ({ codigo: i.code, tipo: i.type, ubicacion: i.locationId ?? "", area: i.area ?? "", inspector: i.inspectorId ? (names.get(i.inspectorId) ?? "") : "", fecha: rowDate(i.inspectedAt), hallazgos: i.findings ?? "", acciones: i.actions ?? "" }));
  }
  if (reportId === "safety-ppe") {
    const items = await prisma.pPEItem.findMany({ where: { organizationId }, include: { assignments: { orderBy: { deliveredAt: "desc" } } }, orderBy: { code: "asc" } });
    return items.flatMap(it => (it.assignments.length ? it.assignments : [null]).map(a => ({ codigo_epp: it.code, epp: it.name, tipo: it.ppeType, norma_tecnica: it.technicalStandard ?? "", vida_util_meses: it.lifespanMonths ?? "", trabajador: a?.workerName ?? a?.personnelId ?? "", cantidad: a?.quantity ?? "", entregado: a ? rowDate(a.deliveredAt) : "", capacitacion: a ? (a.trainingProvided ? "Sí" : "No") : "", reposicion: a ? rowDate(a.replacementDate) : "" })));
  }
  if (reportId === "safety-permits") {
    const names = await orgUserNames(organizationId);
    return (await prisma.permitToWork.findMany({ where: ({ organizationId, ...statusFilter(filters) }) as Prisma.PermitToWorkWhereInput, orderBy: { createdAt: "desc" } })).map(p => ({ codigo: p.code, tipo_trabajo: p.workType, ubicacion: p.locationId ?? "", area: p.area ?? "", peligros: p.hazards ?? "", controles: p.controls ?? "", autorizador: p.authorizerId ? (names.get(p.authorizerId) ?? "") : "", vigencia_desde: rowDate(p.validFrom), vigencia_hasta: rowDate(p.validTo), estado: p.status, cierre: rowDate(p.closedAt) }));
  }
  if (reportId === "safety-incidents") {
    const names = await orgUserNames(organizationId);
    return (await prisma.occupationalIncident.findMany({ where: ({ organizationId, occurredAt: range, ...statusFilter(filters) }) as Prisma.OccupationalIncidentWhereInput, orderBy: { occurredAt: "desc" } })).map(i => ({ codigo: i.code, tipo: i.type, severidad: i.severity, titulo: i.title, lesion: i.injury ?? "", enfermedad: i.illness ?? "", fecha: rowDate(i.occurredAt), ubicacion: i.locationId ?? "", trabajador: i.workerName ?? i.personnelId ?? "", dias_perdidos: i.lostDays, estado: i.status, responsable: i.responsibleId ? (names.get(i.responsibleId) ?? "") : "" }));
  }
  if (reportId === "safety-investigation") {
    return (await prisma.occupationalIncident.findMany({ where: { organizationId, occurredAt: range, status: { in: ["INVESTIGATING", "ROOT_CAUSE", "ACTION_PLAN", "IMPLEMENTED", "EFFECTIVENESS_VERIFIED", "CLOSED"] } }, orderBy: { occurredAt: "desc" } })).map(i => ({ codigo: i.code, titulo: i.title, estado: i.status, investigacion: i.investigation ?? "", metodo_causa: i.rootCauseMethod ?? "", causa_raiz: i.rootCause ?? "", causas: i.causes ?? "", acciones: i.actions ?? "", fecha_objetivo: rowDate(i.dueDate), cerrado: rowDate(i.closedAt) }));
  }
  if (reportId === "safety-drills") {
    return (await prisma.emergencyDrill.findMany({ where: { organizationId, drillDate: range }, orderBy: { drillDate: "desc" } })).map(d => ({ codigo: d.code, escenario: d.scenario, participantes: d.participants ?? "", tiempo_respuesta_min: d.responseTimeMinutes ?? "", resultado: d.outcome ?? "", fallos: d.failures ?? "", acciones: d.actions ?? "", fecha: rowDate(d.drillDate) }));
  }
  if (reportId === "safety-contractors") {
    return (await prisma.contractorSafetyAssessment.findMany({ where: { organizationId }, orderBy: { code: "asc" } })).map(c => ({ codigo: c.code, contratista: c.contractorName ?? c.supplierId ?? "", riesgos: c.risks ?? "", requisitos: c.requirements ?? "", documentacion: c.documentation ?? "", evaluacion: c.outcome, puntaje: c.score ?? "", incidentes: c.incidents, evaluado: rowDate(c.assessedAt), proxima_revision: rowDate(c.nextReviewDate) }));
  }
  if (reportId === "safety-indicators") {
    const now = new Date();
    const [accidents, accidentsLostTime, nearMisses, lostDaysAgg, inspections, overdue] = await Promise.all([
      prisma.occupationalIncident.count({ where: { organizationId, occurredAt: range, type: "ACCIDENT" } }),
      prisma.occupationalIncident.count({ where: { organizationId, occurredAt: range, type: "ACCIDENT", lostDays: { gt: 0 } } }),
      prisma.occupationalIncident.count({ where: { organizationId, occurredAt: range, type: "NEAR_MISS" } }),
      prisma.occupationalIncident.aggregate({ where: { organizationId, occurredAt: range }, _sum: { lostDays: true } }),
      prisma.safetyInspection.count({ where: { organizationId, inspectedAt: range } }),
      prisma.occupationalIncident.count({ where: { organizationId, dueDate: { lt: now }, status: { notIn: ["EFFECTIVENESS_VERIFIED", "CLOSED"] } } }),
    ]);
    const { computeSafetyIndicators } = await import("@/lib/safety/indicators");
    const hoursWorked = Number(filters.hoursWorked ?? "0") || 0;
    const lostDays = lostDaysAgg._sum.lostDays ?? 0;
    const ind = computeSafetyIndicators({ accidentsWithLostTime: accidentsLostTime, totalAccidents: accidents, lostDays, nearMisses, inspections, overdueActions: overdue, hoursWorked });
    return [{ periodo: `${filters.from} → ${filters.to}`, horas_hombre: hoursWorked, accidentes: accidents, indice_frecuencia: ind.frequencyIndex, indice_gravedad: ind.severityIndex, indice_accidentabilidad: ind.accidentRate, dias_perdidos: ind.lostDays, casi_accidentes: ind.nearMisses, inspecciones: ind.inspections, acciones_vencidas: ind.overdueActions }];
  }
  if (reportId === "safety-surveillance") {
    // Sensitive: health/medical data about named workers. Gated a second time
    // at queue time in exportReport() (safety-sensitive:read) — never bundled
    // into safety-audit-package (data minimization: a general compendium
    // should not carry medical data by default).
    const { decryptHealthField } = await import("@/lib/crypto/field-encryption");
    const names = await orgUserNames(organizationId);
    return (await prisma.occupationalHealthSurveillance.findMany({ where: { organizationId }, orderBy: { code: "asc" } })).map(s => ({
      codigo: s.code, trabajador: s.workerName ?? (s.personnelId ? (names.get(s.personnelId) ?? "") : ""),
      exposicion: decryptHealthField(s.exposure) ?? "", protocolo: decryptHealthField(s.protocol) ?? "",
      aptitud: s.fitness, restricciones: decryptHealthField(s.restrictions) ?? "",
      examinado_el: rowDate(s.examinedAt), proxima_revision: rowDate(s.nextReviewDate),
    }));
  }
  if (reportId === "safety-audit-package") {
    const sections: ReportId[] = ["safety-hazard-matrix", "safety-critical-risks", "safety-inspections", "safety-ppe", "safety-permits", "safety-incidents", "safety-investigation", "safety-drills", "safety-indicators", "safety-contractors"];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap(group => group.rows.map(row => ({ seccion: group.section, ...row })));
  }
  // ── Sistema Integrado de Gestión (ISO 9001 + 14001 + 45001) ──
  if (reportId === "sig-crosswalk") {
    const { getIntegratedCrosswalkRows } = await import("@/lib/integrated/report-data");
    return getIntegratedCrosswalkRows(organizationId, filters.standardCode);
  }
  if (reportId === "sig-compliance-by-standard") {
    const { getComplianceByStandardRows } = await import("@/lib/integrated/report-data");
    return getComplianceByStandardRows(organizationId);
  }
  if (reportId === "sig-common-requirements") {
    const { getCommonRequirementRows } = await import("@/lib/integrated/report-data");
    return getCommonRequirementRows(organizationId, filters.standardCode);
  }
  if (reportId === "sig-scope-policy") {
    const system = await prisma.integratedSystem.findUnique({ where: { organizationId }, include: { standards: true, policyApprovedBy: { select: { name: true } } } });
    if (!system) return [];
    return [{
      sistema: system.name, alcance: system.scope ?? "", exclusiones: system.scopeExclusions ?? "",
      limites: system.boundaries ?? "", contexto: system.contextNotes ?? "",
      politica: system.policy ?? "", version_politica: system.policyVersion,
      aprobada_por: system.policyApprovedBy?.name ?? "", aprobada_el: rowDate(system.policyApprovedAt),
      normas: system.standards.map(s => s.standardCode).join(", "),
    }];
  }
  if (reportId === "sig-interested-parties") {
    const names = await orgUserNames(organizationId);
    return (await prisma.interestedParty.findMany({ where: { organizationId }, orderBy: { code: "asc" } })).map(p => ({
      codigo: p.code, parte_interesada: p.name, tipo: p.type ?? "",
      necesidades: p.needs ?? "", requisitos: p.requirements ?? "",
      influencia: p.influence, dependencia: p.dependency, pertinente: p.isRelevant ? "SI" : "NO",
      disciplinas: p.disciplines.join(", ") || "TODAS", normas: p.standards.join(", "),
      responsable: p.responsibleId ? names.get(p.responsibleId) ?? "" : "",
    }));
  }
  if (reportId === "sig-objectives") {
    const names = await orgUserNames(organizationId);
    return (await prisma.integratedObjective.findMany({ where: { organizationId }, orderBy: { code: "asc" } })).map(o => ({
      codigo: o.code, objetivo: o.title, meta: o.target ?? "",
      valor_meta: o.targetValue ?? "", valor_actual: o.currentValue ?? "", unidad: o.unit ?? "",
      disciplinas: o.disciplines.join(", ") || "TODAS",
      compartido: (o.disciplines.length > 1 || o.standards.length > 1) ? "SI" : "NO",
      normas: o.standards.join(", "), estado: o.status, vence: rowDate(o.dueDate),
      responsable: o.ownerId ? names.get(o.ownerId) ?? "" : "",
    }));
  }
  if (reportId === "sig-shared-elements") {
    const { getSharedElementRows } = await import("@/lib/integrated/report-data");
    return getSharedElementRows(organizationId);
  }
  if (reportId === "sig-integrated-audit") {
    const audits = await prisma.audit.findMany({
      where: { organizationId, createdAt: range },
      include: { findings: true },
      orderBy: { plannedDate: "desc" },
    });
    return audits.flatMap(a => {
      const normas = (a.standards.length ? a.standards : a.standardCode ? [a.standardCode] : []).join(", ");
      if (!a.findings.length) return [{ auditoria: a.title, integrada: a.integrated ? "SI" : "NO", normas, estado: a.status, planificada: rowDate(a.plannedDate ?? a.scheduledDate), hallazgo: "", tipo: "", severidad: "", normas_hallazgo: "", estado_hallazgo: "" }];
      return a.findings.map(f => ({
        auditoria: a.title, integrada: a.integrated ? "SI" : "NO", normas, estado: a.status,
        planificada: rowDate(a.plannedDate ?? a.scheduledDate),
        hallazgo: f.title, tipo: f.type, severidad: f.severity,
        normas_hallazgo: f.standards.join(", ") || normas, estado_hallazgo: f.status,
      }));
    });
  }
  if (reportId === "sig-integrated-capa") {
    const names = await orgUserNames(organizationId);
    return (await prisma.cAPA.findMany({ where: { organizationId, createdAt: range }, orderBy: { code: "asc" } })).map(c => ({
      codigo: c.code, titulo: c.title, origen: c.origin, etapa: c.stage,
      normas: (c.standards.length ? c.standards : c.standardCode ? [c.standardCode] : []).join(", "),
      comun: c.standards.length > 1 ? "SI" : "NO",
      responsable: c.ownerId ? names.get(c.ownerId) ?? "" : "",
      vence: rowDate(c.dueDate), avance: `${c.progress}%`,
    }));
  }
  if (reportId === "sig-management-review") {
    return (await prisma.managementReview.findMany({ where: { organizationId, createdAt: range }, orderBy: { scheduledDate: "desc" } })).map(r => ({
      titulo: r.title, normas: r.standards.join(", "), integrada: r.standards.length > 1 ? "SI" : "NO",
      estado: r.status, planificada: rowDate(r.scheduledDate), realizada: rowDate(r.heldAt),
      conclusiones: r.summary ?? "",
    }));
  }
  if (reportId === "sig-system-package") {
    const sections: ReportId[] = [
      "sig-scope-policy", "sig-interested-parties", "sig-objectives", "sig-crosswalk",
      "sig-compliance-by-standard", "sig-common-requirements",
      "sig-shared-elements", "sig-integrated-audit", "sig-integrated-capa", "sig-management-review",
    ];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap(group => group.rows.map(row => ({ seccion: group.section, ...row })));
  }

  // ── Continuidad del negocio (ISO 22301) ──
  if (reportId === "bcm-bia") {
    const names = await orgUserNames(organizationId);
    return (await prisma.businessImpactAnalysis.findMany({ where: { organizationId }, include: { _count: { select: { activities: true } } }, orderBy: { code: "asc" } })).map(b => ({
      codigo: b.code, bia: b.title, alcance: b.scope ?? "", metodologia: b.methodology ?? "",
      version: b.version, estado: b.status, actividades: b._count.activities,
      responsable: b.ownerId ? names.get(b.ownerId) ?? "" : "",
      aprobado_por: b.approvedById ? names.get(b.approvedById) ?? "" : "",
      aprobado_el: rowDate(b.approvedAt), realizado_el: rowDate(b.performedAt), proxima_revision: rowDate(b.nextReviewDate),
    }));
  }
  if (reportId === "bcm-critical-processes") {
    const names = await orgUserNames(organizationId);
    return (await prisma.criticalActivity.findMany({ where: { organizationId }, include: { bia: { select: { code: true } } }, orderBy: [{ priority: "asc" }, { code: "asc" }] })).map(a => ({
      prioridad: a.priority, codigo: a.code, actividad: a.name, bia: a.bia.code,
      criticidad: a.criticality, impacto: a.impactScore,
      impacto_financiero: a.financialImpact, impacto_operacional: a.operationalImpact,
      impacto_legal: a.legalImpact, impacto_reputacional: a.reputationalImpact, impacto_personas: a.peopleImpact,
      nivel_minimo: a.minimumServiceLevel ?? "",
      responsable: a.ownerId ? names.get(a.ownerId) ?? "" : "",
    }));
  }
  if (reportId === "bcm-rto-rpo") {
    return (await prisma.criticalActivity.findMany({ where: { organizationId }, orderBy: [{ priority: "asc" }] })).map(a => ({
      codigo: a.code, actividad: a.name, criticidad: a.criticality,
      mtpd_min: a.mtpdMinutes ?? "", rto_min: a.rtoMinutes ?? "", rpo_min: a.rpoMinutes ?? "",
      nivel_minimo: a.minimumServiceLevel ?? "",
      rto_valido: a.rtoMinutes != null && a.mtpdMinutes != null ? (a.rtoMinutes <= a.mtpdMinutes ? "SI" : "NO") : "",
    }));
  }
  if (reportId === "bcm-dependencies") {
    const rows = await prisma.businessDependency.findMany({ where: { organizationId }, include: { activity: { select: { code: true, name: true } } }, orderBy: [{ activityId: "asc" }, { type: "asc" }] });
    const resources = await prisma.resourceRequirement.findMany({ where: { organizationId }, include: { activity: { select: { code: true, name: true } } } });
    return [
      ...rows.map(d => ({
        clase: "DEPENDENCIA", actividad: `${d.activity.code} · ${d.activity.name}`, tipo: d.type, nombre: d.name,
        criticidad: d.criticality, indisponibilidad_max_min: d.maxOutageMinutes ?? "",
        recurso_alterno: d.alternative ?? "", punto_unico_fallo: d.singlePointOfFailure ? "SI" : "NO",
        cantidad_minima: "", plazo_min: "",
      })),
      ...resources.map(r => ({
        clase: "RECURSO", actividad: `${r.activity.code} · ${r.activity.name}`, tipo: r.type, nombre: r.name,
        criticidad: "", indisponibilidad_max_min: "", recurso_alterno: r.alternativeResource ?? "", punto_unico_fallo: "",
        cantidad_minima: r.minimumQuantity ?? "", plazo_min: r.leadTimeMinutes ?? "",
      })),
    ];
  }
  if (reportId === "bcm-priority-products") {
    return (await prisma.productServicePriority.findMany({ where: { organizationId }, include: { bia: { select: { code: true } } }, orderBy: [{ priority: "asc" }, { code: "asc" }] })).map(x => ({
      prioridad: x.priority, codigo: x.code, producto_servicio: x.name, bia: x.bia.code,
      criticidad: x.criticality, mtpd_min: x.mtpdMinutes ?? "", rto_min: x.rtoMinutes ?? "",
      nivel_minimo: x.minimumServiceLevel ?? "", porcentaje_ingresos: x.revenueShare ?? "",
      clientes_afectados: x.customersAffected ?? "",
    }));
  }
  if (reportId === "bcm-strategies") {
    const names = await orgUserNames(organizationId);
    return (await prisma.continuityStrategy.findMany({ where: { organizationId }, include: { activity: { select: { code: true, name: true } } }, orderBy: { code: "asc" } })).map(s => ({
      codigo: s.code, estrategia: s.title, tipo: s.type, estado: s.status,
      actividad: s.activity ? `${s.activity.code} · ${s.activity.name}` : "",
      rto_que_logra_min: s.achievesRtoMinutes ?? "", rpo_que_logra_min: s.achievesRpoMinutes ?? "",
      coste: s.cost ?? "", recursos: s.resourcesNeeded ?? "",
      responsable: s.ownerId ? names.get(s.ownerId) ?? "" : "",
      aprobado_por: s.approvedById ? names.get(s.approvedById) ?? "" : "", aprobado_el: rowDate(s.approvedAt),
    }));
  }
  if (reportId === "bcm-plans") {
    const names = await orgUserNames(organizationId);
    return (await prisma.businessContinuityPlan.findMany({ where: { organizationId }, include: { _count: { select: { recoveryProcedures: true, crisisTeams: true } } }, orderBy: { code: "asc" } })).map(p => ({
      codigo: p.code, plan: p.title, version: p.version, estado: p.status,
      alcance: p.scope ?? "", nivel_minimo: p.minimumServiceLevel ?? "",
      criterio_activacion: p.invocationCriteria ?? "",
      rto_min: p.rtoMinutes ?? "", rpo_min: p.rpoMinutes ?? "",
      procedimientos: p._count.recoveryProcedures, equipos_crisis: p._count.crisisTeams,
      aprobado_por: p.approvedById ? names.get(p.approvedById) ?? "" : "", aprobado_el: rowDate(p.approvedAt),
      activado: p.activated ? "SI" : "NO", activado_el: rowDate(p.activatedAt),
      proxima_revision: rowDate(p.nextReviewDate),
    }));
  }
  if (reportId === "bcm-plan-versions") {
    const names = await orgUserNames(organizationId);
    return (await prisma.continuityPlanVersion.findMany({ where: { organizationId }, include: { plan: { select: { code: true, title: true } } }, orderBy: [{ planId: "asc" }, { createdAt: "desc" }] })).map(v => ({
      plan: v.plan.code, version: v.version, cambios: v.changeSummary ?? "",
      aprobada_por: v.approvedById ? names.get(v.approvedById) ?? "" : "", aprobada_el: rowDate(v.approvedAt),
      creada_el: rowDate(v.createdAt),
    }));
  }
  if (reportId === "bcm-crisis-teams") {
    const teams = await prisma.crisisTeam.findMany({
      where: { organizationId },
      include: { leader: { select: { name: true } }, deputy: { select: { name: true } }, contacts: { orderBy: { escalationOrder: "asc" } } },
      orderBy: { code: "asc" },
    });
    return teams.flatMap(t => {
      if (!t.contacts.length) return [{ equipo: `${t.code} · ${t.name}`, lider: t.leader?.name ?? "", suplente: t.deputy?.name ?? "", regla_activacion: t.activationRule ?? "", punto_encuentro: t.meetingPoint ?? "", orden: "" as string | number, contacto: "", rol: "", tipo: "" as string, telefono: "" }];
      return t.contacts.map(c => ({
        equipo: `${t.code} · ${t.name}`, lider: t.leader?.name ?? "", suplente: t.deputy?.name ?? "",
        regla_activacion: t.activationRule ?? "", punto_encuentro: t.meetingPoint ?? "",
        orden: c.escalationOrder, contacto: c.name, rol: c.role ?? "", tipo: c.type, telefono: c.primaryPhone ?? "",
      }));
    });
  }
  if (reportId === "bcm-activations") {
    const names = await orgUserNames(organizationId);
    return (await prisma.planActivation.findMany({ where: { organizationId, activatedAt: range }, include: { plan: { select: { code: true } }, scenario: { select: { title: true } } }, orderBy: { activatedAt: "desc" } })).map(a => ({
      plan: a.plan.code, motivo: a.reason, escenario: a.scenario?.title ?? "",
      activado_por: a.activatedById ? names.get(a.activatedById) ?? "" : "", activado_el: a.activatedAt.toISOString(),
      desactivado_el: a.deactivatedAt?.toISOString() ?? "", resultado: a.outcome ?? "", lecciones_aprendidas: a.lessonsLearned ?? "",
    }));
  }
  if (reportId === "bcm-exercises") {
    const names = await orgUserNames(organizationId);
    const tests = await prisma.continuityTest.findMany({
      where: { organizationId, createdAt: range },
      include: { plan: { select: { code: true } }, scenario: { select: { title: true } }, results: { orderBy: { testedAt: "desc" }, include: { improvementActions: true } } },
      orderBy: { plannedDate: "desc" },
    });
    return tests.map(t => {
      const r = t.results[0];
      return {
        plan: t.plan.code, simulacro: t.title, tipo: t.type, estado: t.status,
        escenario: t.scenario?.title ?? "", objetivo: t.objective ?? "",
        planificado: rowDate(t.plannedDate), ejecutado: rowDate(t.executedDate),
        responsable: t.responsibleId ? names.get(t.responsibleId) ?? "" : "",
        rto_objetivo_min: t.targetRtoMinutes ?? "", rpo_objetivo_min: t.targetRpoMinutes ?? "",
        resultado: r?.outcome ?? "", rto_logrado_min: r?.rtoAchievedMinutes ?? "", rpo_logrado_min: r?.rpoAchievedMinutes ?? "",
        cumple_objetivos: r && t.targetRtoMinutes != null && r.rtoAchievedMinutes != null ? (r.rtoAchievedMinutes <= t.targetRtoMinutes ? "SI" : "NO") : "",
        acciones_mejora: r ? r.improvementActions.length : 0,
        mejoras_abiertas: r ? r.improvementActions.filter(a => a.status !== "DONE").length : 0,
      };
    });
  }
  if (reportId === "bcm-gaps") {
    const { getContinuityGapRows } = await import("@/lib/continuity/report-data");
    return getContinuityGapRows(organizationId);
  }
  if (reportId === "bcm-audit-package") {
    const sections: ReportId[] = [
      "bcm-bia", "bcm-critical-processes", "bcm-rto-rpo", "bcm-priority-products", "bcm-dependencies",
      "bcm-strategies", "bcm-plans", "bcm-plan-versions", "bcm-crisis-teams", "bcm-activations", "bcm-exercises", "bcm-gaps",
    ];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap(group => group.rows.map(row => ({ seccion: group.section, ...row })));
  }
  // ── ISO/IEC 42001 AI management reports ──
  if (reportId === "ai-inventory") {
    const { getAISystemInventoryRows } = await import("@/lib/aims/report-data");
    return getAISystemInventoryRows(organizationId);
  }
  if (reportId === "ai-impact-assessment") {
    const { getAIImpactAssessmentRows } = await import("@/lib/aims/report-data");
    return getAIImpactAssessmentRows(organizationId);
  }
  if (reportId === "ai-risks") {
    const { getAIRiskRows } = await import("@/lib/aims/report-data");
    return getAIRiskRows(organizationId);
  }
  if (reportId === "ai-datasets") {
    const { getAIDatasetRows } = await import("@/lib/aims/report-data");
    return getAIDatasetRows(organizationId);
  }
  if (reportId === "ai-models") {
    const { getAIModelRows } = await import("@/lib/aims/report-data");
    return getAIModelRows(organizationId);
  }
  if (reportId === "ai-controls") {
    const { getAIControlRows } = await import("@/lib/aims/report-data");
    return getAIControlRows(organizationId);
  }
  if (reportId === "ai-incidents") {
    const { getAIIncidentRows } = await import("@/lib/aims/report-data");
    return getAIIncidentRows(organizationId, range);
  }
  if (reportId === "ai-transparency") {
    const { getAITransparencyRows } = await import("@/lib/aims/report-data");
    return getAITransparencyRows(organizationId);
  }
  if (reportId === "ai-human-review") {
    const { getAIHumanReviewRows } = await import("@/lib/aims/report-data");
    return getAIHumanReviewRows(organizationId, range);
  }
  if (reportId === "ai-audit-package") {
    const sections: ReportId[] = ["ai-inventory", "ai-impact-assessment", "ai-risks", "ai-datasets", "ai-models", "ai-controls", "ai-transparency", "ai-incidents", "ai-human-review"];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap(group => group.rows.map(row => ({ seccion: group.section, ...row })));
  }
  // ── ISO 37301 compliance management reports ──
  if (reportId === "compliance-obligations") {
    const { getComplianceObligationRows } = await import("@/lib/compliance/report-data");
    return getComplianceObligationRows(organizationId);
  }
  if (reportId === "compliance-risks") {
    const { getComplianceRiskRows } = await import("@/lib/compliance/report-data");
    return getComplianceRiskRows(organizationId);
  }
  if (reportId === "compliance-evaluations") {
    const { getComplianceEvaluationRows } = await import("@/lib/compliance/report-data");
    return getComplianceEvaluationRows(organizationId);
  }
  if (reportId === "compliance-calendar") {
    const { getComplianceCalendarRows } = await import("@/lib/compliance/report-data");
    return getComplianceCalendarRows(organizationId);
  }
  if (reportId === "compliance-speak-up") {
    const { getComplianceSpeakUpRows } = await import("@/lib/compliance/report-data");
    return getComplianceSpeakUpRows(organizationId);
  }
  if (reportId === "compliance-investigations") {
    const { getComplianceInvestigationRows } = await import("@/lib/compliance/report-data");
    return getComplianceInvestigationRows(organizationId);
  }
  if (reportId === "compliance-breaches") {
    const { getComplianceBreachRows } = await import("@/lib/compliance/report-data");
    return getComplianceBreachRows(organizationId);
  }
  if (reportId === "compliance-remediation") {
    const { getComplianceRemediationRows } = await import("@/lib/compliance/report-data");
    return getComplianceRemediationRows(organizationId);
  }
  if (reportId === "compliance-management-review") {
    const { getComplianceManagementReviewRows } = await import("@/lib/compliance/report-data");
    return getComplianceManagementReviewRows(organizationId);
  }
  if (reportId === "compliance-audit-package") {
    const sections: ReportId[] = ["compliance-obligations", "compliance-risks", "compliance-evaluations", "compliance-calendar", "compliance-speak-up", "compliance-investigations", "compliance-breaches", "compliance-remediation", "compliance-management-review"];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap(group => group.rows.map(row => ({ seccion: group.section, ...row })));
  }
  // ── ISO 37001 anti-bribery reports (extension of compliance) ──
  if (reportId === "abms-risk-map") {
    const { getBriberyRiskMapRows } = await import("@/lib/antibribery/report-data");
    return getBriberyRiskMapRows(organizationId);
  }
  if (reportId === "abms-third-parties") {
    const { getBusinessAssociateRows } = await import("@/lib/antibribery/report-data");
    return getBusinessAssociateRows(organizationId);
  }
  if (reportId === "abms-due-diligence") {
    const { getDueDiligenceRows } = await import("@/lib/antibribery/report-data");
    return getDueDiligenceRows(organizationId);
  }
  if (reportId === "abms-beneficial-owners") {
    const { getBeneficialOwnerRows } = await import("@/lib/antibribery/report-data");
    return getBeneficialOwnerRows(organizationId);
  }
  if (reportId === "abms-gifts") {
    const { getGiftHospitalityRows } = await import("@/lib/antibribery/report-data");
    return getGiftHospitalityRows(organizationId);
  }
  if (reportId === "abms-donations") {
    const { getDonationSponsorshipRows } = await import("@/lib/antibribery/report-data");
    return getDonationSponsorshipRows(organizationId);
  }
  if (reportId === "abms-conflicts") {
    const { getAbmsConflictRows } = await import("@/lib/antibribery/report-data");
    return getAbmsConflictRows(organizationId);
  }
  if (reportId === "abms-high-risk-ops") {
    const { getHighRiskTransactionRows } = await import("@/lib/antibribery/report-data");
    return getHighRiskTransactionRows(organizationId);
  }
  if (reportId === "abms-controls") {
    const { getAbmsControlTestRows } = await import("@/lib/antibribery/report-data");
    return getAbmsControlTestRows(organizationId);
  }
  if (reportId === "abms-investigations") {
    const { getAbmsInvestigationRows } = await import("@/lib/antibribery/report-data");
    return getAbmsInvestigationRows(organizationId);
  }
  if (reportId === "abms-audit-package") {
    // abms-beneficial-owners is antibribery-sensitive:* (UBO/PEP data of real
    // third parties) — never bundled into a general audit package, same rule
    // as safety-audit-package excluding safety-surveillance and
    // md-audit-package excluding its four vigilance sections.
    const sections: ReportId[] = [
      "abms-risk-map", "abms-third-parties", "abms-due-diligence",
      "abms-gifts", "abms-donations", "abms-conflicts", "abms-high-risk-ops",
      "abms-controls", "abms-investigations",
    ];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap((group) => group.rows.map((row) => ({ seccion: group.section, ...row })));
  }
  // ── ISO 50001 energy management reports ──
  if (reportId === "enms-energy-review") {
    const { getEnergyReviewRows } = await import("@/lib/energy/report-data");
    return getEnergyReviewRows(organizationId);
  }
  if (reportId === "enms-significant-uses") {
    const { getSignificantEnergyUseRows } = await import("@/lib/energy/report-data");
    return getSignificantEnergyUseRows(organizationId);
  }
  if (reportId === "enms-baseline") {
    const { getEnergyBaselineRows } = await import("@/lib/energy/report-data");
    return getEnergyBaselineRows(organizationId);
  }
  if (reportId === "enms-enpi") {
    const { getEnpiRows } = await import("@/lib/energy/report-data");
    return getEnpiRows(organizationId);
  }
  if (reportId === "enms-consumption") {
    const { getEnergyConsumptionRows } = await import("@/lib/energy/report-data");
    return getEnergyConsumptionRows(organizationId);
  }
  if (reportId === "enms-opportunities") {
    const { getEnergyOpportunityRows } = await import("@/lib/energy/report-data");
    return getEnergyOpportunityRows(organizationId);
  }
  if (reportId === "enms-actions") {
    const { getEnergyActionRows } = await import("@/lib/energy/report-data");
    return getEnergyActionRows(organizationId);
  }
  if (reportId === "enms-savings") {
    const { getEnergySavingRows } = await import("@/lib/energy/report-data");
    return getEnergySavingRows(organizationId);
  }
  if (reportId === "enms-audit-package") {
    const sections: ReportId[] = [
      "enms-energy-review", "enms-significant-uses", "enms-baseline", "enms-enpi",
      "enms-consumption", "enms-opportunities", "enms-actions", "enms-savings",
    ];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap((group) => group.rows.map((row) => ({ seccion: group.section, ...row })));
  }
  // ── ISO 22000 / HACCP food safety reports ──
  if (reportId === "fsms-hazard-analysis") {
    const { getFsmsHazardAnalysisRows } = await import("@/lib/food-safety/report-data");
    return getFsmsHazardAnalysisRows(organizationId);
  }
  if (reportId === "fsms-prp") {
    const { getFsmsPrpRows } = await import("@/lib/food-safety/report-data");
    return getFsmsPrpRows(organizationId);
  }
  if (reportId === "fsms-oprp") {
    const { getFsmsOprpRows } = await import("@/lib/food-safety/report-data");
    return getFsmsOprpRows(organizationId);
  }
  if (reportId === "fsms-ccp") {
    const { getFsmsCcpRows } = await import("@/lib/food-safety/report-data");
    return getFsmsCcpRows(organizationId);
  }
  if (reportId === "fsms-monitoring") {
    const { getFsmsMonitoringRows } = await import("@/lib/food-safety/report-data");
    return getFsmsMonitoringRows(organizationId);
  }
  if (reportId === "fsms-deviations") {
    const { getFsmsDeviationRows } = await import("@/lib/food-safety/report-data");
    return getFsmsDeviationRows(organizationId);
  }
  if (reportId === "fsms-traceability") {
    const { getFsmsTraceabilityRows } = await import("@/lib/food-safety/report-data");
    return getFsmsTraceabilityRows(organizationId);
  }
  if (reportId === "fsms-recalls") {
    const { getFsmsRecallRows } = await import("@/lib/food-safety/report-data");
    return getFsmsRecallRows(organizationId);
  }
  if (reportId === "fsms-allergens") {
    const { getFsmsAllergenRows } = await import("@/lib/food-safety/report-data");
    return getFsmsAllergenRows(organizationId);
  }
  if (reportId === "fsms-audit-package") {
    const sections: ReportId[] = [
      "fsms-hazard-analysis", "fsms-prp", "fsms-oprp", "fsms-ccp", "fsms-monitoring",
      "fsms-deviations", "fsms-traceability", "fsms-recalls", "fsms-allergens",
    ];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap((group) => group.rows.map((row) => ({ seccion: group.section, ...row })));
  }
  // ── ISO/IEC 20000 ITSM reports ──
  if (reportId === "itsm-sla") {
    const { getItsmSlaRows } = await import("@/lib/itsm/report-data");
    return getItsmSlaRows(organizationId);
  }
  if (reportId === "itsm-incidents") {
    const { getItsmIncidentRows } = await import("@/lib/itsm/report-data");
    return getItsmIncidentRows(organizationId);
  }
  if (reportId === "itsm-problems") {
    const { getItsmProblemRows } = await import("@/lib/itsm/report-data");
    return getItsmProblemRows(organizationId);
  }
  if (reportId === "itsm-changes") {
    const { getItsmChangeRows } = await import("@/lib/itsm/report-data");
    return getItsmChangeRows(organizationId);
  }
  if (reportId === "itsm-availability") {
    const { getItsmAvailabilityRows } = await import("@/lib/itsm/report-data");
    return getItsmAvailabilityRows(organizationId);
  }
  if (reportId === "itsm-capacity") {
    const { getItsmCapacityRows } = await import("@/lib/itsm/report-data");
    return getItsmCapacityRows(organizationId);
  }
  if (reportId === "itsm-continuity") {
    const { getItsmContinuityRows } = await import("@/lib/itsm/report-data");
    return getItsmContinuityRows(organizationId);
  }
  if (reportId === "itsm-suppliers") {
    const { getItsmSupplierRows } = await import("@/lib/itsm/report-data");
    return getItsmSupplierRows(organizationId);
  }
  if (reportId === "itsm-service-performance") {
    const { getItsmServicePerformanceRows } = await import("@/lib/itsm/report-data");
    return getItsmServicePerformanceRows(organizationId);
  }
  if (reportId === "itsm-audit-package") {
    const sections: ReportId[] = [
      "itsm-sla", "itsm-incidents", "itsm-problems", "itsm-changes",
      "itsm-availability", "itsm-capacity", "itsm-continuity", "itsm-suppliers",
    ];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap((group) => group.rows.map((row) => ({ seccion: group.section, ...row })));
  }
  // ── ISO 13485 medical device QMS reports ──
  if (reportId === "md-design-history") {
    const { getMdDesignHistoryRows } = await import("@/lib/medical-devices/report-data");
    return getMdDesignHistoryRows(organizationId);
  }
  if (reportId === "md-master-record") {
    const { getMdMasterRecordRows } = await import("@/lib/medical-devices/report-data");
    return getMdMasterRecordRows(organizationId);
  }
  if (reportId === "md-risks") {
    const { getMdRiskRows } = await import("@/lib/medical-devices/report-data");
    return getMdRiskRows(organizationId);
  }
  if (reportId === "md-validations") {
    const { getMdValidationRows } = await import("@/lib/medical-devices/report-data");
    return getMdValidationRows(organizationId);
  }
  if (reportId === "md-suppliers") {
    const { getMdSupplierRows } = await import("@/lib/medical-devices/report-data");
    return getMdSupplierRows(organizationId);
  }
  if (reportId === "md-batches") {
    const { getMdBatchRows } = await import("@/lib/medical-devices/report-data");
    return getMdBatchRows(organizationId);
  }
  if (reportId === "md-complaints") {
    const { getMdComplaintRows } = await import("@/lib/medical-devices/report-data");
    return getMdComplaintRows(organizationId);
  }
  if (reportId === "md-surveillance") {
    const { getMdSurveillanceRows } = await import("@/lib/medical-devices/report-data");
    return getMdSurveillanceRows(organizationId);
  }
  if (reportId === "md-events") {
    const { getMdAdverseEventRows } = await import("@/lib/medical-devices/report-data");
    return getMdAdverseEventRows(organizationId);
  }
  if (reportId === "md-recalls") {
    const { getMdRecallRows } = await import("@/lib/medical-devices/report-data");
    return getMdRecallRows(organizationId);
  }
  if (reportId === "md-audit-package") {
    // md-complaints/md-surveillance/md-events/md-recalls are md-sensitive:* —
    // never bundled into a general audit package (data minimization: a
    // compendium requested with plain medical-devices:export should not
    // silently carry vigilance/adverse-event data), same rule as
    // safety-audit-package excluding safety-surveillance.
    const sections: ReportId[] = [
      "md-design-history", "md-master-record", "md-risks", "md-validations",
      "md-suppliers", "md-batches",
    ];
    const groups = await Promise.all(sections.map(async (section) => ({ section, rows: await reportRows(section, organizationId, filters) })));
    return groups.flatMap((group) => group.rows.map((row) => ({ seccion: group.section, ...row })));
  }

  return (await prisma.changeRequest.findMany({ where: ({ organizationId, createdAt: range, ...statusFilter(filters) }) as Prisma.ChangeRequestWhereInput })).map(item => ({ codigo: item.code, titulo: item.title, categoria: item.category, tipo: item.changeType, impacto: item.impact, estado: item.status, solicitante: item.requesterName ?? "" }));
}

export async function filterSummary(filters: ReportFilters) {
  return [`Desde ${filters.from}`, `Hasta ${filters.to}`, filters.standardCode ? `Norma ${filters.standardCode}` : "Todas las normas", filters.status ? `Estado ${filters.status}` : "Todos los estados", filters.domain ? `Dominio ${filters.domain}` : "Todos los dominios", filters.applicability ? `Aplicabilidad ${filters.applicability}` : "Toda aplicabilidad"];
}

export async function exportReport(input: { reportId: string; title: string; format: ExportFormat; filters: ReportFilters }) {
  input = parseInput(reportRequestSchema, input) as typeof input;
  const ctx = await requirePermission("reporting:export");
  // Sensitive health data: the worker generates rows outside any request
  // context (no session to check), so this queue-time gate is the only
  // enforcement point — never bundled into safety-audit-package either.
  if (input.reportId === "safety-surveillance") await requirePermission("safety-sensitive:read");
  if (["md-complaints", "md-surveillance", "md-events", "md-recalls"].includes(input.reportId)) {
    await requirePermission("md-sensitive:read");
  }
  if (input.reportId === "abms-beneficial-owners") await requirePermission("antibribery-sensitive:read");
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
