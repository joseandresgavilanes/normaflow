import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clauseIdFor, getStandardSpec, type StandardSpec } from "@/lib/standards-catalog";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Siembra (idempotente) el catálogo global Standard + Clause de una norma.
 * Solo añade lo que falte; nunca borra ni pisa datos de organizaciones.
 */
export async function ensureStandardCatalog(spec: StandardSpec, db: Db = prisma) {
  const standard = await db.standard.upsert({
    where: { code: spec.code },
    update: { name: spec.name, version: spec.version, description: spec.description, isActive: true },
    create: { code: spec.code, name: spec.name, version: spec.version, description: spec.description, isActive: true },
  });

  const chapters = spec.clauses.filter((c) => !c.parent);
  const children = spec.clauses.filter((c) => c.parent);
  for (const [index, clause] of chapters.entries()) {
    await db.clause.upsert({
      where: { id: clauseIdFor(spec.code, clause.code) },
      update: { title: clause.title },
      create: {
        id: clauseIdFor(spec.code, clause.code),
        standardId: standard.id,
        code: clause.code,
        title: clause.title,
        description: clause.description ?? null,
        order: index + 1,
      },
    });
  }
  for (const [index, clause] of children.entries()) {
    await db.clause.upsert({
      where: { id: clauseIdFor(spec.code, clause.code) },
      update: { title: clause.title },
      create: {
        id: clauseIdFor(spec.code, clause.code),
        standardId: standard.id,
        code: clause.code,
        title: clause.title,
        description: clause.description ?? null,
        parentId: clauseIdFor(spec.code, clause.parent!),
        order: chapters.length + index + 1,
      },
    });
  }
  return standard;
}

/** Cláusulas evaluables de una norma: las hojas del catálogo. */
export function leafClauseIds(spec: StandardSpec): string[] {
  const parentCodes = new Set(spec.clauses.map((c) => c.parent).filter(Boolean));
  return spec.clauses
    .filter((c) => !parentCodes.has(c.code))
    .map((c) => clauseIdFor(spec.code, c.code));
}

/**
 * Adopta una norma para una organización: crea el vínculo OrganizationStandard
 * y la evaluación GAP inicial con una respuesta NOT_EVALUATED por cláusula hoja.
 * Idempotente: re-ejecutarla solo rellena lo que falte.
 */
export async function adoptStandardForOrganization(args: {
  db?: Db;
  organizationId: string;
  standardCode: StandardSpec["code"];
  standardId: string;
  assessorId?: string | null;
}) {
  const db = args.db ?? prisma;
  const spec = getStandardSpec(args.standardCode);
  if (!spec) throw new Error("Norma no soportada.");

  const adoption = await db.organizationStandard.upsert({
    where: {
      organizationId_standardId: {
        organizationId: args.organizationId,
        standardId: args.standardId,
      },
    },
    update: {},
    create: { organizationId: args.organizationId, standardId: args.standardId },
  });

  let assessment = await db.assessment.findFirst({
    where: {
      organizationId: args.organizationId,
      standardId: args.standardId,
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
    },
    include: { answers: { select: { clauseId: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (!assessment) {
    const created = await db.assessment.create({
      data: {
        organizationId: args.organizationId,
        standardId: args.standardId,
        title: `Evaluación inicial ${spec.name}:${spec.version}`,
        type: "INTERNAL",
        status: "IN_PROGRESS",
        assessorId: args.assessorId ?? null,
      },
    });
    assessment = { ...created, answers: [] };
  }

  const existing = new Set(assessment.answers.map((a) => a.clauseId));
  const missing = leafClauseIds(spec).filter((id) => !existing.has(id));
  if (missing.length) {
    await db.assessmentAnswer.createMany({
      data: missing.map((clauseId) => ({
        assessmentId: assessment!.id,
        clauseId,
        score: 0,
        status: "NOT_EVALUATED" as const,
      })),
      skipDuplicates: true,
    });
  }

  return { adoptionId: adoption.id, assessmentId: assessment.id, answersCreated: missing.length };
}
