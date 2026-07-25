import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clauseIdFor, getStandardSpec, type StandardSpec } from "@/lib/standards-catalog";
import { getPackForFamily, installPack } from "@/lib/standard-packs";
import { ensureSecurityControlCatalog, ensureOrganizationControlSet } from "@/lib/security-control-catalog";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Siembra (idempotente) el catálogo de una norma (StandardFamily + StandardEdition
 * + StandardRequirement) instalando su paquete normativo y devuelve la EDICIÓN.
 * Solo añade lo que falte; nunca borra ni pisa datos de organizaciones.
 */
export async function ensureStandardCatalog(spec: StandardSpec, db: Db = prisma) {
  const pack = getPackForFamily(spec.code);
  if (pack) await installPack(pack, db);

  const edition = await db.standardEdition.findFirst({
    where: { family: { code: spec.code }, editionCode: spec.version },
  });
  if (!edition) throw new Error(`No se pudo preparar la edición ${spec.code}:${spec.version}.`);
  return edition;
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
  standardId: string; // StandardEdition.id
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

  if (args.standardCode === "ISO_27001") {
    await ensureSecurityControlCatalog(db);
    await ensureOrganizationControlSet(args.organizationId, db);
  }

  return { adoptionId: adoption.id, assessmentId: assessment.id, answersCreated: missing.length };
}
