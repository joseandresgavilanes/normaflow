import "server-only";
import { prisma } from "@/lib/prisma";

type Row = Record<string, string | number | boolean | null>;
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? "";
const YES = (v: boolean) => (v ? "SI" : "NO");
const join = (arr: string[] | null | undefined) => (arr ?? []).join(", ");

export async function getMdDesignHistoryRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.designHistoryFile.findMany({
    where: { organizationId },
    include: {
      device: { select: { code: true, name: true } },
      _count: { select: { inputs: true, outputs: true, reviews: true, verifications: true, validations: true, transfers: true } },
    },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code, dispositivo: row.device.code, titulo: row.title, estado: row.status,
    inputs: row._count.inputs, outputs: row._count.outputs, revisiones: row._count.reviews,
    verificaciones: row._count.verifications, validaciones: row._count.validations,
    transferencias: row._count.transfers,
  }));
}

export async function getMdMasterRecordRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.deviceMasterRecord.findMany({
    where: { organizationId },
    include: { device: { select: { code: true, name: true } } },
    orderBy: [{ code: "asc" }, { version: "desc" }],
  });
  return rows.map((row) => ({
    codigo: row.code, version: row.version, dispositivo: row.device.code, titulo: row.title,
    estado: row.status, aprobado_el: date(row.approvedAt), resumen: row.summary ?? "",
  }));
}

export async function getMdRiskRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.deviceRiskFile.findMany({
    where: { organizationId },
    include: { device: { select: { code: true } } },
    orderBy: [{ code: "asc" }, { version: "desc" }],
  });
  return rows.map((row) => ({
    codigo: row.code, version: row.version, dispositivo: row.device.code, titulo: row.title,
    metodologia: row.methodology ?? "", riesgos_enlazados: row.linkedRiskIds.length,
    residual: row.residualRiskSummary ?? "", estado: row.status,
  }));
}

export async function getMdValidationRows(organizationId: string): Promise<Row[]> {
  const [process, ster, ver, val] = await Promise.all([
    prisma.processValidation.findMany({ where: { organizationId }, include: { device: { select: { code: true } } } }),
    prisma.sterilizationValidation.findMany({ where: { organizationId }, include: { device: { select: { code: true } } } }),
    prisma.designVerification.findMany({ where: { organizationId }, include: { dhf: { select: { code: true } } } }),
    prisma.designValidation.findMany({ where: { organizationId }, include: { dhf: { select: { code: true } } } }),
  ]);
  return [
    ...process.map((r) => ({ tipo: "PROCESO", codigo: r.code, dispositivo: r.device?.code ?? "", titulo: r.title, resultado: r.result, fecha: date(r.validatedAt) })),
    ...ster.map((r) => ({ tipo: "ESTERILIZACION", codigo: r.code, dispositivo: r.device?.code ?? "", titulo: r.method, resultado: r.result, fecha: date(r.validatedAt) })),
    ...ver.map((r) => ({ tipo: "VERIFICACION_DISENO", codigo: r.code, dispositivo: r.dhf.code, titulo: r.method ?? "", resultado: r.result, fecha: date(r.verifiedAt) })),
    ...val.map((r) => ({ tipo: "VALIDACION_DISENO", codigo: r.code, dispositivo: r.dhf.code, titulo: r.method ?? "", resultado: r.result, fecha: date(r.validatedAt) })),
  ];
}

export async function getMdSupplierRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.criticalSupplier.findMany({
    where: { organizationId },
    include: { qualifications: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code, nombre: row.name, tipo: row.serviceType ?? "", criticidad: row.criticality,
    estado: row.status, qualificacion: row.qualifications[0]?.status ?? "",
    proxima_revision: date(row.qualifications[0]?.nextReviewAt),
  }));
}

export async function getMdBatchRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.productionBatch.findMany({
    where: { organizationId },
    include: { device: { select: { code: true } }, _count: { select: { traceability: true } } },
    orderBy: { manufacturedAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code, lote: row.lotNumber, dispositivo: row.device.code, cantidad: row.quantity ?? "",
    unidad: row.unit ?? "", fabricado_el: date(row.manufacturedAt), caduca_el: date(row.expiryAt),
    estado: row.status, trazas: row._count.traceability,
  }));
}

export async function getMdComplaintRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.complaint.findMany({
    where: { organizationId },
    include: { device: { select: { code: true } }, batch: { select: { lotNumber: true } } },
    orderBy: { receivedAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code, dispositivo: row.device?.code ?? "", lote: row.batch?.lotNumber ?? "",
    fuente: row.source, categoria: row.category ?? "", estado: row.status,
    recibido_el: date(row.receivedAt), sujeto_opaco: row.anonymizedSubjectRef ?? "",
    capa: row.capaId ?? "",
  }));
}

export async function getMdSurveillanceRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.postMarketSurveillance.findMany({
    where: { organizationId },
    include: { device: { select: { code: true } } },
    orderBy: { periodEnd: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code, dispositivo: row.device.code, titulo: row.title,
    desde: date(row.periodStart), hasta: date(row.periodEnd), estado: row.status,
    hallazgos: row.findings ?? "",
  }));
}

export async function getMdAdverseEventRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.adverseEvent.findMany({
    where: { organizationId },
    include: { device: { select: { code: true } }, batch: { select: { lotNumber: true } }, complaint: { select: { code: true } } },
    orderBy: { reportedAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code, dispositivo: row.device?.code ?? "", lote: row.batch?.lotNumber ?? "",
    queja: row.complaint?.code ?? "", severidad: row.severity, reportable: YES(row.reportable),
    autoridad: YES(row.reportedToAuthority), estado: row.status, reportado_el: date(row.reportedAt),
    sujeto_opaco: row.anonymizedSubjectRef ?? "",
  }));
}

export async function getMdRecallRows(organizationId: string): Promise<Row[]> {
  const [recalls, fsas] = await Promise.all([
    prisma.productRecall.findMany({
      where: { organizationId },
      include: { device: { select: { code: true } } },
      orderBy: { initiatedAt: "desc" },
    }),
    prisma.fieldSafetyAction.findMany({
      where: { organizationId },
      include: { device: { select: { code: true } } },
      orderBy: { initiatedAt: "desc" },
    }),
  ]);
  return [
    ...recalls.map((row) => ({
      tipo: "RETIRO", codigo: row.code, dispositivo: row.device?.code ?? "", titulo: row.title,
      lotes: join(row.lotNumbers), estado: row.status, iniciado_el: date(row.initiatedAt),
      autoridad: YES(row.authorityNotified),
    })),
    ...fsas.map((row) => ({
      tipo: "ACCION_CAMPO", codigo: row.code, dispositivo: row.device?.code ?? "", titulo: row.title,
      lotes: join(row.lotNumbers), estado: row.status, iniciado_el: date(row.initiatedAt),
      autoridad: "",
    })),
  ];
}
