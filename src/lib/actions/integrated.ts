"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, tenantData, tenantWhere } from "@/lib/permissions/server";
import { writeAuditLog } from "@/lib/audit-log";

const MODULE = "integrated";
const revalidate = () => {
  revalidatePath("/app/integrated");
  revalidatePath("/app/context");
  revalidatePath("/app/activity");
};

const disciplineEnum = z.enum(["QUALITY", "ENVIRONMENT", "SAFETY", "SECURITY"]);

/** Los responsables/procesos referenciados deben pertenecer a la organización. */
async function assertRefInOrg(organizationId: string, refs: { userId?: string | null; processId?: string | null }) {
  const checks: Promise<void>[] = [];
  if (refs.userId) {
    checks.push(
      prisma.membership.findFirst({ where: { userId: refs.userId, organizationId }, select: { id: true } })
        .then((m) => { if (!m) throw new Error("La persona indicada no pertenece a la organización."); }),
    );
  }
  if (refs.processId) {
    checks.push(
      prisma.process.findFirst({ where: { id: refs.processId, organizationId }, select: { id: true } })
        .then((p) => { if (!p) throw new Error("El proceso indicado no pertenece a la organización."); }),
    );
  }
  await Promise.all(checks);
}

async function nextCode(organizationId: string, prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

// ─── 1-3. ALCANCE Y POLÍTICA INTEGRADOS ──────────────

const systemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  scope: z.string().max(5000).nullable().optional(),
  scopeExclusions: z.string().max(5000).nullable().optional(),
  policy: z.string().max(20000).nullable().optional(),
  policyVersion: z.string().max(20).optional(),
  boundaries: z.string().max(5000).nullable().optional(),
  contextNotes: z.string().max(20000).nullable().optional(),
});

/** Crea o actualiza el alcance y la política integrados (uno por organización). */
export async function upsertIntegratedSystem(input: z.infer<typeof systemSchema>) {
  const ctx = await requirePermission("integrated:update");
  const data = systemSchema.parse(input);
  const organizationId = ctx.organization.id;

  const saved = await prisma.$transaction(async (tx) => {
    const system = await tx.integratedSystem.upsert({
      where: { organizationId },
      update: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.scope !== undefined ? { scope: data.scope } : {}),
        ...(data.scopeExclusions !== undefined ? { scopeExclusions: data.scopeExclusions } : {}),
        ...(data.policy !== undefined ? { policy: data.policy } : {}),
        ...(data.policyVersion !== undefined ? { policyVersion: data.policyVersion } : {}),
        ...(data.boundaries !== undefined ? { boundaries: data.boundaries } : {}),
        ...(data.contextNotes !== undefined ? { contextNotes: data.contextNotes } : {}),
      },
      create: tenantData(ctx, {
        name: data.name ?? "Sistema Integrado de Gestión",
        scope: data.scope ?? null,
        scopeExclusions: data.scopeExclusions ?? null,
        policy: data.policy ?? null,
        policyVersion: data.policyVersion ?? "1.0",
        boundaries: data.boundaries ?? null,
        contextNotes: data.contextNotes ?? null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: system.id,
      after: { policyVersion: system.policyVersion, hasScope: Boolean(system.scope), hasPolicy: Boolean(system.policy) },
      extra: { event: "upsert_integrated_system" },
    });
    return system;
  });

  revalidate();
  return { id: saved.id };
}

/** Aprueba la política integrada (deja constancia de quién y cuándo). */
export async function approveIntegratedPolicy(policyVersion?: string) {
  const ctx = await requirePermission("integrated:approve");
  const version = z.string().max(20).optional().parse(policyVersion);
  const existing = await prisma.integratedSystem.findUnique({ where: { organizationId: ctx.organization.id }, select: { id: true } });
  if (!existing) throw new Error("Define primero el alcance y la política del sistema integrado.");

  const saved = await prisma.$transaction(async (tx) => {
    const system = await tx.integratedSystem.update({
      where: { id: existing.id },
      data: { policyApprovedAt: new Date(), policyApprovedById: ctx.user.id, ...(version ? { policyVersion: version } : {}) },
    });
    await writeAuditLog(tx, {
      ctx, action: "approve", module: MODULE, recordId: system.id,
      after: { policyVersion: system.policyVersion }, extra: { event: "approve_integrated_policy" },
    });
    return system;
  });

  revalidate();
  return { id: saved.id, policyVersion: saved.policyVersion };
}

const systemStandardSchema = z.object({
  standardCode: z.string().min(1).max(40),
  discipline: disciplineEnum,
  scopeNote: z.string().max(2000).nullable().optional(),
  exclusions: z.string().max(2000).nullable().optional(),
  responsibleId: z.string().nullable().optional(),
});

/** Incluye una norma dentro del alcance del sistema integrado. */
export async function upsertSystemStandard(input: z.infer<typeof systemStandardSchema>) {
  const ctx = await requirePermission("integrated:update");
  const data = systemStandardSchema.parse(input);
  const organizationId = ctx.organization.id;
  await assertRefInOrg(organizationId, { userId: data.responsibleId });

  const saved = await prisma.$transaction(async (tx) => {
    const system = await tx.integratedSystem.upsert({
      where: { organizationId },
      update: {},
      create: tenantData(ctx, { createdById: ctx.user.id }),
    });

    const systemStandard = await tx.integratedSystemStandard.upsert({
      where: { integratedSystemId_standardCode: { integratedSystemId: system.id, standardCode: data.standardCode } },
      update: {
        discipline: data.discipline,
        scopeNote: data.scopeNote ?? null,
        exclusions: data.exclusions ?? null,
        responsibleId: data.responsibleId ?? null,
      },
      create: tenantData(ctx, {
        integratedSystemId: system.id, standardCode: data.standardCode, discipline: data.discipline,
        scopeNote: data.scopeNote ?? null, exclusions: data.exclusions ?? null, responsibleId: data.responsibleId ?? null,
      }),
    });

    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: systemStandard.id,
      after: { standardCode: data.standardCode, discipline: data.discipline },
      extra: { event: "upsert_system_standard" },
    });
    return systemStandard;
  });

  revalidate();
  return { id: saved.id };
}

// ─── 4. PARTES INTERESADAS COMUNES ───────────────────

const partySchema = z.object({
  code: z.string().max(40).optional(),
  name: z.string().min(1).max(200),
  type: z.string().max(80).nullable().optional(),
  needs: z.string().max(4000).nullable().optional(),
  requirements: z.string().max(4000).nullable().optional(),
  influence: z.number().int().min(1).max(5).optional(),
  dependency: z.number().int().min(1).max(5).optional(),
  isRelevant: z.boolean().optional(),
  communication: z.string().max(2000).nullable().optional(),
  disciplines: z.array(disciplineEnum).optional(),
  standards: z.array(z.string().max(40)).optional(),
  responsibleId: z.string().nullable().optional(),
});

/** Alta de una parte interesada común a todas las normas del sistema. */
export async function createInterestedParty(input: z.infer<typeof partySchema>) {
  const ctx = await requirePermission("integrated:create");
  const data = partySchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { userId: data.responsibleId });

  const code = data.code ?? await nextCode(
    ctx.organization.id, "PI",
    await prisma.interestedParty.count({ where: { organizationId: ctx.organization.id } }),
  );

  const created = await prisma.$transaction(async (tx) => {
    const party = await tx.interestedParty.create({
      data: tenantData(ctx, {
        code, name: data.name, type: data.type ?? null, needs: data.needs ?? null,
        requirements: data.requirements ?? null,
        influence: data.influence ?? 3, dependency: data.dependency ?? 3,
        isRelevant: data.isRelevant ?? true, communication: data.communication ?? null,
        disciplines: data.disciplines ?? [], standards: data.standards ?? [],
        responsibleId: data.responsibleId ?? null, createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, {
      ctx, action: "create", module: MODULE, recordId: party.id,
      after: { code, name: data.name, disciplines: party.disciplines },
      extra: { event: "create_interested_party" },
    });
    return party;
  });

  revalidate();
  return { id: created.id, code };
}

export async function updateInterestedParty(id: string, input: z.infer<typeof partySchema>) {
  const ctx = await requirePermission("integrated:update");
  const partyId = z.string().min(1).parse(id);
  const data = partySchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { userId: data.responsibleId });

  const existing = await prisma.interestedParty.findFirst({ where: tenantWhere(ctx, { id: partyId }), select: { id: true } });
  if (!existing) throw new Error("Parte interesada no encontrada.");

  const updated = await prisma.$transaction(async (tx) => {
    const party = await tx.interestedParty.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.needs !== undefined ? { needs: data.needs } : {}),
        ...(data.requirements !== undefined ? { requirements: data.requirements } : {}),
        ...(data.influence !== undefined ? { influence: data.influence } : {}),
        ...(data.dependency !== undefined ? { dependency: data.dependency } : {}),
        ...(data.isRelevant !== undefined ? { isRelevant: data.isRelevant } : {}),
        ...(data.communication !== undefined ? { communication: data.communication } : {}),
        ...(data.disciplines !== undefined ? { disciplines: data.disciplines } : {}),
        ...(data.standards !== undefined ? { standards: data.standards } : {}),
        ...(data.responsibleId !== undefined ? { responsibleId: data.responsibleId } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: party.id, after: { name: party.name }, extra: { event: "update_interested_party" } });
    return party;
  });

  revalidate();
  return { id: updated.id };
}

export async function deleteInterestedParty(id: string) {
  const ctx = await requirePermission("integrated:delete");
  const partyId = z.string().min(1).parse(id);
  const existing = await prisma.interestedParty.findFirst({ where: tenantWhere(ctx, { id: partyId }), select: { id: true, code: true } });
  if (!existing) throw new Error("Parte interesada no encontrada.");

  await prisma.$transaction(async (tx) => {
    await tx.interestedParty.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: existing.id, before: { code: existing.code }, extra: { event: "delete_interested_party" } });
  });

  revalidate();
  return { id: existing.id };
}

// ─── 6. OBJETIVOS POR DISCIPLINA Y COMPARTIDOS ───────

const objectiveSchema = z.object({
  code: z.string().max(40).optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).nullable().optional(),
  disciplines: z.array(disciplineEnum).optional(),
  standards: z.array(z.string().max(40)).optional(),
  target: z.string().max(500).nullable().optional(),
  baseline: z.string().max(500).nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "ACHIEVED", "NOT_ACHIEVED", "CANCELLED"]).optional(),
  ownerId: z.string().nullable().optional(),
  processId: z.string().nullable().optional(),
  indicatorId: z.string().nullable().optional(),
  resources: z.string().max(2000).nullable().optional(),
});

/**
 * Objetivo del sistema. Con varias disciplinas es un objetivo COMPARTIDO:
 * una sola meta cubre calidad, ambiente y/o SST sin duplicarla por norma.
 */
export async function createIntegratedObjective(input: z.infer<typeof objectiveSchema>) {
  const ctx = await requirePermission("integrated:create");
  const data = objectiveSchema.parse(input);
  await assertRefInOrg(ctx.organization.id, { userId: data.ownerId, processId: data.processId });

  const code = data.code ?? await nextCode(
    ctx.organization.id, "OBJ",
    await prisma.integratedObjective.count({ where: { organizationId: ctx.organization.id } }),
  );

  const created = await prisma.$transaction(async (tx) => {
    const objective = await tx.integratedObjective.create({
      data: tenantData(ctx, {
        code, title: data.title, description: data.description ?? null,
        disciplines: data.disciplines ?? [], standards: data.standards ?? [],
        target: data.target ?? null, baseline: data.baseline ?? null, unit: data.unit ?? null,
        targetValue: data.targetValue ?? null, currentValue: data.currentValue ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: data.status ?? "PLANNED",
        ownerId: data.ownerId ?? null, processId: data.processId ?? null,
        indicatorId: data.indicatorId ?? null, resources: data.resources ?? null,
        createdById: ctx.user.id,
      }),
    });
    await writeAuditLog(tx, {
      ctx, action: "create", module: MODULE, recordId: objective.id,
      after: { code, title: data.title, disciplines: objective.disciplines, shared: objective.disciplines.length > 1 },
      extra: { event: "create_integrated_objective" },
    });
    return objective;
  });

  revalidate();
  return { id: created.id, code };
}

export async function updateIntegratedObjective(id: string, input: z.infer<typeof objectiveSchema>) {
  const ctx = await requirePermission("integrated:update");
  const objectiveId = z.string().min(1).parse(id);
  const data = objectiveSchema.partial().parse(input);
  await assertRefInOrg(ctx.organization.id, { userId: data.ownerId, processId: data.processId });

  const existing = await prisma.integratedObjective.findFirst({ where: tenantWhere(ctx, { id: objectiveId }), select: { id: true } });
  if (!existing) throw new Error("Objetivo no encontrado.");

  const updated = await prisma.$transaction(async (tx) => {
    const objective = await tx.integratedObjective.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.disciplines !== undefined ? { disciplines: data.disciplines } : {}),
        ...(data.standards !== undefined ? { standards: data.standards } : {}),
        ...(data.target !== undefined ? { target: data.target } : {}),
        ...(data.baseline !== undefined ? { baseline: data.baseline } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.targetValue !== undefined ? { targetValue: data.targetValue } : {}),
        ...(data.currentValue !== undefined ? { currentValue: data.currentValue } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.processId !== undefined ? { processId: data.processId } : {}),
        ...(data.indicatorId !== undefined ? { indicatorId: data.indicatorId } : {}),
        ...(data.resources !== undefined ? { resources: data.resources } : {}),
      },
    });
    await writeAuditLog(tx, { ctx, action: "update", module: MODULE, recordId: objective.id, after: { status: objective.status }, extra: { event: "update_integrated_objective" } });
    return objective;
  });

  revalidate();
  return { id: updated.id };
}

export async function deleteIntegratedObjective(id: string) {
  const ctx = await requirePermission("integrated:delete");
  const objectiveId = z.string().min(1).parse(id);
  const existing = await prisma.integratedObjective.findFirst({ where: tenantWhere(ctx, { id: objectiveId }), select: { id: true, code: true } });
  if (!existing) throw new Error("Objetivo no encontrado.");

  await prisma.$transaction(async (tx) => {
    await tx.integratedObjective.delete({ where: { id: existing.id } });
    await writeAuditLog(tx, { ctx, action: "delete", module: MODULE, recordId: existing.id, before: { code: existing.code }, extra: { event: "delete_integrated_objective" } });
  });

  revalidate();
  return { id: existing.id };
}

// ─── CROSSWALK: RESPONSABLE POR REQUISITO ────────────

const assignmentSchema = z.object({
  requirementId: z.string().min(1),
  responsibleId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** Asigna responsable (y notas) a un requisito dentro de la matriz integrada. */
export async function assignRequirementOwner(input: z.infer<typeof assignmentSchema>) {
  const ctx = await requirePermission("integrated:update");
  const data = assignmentSchema.parse(input);
  const organizationId = ctx.organization.id;
  await assertRefInOrg(organizationId, { userId: data.responsibleId });

  // El requisito debe pertenecer a una norma activa de la organización.
  const requirement = await prisma.standardRequirement.findFirst({
    where: { id: data.requirementId, standard: { orgStandards: { some: { organizationId } } } },
    select: { id: true },
  });
  if (!requirement) throw new Error("El requisito no pertenece a una norma activa de la organización.");

  const saved = await prisma.$transaction(async (tx) => {
    const assignment = await tx.requirementAssignment.upsert({
      where: { organizationId_requirementId: { organizationId, requirementId: data.requirementId } },
      update: { responsibleId: data.responsibleId ?? null, notes: data.notes ?? null },
      create: tenantData(ctx, { requirementId: data.requirementId, responsibleId: data.responsibleId ?? null, notes: data.notes ?? null }),
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: assignment.id,
      after: { requirementId: data.requirementId, responsibleId: data.responsibleId ?? null },
      extra: { event: "assign_requirement_owner" },
    });
    return assignment;
  });

  revalidate();
  return { id: saved.id };
}

// ─── 8. AUDITORÍA INTEGRADA ──────────────────────────

const auditScopeSchema = z.object({
  auditId: z.string().min(1),
  standards: z.array(z.string().max(40)).min(1),
});

/**
 * Convierte una auditoría en integrada: una sola auditoría cubre varias normas
 * (un programa, un checklist, hallazgos y CAPA compartidos).
 */
export async function setAuditStandards(input: z.infer<typeof auditScopeSchema>) {
  const ctx = await requirePermission("integrated:update");
  const data = auditScopeSchema.parse(input);

  const existing = await prisma.audit.findFirst({ where: tenantWhere(ctx, { id: data.auditId }), select: { id: true, standards: true } });
  if (!existing) throw new Error("Auditoría no encontrada.");

  const updated = await prisma.$transaction(async (tx) => {
    const audit = await tx.audit.update({
      where: { id: existing.id },
      data: {
        standards: data.standards,
        integrated: data.standards.length > 1,
        ...(data.standards.length === 1 ? { standardCode: data.standards[0] } : {}),
      },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: audit.id,
      before: { standards: existing.standards }, after: { standards: audit.standards, integrated: audit.integrated },
      extra: { event: "set_audit_standards" },
    });
    return audit;
  });

  revalidate();
  revalidatePath("/app/audits");
  return { id: updated.id, integrated: updated.integrated };
}

const findingScopeSchema = z.object({
  findingId: z.string().min(1),
  standards: z.array(z.string().max(40)).min(1),
});

/** Un hallazgo puede afectar a varias normas sin duplicarse. */
export async function setFindingStandards(input: z.infer<typeof findingScopeSchema>) {
  const ctx = await requirePermission("integrated:update");
  const data = findingScopeSchema.parse(input);

  // AuditFinding no tiene organizationId: la tenencia se hereda de la auditoría.
  const existing = await prisma.auditFinding.findFirst({
    where: { id: data.findingId, audit: { organizationId: ctx.organization.id } },
    select: { id: true, standards: true },
  });
  if (!existing) throw new Error("Hallazgo no encontrado.");

  const updated = await prisma.$transaction(async (tx) => {
    const finding = await tx.auditFinding.update({ where: { id: existing.id }, data: { standards: data.standards } });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: finding.id,
      before: { standards: existing.standards }, after: { standards: finding.standards },
      extra: { event: "set_finding_standards" },
    });
    return finding;
  });

  revalidate();
  return { id: updated.id };
}

const capaScopeSchema = z.object({
  capaId: z.string().min(1),
  standards: z.array(z.string().max(40)).min(1),
});

/** 9. CAPA común: una sola acción correctiva cubre varias normas. */
export async function setCapaStandards(input: z.infer<typeof capaScopeSchema>) {
  const ctx = await requirePermission("integrated:update");
  const data = capaScopeSchema.parse(input);

  const existing = await prisma.cAPA.findFirst({ where: tenantWhere(ctx, { id: data.capaId }), select: { id: true, standards: true } });
  if (!existing) throw new Error("CAPA no encontrada.");

  const updated = await prisma.$transaction(async (tx) => {
    const capa = await tx.cAPA.update({
      where: { id: existing.id },
      data: { standards: data.standards, ...(data.standards.length === 1 ? { standardCode: data.standards[0] } : {}) },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: capa.id,
      before: { standards: existing.standards }, after: { standards: capa.standards },
      extra: { event: "set_capa_standards" },
    });
    return capa;
  });

  revalidate();
  return { id: updated.id };
}

// ─── 5. RIESGOS INTEGRADOS ───────────────────────────

const riskScopeSchema = z.object({
  riskId: z.string().min(1),
  disciplines: z.array(disciplineEnum).min(1),
  standards: z.array(z.string().max(40)).optional(),
});

/** Un riesgo puede pertenecer a varias disciplinas sin duplicarse. */
export async function setRiskDisciplines(input: z.infer<typeof riskScopeSchema>) {
  const ctx = await requirePermission("integrated:update");
  const data = riskScopeSchema.parse(input);

  const existing = await prisma.risk.findFirst({ where: tenantWhere(ctx, { id: data.riskId }), select: { id: true, disciplines: true } });
  if (!existing) throw new Error("Riesgo no encontrado.");

  const updated = await prisma.$transaction(async (tx) => {
    const risk = await tx.risk.update({
      where: { id: existing.id },
      data: { disciplines: data.disciplines, ...(data.standards ? { standards: data.standards } : {}) },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: risk.id,
      before: { disciplines: existing.disciplines }, after: { disciplines: risk.disciplines },
      extra: { event: "set_risk_disciplines" },
    });
    return risk;
  });

  revalidate();
  revalidatePath("/app/risks");
  return { id: updated.id };
}

// ─── 13. CAMBIOS CON IMPACTO MÚLTIPLE ────────────────

const changeScopeSchema = z.object({
  changeRequestId: z.string().min(1),
  disciplines: z.array(disciplineEnum).min(1),
  standards: z.array(z.string().max(40)).optional(),
});

export async function setChangeDisciplines(input: z.infer<typeof changeScopeSchema>) {
  const ctx = await requirePermission("integrated:update");
  const data = changeScopeSchema.parse(input);

  const existing = await prisma.changeRequest.findFirst({ where: tenantWhere(ctx, { id: data.changeRequestId }), select: { id: true, disciplines: true } });
  if (!existing) throw new Error("Solicitud de cambio no encontrada.");

  const updated = await prisma.$transaction(async (tx) => {
    const change = await tx.changeRequest.update({
      where: { id: existing.id },
      data: { disciplines: data.disciplines, ...(data.standards ? { standards: data.standards } : {}) },
    });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: change.id,
      before: { disciplines: existing.disciplines }, after: { disciplines: change.disciplines },
      extra: { event: "set_change_disciplines" },
    });
    return change;
  });

  revalidate();
  revalidatePath("/app/changes");
  return { id: updated.id };
}

// ─── 12. PROVEEDORES EVALUADOS EN CALIDAD/AMBIENTE/SST ──

const supplierEvalSchema = z.object({
  supplierId: z.string().min(1),
  qualityScore: z.number().int().min(0).max(100).nullable().optional(),
  environmentScore: z.number().int().min(0).max(100).nullable().optional(),
  safetyScore: z.number().int().min(0).max(100).nullable().optional(),
  outcome: z.enum(["APPROVED", "CONDITIONAL", "REJECTED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  nextReviewDue: z.string().nullable().optional(),
});

/**
 * Una sola evaluación de proveedor con las tres dimensiones del SIG.
 * `score` global = media de las dimensiones informadas (sin duplicar registros).
 */
export async function evaluateSupplierIntegrated(input: z.infer<typeof supplierEvalSchema>) {
  const ctx = await requirePermission("integrated:create");
  const data = supplierEvalSchema.parse(input);

  const supplier = await prisma.supplier.findFirst({ where: tenantWhere(ctx, { id: data.supplierId }), select: { id: true } });
  if (!supplier) throw new Error("El proveedor no pertenece a la organización.");

  const dims: { key: "QUALITY" | "ENVIRONMENT" | "SAFETY"; value: number | null | undefined }[] = [
    { key: "QUALITY", value: data.qualityScore },
    { key: "ENVIRONMENT", value: data.environmentScore },
    { key: "SAFETY", value: data.safetyScore },
  ];
  const present = dims.filter((d) => typeof d.value === "number");
  if (!present.length) throw new Error("Informa al menos una dimensión (calidad, ambiente o SST).");
  const score = Math.round(present.reduce((s, d) => s + (d.value as number), 0) / present.length);

  const created = await prisma.$transaction(async (tx) => {
    const evaluation = await tx.supplierEvaluation.create({
      data: {
        supplierId: supplier.id,
        score,
        qualityScore: data.qualityScore ?? null,
        environmentScore: data.environmentScore ?? null,
        safetyScore: data.safetyScore ?? null,
        disciplines: present.map((d) => d.key),
        outcome: data.outcome ?? (score >= 80 ? "APPROVED" : score >= 60 ? "CONDITIONAL" : "REJECTED"),
        notes: data.notes ?? null,
        evaluatedById: ctx.user.id,
        nextReviewDue: data.nextReviewDue ? new Date(data.nextReviewDue) : null,
      },
    });
    await tx.supplier.update({ where: { id: supplier.id }, data: { lastEvaluationAt: new Date() } });
    await writeAuditLog(tx, {
      ctx, action: "create", module: MODULE, recordId: evaluation.id,
      after: { supplierId: supplier.id, score, disciplines: evaluation.disciplines },
      extra: { event: "evaluate_supplier_integrated" },
    });
    return evaluation;
  });

  revalidate();
  revalidatePath("/app/suppliers");
  return { id: created.id, score };
}

// ─── 10. REVISIÓN POR LA DIRECCIÓN INTEGRADA ─────────

const reviewScopeSchema = z.object({
  reviewId: z.string().min(1),
  standards: z.array(z.string().max(40)).min(1),
});

/** Una sola revisión por la dirección que cubre todas las normas del SIG. */
export async function setReviewStandards(input: z.infer<typeof reviewScopeSchema>) {
  const ctx = await requirePermission("integrated:update");
  const data = reviewScopeSchema.parse(input);

  const existing = await prisma.managementReview.findFirst({ where: tenantWhere(ctx, { id: data.reviewId }), select: { id: true, standards: true } });
  if (!existing) throw new Error("Revisión por la dirección no encontrada.");

  const updated = await prisma.$transaction(async (tx) => {
    const review = await tx.managementReview.update({ where: { id: existing.id }, data: { standards: data.standards } });
    await writeAuditLog(tx, {
      ctx, action: "update", module: MODULE, recordId: review.id,
      before: { standards: existing.standards }, after: { standards: review.standards },
      extra: { event: "set_review_standards" },
    });
    return review;
  });

  revalidate();
  revalidatePath("/app/management-review");
  return { id: updated.id };
}
