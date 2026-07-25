import "server-only";
import { prisma } from "@/lib/prisma";

type Row = Record<string, string | number | boolean | null>;
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? "";
const YES = (v: boolean) => (v ? "SI" : "NO");

export async function getEnergyReviewRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.energyReview.findMany({
    where: { organizationId },
    include: { _count: { select: { significantUses: true } } },
    orderBy: { periodEnd: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code, titulo: row.title, desde: date(row.periodStart), hasta: date(row.periodEnd),
    alcance: row.scope ?? "", estado: row.status, usos_significativos: row._count.significantUses,
    aprobado_el: date(row.approvedAt), hallazgos: row.findings ?? "",
  }));
}

export async function getSignificantEnergyUseRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.significantEnergyUse.findMany({
    where: { organizationId },
    include: { energyUse: { select: { code: true, name: true, unit: true } }, review: { select: { code: true } } },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code, uso: row.energyUse.code, nombre_uso: row.energyUse.name,
    revision: row.review?.code ?? "", participacion_pct: row.consumptionShare ?? "",
    potencial_mejora_pct: row.improvementPotential ?? "", significativo: YES(row.significant),
    estado: row.status, justificacion: row.rationale ?? "",
  }));
}

export async function getEnergyBaselineRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.energyBaseline.findMany({
    where: { organizationId },
    include: { seu: { select: { code: true } } },
    orderBy: [{ code: "asc" }, { formulaVersion: "desc" }],
  });
  return rows.map((row) => ({
    codigo: row.code, version_formula: row.formulaVersion, titulo: row.title,
    seu: row.seu?.code ?? "", desde: date(row.periodStart), hasta: date(row.periodEnd),
    consumo: row.consumption, normalizado: row.normalizedConsumption ?? "",
    unidad: row.unit, metodo_normalizacion: row.normalizationMethod, estado: row.status,
  }));
}

export async function getEnpiRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.energyPerformanceIndicator.findMany({
    where: { organizationId },
    include: { seu: { select: { code: true } }, baseline: { select: { code: true, formulaVersion: true } } },
    orderBy: [{ code: "asc" }, { formulaVersion: "desc" }],
  });
  return rows.map((row) => ({
    codigo: row.code, version_formula: row.formulaVersion, nombre: row.name,
    tipo_formula: row.formulaKind, seu: row.seu?.code ?? "",
    linea_base: row.baseline ? `${row.baseline.code}@${row.baseline.formulaVersion}` : "",
    valor_actual: row.currentValue ?? "", valor_base: row.baselineValue ?? "",
    meta: row.targetValue ?? "", desviacion_pct: row.deviationPercent ?? "",
    unidad: row.unit, activo: YES(row.active), supersedido: YES(row.superseded),
  }));
}

export async function getEnergyConsumptionRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.energyReading.findMany({
    where: { organizationId },
    include: {
      meter: { select: { code: true, name: true, source: { select: { code: true, name: true, sourceType: true } } } },
    },
    orderBy: { readingAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code, medidor: row.meter.code, fuente: row.meter.source?.code ?? "",
    tipo_fuente: row.meter.source?.sourceType ?? "", fecha: date(row.readingAt),
    periodo_desde: date(row.periodStart), periodo_hasta: date(row.periodEnd),
    valor: row.value, unidad: row.unit, estimado: YES(row.estimated),
    coste: row.cost ?? "", emisiones: row.emissions ?? "",
  }));
}

export async function getEnergyOpportunityRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.energyOpportunity.findMany({
    where: { organizationId },
    include: { seu: { select: { code: true } }, _count: { select: { actionPlans: true } } },
    orderBy: { identifiedAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code, titulo: row.title, seu: row.seu?.code ?? "",
    ahorro_estimado: row.estimatedSaving ?? "", coste_estimado: row.estimatedCost ?? "",
    payback_meses: row.paybackMonths ?? "", prioridad: row.priority, estado: row.status,
    planes: row._count.actionPlans, identificado_el: date(row.identifiedAt),
  }));
}

export async function getEnergyActionRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.energyActionPlan.findMany({
    where: { organizationId },
    include: { opportunity: { select: { code: true, title: true } } },
    orderBy: { dueDate: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code, titulo: row.title, oportunidad: row.opportunity?.code ?? "",
    avance_pct: row.progressPercent, estado: row.status,
    inicio: date(row.startDate), vencimiento: date(row.dueDate),
    capa: row.capaId ?? "", completado_el: date(row.completedAt),
  }));
}

export async function getEnergySavingRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.energySavingVerification.findMany({
    where: { organizationId },
    include: { actionPlan: { select: { code: true, title: true } } },
    orderBy: { periodEnd: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code, plan: row.actionPlan.code, desde: date(row.periodStart), hasta: date(row.periodEnd),
    base: row.baselineConsumption ?? "", actual: row.actualConsumption ?? "",
    ahorro_absoluto: row.absoluteSaving ?? "", ahorro_normalizado: row.normalizedSaving ?? "",
    ahorro_coste: row.costSaving ?? "", ahorro_emisiones: row.emissionSaving ?? "",
    formula: row.formulaKind, version_formula: row.formulaVersion, estado: row.status,
    verificado_el: date(row.verifiedAt),
  }));
}
