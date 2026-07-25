/**
 * Lógica pura del crosswalk del Sistema Integrado de Gestión.
 *
 * Clasifica cada requisito frente al resto de normas activas y calcula el grado
 * de integración. Sin acceso a base de datos: testeable de forma aislada.
 */

export type RelationType = "EQUIVALENT" | "PARTIAL" | "RELATED" | "SUPERSEDES";

/** Clasificación de un requisito dentro del sistema integrado. */
export type RequirementKind = "EQUIVALENT" | "PARTIAL" | "SPECIFIC";

export type MappingEdge = {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  equivalencePercent: number | null;
};

export type CrosswalkRequirement = {
  id: string;
  code: string;
  title: string;
  familyCode: string;
  level: number;
  mandatory: boolean;
};

export type CrosswalkRow = {
  requirementId: string;
  code: string;
  title: string;
  familyCode: string;
  /** Equivalente / parcialmente equivalente / específico de esta norma. */
  kind: RequirementKind;
  /** Requisitos correspondientes en las otras normas activas. */
  related: {
    requirementId: string;
    code: string;
    familyCode: string;
    relationType: RelationType;
    equivalencePercent: number | null;
  }[];
  /** Documentos, evidencias y demás elementos que ya cubren este requisito. */
  sharedDocuments: string[];
  sharedEvidence: string[];
  coverageCount: number;
  responsibleId: string | null;
  responsibleName: string | null;
};

/**
 * Índice bidireccional de correspondencias: un mapeo A→B se consulta también
 * desde B. El instalador guarda una sola dirección para no duplicar filas.
 */
export function buildMappingIndex(edges: MappingEdge[]): Map<string, MappingEdge[]> {
  const index = new Map<string, MappingEdge[]>();
  const push = (key: string, edge: MappingEdge) => {
    const list = index.get(key);
    if (list) list.push(edge);
    else index.set(key, [edge]);
  };
  for (const e of edges) {
    push(e.sourceId, e);
    // Dirección inversa con los extremos intercambiados.
    push(e.targetId, { ...e, sourceId: e.targetId, targetId: e.sourceId });
  }
  return index;
}

/**
 * Clasifica un requisito: EQUIVALENT si tiene al menos una correspondencia
 * equivalente con otra norma activa, PARTIAL si solo tiene parciales/relacionadas,
 * SPECIFIC si no corresponde con ninguna otra norma (requisito propio).
 */
export function classifyRequirement(
  relations: { relationType: RelationType; familyCode: string }[],
  ownFamily: string,
): RequirementKind {
  const external = relations.filter((r) => r.familyCode !== ownFamily);
  if (!external.length) return "SPECIFIC";
  if (external.some((r) => r.relationType === "EQUIVALENT")) return "EQUIVALENT";
  return "PARTIAL";
}

/**
 * Grado de integración del sistema: porcentaje de requisitos que se satisfacen
 * de forma compartida (equivalentes o parciales) frente al total.
 * Es la métrica que justifica el SIG: cuanto mayor, menos duplicación.
 */
export function integrationRate(rows: { kind: RequirementKind }[]): number {
  if (!rows.length) return 0;
  const shared = rows.filter((r) => r.kind !== "SPECIFIC").length;
  return Math.round((shared / rows.length) * 100);
}

/**
 * Elementos reutilizados: cuántos requisitos cubre de media cada elemento
 * (documento, evidencia, riesgo…). Un valor > 1 demuestra no-duplicación.
 */
export function reuseFactor(coverage: { entityType: string; entityId: string; requirementId: string }[]): number {
  if (!coverage.length) return 0;
  const byEntity = new Map<string, Set<string>>();
  for (const c of coverage) {
    const key = `${c.entityType}:${c.entityId}`;
    const set = byEntity.get(key) ?? new Set<string>();
    set.add(c.requirementId);
    byEntity.set(key, set);
  }
  const total = [...byEntity.values()].reduce((sum, set) => sum + set.size, 0);
  return Math.round((total / byEntity.size) * 100) / 100;
}

/** Requisitos obligatorios sin ninguna evidencia/documento asociado. */
export function missingEvidence(rows: CrosswalkRow[]): CrosswalkRow[] {
  return rows.filter((r) => r.coverageCount === 0);
}
