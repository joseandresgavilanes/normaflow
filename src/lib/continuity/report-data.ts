import "server-only";
import { prisma } from "@/lib/prisma";
import { detectGaps } from "@/lib/continuity/bia";

type Row = Record<string, string | number | boolean | null>;

const GAP_ES: Record<string, string> = {
  NO_RTO: "SIN RTO",
  NO_MTPD: "SIN MTPD",
  RTO_EXCEEDS_MTPD: "RTO SUPERA MTPD",
  NO_STRATEGY: "SIN ESTRATEGIA",
  NO_PROCEDURE: "SIN PROCEDIMIENTO",
  SPOF: "PUNTO UNICO DE FALLO",
  STRATEGY_RTO_INSUFFICIENT: "ESTRATEGIA INSUFICIENTE",
  NEVER_TESTED: "NUNCA EJERCITADA",
};

/**
 * Brechas de continuidad por actividad crítica: objetivos sin definir, RTO
 * inalcanzable, ausencia de estrategia o procedimiento, puntos únicos de fallo
 * y actividades nunca ejercitadas. Es el informe que alimenta el plan de mejora.
 */
export async function getContinuityGapRows(organizationId: string): Promise<Row[]> {
  const [activities, executedTests] = await Promise.all([
    prisma.criticalActivity.findMany({
      where: { organizationId },
      orderBy: [{ priority: "asc" }, { code: "asc" }],
      include: {
        dependencies: { select: { name: true, singlePointOfFailure: true } },
        strategies: { select: { achievesRtoMinutes: true, status: true } },
        procedures: { select: { id: true } },
      },
    }),
    prisma.continuityTest.count({ where: { organizationId, status: "COMPLETED" } }),
  ]);

  return activities.flatMap((a) => {
    const gaps = detectGaps({
      id: a.id, name: a.name, mtpdMinutes: a.mtpdMinutes, rtoMinutes: a.rtoMinutes,
      strategies: a.strategies.map((s) => ({ achievesRtoMinutes: s.achievesRtoMinutes, status: s.status })),
      procedures: a.procedures.length,
      dependencies: a.dependencies.map((d) => ({ name: d.name, singlePointOfFailure: d.singlePointOfFailure })),
      tested: executedTests > 0,
    });
    if (!gaps.length) {
      return [{
        codigo: a.code, actividad: a.name, criticidad: a.criticality, prioridad: a.priority,
        brecha: "", tipo_brecha: "SIN BRECHAS", detalle: "",
        mtpd_min: a.mtpdMinutes ?? "", rto_min: a.rtoMinutes ?? "",
      } satisfies Row];
    }
    return gaps.map((g) => ({
      codigo: a.code, actividad: a.name, criticidad: a.criticality, prioridad: a.priority,
      brecha: "SI", tipo_brecha: GAP_ES[g.kind] ?? g.kind, detalle: g.detail,
      mtpd_min: a.mtpdMinutes ?? "", rto_min: a.rtoMinutes ?? "",
    } satisfies Row));
  });
}
