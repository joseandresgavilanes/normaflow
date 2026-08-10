import "server-only";
import { prisma } from "@/lib/prisma";
import { buildMappingIndex, classifyRequirement, isShareable, type RelationType } from "@/lib/integrated/crosswalk";

type Row = Record<string, string | number | boolean | null>;

const KIND_ES: Record<string, string> = {
  EQUIVALENT: "EQUIVALENTE",
  PARTIAL: "PARCIALMENTE EQUIVALENTE",
  SPECIFIC: "ESPECIFICO",
};

/**
 * Matriz integrada para reportes: una fila por requisito de las normas activas,
 * con su equivalencia en las otras normas, documento/evidencia compartidos y
 * responsable. Es la versión exportable del crosswalk del SIG.
 */
export async function getIntegratedCrosswalkRows(organizationId: string, standardCode?: string): Promise<Row[]> {
  const orgStandards = await prisma.organizationStandard.findMany({
    where: { organizationId },
    include: { standard: { include: { family: true } } },
  });
  if (!orgStandards.length) return [];

  const editionIds = orgStandards.map((o) => o.standardId);
  const activeFamilies = new Set(orgStandards.map((o) => o.standard.family.code));

  const requirements = await prisma.standardRequirement.findMany({
    where: { standardId: { in: editionIds }, active: true },
    select: {
      id: true, code: true, title: true, mandatory: true,
      standard: { select: { family: { select: { code: true } } } },
    },
    orderBy: [{ standardId: "asc" }, { order: "asc" }, { code: "asc" }],
  });
  const requirementIds = requirements.map((r) => r.id);
  const familyById = new Map(requirements.map((r) => [r.id, r.standard.family.code]));
  const codeById = new Map(requirements.map((r) => [r.id, r.code]));

  const [mappings, coverage, assignments] = await Promise.all([
    requirementIds.length
      ? prisma.requirementMapping.findMany({
          where: { OR: [{ sourceRequirementId: { in: requirementIds } }, { targetRequirementId: { in: requirementIds } }] },
          select: { sourceRequirementId: true, targetRequirementId: true, relationType: true, equivalencePercent: true },
        })
      : [],
    prisma.requirementCoverage.findMany({ where: { organizationId }, select: { requirementId: true, entityType: true, entityId: true } }),
    prisma.requirementAssignment.findMany({ where: { organizationId }, include: { responsible: { select: { name: true } } } }),
  ]);

  const docIds = coverage.filter((c) => c.entityType === "DOCUMENT").map((c) => c.entityId);
  const evIds = coverage.filter((c) => c.entityType === "EVIDENCE").map((c) => c.entityId);
  const [docs, evs] = await Promise.all([
    docIds.length ? prisma.document.findMany({ where: { organizationId, id: { in: docIds } }, select: { id: true, code: true, title: true } }) : [],
    evIds.length ? prisma.evidenceFile.findMany({ where: { organizationId, id: { in: evIds } }, select: { id: true, title: true } }) : [],
  ]);
  const docLabel = new Map(docs.map((d) => [d.id, `${d.code} · ${d.title}`]));
  const evLabel = new Map(evs.map((e) => [e.id, e.title]));

  const index = buildMappingIndex(mappings.map((m) => ({
    sourceId: m.sourceRequirementId, targetId: m.targetRequirementId,
    relationType: m.relationType as RelationType, equivalencePercent: m.equivalencePercent,
  })));
  const covByReq = new Map<string, { entityType: string; entityId: string }[]>();
  for (const c of coverage) {
    const list = covByReq.get(c.requirementId) ?? [];
    list.push({ entityType: c.entityType, entityId: c.entityId });
    covByReq.set(c.requirementId, list);
  }
  const assignByReq = new Map(assignments.map((a) => [a.requirementId, a]));

  // Elementos que cubren requisitos de más de una norma — determina la
  // compartibilidad práctica de los requisitos ESPECIFICOS (ver isShareable).
  const familiesByEntity = new Map<string, Set<string>>();
  for (const c of coverage) {
    const key = `${c.entityType}:${c.entityId}`;
    const fam = familyById.get(c.requirementId);
    const set = familiesByEntity.get(key) ?? new Set<string>();
    if (fam) set.add(fam);
    familiesByEntity.set(key, set);
  }
  const multiFamilyEntityKeys = new Set([...familiesByEntity.entries()].filter(([, fams]) => fams.size > 1).map(([key]) => key));

  return requirements
    .filter((r) => !standardCode || r.standard.family.code === standardCode)
    .map((r) => {
      const own = r.standard.family.code;
      const related = (index.get(r.id) ?? [])
        .filter((e) => { const f = familyById.get(e.targetId); return f !== undefined && activeFamilies.has(f); })
        .map((e) => ({ relationType: e.relationType, familyCode: familyById.get(e.targetId) ?? "", code: codeById.get(e.targetId) ?? "", pct: e.equivalencePercent }));
      const kind = classifyRequirement(related, own);
      const cov = covByReq.get(r.id) ?? [];
      const assign = assignByReq.get(r.id);
      const equivalents = related.filter((x) => x.relationType === "EQUIVALENT");
      const partials = related.filter((x) => x.relationType !== "EQUIVALENT");
      return {
        norma: own,
        requisito: r.code,
        titulo: r.title,
        obligatorio: r.mandatory ? "SI" : "NO",
        tipo: KIND_ES[kind] ?? kind,
        compartible: isShareable({ kind, requirementId: r.id }, covByReq, multiFamilyEntityKeys) ? "SI" : "NO",
        requisito_equivalente: equivalents.map((x) => `${x.familyCode} ${x.code}`).join(", "),
        requisito_parcial: partials.map((x) => `${x.familyCode} ${x.code}${x.pct != null ? ` (${x.pct}%)` : ""}`).join(", "),
        documento_compartido: cov.filter((c) => c.entityType === "DOCUMENT").map((c) => docLabel.get(c.entityId) ?? c.entityId).join(", "),
        evidencia_compartida: cov.filter((c) => c.entityType === "EVIDENCE").map((c) => evLabel.get(c.entityId) ?? c.entityId).join(", "),
        elementos_asociados: cov.length,
        responsable: assign?.responsible?.name ?? "",
        notas: assign?.notes ?? "",
      } satisfies Row;
    });
}

/**
 * Requisitos comunes: la vista filtrada de la matriz integrada que solo
 * incluye equivalentes/parcialmente equivalentes (excluye los específicos de
 * una sola norma) — la lista exportable de "qué no hay que duplicar".
 */
export async function getCommonRequirementRows(organizationId: string, standardCode?: string): Promise<Row[]> {
  const rows = await getIntegratedCrosswalkRows(organizationId, standardCode);
  return rows.filter((r) => r.tipo !== KIND_ES.SPECIFIC);
}

const DISCIPLINE_BY_FAMILY_REPORT: Record<string, string> = {
  ISO_9001: "QUALITY", ISO_14001: "ENVIRONMENT", ISO_45001: "SAFETY", ISO_27001: "SECURITY",
};

/**
 * Cumplimiento por norma: una fila por familia activa con su puntaje GAP,
 * requisitos evaluados y evidencia asociada — la vista exportable del panel
 * "Cumplimiento por norma" del dashboard SIG.
 */
export async function getComplianceByStandardRows(organizationId: string): Promise<Row[]> {
  const orgStandards = await prisma.organizationStandard.findMany({
    where: { organizationId },
    include: { standard: { include: { family: true } } },
  });
  if (!orgStandards.length) return [];

  const editionIds = orgStandards.map((o) => o.standardId);
  const requirements = await prisma.standardRequirement.findMany({
    where: { standardId: { in: editionIds }, active: true },
    select: { id: true, standardId: true, standard: { select: { family: { select: { code: true } } } } },
  });
  const familyById = new Map(requirements.map((r) => [r.id, r.standard.family.code]));

  const [coverage, gapAssessments] = await Promise.all([
    prisma.requirementCoverage.findMany({ where: { organizationId }, select: { requirementId: true } }),
    prisma.assessment.findMany({
      where: { organizationId, standardId: { in: editionIds }, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
      orderBy: { updatedAt: "desc" },
      select: { standardId: true, answers: { select: { clauseId: true, status: true, score: true } } },
    }),
  ]);

  const coveredReqIds = new Set(coverage.map((c) => c.requirementId));
  const gapByReq = new Map<string, { status: string; score: number }>();
  const seenEdition = new Set<string>();
  for (const a of gapAssessments) {
    if (seenEdition.has(a.standardId)) continue;
    seenEdition.add(a.standardId);
    for (const an of a.answers) gapByReq.set(an.clauseId, { status: an.status, score: an.score });
  }

  const byFamily = new Map<string, { total: number; evaluated: number; sum: number; covered: number }>();
  for (const r of requirements) {
    const fam = familyById.get(r.id) ?? "";
    const f = byFamily.get(fam) ?? { total: 0, evaluated: 0, sum: 0, covered: 0 };
    f.total += 1;
    const gap = gapByReq.get(r.id);
    if (gap && gap.status !== "NOT_EVALUATED") { f.evaluated += 1; f.sum += gap.score; }
    if (coveredReqIds.has(r.id)) f.covered += 1;
    byFamily.set(fam, f);
  }

  return [...byFamily.entries()].map(([norma, f]) => ({
    norma,
    disciplina: DISCIPLINE_BY_FAMILY_REPORT[norma] ?? "QUALITY",
    requisitos_totales: f.total,
    evaluados: f.evaluated,
    cumplimiento_pct: f.evaluated ? Math.round(f.sum / f.evaluated) : 0,
    con_evidencia: f.covered,
    sin_evidencia: f.total - f.covered,
  } satisfies Row));
}

/**
 * Elementos que cubren requisitos de MÁS DE UNA norma: la prueba exportable de
 * que el sistema no duplica documentos, evidencias, riesgos ni auditorías.
 */
export async function getSharedElementRows(organizationId: string): Promise<Row[]> {
  const coverage = await prisma.requirementCoverage.findMany({
    where: { organizationId },
    select: {
      entityType: true, entityId: true,
      requirement: { select: { code: true, standard: { select: { family: { select: { code: true } } } } } },
    },
  });
  if (!coverage.length) return [];

  const grouped = new Map<string, { entityType: string; entityId: string; families: Set<string>; requirements: string[] }>();
  for (const c of coverage) {
    const key = `${c.entityType}:${c.entityId}`;
    const entry = grouped.get(key) ?? { entityType: c.entityType, entityId: c.entityId, families: new Set<string>(), requirements: [] };
    entry.families.add(c.requirement.standard.family.code);
    entry.requirements.push(`${c.requirement.standard.family.code} ${c.requirement.code}`);
    grouped.set(key, entry);
  }

  const docIds = [...grouped.values()].filter((g) => g.entityType === "DOCUMENT").map((g) => g.entityId);
  const evIds = [...grouped.values()].filter((g) => g.entityType === "EVIDENCE").map((g) => g.entityId);
  const [docs, evs] = await Promise.all([
    docIds.length ? prisma.document.findMany({ where: { organizationId, id: { in: docIds } }, select: { id: true, code: true, title: true } }) : [],
    evIds.length ? prisma.evidenceFile.findMany({ where: { organizationId, id: { in: evIds } }, select: { id: true, title: true } }) : [],
  ]);
  const label = new Map<string, string>([
    ...docs.map((d) => [d.id, `${d.code} · ${d.title}`] as const),
    ...evs.map((e) => [e.id, e.title] as const),
  ]);

  return [...grouped.values()]
    .filter((g) => g.families.size > 1)
    .sort((a, b) => b.requirements.length - a.requirements.length)
    .map((g) => ({
      elemento: label.get(g.entityId) ?? g.entityId,
      tipo: g.entityType,
      normas_cubiertas: [...g.families].sort().join(", "),
      total_normas: g.families.size,
      requisitos_cubiertos: g.requirements.sort().join(", "),
      total_requisitos: g.requirements.length,
    } satisfies Row));
}
