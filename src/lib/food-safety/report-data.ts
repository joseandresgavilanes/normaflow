import "server-only";
import { prisma } from "@/lib/prisma";
import { runTraceabilityTest, type TraceLotNode } from "@/lib/food-safety/traceability";

type Row = Record<string, string | number | boolean | null>;
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? "";
const YES = (v: boolean) => (v ? "SI" : "NO");
const join = (arr: string[] | null | undefined) => (arr ?? []).join(", ");

export async function getFsmsHazardAnalysisRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.hazardAssessment.findMany({
    where: { organizationId },
    include: {
      hazard: { select: { code: true, name: true, hazardType: true } },
      step: { select: { code: true, name: true, sequence: true } },
    },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    peligro: row.hazard.code,
    nombre_peligro: row.hazard.name,
    tipo: row.hazard.hazardType,
    paso: row.step?.code ?? "",
    severidad: row.severity,
    probabilidad: row.likelihood,
    puntuacion: row.score,
    significativo: YES(row.significant),
    decision_control: row.controlDecision,
    estado: row.status,
    evaluado_el: date(row.assessedAt),
    justificacion: row.justification ?? "",
  }));
}

export async function getFsmsPrpRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.prerequisiteProgram.findMany({
    where: { organizationId },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    nombre: row.name,
    categoria: row.category,
    frecuencia: row.frequency ?? "",
    activo: YES(row.active),
    documento: row.documentId ?? "",
    evidencia: row.evidenceId ?? "",
    descripcion: row.description ?? "",
  }));
}

export async function getFsmsOprpRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.operationalPRP.findMany({
    where: { organizationId },
    include: {
      step: { select: { code: true, name: true } },
      hazardAssessment: { select: { code: true } },
    },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    nombre: row.name,
    evaluacion: row.hazardAssessment?.code ?? "",
    paso: row.step?.code ?? "",
    metodo_monitoreo: row.monitoringMethod ?? "",
    frecuencia: row.monitoringFrequency ?? "",
    correccion: row.correctionAction ?? "",
    activo: YES(row.active),
  }));
}

export async function getFsmsCcpRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.criticalControlPoint.findMany({
    where: { organizationId },
    include: {
      step: { select: { code: true, name: true } },
      hazardAssessment: { select: { code: true } },
      limits: { select: { code: true, parameter: true, operator: true, minValue: true, maxValue: true, unit: true } },
    },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    nombre: row.name,
    paso: row.step.code,
    evaluacion: row.hazardAssessment?.code ?? "",
    peligro_controlado: row.hazardControlled ?? "",
    limites: row.limits.map((l) => `${l.parameter} ${l.operator} [${l.minValue ?? ""}–${l.maxValue ?? ""}] ${l.unit ?? ""}`).join("; "),
    activo: YES(row.active),
    justificacion: row.justification ?? "",
  }));
}

export async function getFsmsMonitoringRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.monitoringRecord.findMany({
    where: { organizationId },
    include: {
      plan: {
        select: {
          code: true,
          title: true,
          ccp: { select: { code: true } },
          oprp: { select: { code: true } },
        },
      },
    },
    orderBy: { recordedAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    plan: row.plan.code,
    ccp: row.plan.ccp?.code ?? "",
    oprp: row.plan.oprp?.code ?? "",
    fecha: date(row.recordedAt),
    valor: row.valueNumeric ?? row.valueText ?? "",
    unidad: row.unit ?? "",
    dentro_limites: YES(row.withinLimits),
    notas: row.notes ?? "",
  }));
}

export async function getFsmsDeviationRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.deviation.findMany({
    where: { organizationId },
    include: {
      ccp: { select: { code: true, name: true } },
      _count: { select: { corrections: true } },
    },
    orderBy: { detectedAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    titulo: row.title,
    ccp: row.ccp?.code ?? "",
    detectado_el: date(row.detectedAt),
    severidad: row.severity,
    estado: row.status,
    retencion_producto: YES(row.productHold),
    lotes: join(row.lotCodes),
    correcciones: row._count.corrections,
    capa: row.capaId ?? "",
    cerrado_el: date(row.closedAt),
  }));
}

export async function getFsmsTraceabilityRows(organizationId: string): Promise<Row[]> {
  const lots = await prisma.traceabilityLot.findMany({
    where: { organizationId },
    include: {
      product: { select: { code: true } },
      rawMaterial: { select: { code: true } },
    },
    orderBy: { code: "asc" },
  });
  const nodes: TraceLotNode[] = lots.map((lot) => ({
    id: lot.id,
    code: lot.code,
    lotType: lot.lotType,
    productCode: lot.product?.code,
    rawMaterialCode: lot.rawMaterial?.code,
    supplierId: lot.supplierId,
    customerName: lot.customerName,
    previousLotIds: lot.previousLotIds,
    quantity: lot.quantity,
    unit: lot.unit,
    status: lot.status,
  }));
  const byId = new Map(lots.map((l) => [l.id, l]));

  return lots.map((lot) => {
    let back = 0;
    let fwd = 0;
    try {
      const test = runTraceabilityTest({ rootIdOrCode: lot.id, lots: nodes });
      back = test.backward.nodes.length;
      fwd = test.forward.nodes.length;
    } catch {
      /* ignore */
    }
    const prevCodes = lot.previousLotIds.map((id) => byId.get(id)?.code ?? id);
    return {
      codigo: lot.code,
      tipo: lot.lotType,
      producto: lot.product?.code ?? "",
      materia_prima: lot.rawMaterial?.code ?? "",
      proveedor: lot.supplierId ?? "",
      cliente: lot.customerName ?? "",
      distribucion: lot.distributionRef ?? "",
      lotes_previos: prevCodes.join(", "),
      nodos_atras: back,
      nodos_adelante: fwd,
      cantidad: lot.quantity ?? "",
      unidad: lot.unit ?? "",
      estado: lot.status,
      producido_el: date(lot.producedAt),
    };
  });
}

export async function getFsmsRecallRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.withdrawalRecall.findMany({
    where: { organizationId },
    orderBy: { initiatedAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    titulo: row.title,
    tipo: row.recallType,
    motivo: row.reason,
    estado: row.status,
    lotes: join(row.lotCodes),
    iniciado_el: date(row.initiatedAt),
    notificado_el: date(row.notifiedAt),
    autoridad: YES(row.authorityNotified),
    cantidad: row.quantityAffected ?? "",
    unidad: row.unit ?? "",
    cerrado_el: date(row.closedAt),
  }));
}

export async function getFsmsAllergenRows(organizationId: string): Promise<Row[]> {
  const [allergens, products, materials] = await Promise.all([
    prisma.allergen.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.foodProduct.findMany({ where: { organizationId }, select: { code: true, name: true, allergenCodes: true } }),
    prisma.rawMaterial.findMany({ where: { organizationId }, select: { code: true, name: true, allergenCodes: true } }),
  ]);
  return allergens.map((a) => {
    const inProducts = products.filter((p) => p.allergenCodes.includes(a.code)).map((p) => p.code);
    const inMaterials = materials.filter((m) => m.allergenCodes.includes(a.code)).map((m) => m.code);
    return {
      codigo: a.code,
      nombre: a.name,
      categoria: a.category ?? "",
      activo: YES(a.active),
      productos: inProducts.join(", "),
      materias_primas: inMaterials.join(", "),
      descripcion: a.description ?? "",
    };
  });
}
