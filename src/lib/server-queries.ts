import { prisma } from "@/lib/prisma";

export async function getDashboardPayload(organizationId: string) {
  const now = new Date();

  const [
    orgStandards,
    actions,
    risks,
    documentsInReview,
    auditsUpcoming,
    openNcs,
    indicators,
    recentAudits,
  ] = await Promise.all([
    prisma.organizationStandard.findMany({
      where: { organizationId },
      include: { standard: true },
    }),
    prisma.action.findMany({ where: { organizationId } }),
    prisma.risk.findMany({ where: { organizationId } }),
    prisma.document.count({
      where: { organizationId, status: "IN_REVIEW" },
    }),
    prisma.audit.count({
      where: {
        organizationId,
        status: "PLANNED",
      },
    }),
    prisma.nonconformity.count({
      where: { organizationId, status: { not: "CLOSED" } },
    }),
    prisma.indicator.findMany({
      where: { organizationId },
      include: { values: { orderBy: { createdAt: "desc" }, take: 6 } },
    }),
    prisma.audit.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
  ]);

  const scores = orgStandards.map(o => o.score).filter((s): s is number => s != null);
  const iso9001 = orgStandards.find(o => o.standard.code === "ISO_9001");
  const iso27001 = orgStandards.find(o => o.standard.code === "ISO_27001");
  const globalPct =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 78;

  const overdueCritical = actions.filter(
    a =>
      a.status !== "COMPLETED" &&
      a.priority === "CRITICAL" &&
      a.dueDate &&
      a.dueDate < now
  ).length;

  const pendingActions = actions.filter(a => a.status !== "COMPLETED" && a.status !== "CANCELLED").length;

  const criticalRisks = risks.filter(r => r.score >= 15).length;

  const indicatorRows = indicators.map(ind => {
    const latest = ind.values[0];
    const value = latest?.value ?? 0;
    return {
      id: ind.id,
      name: ind.name,
      value,
      target: ind.target,
      unit: ind.unit,
      status: ind.status,
    };
  });

  return {
    organizationId,
    globalPct,
    iso9001Pct: iso9001?.score != null ? Math.round(iso9001.score) : 82,
    iso27001Pct: iso27001?.score != null ? Math.round(iso27001.score) : 74,
    overdueCritical,
    pendingActions,
    criticalRisks,
    documentsInReview,
    auditsUpcoming,
    openNcs,
    indicatorRows,
    recentAudits: recentAudits.map(a => ({
      id: a.id,
      title: a.title,
      status: a.status,
      scheduledDate: a.scheduledDate?.toISOString() ?? null,
    })),
  };
}

export async function getGapPayload(organizationId: string) {
  const assessments = await prisma.assessment.findMany({
    where: { organizationId, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    include: {
      standard: true,
      answers: { include: { clause: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 4,
  });

  const byStandard = (code: string) =>
    assessments.find(a => a.standard.code === code) ?? null;

  function buildRows(assessment: (typeof assessments)[0] | null) {
    if (!assessment || assessment.answers.length === 0) return null;
    const byClause = new Map<string, { scores: number[]; statuses: string[]; title: string }>();
    for (const ans of assessment.answers) {
      const code = ans.clause.code;
      const cur = byClause.get(code) ?? { scores: [], statuses: [], title: ans.clause.title };
      cur.scores.push(ans.score);
      cur.statuses.push(ans.status);
      byClause.set(code, cur);
    }
    return Array.from(byClause.entries())
      .map(([clause, v]) => {
        const score = Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length);
        let status: "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT" = "PARTIALLY_COMPLIANT";
        if (v.statuses.every(s => s === "COMPLIANT")) status = "COMPLIANT";
        else if (v.statuses.some(s => s === "NON_COMPLIANT")) status = "NON_COMPLIANT";
        return {
          clause,
          title: v.title,
          score,
          questions: v.scores.length,
          answered: v.scores.length,
          status,
        };
      })
      .sort((a, b) => a.clause.localeCompare(b.clause, undefined, { numeric: true }));
  }

  return {
    iso9001: buildRows(byStandard("ISO_9001")),
    iso27001: buildRows(byStandard("ISO_27001")),
  };
}

export type DashboardPayload = Awaited<ReturnType<typeof getDashboardPayload>>;
export type GapPayload = Awaited<ReturnType<typeof getGapPayload>>;

// ─── Documents ─────────────────────────────────────────────────────────

export async function getDocumentsPayload(organizationId: string) {
  const [documents, locations, personnel, members] = await Promise.all([
    prisma.document.findMany({
      where: { organizationId },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: { orderBy: { createdAt: "asc" } },
        location: true,
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.location.findMany({
      where: { organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.personnel.findMany({
      where: { organizationId, active: true },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: true },
    }),
  ]);

  return {
    documents: documents.map((d) => ({
      id: d.id,
      code: d.code,
      title: d.title,
      type: d.type,
      status: d.status,
      currentVersion: d.currentVersion,
      isExternal: d.isExternal,
      externalLink: d.externalLink,
      ownerId: d.ownerId,
      processId: d.processId,
      standardCode: d.standardCode,
      observations: d.observations,
      distributionList: d.distributionList,
      locationId: d.locationId,
      locationName: d.location?.name ?? null,
      physicalLocation: d.physicalLocation,
      responsibleElaborationId: d.responsibleElaborationId,
      responsibleApprovalId: d.responsibleApprovalId,
      custodianId: d.custodianId,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      versions: d.versions.map((v) => ({
        id: v.id,
        version: v.version,
        previousVersion: v.previousVersion,
        changeDescription: v.changeDescription ?? v.changeLog,
        fileUrl: v.fileUrl,
        fileSize: v.fileSize,
        mimeType: v.mimeType,
        createdAt: v.createdAt.toISOString(),
        createdById: v.createdById,
      })),
      approvals: d.approvals.map((a) => ({
        id: a.id,
        approverId: a.approverId,
        status: a.status,
        comment: a.comment,
        decidedAt: a.decidedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    })),
    locations,
    personnel,
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  };
}

export type DocumentsPayload = Awaited<ReturnType<typeof getDocumentsPayload>>;
export type DocumentRowLive = DocumentsPayload["documents"][number];

// ─── Admin / Info / Catalogs / Records / ACPM — full payload ─────────

export async function getAdminPayload(organizationId: string, currentUserId: string) {
  const [
    org,
    memberships,
    groups,
    positions,
    personnel,
    locations,
    retentionTimes,
    dispositions,
    archiveMethods,
    recordTypes,
    records,
    recordEntries,
    actions,
    actionComments,
  ] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.group.findMany({
      where: { organizationId },
      include: {
        permissions: { select: { permission: true } },
        members: { select: { userId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.personnel.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { lastName: "asc" }] }),
    prisma.location.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.retentionTime.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { months: "asc" }] }),
    prisma.disposition.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.archiveMethod.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.recordType.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.record.findMany({ where: { organizationId }, orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    prisma.recordEntry.findMany({
      where: { record: { organizationId } },
      orderBy: { enteredAt: "desc" },
    }),
    prisma.action.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.actionComment.findMany({
      where: { action: { organizationId } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const lastEntryAtByRecord = new Map<string, string>();
  recordEntries.forEach((e) => {
    const cur = lastEntryAtByRecord.get(e.recordId);
    const iso = e.enteredAt.toISOString();
    if (!cur || cur < iso) lastEntryAtByRecord.set(e.recordId, iso);
  });

  function deriveCode(idx: number, year: number): string {
    return `ACPM-${year}-${String(idx).padStart(3, "0")}`;
  }
  // ACPMs ya tienen `code` embebido en title ("ACPM-2026-001 · ..."): lo extraemos
  function parseACPM(title: string): { code: string; title: string } {
    const m = /^(ACPM-\d{4}-\d{3})\s*·\s*(.+)$/.exec(title);
    if (m) return { code: m[1], title: m[2] };
    return { code: "", title };
  }

  return {
    organization: {
      name: org.name,
      industry: org.industry,
      country: org.country,
      logoUrl: org.logoUrl,
      plan: org.plan as "STARTER" | "GROWTH" | "ENTERPRISE",
    },
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      isSelf: m.userId === currentUserId,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      permissions: g.permissions.map((p) => p.permission),
      memberIds: g.members.map((m) => m.userId),
      createdAt: g.createdAt.toISOString(),
    })),
    positions: positions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      active: p.active,
      createdAt: p.createdAt.toISOString(),
    })),
    personnel: personnel.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      identification: p.identification,
      positionId: p.positionId,
      active: p.active,
      hiredAt: p.hiredAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      active: l.active,
      createdAt: l.createdAt.toISOString(),
    })),
    retentionTimes: retentionTimes.map((r) => ({
      id: r.id,
      name: r.name,
      months: r.months,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
    })),
    dispositions: dispositions.map((d) => ({
      id: d.id,
      name: d.name,
      active: d.active,
      createdAt: d.createdAt.toISOString(),
    })),
    archiveMethods: archiveMethods.map((a) => ({
      id: a.id,
      name: a.name,
      active: a.active,
      createdAt: a.createdAt.toISOString(),
    })),
    recordTypes: recordTypes.map((t) => ({
      id: t.id,
      name: t.name,
      active: t.active,
      createdAt: t.createdAt.toISOString(),
    })),
    records: records.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      processName: null,
      recordTypeId: r.recordTypeId,
      retentionTimeId: r.retentionTimeId,
      dispositionId: r.dispositionId,
      archiveMethodId: r.archiveMethodId,
      custodianId: r.custodianId,
      physicalLocation: r.physicalLocation,
      digitalLocation: r.digitalLocation,
      observations: r.observations,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
      lastEntryAt: lastEntryAtByRecord.get(r.id) ?? null,
    })),
    recordEntries: recordEntries.map((e) => ({
      id: e.id,
      recordId: e.recordId,
      reference: e.reference ?? "",
      description: e.description,
      fileName: e.fileUrl, // ver actions/records.ts: guardamos fileName en fileUrl
      enteredById: e.enteredById,
      enteredAt: e.enteredAt.toISOString(),
    })),
    acpms: actions.map((a, idx) => {
      const parsed = parseACPM(a.title);
      const code = parsed.code || deriveCode(idx + 1, new Date(a.createdAt).getFullYear());
      return {
        id: a.id,
        code,
        title: parsed.title,
        description: a.description,
        type: a.type,
        priority: a.priority,
        stage: a.stage,
        source: a.source,
        rootCause: a.rootCause,
        proposedSolution: a.proposedSolution,
        effectivenessCheck: a.effectivenessCheck,
        effectivenessAt: a.effectivenessAt?.toISOString() ?? null,
        requestedById: a.requestedById,
        requestApproverId: a.requestApproverId,
        solutionApproverId: a.solutionApproverId,
        ownerId: a.ownerId,
        dueDate: a.dueDate?.toISOString() ?? null,
        progress: a.progress,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      };
    }),
    acpmHistory: actionComments.map((c) => ({
      id: c.id,
      acpmId: c.actionId,
      kind: "comment" as const,
      fromStage: null,
      toStage: null,
      message: c.content,
      actorId: c.authorId,
      at: c.createdAt.toISOString(),
    })),
  };
}

export type AdminPayload = Awaited<ReturnType<typeof getAdminPayload>>;

// ─── Activity / Audit log ─────────────────────────────────────────────

export async function getActivityPayload(organizationId: string, limit = 500) {
  const [logs, memberships] = await Promise.all([
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: true },
    }),
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: true },
    }),
  ]);

  const userById = new Map(memberships.map((m) => [m.userId, { name: m.user.name, email: m.user.email }]));

  return {
    auditTrail: logs.map((l) => {
      const meta = (l.metadata ?? {}) as Record<string, unknown>;
      const before = meta.before as Record<string, unknown> | undefined;
      const after = meta.after as Record<string, unknown> | undefined;
      const summaryParts: string[] = [];
      if (typeof meta.message === "string") summaryParts.push(meta.message);
      if (typeof meta.reason === "string") summaryParts.push(`Motivo: ${meta.reason}`);
      const summary = summaryParts.join(" · ") || `${l.action} en ${l.module}`;

      const actor = l.userId ? userById.get(l.userId) : null;

      return {
        id: l.id,
        at: l.createdAt.toISOString(),
        action: l.action,
        module: l.module,
        recordId: l.recordId,
        recordLabel: (typeof meta.recordLabel === "string" ? meta.recordLabel : null) ?? l.recordId,
        actorId: l.userId,
        actorName: actor?.name ?? null,
        summary,
        before,
        after,
      };
    }),
  };
}

export type ActivityPayload = Awaited<ReturnType<typeof getActivityPayload>>;
