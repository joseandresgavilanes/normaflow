import "server-only";
import { prisma } from "@/lib/prisma";

type Row = Record<string, string | number | boolean | null>;
const YES = (value: boolean) => (value ? "SI" : "NO");
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? "";

async function userNames(organizationId: string): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({
    where: { memberships: { some: { organizationId } } },
    select: { id: true, name: true },
  });
  return new Map(users.map((user) => [user.id, user.name]));
}

export async function getBriberyRiskMapRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.briberyRiskAssessment.findMany({ where: { organizationId }, orderBy: [{ residualScore: "desc" }, { code: "asc" }] }),
  ]);
  return rows.map((row) => ({
    codigo: row.code, evaluacion: row.title, alcance: row.scope ?? "",
    probabilidad_inherente: row.inherentLikelihood, impacto_inherente: row.inherentImpact,
    riesgo_inherente: row.inherentScore, nivel_inherente: row.inherentLevel,
    riesgo_residual: row.residualScore ?? "", nivel_residual: row.residualLevel ?? "",
    pais: row.countryRisk, sector: row.sectorRisk,
    funcionario_publico: YES(row.publicOfficialRisk), tercero: YES(row.thirdPartyRisk),
    tratamiento: row.treatment, propietario: row.ownerId ? names.get(row.ownerId) ?? "" : "",
    estado: row.status, aprobado_el: date(row.approvedAt), proxima_revision: date(row.nextReviewDate),
    obligacion: row.obligationId ?? "", riesgo_compliance: row.complianceRiskId ?? "",
  } satisfies Row));
}

export async function getBusinessAssociateRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.businessAssociate.findMany({
      where: { organizationId },
      include: { _count: { select: { beneficialOwners: true, dueDiligence: true } } },
      orderBy: { code: "asc" },
    }),
  ]);
  return rows.map((row) => ({
    codigo: row.code, nombre: row.name, tipo: row.associateType, pais: row.country ?? "",
    industria: row.industry ?? "", proveedor_corporativo: row.supplierId ?? "",
    riesgo: row.riskTier, funcionario_publico: YES(row.isPublicOfficial), peps: YES(row.interactsWithPEPs),
    screening: row.sanctionedScreen, medios_adversos: row.adverseMedia,
    propiedad_conocida: YES(row.ownershipKnown), beneficiarios: row._count.beneficialOwners,
    debidas_diligencias: row._count.dueDiligence, estado: row.status,
    responsable: row.ownerId ? names.get(row.ownerId) ?? "" : "", proxima_revision: date(row.nextReviewDate),
  } satisfies Row));
}

export async function getDueDiligenceRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.dueDiligenceCase.findMany({
      where: { organizationId },
      include: { associate: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
  ]);
  return rows.map((row) => ({
    codigo: row.code, socio: row.associate.code, nombre_socio: row.associate.name,
    nivel: row.level, estado: row.status, screening: row.screeningResult,
    riesgo_residual: row.residualRisk ?? "", revisor: row.reviewerId ? names.get(row.reviewerId) ?? "" : "",
    aprobado_por: row.approvedById ? names.get(row.approvedById) ?? "" : "",
    aprobado_el: date(row.approvedAt), proxima_revision: date(row.nextReviewDate),
    obligacion: row.obligationId ?? "",
  } satisfies Row));
}

export async function getBeneficialOwnerRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.beneficialOwner.findMany({
    where: { organizationId },
    include: { associate: { select: { code: true, name: true } } },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code, socio: row.associate.code, nombre_socio: row.associate.name,
    beneficiario: row.fullName, nacionalidad: row.nationality ?? "",
    residencia: row.countryOfResidence ?? "", porcentaje: row.ownershipPercent ?? "",
    control: row.controlType, pep: YES(row.isPep), rol_pep: row.pepRole ?? "",
    identificado_el: date(row.identifiedAt), verificado_el: date(row.verifiedAt),
  } satisfies Row));
}

export async function getGiftHospitalityRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.giftHospitalityRecord.findMany({
      where: { organizationId },
      include: { associate: { select: { code: true } } },
      orderBy: { occurredAt: "desc" },
    }),
  ]);
  return rows.map((row) => ({
    codigo: row.code, tipo: row.recordType, direccion: row.direction, descripcion: row.description,
    valor: row.estimatedValue ?? "", moneda: row.currency ?? "", fecha: date(row.occurredAt),
    contraparte: row.counterpartyName ?? "", socio: row.associate?.code ?? "",
    funcionario_publico: YES(row.involvesPublicOfficial), sobre_umbral: YES(row.aboveThreshold),
    estado: row.status, solicitante: row.submittedById ? names.get(row.submittedById) ?? "" : "",
    manager: row.managerId ? names.get(row.managerId) ?? "" : "",
    compliance: row.complianceReviewerId ? names.get(row.complianceReviewerId) ?? "" : "",
  } satisfies Row));
}

export async function getDonationSponsorshipRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.donationSponsorshipRecord.findMany({
    where: { organizationId },
    include: { associate: { select: { code: true } } },
    orderBy: { grantedAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code, tipo: row.recordType, beneficiario: row.beneficiaryName,
    socio: row.associate?.code ?? "", proposito: row.purpose ?? "",
    importe: row.amount ?? "", moneda: row.currency ?? "", fecha: date(row.grantedAt),
    funcionario_publico: YES(row.involvesPublicOfficial), politica: YES(row.politicalDonation),
    estado: row.status,
  } satisfies Row));
}

export async function getAbmsConflictRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.conflictDeclaration.findMany({ where: { organizationId }, orderBy: [{ period: "desc" }, { code: "asc" }] }),
  ]);
  return rows.map((row) => ({
    codigo: row.code, declarante: names.get(row.declarantId) ?? "", periodo: row.period,
    conflicto: YES(row.hasConflict), naturaleza: row.conflictNature,
    abstencion: YES(row.recusalRequired), revision: row.reviewStatus,
    revisor: row.reviewerId ? names.get(row.reviewerId) ?? "" : "",
    declaracion_compliance: row.conflictOfInterestDeclarationId ?? "",
  } satisfies Row));
}

export async function getHighRiskTransactionRows(organizationId: string): Promise<Row[]> {
  const [names, rows] = await Promise.all([
    userNames(organizationId),
    prisma.highRiskTransactionApproval.findMany({
      where: { organizationId },
      include: { associate: { select: { code: true } } },
      orderBy: { requestedAt: "desc" },
    }),
  ]);
  return rows.map((row) => ({
    codigo: row.code, operacion: row.title, tipo: row.transactionType,
    importe: row.amount ?? "", moneda: row.currency ?? "", socio: row.associate?.code ?? "",
    funcionario_publico: YES(row.involvesPublicOfficial), estado: row.status,
    solicitante: row.requestedById ? names.get(row.requestedById) ?? "" : "",
    aprobado_por: row.approvedById ? names.get(row.approvedById) ?? "" : "",
    aprobado_el: date(row.approvedAt),
  } satisfies Row));
}

export async function getAbmsControlTestRows(organizationId: string): Promise<Row[]> {
  const [financial, nonFinancial] = await Promise.all([
    prisma.financialControlTest.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.nonFinancialControlTest.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
  ]);
  return [
    ...financial.map((row) => ({
      seccion: "financiero", codigo: row.code, control: row.title, periodo: row.period,
      area: "FINANCIAL", diseno: row.designAdequate === null ? "" : YES(row.designAdequate),
      operacion: row.operatingEffective === null ? "" : YES(row.operatingEffective),
      excepciones: row.exceptionsFound, eficacia: row.effectiveness ?? "", estado: row.status,
      control_compliance: row.complianceControlId ?? "", control_iso27001: row.organizationControlId ?? "",
    } satisfies Row)),
    ...nonFinancial.map((row) => ({
      seccion: "no_financiero", codigo: row.code, control: row.title, periodo: row.period,
      area: row.controlArea, diseno: row.designAdequate === null ? "" : YES(row.designAdequate),
      operacion: row.operatingEffective === null ? "" : YES(row.operatingEffective),
      excepciones: row.exceptionsFound, eficacia: row.effectiveness ?? "", estado: row.status,
      control_compliance: row.complianceControlId ?? "", control_iso27001: row.organizationControlId ?? "",
    } satisfies Row)),
  ];
}

export async function getAbmsInvestigationRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.antiBriberyInvestigation.findMany({ where: { organizationId }, orderBy: { code: "asc" } });
  return rows.map((row) => ({
    codigo: row.code, investigacion: row.investigationId, denuncia: row.speakUpReportId ?? "",
    incumplimiento: row.breachId ?? "", alegacion: row.allegationType,
    funcionario_publico: YES(row.involvesPublicOfficial), valor_estimado: row.estimatedValue ?? "",
    estado: row.status, resultado: row.outcome ?? "", cerrado_el: date(row.closedAt),
    remediacion: row.remediationPlanId ?? "", capa: row.capaId ?? "",
  } satisfies Row));
}
