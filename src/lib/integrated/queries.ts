import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import {
  buildMappingIndex,
  classifyRequirement,
  integrationRate,
  reuseFactor,
  type CrosswalkRow,
  type RelationType,
} from "@/lib/integrated/crosswalk";

export type IntegratedPayload = Awaited<ReturnType<typeof getIntegratedPayload>>;

const DISCIPLINE_BY_FAMILY: Record<string, string> = {
  ISO_9001: "QUALITY",
  ISO_14001: "ENVIRONMENT",
  ISO_45001: "SAFETY",
  ISO_27001: "SECURITY",
};

/** Live payload for the /app/integrated module (Sistema Integrado de Gestión). */
export async function getIntegratedPayload() {
  const auth = await requireAuthorization("integrated:read");
  const organizationId = auth.ctx.organization.id;

  const [system, orgStandards, parties, objectives, members, processes] = await Promise.all([
    prisma.integratedSystem.findUnique({
      where: { organizationId },
      include: { standards: { orderBy: { standardCode: "asc" } }, policyApprovedBy: { select: { name: true } } },
    }),
    prisma.organizationStandard.findMany({
      where: { organizationId },
      include: { standard: { include: { family: true } } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.interestedParty.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.integratedObjective.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { memberships: { some: { organizationId } } }, select: { id: true, name: true } }),
    prisma.process.findMany({ where: { organizationId }, select: { id: true, name: true, code: true, type: true }, orderBy: { name: "asc" } }),
  ]);

  const editionIds = orgStandards.map((o) => o.standardId);
  const activeFamilies = orgStandards.map((o) => o.standard.family.code);

  // ── Crosswalk: requisitos de las normas activas + correspondencias ──
  const requirements = editionIds.length
    ? await prisma.standardRequirement.findMany({
        where: { standardId: { in: editionIds }, active: true },
        select: {
          id: true, code: true, title: true, level: true, mandatory: true,
          standard: { select: { family: { select: { code: true } } } },
        },
        orderBy: [{ standardId: "asc" }, { order: "asc" }, { code: "asc" }],
      })
    : [];

  const requirementIds = requirements.map((r) => r.id);
  const familyById = new Map(requirements.map((r) => [r.id, r.standard.family.code]));
  const codeById = new Map(requirements.map((r) => [r.id, r.code]));

  const [mappings, coverage, assignments, gapAnswers] = await Promise.all([
    requirementIds.length
      ? prisma.requirementMapping.findMany({
          where: { OR: [{ sourceRequirementId: { in: requirementIds } }, { targetRequirementId: { in: requirementIds } }] },
          select: { sourceRequirementId: true, targetRequirementId: true, relationType: true, equivalencePercent: true },
        })
      : [],
    prisma.requirementCoverage.findMany({
      where: { organizationId },
      select: { requirementId: true, entityType: true, entityId: true },
    }),
    prisma.requirementAssignment.findMany({
      where: { organizationId },
      include: { responsible: { select: { id: true, name: true } } },
    }),
    editionIds.length
      ? prisma.assessment.findMany({
          where: { organizationId, standardId: { in: editionIds }, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
          orderBy: { updatedAt: "desc" },
          select: { standardId: true, answers: { select: { clauseId: true, status: true, score: true } } },
        })
      : [],
  ]);

  // Nombres de documentos/evidencias para las columnas "documento/evidencia compartida".
  const docIds = coverage.filter((c) => c.entityType === "DOCUMENT").map((c) => c.entityId);
  const evIds = coverage.filter((c) => c.entityType === "EVIDENCE").map((c) => c.entityId);
  const [docs, evs] = await Promise.all([
    docIds.length ? prisma.document.findMany({ where: { organizationId, id: { in: docIds } }, select: { id: true, code: true, title: true } }) : [],
    evIds.length ? prisma.evidenceFile.findMany({ where: { organizationId, id: { in: evIds } }, select: { id: true, title: true } }) : [],
  ]);
  const docLabel = new Map(docs.map((d) => [d.id, `${d.code} · ${d.title}`]));
  const evLabel = new Map(evs.map((e) => [e.id, e.title]));

  const mappingIndex = buildMappingIndex(
    mappings.map((m) => ({
      sourceId: m.sourceRequirementId, targetId: m.targetRequirementId,
      relationType: m.relationType as RelationType, equivalencePercent: m.equivalencePercent,
    })),
  );
  const coverageByReq = new Map<string, { entityType: string; entityId: string }[]>();
  for (const c of coverage) {
    const list = coverageByReq.get(c.requirementId) ?? [];
    list.push({ entityType: c.entityType, entityId: c.entityId });
    coverageByReq.set(c.requirementId, list);
  }
  const assignmentByReq = new Map(assignments.map((a) => [a.requirementId, a]));

  // Última evaluación GAP por edición → estado por requisito.
  const gapByReq = new Map<string, { status: string; score: number }>();
  const seenEdition = new Set<string>();
  for (const a of gapAnswers) {
    if (seenEdition.has(a.standardId)) continue;
    seenEdition.add(a.standardId);
    for (const an of a.answers) gapByReq.set(an.clauseId, { status: an.status, score: an.score });
  }

  const activeFamilySet = new Set(activeFamilies);
  const crosswalk: CrosswalkRow[] = requirements.map((r) => {
    const ownFamily = r.standard.family.code;
    const edges = (mappingIndex.get(r.id) ?? []).filter((e) => {
      const fam = familyById.get(e.targetId);
      // Solo correspondencias con normas activas de la organización.
      return fam !== undefined && activeFamilySet.has(fam);
    });
    const related = edges.map((e) => ({
      requirementId: e.targetId,
      code: codeById.get(e.targetId) ?? "",
      familyCode: familyById.get(e.targetId) ?? "",
      relationType: e.relationType,
      equivalencePercent: e.equivalencePercent,
    }));
    const cov = coverageByReq.get(r.id) ?? [];
    const assignment = assignmentByReq.get(r.id);
    return {
      requirementId: r.id, code: r.code, title: r.title, familyCode: ownFamily,
      kind: classifyRequirement(related, ownFamily),
      related,
      sharedDocuments: cov.filter((c) => c.entityType === "DOCUMENT").map((c) => docLabel.get(c.entityId) ?? c.entityId),
      sharedEvidence: cov.filter((c) => c.entityType === "EVIDENCE").map((c) => evLabel.get(c.entityId) ?? c.entityId),
      coverageCount: cov.length,
      responsibleId: assignment?.responsibleId ?? null,
      responsibleName: assignment?.responsible?.name ?? null,
    };
  });

  // ── Cumplimiento global y por norma (desde el GAP) ──
  const byFamily = new Map<string, { total: number; evaluated: number; sum: number; covered: number; missing: number }>();
  for (const row of crosswalk) {
    const f = byFamily.get(row.familyCode) ?? { total: 0, evaluated: 0, sum: 0, covered: 0, missing: 0 };
    f.total += 1;
    const gap = gapByReq.get(row.requirementId);
    if (gap && gap.status !== "NOT_EVALUATED") { f.evaluated += 1; f.sum += gap.score; }
    if (row.coverageCount > 0) f.covered += 1; else f.missing += 1;
    byFamily.set(row.familyCode, f);
  }
  const compliance = [...byFamily.entries()].map(([familyCode, f]) => ({
    familyCode,
    discipline: DISCIPLINE_BY_FAMILY[familyCode] ?? "QUALITY",
    total: f.total,
    evaluated: f.evaluated,
    score: f.evaluated ? Math.round(f.sum / f.evaluated) : 0,
    covered: f.covered,
    missingEvidence: f.missing,
  }));
  const globalScore = compliance.length
    ? Math.round(compliance.reduce((s, c) => s + c.score, 0) / compliance.length)
    : 0;

  // ── Elementos compartidos (la prueba de no-duplicación) ──
  const sharedEntities = [...coverageByReq.entries()]
    .reduce((acc, [requirementId, list]) => {
      for (const c of list) {
        const key = `${c.entityType}:${c.entityId}`;
        const fam = familyById.get(requirementId);
        const entry = acc.get(key) ?? { entityType: c.entityType, entityId: c.entityId, requirements: 0, families: new Set<string>() };
        entry.requirements += 1;
        if (fam) entry.families.add(fam);
        acc.set(key, entry);
      }
      return acc;
    }, new Map<string, { entityType: string; entityId: string; requirements: number; families: Set<string> }>());
  const multiNormEntities = [...sharedEntities.values()]
    .filter((e) => e.families.size > 1)
    .map((e) => ({
      entityType: e.entityType, entityId: e.entityId, requirements: e.requirements,
      families: [...e.families].sort(),
      label: e.entityType === "DOCUMENT" ? docLabel.get(e.entityId) ?? e.entityId
        : e.entityType === "EVIDENCE" ? evLabel.get(e.entityId) ?? e.entityId : e.entityId,
    }))
    .sort((a, b) => b.requirements - a.requirements);

  // ── Auditorías integradas, hallazgos y CAPA multi-norma ──
  const [audits, capas, risks, reviews] = await Promise.all([
    prisma.audit.findMany({
      where: { organizationId },
      select: {
        id: true, title: true, standardCode: true, standards: true, integrated: true, status: true,
        plannedDate: true, scheduledDate: true,
        findings: { select: { id: true, title: true, type: true, severity: true, status: true, standards: true } },
      },
      orderBy: [{ plannedDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.cAPA.findMany({
      where: { organizationId },
      select: { id: true, code: true, title: true, stage: true, standardCode: true, standards: true, dueDate: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.risk.findMany({
      where: { organizationId },
      select: { id: true, title: true, score: true, status: true, disciplines: true, standards: true, category: true },
      orderBy: { score: "desc" },
      take: 100,
    }),
    prisma.managementReview.findMany({
      where: { organizationId },
      select: { id: true, title: true, standards: true, status: true, scheduledDate: true, heldAt: true },
      orderBy: { scheduledDate: "desc" },
      take: 20,
    }),
  ]);

  const integratedAudits = audits.filter((a) => a.integrated || a.standards.length > 1);
  const multiNormFindings = audits.flatMap((a) =>
    a.findings.filter((f) => f.standards.length > 1).map((f) => ({ ...f, auditId: a.id, auditTitle: a.title })),
  );

  return {
    canManage: auth.can("integrated:create"),
    canUpdate: auth.can("integrated:update"),
    system: system
      ? {
          id: system.id, name: system.name, scope: system.scope, scopeExclusions: system.scopeExclusions,
          policy: system.policy, policyVersion: system.policyVersion,
          policyApprovedAt: system.policyApprovedAt?.toISOString() ?? null,
          policyApprovedByName: system.policyApprovedBy?.name ?? null,
          boundaries: system.boundaries, contextNotes: system.contextNotes,
          standards: system.standards.map((s) => ({
            id: s.id, standardCode: s.standardCode, discipline: s.discipline,
            scopeNote: s.scopeNote, exclusions: s.exclusions, responsibleId: s.responsibleId,
          })),
        }
      : null,
    activeStandards: orgStandards.map((o) => ({
      editionId: o.standardId, familyCode: o.standard.family.code, name: o.standard.name,
      editionCode: o.standard.editionCode, discipline: DISCIPLINE_BY_FAMILY[o.standard.family.code] ?? "QUALITY",
      score: o.score, implementationStatus: o.implementationStatus,
    })),
    interestedParties: parties.map((p) => ({
      id: p.id, code: p.code, name: p.name, type: p.type, needs: p.needs, requirements: p.requirements,
      influence: p.influence, dependency: p.dependency, isRelevant: p.isRelevant,
      disciplines: p.disciplines, standards: p.standards, responsibleId: p.responsibleId,
    })),
    objectives: objectives.map((o) => ({
      id: o.id, code: o.code, title: o.title, description: o.description,
      disciplines: o.disciplines, standards: o.standards, target: o.target,
      targetValue: o.targetValue, currentValue: o.currentValue, unit: o.unit,
      status: o.status, dueDate: o.dueDate?.toISOString() ?? null, ownerId: o.ownerId,
      shared: o.disciplines.length > 1 || o.standards.length > 1,
    })),
    crosswalk,
    compliance,
    globalScore,
    integrationRate: integrationRate(crosswalk),
    reuseFactor: reuseFactor(coverage),
    multiNormEntities,
    processes,
    members,
    audits: audits.map((a) => ({
      id: a.id, title: a.title, standards: a.standards.length ? a.standards : (a.standardCode ? [a.standardCode] : []),
      integrated: a.integrated, status: a.status,
      plannedDate: (a.plannedDate ?? a.scheduledDate)?.toISOString() ?? null,
      findingCount: a.findings.length,
      multiNormFindings: a.findings.filter((f) => f.standards.length > 1).length,
    })),
    integratedAuditCount: integratedAudits.length,
    multiNormFindings,
    capas: capas.map((c) => ({
      id: c.id, code: c.code, title: c.title, stage: c.stage,
      standards: c.standards.length ? c.standards : (c.standardCode ? [c.standardCode] : []),
      dueDate: c.dueDate?.toISOString() ?? null,
      shared: c.standards.length > 1,
    })),
    risks: risks.map((r) => ({
      id: r.id, title: r.title, score: r.score, status: r.status,
      disciplines: r.disciplines, standards: r.standards, category: r.category,
      shared: r.disciplines.length > 1 || r.standards.length > 1,
    })),
    reviews: reviews.map((r) => ({
      id: r.id, title: r.title, standards: r.standards, status: r.status,
      scheduledDate: r.scheduledDate?.toISOString() ?? null,
      heldAt: r.heldAt?.toISOString() ?? null,
      integrated: r.standards.length > 1,
    })),
    summary: {
      standards: orgStandards.length,
      requirements: crosswalk.length,
      equivalent: crosswalk.filter((r) => r.kind === "EQUIVALENT").length,
      partial: crosswalk.filter((r) => r.kind === "PARTIAL").length,
      specific: crosswalk.filter((r) => r.kind === "SPECIFIC").length,
      missingEvidence: crosswalk.filter((r) => r.coverageCount === 0).length,
      sharedElements: multiNormEntities.length,
      criticalRisks: risks.filter((r) => r.score >= 15).length,
      openCapas: capas.filter((c) => c.stage !== "CLOSED").length,
      integratedAudits: integratedAudits.length,
    },
  };
}
