import "server-only";
import { prisma } from "@/lib/prisma";
import { getServerAuthorization } from "@/lib/permissions/server";
import { STANDARD_PACKS } from "@/lib/standard-packs";

export type EngineRequirement = {
  id: string;
  code: string;
  title: string;
  level: number;
  mandatory: boolean;
  gapStatus: string | null;
  gapScore: number | null;
  coverageCount: number;
};

export type EngineMatrixEdition = {
  editionId: string;
  familyCode: string;
  label: string;
  requirements: EngineRequirement[];
};

export type StandardsEnginePayload = {
  canActivate: boolean;
  canInstall: boolean;
  families: {
    code: string;
    name: string;
    category: string | null;
    editions: {
      id: string;
      editionCode: string;
      version: string;
      status: string;
      requirementCount: number;
      active: boolean;
      score: number | null;
      implementationStatus: string | null;
    }[];
  }[];
  active: {
    orgStandardId: string;
    editionId: string;
    familyCode: string;
    name: string;
    editionCode: string;
    score: number | null;
    implementationStatus: string;
    scope: string | null;
    responsibleName: string | null;
    nextAuditDate: string | null;
    certified: boolean;
    requirementCount: number;
    coveredRequirements: number;
  }[];
  matrix: EngineMatrixEdition[];
  correspondence: {
    id: string;
    sourceFamily: string;
    sourceCode: string;
    sourceTitle: string;
    targetFamily: string;
    targetCode: string;
    targetTitle: string;
    relationType: string;
    equivalencePercent: number | null;
  }[];
  availablePacks: { code: string; name: string; version: string; editions: { familyCode: string; editionCode: string }[] }[];
  members: { id: string; name: string }[];
};

/** Everything the Standards Engine workspace needs for the current organization. */
export async function getStandardsEnginePayload(): Promise<StandardsEnginePayload> {
  const auth = await getServerAuthorization();
  const orgId = auth.ctx.organization.id;
  const canActivate = auth.can("standards:activate");
  const canInstall = auth.can("packs:install");

  const [families, orgStandards, mappings, members] = await Promise.all([
    prisma.standardFamily.findMany({
      orderBy: { code: "asc" },
      include: {
        editions: {
          orderBy: { editionCode: "desc" },
          include: {
            _count: { select: { requirements: true } },
            orgStandards: { where: { organizationId: orgId }, select: { score: true, implementationStatus: true } },
          },
        },
      },
    }),
    prisma.organizationStandard.findMany({
      where: { organizationId: orgId },
      include: {
        standard: { include: { family: true, _count: { select: { requirements: true } } } },
        responsible: { select: { name: true } },
      },
      orderBy: { startedAt: "asc" },
    }),
    prisma.requirementMapping.findMany({
      include: {
        source: { select: { code: true, title: true, standard: { select: { family: { select: { code: true } } } } } },
        target: { select: { code: true, title: true, standard: { select: { family: { select: { code: true } } } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.membership.findMany({
      where: { organizationId: orgId, active: true },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const activeEditionIds = orgStandards.map((o) => o.standardId);

  // Coverage counts per requirement (this org) + latest GAP answers per active edition.
  const [coverageGroups, assessments] = await Promise.all([
    prisma.requirementCoverage.groupBy({
      by: ["requirementId"],
      where: { organizationId: orgId },
      _count: { _all: true },
    }),
    prisma.assessment.findMany({
      where: { organizationId: orgId, standardId: { in: activeEditionIds }, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
      orderBy: { updatedAt: "desc" },
      include: { answers: { select: { clauseId: true, status: true, score: true } } },
    }),
  ]);

  const coverageByReq = new Map(coverageGroups.map((g) => [g.requirementId, g._count._all]));
  // First (latest) assessment wins per edition.
  const answersByEdition = new Map<string, Map<string, { status: string; score: number }>>();
  for (const a of assessments) {
    if (!answersByEdition.has(a.standardId)) {
      answersByEdition.set(a.standardId, new Map(a.answers.map((an) => [an.clauseId, { status: an.status, score: an.score }])));
    }
  }

  const requirements = activeEditionIds.length
    ? await prisma.standardRequirement.findMany({
        where: { standardId: { in: activeEditionIds }, active: true },
        orderBy: [{ standardId: "asc" }, { order: "asc" }, { code: "asc" }],
        select: { id: true, code: true, title: true, level: true, mandatory: true, standardId: true },
      })
    : [];

  const editionLabel = new Map(orgStandards.map((o) => [o.standardId, `${o.standard.family.code} ${o.standard.editionCode}`]));
  const editionFamily = new Map(orgStandards.map((o) => [o.standardId, o.standard.family.code]));
  const matrixMap = new Map<string, EngineMatrixEdition>();
  for (const r of requirements) {
    if (!matrixMap.has(r.standardId)) {
      matrixMap.set(r.standardId, {
        editionId: r.standardId,
        familyCode: editionFamily.get(r.standardId) ?? "",
        label: editionLabel.get(r.standardId) ?? "",
        requirements: [],
      });
    }
    const ans = answersByEdition.get(r.standardId)?.get(r.id);
    matrixMap.get(r.standardId)!.requirements.push({
      id: r.id, code: r.code, title: r.title, level: r.level, mandatory: r.mandatory,
      gapStatus: ans?.status ?? null, gapScore: ans?.score ?? null,
      coverageCount: coverageByReq.get(r.id) ?? 0,
    });
  }

  const coveredByEdition = new Map<string, number>();
  for (const [editionId, edition] of matrixMap) {
    coveredByEdition.set(editionId, edition.requirements.filter((r) => r.coverageCount > 0).length);
  }

  return {
    canActivate,
    canInstall,
    families: families.map((f) => ({
      code: f.code, name: f.name, category: f.category,
      editions: f.editions.map((e) => ({
        id: e.id, editionCode: e.editionCode, version: e.version, status: e.status,
        requirementCount: e._count.requirements,
        active: e.orgStandards.length > 0,
        score: e.orgStandards[0]?.score ?? null,
        implementationStatus: e.orgStandards[0]?.implementationStatus ?? null,
      })),
    })),
    active: orgStandards.map((o) => ({
      orgStandardId: o.id, editionId: o.standardId, familyCode: o.standard.family.code,
      name: o.standard.name, editionCode: o.standard.editionCode, score: o.score,
      implementationStatus: o.implementationStatus, scope: o.scope,
      responsibleName: o.responsible?.name ?? null,
      nextAuditDate: o.nextAuditDate?.toISOString() ?? null, certified: o.certified,
      requirementCount: o.standard._count.requirements,
      coveredRequirements: coveredByEdition.get(o.standardId) ?? 0,
    })),
    matrix: [...matrixMap.values()],
    correspondence: mappings.map((m) => ({
      id: m.id,
      sourceFamily: m.source.standard.family.code, sourceCode: m.source.code, sourceTitle: m.source.title,
      targetFamily: m.target.standard.family.code, targetCode: m.target.code, targetTitle: m.target.title,
      relationType: m.relationType, equivalencePercent: m.equivalencePercent,
    })),
    availablePacks: STANDARD_PACKS.map((p) => ({
      code: p.code, name: p.name, version: p.version,
      editions: p.editions.map((e) => ({ familyCode: e.familyCode, editionCode: e.editionCode })),
    })),
    members: members.map((m) => ({ id: m.user.id, name: m.user.name })),
  };
}
