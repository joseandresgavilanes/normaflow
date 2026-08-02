import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuthorization } from "@/lib/permissions/server";
import { availabilityPercent, slaMet } from "@/lib/itsm/workflows";

export type ItsmPayload = Awaited<ReturnType<typeof getItsmPayload>>;

export async function getItsmPayload() {
  const auth = await requireAuthorization("itsm:read");
  const organizationId = auth.ctx.organization.id;

  const [
    services, catalog, owners, slas, olas, requests, incidents, problems,
    knownErrors, changes, releases, deployments, cis, relationships,
    availability, capacity, continuity, suppliers, reports, articles, members, crossLinks,
  ] = await Promise.all([
    prisma.iTService.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.serviceCatalogEntry.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.serviceOwner.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.serviceLevelAgreement.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.operationalLevelAgreement.findMany({
      where: { organizationId },
      include: {
        service: { select: { code: true, name: true } },
        sla: { select: { code: true, name: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.serviceRequest.findMany({
      where: { organizationId },
      include: {
        service: { select: { code: true, name: true } },
        catalogEntry: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.iTSMIncident.findMany({
      where: { organizationId },
      include: {
        service: { select: { code: true, name: true } },
        sla: { select: { code: true, responseTimeMinutes: true, resolutionTimeMinutes: true } },
        configurationItem: { select: { code: true, name: true } },
      },
      orderBy: { detectedAt: "desc" },
      take: 200,
    }),
    prisma.problem.findMany({
      where: { organizationId },
      include: {
        service: { select: { code: true, name: true } },
        _count: { select: { incidents: true, knownErrors: true } },
      },
      orderBy: { identifiedAt: "desc" },
    }),
    prisma.knownError.findMany({
      where: { organizationId },
      include: {
        problem: { select: { code: true, title: true } },
        configurationItem: { select: { code: true, name: true } },
      },
      orderBy: { documentedAt: "desc" },
    }),
    prisma.iTSMChange.findMany({
      where: { organizationId },
      include: {
        service: { select: { code: true, name: true } },
        relatedIncident: { select: { code: true } },
        relatedProblem: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.release.findMany({
      where: { organizationId },
      include: {
        service: { select: { code: true, name: true } },
        _count: { select: { deployments: true } },
      },
      orderBy: { plannedAt: "desc" },
    }),
    prisma.deployment.findMany({
      where: { organizationId },
      include: {
        release: { select: { code: true, version: true } },
        configurationItem: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.configurationItem.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.cMDBRelationship.findMany({
      where: { organizationId },
      include: {
        sourceCi: { select: { code: true, name: true } },
        targetCi: { select: { code: true, name: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.availabilityPlan.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.capacityPlan.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.serviceContinuityPlan.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.serviceSupplier.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.serviceReport.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { generatedAt: "desc" },
      take: 50,
    }),
    prisma.knowledgeArticle.findMany({
      where: { organizationId },
      include: { service: { select: { code: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { memberships: { some: { organizationId } } },
      select: { id: true, name: true },
    }),
    prisma.incidentCrossLink.findMany({
      where: { organizationId },
      include: { itsmIncident: { select: { code: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const linkedIds = {
    SECURITY: crossLinks.filter((l) => l.targetDomain === "SECURITY").map((l) => l.targetId),
    AI: crossLinks.filter((l) => l.targetDomain === "AI").map((l) => l.targetId),
    OCCUPATIONAL: crossLinks.filter((l) => l.targetDomain === "OCCUPATIONAL").map((l) => l.targetId),
  };
  const [securityOptions, aiOptions, occupationalOptions] = await Promise.all([
    prisma.securityIncident.findMany({
      where: { organizationId },
      select: { id: true, code: true, description: true },
      orderBy: { detectedAt: "desc" },
      take: 50,
    }),
    prisma.aIIncident.findMany({
      where: { organizationId },
      select: { id: true, code: true, title: true },
      orderBy: { detectedAt: "desc" },
      take: 50,
    }),
    prisma.occupationalIncident.findMany({
      where: { organizationId },
      select: { id: true, code: true, title: true },
      orderBy: { occurredAt: "desc" },
      take: 50,
    }),
  ]);
  const securityTargets = securityOptions.filter((t) => linkedIds.SECURITY.includes(t.id));
  const aiTargets = aiOptions.filter((t) => linkedIds.AI.includes(t.id));
  const occupationalTargets = occupationalOptions.filter((t) => linkedIds.OCCUPATIONAL.includes(t.id));
  const targetLabel = (domain: string, targetId: string): string => {
    if (domain === "SECURITY") {
      const t = securityTargets.find((x) => x.id === targetId);
      return t ? `${t.code} — ${t.description.slice(0, 60)}` : targetId;
    }
    if (domain === "AI") {
      const t = aiTargets.find((x) => x.id === targetId);
      return t ? `${t.code} — ${t.title}` : targetId;
    }
    const t = occupationalTargets.find((x) => x.id === targetId);
    return t ? `${t.code} — ${t.title}` : targetId;
  };
  const crossLinksResolved = crossLinks.map((link) => ({ ...link, targetLabel: targetLabel(link.targetDomain, link.targetId) }));
  const crossLinkOptions = {
    SECURITY: securityOptions.map((t) => ({ id: t.id, label: `${t.code} — ${t.description.slice(0, 60)}` })),
    AI: aiOptions.map((t) => ({ id: t.id, label: `${t.code} — ${t.title}` })),
    OCCUPATIONAL: occupationalOptions.map((t) => ({ id: t.id, label: `${t.code} — ${t.title}` })),
  };

  const openIncidents = incidents.filter((i) => i.status !== "CLOSED").length;
  const openProblems = problems.filter((p) => p.status !== "CLOSED").length;
  const openChanges = changes.filter((c) => c.status !== "CLOSED").length;

  const incidentSla = incidents.map((inc) => {
    if (!inc.sla) return { id: inc.id, ...slaMet({ responseDueMinutes: 0, resolutionDueMinutes: 0 }) };
    const responseActual =
      inc.assignedAt ? Math.round((inc.assignedAt.getTime() - inc.detectedAt.getTime()) / 60000) : null;
    const resolutionActual =
      inc.resolvedAt ? Math.round((inc.resolvedAt.getTime() - inc.detectedAt.getTime()) / 60000) : null;
    return {
      id: inc.id,
      ...slaMet({
        responseDueMinutes: inc.sla.responseTimeMinutes,
        resolutionDueMinutes: inc.sla.resolutionTimeMinutes,
        responseActualMinutes: responseActual,
        resolutionActualMinutes: resolutionActual,
      }),
    };
  });
  const slaBreaches = incidentSla.filter((s) => s.overallMet === false).length;

  const availabilityRows = availability.map((plan) => {
    let computed: number | null = plan.actualAvailabilityPct;
    if (
      computed == null &&
      plan.periodStart &&
      plan.periodEnd &&
      typeof plan.agreedDowntimeMinutes === "number"
    ) {
      const periodMinutes = Math.max(1, Math.round((plan.periodEnd.getTime() - plan.periodStart.getTime()) / 60000));
      try {
        computed = availabilityPercent(periodMinutes, plan.agreedDowntimeMinutes);
      } catch {
        computed = null;
      }
    }
    return { ...plan, computedAvailability: computed };
  });

  return {
    can: {
      create: auth.can("itsm:create"),
      update: auth.can("itsm:update"),
      approve: auth.can("itsm:approve") || auth.can("itsm:update"),
      export: auth.can("itsm:export"),
    },
    members,
    services,
    catalog,
    owners,
    slas,
    olas,
    requests,
    incidents: incidents.map((inc) => ({
      ...inc,
      slaEval: incidentSla.find((s) => s.id === inc.id),
    })),
    crossLinks: crossLinksResolved,
    crossLinkOptions,
    problems,
    knownErrors,
    changes,
    releases,
    deployments,
    cis,
    relationships,
    availability: availabilityRows,
    capacity,
    continuity,
    suppliers,
    reports,
    articles,
    summary: {
      services: services.filter((s) => s.status === "ACTIVE").length,
      catalogEntries: catalog.filter((c) => c.active).length,
      activeSlas: slas.filter((s) => s.status === "ACTIVE").length,
      openRequests: requests.filter((r) => r.status !== "CLOSED" && r.status !== "FULFILLED" && r.status !== "CANCELLED").length,
      openIncidents,
      openProblems,
      openChanges,
      slaBreaches,
      cis: cis.filter((c) => c.status === "IN_USE").length,
      publishedArticles: articles.filter((a) => a.status === "PUBLISHED").length,
      releasesOpen: releases.filter((r) => r.status !== "RELEASED" && r.status !== "ROLLED_BACK").length,
    },
  };
}
