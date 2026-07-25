import "server-only";
import { prisma } from "@/lib/prisma";
import { availabilityPercent, slaMet } from "@/lib/itsm/workflows";

type Row = Record<string, string | number | boolean | null>;
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? "";
const YES = (v: boolean | null | undefined) => (v == null ? "" : v ? "SI" : "NO");

export async function getItsmSlaRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.serviceLevelAgreement.findMany({
    where: { organizationId },
    include: { service: { select: { code: true, name: true } } },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    servicio: row.service.code,
    nombre: row.name,
    prioridad: row.priority,
    respuesta_min: row.responseTimeMinutes,
    resolucion_min: row.resolutionTimeMinutes,
    disponibilidad_objetivo_pct: row.availabilityTargetPct ?? "",
    estado: row.status,
    vigente_desde: date(row.effectiveFrom),
    vigente_hasta: date(row.effectiveTo),
  }));
}

export async function getItsmIncidentRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.iTSMIncident.findMany({
    where: { organizationId },
    include: {
      service: { select: { code: true } },
      sla: { select: { code: true, responseTimeMinutes: true, resolutionTimeMinutes: true } },
      configurationItem: { select: { code: true } },
    },
    orderBy: { detectedAt: "desc" },
  });
  return rows.map((row) => {
    const responseActual =
      row.assignedAt ? Math.round((row.assignedAt.getTime() - row.detectedAt.getTime()) / 60000) : null;
    const resolutionActual =
      row.resolvedAt ? Math.round((row.resolvedAt.getTime() - row.detectedAt.getTime()) / 60000) : null;
    const evalSla = row.sla
      ? slaMet({
          responseDueMinutes: row.sla.responseTimeMinutes,
          resolutionDueMinutes: row.sla.resolutionTimeMinutes,
          responseActualMinutes: responseActual,
          resolutionActualMinutes: resolutionActual,
        })
      : null;
    return {
      codigo: row.code,
      titulo: row.title,
      servicio: row.service?.code ?? "",
      sla: row.sla?.code ?? "",
      ci: row.configurationItem?.code ?? "",
      prioridad: row.priority,
      impacto: row.impact,
      urgencia: row.urgency,
      estado: row.status,
      detectado_el: date(row.detectedAt),
      resuelto_el: date(row.resolvedAt),
      cerrado_el: date(row.closedAt),
      sla_cumplido: YES(evalSla?.overallMet),
    };
  });
}

export async function getItsmProblemRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.problem.findMany({
    where: { organizationId },
    include: {
      service: { select: { code: true } },
      _count: { select: { incidents: true, knownErrors: true } },
    },
    orderBy: { identifiedAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    titulo: row.title,
    servicio: row.service?.code ?? "",
    estado: row.status,
    causa_raiz: row.rootCause ?? "",
    workaround: row.workaround ?? "",
    incidentes: row._count.incidents,
    errores_conocidos: row._count.knownErrors,
    identificado_el: date(row.identifiedAt),
    cerrado_el: date(row.closedAt),
  }));
}

export async function getItsmChangeRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.iTSMChange.findMany({
    where: { organizationId },
    include: {
      service: { select: { code: true } },
      relatedIncident: { select: { code: true } },
      relatedProblem: { select: { code: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    titulo: row.title,
    servicio: row.service?.code ?? "",
    tipo: row.changeType,
    estado: row.status,
    riesgo: row.riskLevel,
    impacto: row.impact,
    incidente: row.relatedIncident?.code ?? "",
    problema: row.relatedProblem?.code ?? "",
    programado_inicio: date(row.scheduledStart),
    implementado_el: date(row.implementedAt),
    cerrado_el: date(row.closedAt),
  }));
}

export async function getItsmAvailabilityRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.availabilityPlan.findMany({
    where: { organizationId },
    include: { service: { select: { code: true, name: true } } },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => {
    let computed = row.actualAvailabilityPct;
    if (
      computed == null &&
      row.periodStart &&
      row.periodEnd &&
      typeof row.agreedDowntimeMinutes === "number"
    ) {
      const periodMinutes = Math.max(1, Math.round((row.periodEnd.getTime() - row.periodStart.getTime()) / 60000));
      try {
        computed = availabilityPercent(periodMinutes, row.agreedDowntimeMinutes);
      } catch {
        computed = null;
      }
    }
    return {
      codigo: row.code,
      servicio: row.service.code,
      titulo: row.title,
      objetivo_pct: row.targetPercent,
      real_pct: computed ?? "",
      downtime_acordado_min: row.agreedDowntimeMinutes ?? "",
      periodo_desde: date(row.periodStart),
      periodo_hasta: date(row.periodEnd),
      estado: row.status,
    };
  });
}

export async function getItsmCapacityRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.capacityPlan.findMany({
    where: { organizationId },
    include: { service: { select: { code: true } } },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    servicio: row.service.code,
    titulo: row.title,
    metrica: row.metric,
    capacidad_actual: row.currentCapacity ?? "",
    capacidad_pronosticada: row.forecastCapacity ?? "",
    umbral_pct: row.thresholdPercent ?? "",
    unidad: row.unit ?? "",
    estado: row.status,
  }));
}

export async function getItsmContinuityRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.serviceContinuityPlan.findMany({
    where: { organizationId },
    include: { service: { select: { code: true } } },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    servicio: row.service.code,
    titulo: row.title,
    rto_min: row.rtoMinutes ?? "",
    rpo_min: row.rpoMinutes ?? "",
    bcp_corporativo: row.bcpId ?? "",
    ultimo_ensayo: date(row.lastTestedAt),
    estado: row.status,
  }));
}

export async function getItsmSupplierRows(organizationId: string): Promise<Row[]> {
  const rows = await prisma.serviceSupplier.findMany({
    where: { organizationId },
    include: { service: { select: { code: true } } },
    orderBy: { code: "asc" },
  });
  return rows.map((row) => ({
    codigo: row.code,
    nombre: row.name,
    servicio: row.service?.code ?? "",
    proveedor_maestro: row.supplierId ?? "",
    contrato: row.contractRef ?? "",
    criticidad: row.criticality,
    estado: row.status,
    revision_el: date(row.reviewDueAt),
  }));
}

export async function getItsmServicePerformanceRows(organizationId: string): Promise<Row[]> {
  const [services, incidents, requests, slas, availability] = await Promise.all([
    prisma.iTService.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.iTSMIncident.findMany({ where: { organizationId }, select: { serviceId: true, status: true, resolvedAt: true, detectedAt: true } }),
    prisma.serviceRequest.findMany({ where: { organizationId }, select: { serviceId: true, status: true } }),
    prisma.serviceLevelAgreement.findMany({ where: { organizationId, status: "ACTIVE" }, select: { serviceId: true } }),
    prisma.availabilityPlan.findMany({
      where: { organizationId },
      select: { serviceId: true, actualAvailabilityPct: true, targetPercent: true, status: true },
    }),
  ]);

  return services.map((svc) => {
    const svcInc = incidents.filter((i) => i.serviceId === svc.id);
    const openInc = svcInc.filter((i) => i.status !== "CLOSED").length;
    const resolved = svcInc.filter((i) => i.resolvedAt);
    const mttr = resolved.length
      ? Math.round(
          resolved.reduce((sum, i) => sum + (i.resolvedAt!.getTime() - i.detectedAt.getTime()) / 60000, 0) /
            resolved.length,
        )
      : null;
    const openReq = requests.filter(
      (r) => r.serviceId === svc.id && r.status !== "CLOSED" && r.status !== "FULFILLED" && r.status !== "CANCELLED",
    ).length;
    const activeSla = slas.filter((s) => s.serviceId === svc.id).length;
    const avail = availability.find((a) => a.serviceId === svc.id && a.status === "ACTIVE");
    return {
      servicio: svc.code,
      nombre: svc.name,
      criticidad: svc.criticality,
      estado: svc.status,
      slas_activos: activeSla,
      incidentes_abiertos: openInc,
      solicitudes_abiertas: openReq,
      mttr_min: mttr ?? "",
      disponibilidad_pct: avail?.actualAvailabilityPct ?? "",
      disponibilidad_objetivo_pct: avail?.targetPercent ?? "",
    };
  });
}
