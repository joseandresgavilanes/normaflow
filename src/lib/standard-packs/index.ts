import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parsePackManifest,
  requirementIdFor,
  type StandardPackInput,
} from "./pack-schema";
import { SIG_CROSSWALK } from "./sig-crosswalk";
import { iso9001Pack } from "./iso-9001-2015.pack";
import { iso27001Pack } from "./iso-27001-2022.pack";
import { iso14001Pack } from "./iso-14001-2015.pack";
import { iso45001Pack } from "./iso-45001-2018.pack";
import { iso42001Pack } from "./iso-42001-2023.pack";
import { iso37301Pack } from "./iso-37301-2021.pack";
import { iso37001Pack } from "./iso-37001-2016.pack";
import { iso50001Pack } from "./iso-50001-2018.pack";
import { iso22000Pack } from "./iso-22000-2018.pack";
import { iso20000Pack } from "./iso-20000-2018.pack";
import { iso13485Pack } from "./iso-13485-2016.pack";

export * from "./pack-schema";
export { SIG_CROSSWALK } from "./sig-crosswalk";

type Db = PrismaClient | Prisma.TransactionClient;

/** Built-in packs shipped with NormaFlow. New norms drop a manifest in here.
 * Order matters for cross-standard mappings: a pack's mappings only install
 * when both endpoints already exist, so packs that map to ISO 9001 come after it. */
export const STANDARD_PACKS: StandardPackInput[] = [
  iso9001Pack, iso27001Pack, iso14001Pack, iso45001Pack, iso42001Pack, iso37301Pack, iso37001Pack, iso50001Pack, iso22000Pack, iso20000Pack, iso13485Pack,
];

export function getPack(code: string): StandardPackInput | null {
  return STANDARD_PACKS.find((p) => p.code === code) ?? null;
}

/** Pack whose edition matches a family code — used by adoption helpers. */
export function getPackForFamily(familyCode: string): StandardPackInput | null {
  return STANDARD_PACKS.find((p) => p.editions.some((e) => e.familyCode === familyCode)) ?? null;
}

export type InstallPackResult = {
  packCode: string;
  editions: number;
  requirements: number;
  evidenceRules: number;
  gapQuestions: number;
  auditChecklist: number;
  templates: number;
  mappings: number;
};

const levelFromCode = (code: string) => code.split(".").length;

/**
 * Install (or update) a pack — idempotent. Upserts the pack, its families,
 * editions and requirements by deterministic keys so existing production rows
 * (and their `cl-…` ids) are preserved. Catalog-only artifacts (evidence rules,
 * GAP questions, audit checklist, templates) are replaced per edition; ORG data
 * (assessments, coverage, OrganizationStandard) is never touched.
 */
export async function installPack(input: unknown, db: Db = prisma): Promise<InstallPackResult> {
  const manifest = parsePackManifest(input);
  const result: InstallPackResult = {
    packCode: manifest.code,
    editions: 0, requirements: 0, evidenceRules: 0, gapQuestions: 0, auditChecklist: 0, templates: 0, mappings: 0,
  };

  const pack = await db.standardPack.upsert({
    where: { code: manifest.code },
    update: {
      name: manifest.name, version: manifest.version, description: manifest.description ?? null,
      requiredModules: manifest.requiredModules, featureFlags: manifest.featureFlags,
    },
    create: {
      code: manifest.code, name: manifest.name, version: manifest.version, description: manifest.description ?? null,
      requiredModules: manifest.requiredModules, featureFlags: manifest.featureFlags,
    },
  });

  for (const ed of manifest.editions) {
    const family = await db.standardFamily.upsert({
      where: { code: ed.familyCode },
      update: { name: ed.familyName, category: ed.category ?? null, description: ed.familyDescription ?? null },
      create: {
        id: `fam-${ed.familyCode}`, code: ed.familyCode, name: ed.familyName,
        category: ed.category ?? null, description: ed.familyDescription ?? null,
      },
    });

    const edition = await db.standardEdition.upsert({
      where: { familyId_editionCode: { familyId: family.id, editionCode: ed.editionCode } },
      update: {
        code: ed.familyCode, name: ed.name, version: ed.version,
        year: ed.year ?? null, description: ed.description ?? null, catalogVersion: ed.catalogVersion ?? null,
        status: ed.status ?? "ACTIVE", publishedAt: ed.publishedAt ? new Date(ed.publishedAt) : null,
      },
      create: {
        familyId: family.id, code: ed.familyCode, editionCode: ed.editionCode, name: ed.name, version: ed.version,
        year: ed.year ?? null, description: ed.description ?? null, catalogVersion: ed.catalogVersion ?? null,
        status: ed.status ?? "ACTIVE", publishedAt: ed.publishedAt ? new Date(ed.publishedAt) : null,
      },
    });
    result.editions += 1;

    await db.standardPackEdition.upsert({
      where: { packId_editionId: { packId: pack.id, editionId: edition.id } },
      update: {},
      create: { packId: pack.id, editionId: edition.id },
    });

    // Requirements: parents first (so parentId FKs resolve), preserving deterministic ids.
    const ordered = [...ed.requirements].sort((a, b) => (a.parent ? 1 : 0) - (b.parent ? 1 : 0));
    for (const [index, req] of ordered.entries()) {
      const id = requirementIdFor(ed.familyCode, req.code);
      await db.standardRequirement.upsert({
        where: { id },
        update: {
          title: req.title, summary: req.summary ?? null, mandatory: req.mandatory,
          level: req.level ?? levelFromCode(req.code), active: true,
          parentId: req.parent ? requirementIdFor(ed.familyCode, req.parent) : null,
        },
        create: {
          id, standardId: edition.id, code: req.code, title: req.title, summary: req.summary ?? null,
          description: req.description ?? null, mandatory: req.mandatory,
          level: req.level ?? levelFromCode(req.code), order: index,
          parentId: req.parent ? requirementIdFor(ed.familyCode, req.parent) : null,
        },
      });
      result.requirements += 1;
    }

    const reqIds = ed.requirements.map((r) => requirementIdFor(ed.familyCode, r.code));

    // Catalog artifacts: replace per edition (no org data involved).
    await db.requirementEvidenceRule.deleteMany({ where: { requirementId: { in: reqIds } } });
    if (ed.evidenceRules?.length) {
      await db.requirementEvidenceRule.createMany({
        data: ed.evidenceRules.map((r) => ({
          requirementId: requirementIdFor(ed.familyCode, r.requirementCode),
          expectedType: r.expectedType, mandatory: r.mandatory, frequency: r.frequency,
          retentionMonths: r.retentionMonths ?? null, note: r.note ?? null,
        })),
      });
      result.evidenceRules += ed.evidenceRules.length;
    }

    await db.gapQuestionTemplate.deleteMany({ where: { requirementId: { in: reqIds } } });
    if (ed.gapQuestions?.length) {
      await db.gapQuestionTemplate.createMany({
        data: ed.gapQuestions.map((q) => ({
          requirementId: requirementIdFor(ed.familyCode, q.requirementCode),
          question: q.question, guidance: q.guidance ?? null, weight: q.weight,
          options: q.options ?? undefined, version: q.version,
        })),
      });
      result.gapQuestions += ed.gapQuestions.length;
    }

    await db.auditChecklistTemplate.deleteMany({ where: { requirementId: { in: reqIds } } });
    if (ed.auditChecklist?.length) {
      await db.auditChecklistTemplate.createMany({
        data: ed.auditChecklist.map((c) => ({
          requirementId: requirementIdFor(ed.familyCode, c.requirementCode),
          question: c.question, expectedEvidence: c.expectedEvidence ?? null,
          criterion: c.criterion ?? null, version: c.version,
        })),
      });
      result.auditChecklist += ed.auditChecklist.length;
    }

    await db.standardTemplate.deleteMany({ where: { editionId: edition.id } });
    if (ed.templates?.length) {
      await db.standardTemplate.createMany({
        data: ed.templates.map((t) => ({
          editionId: edition.id,
          requirementId: t.requirementCode ? requirementIdFor(ed.familyCode, t.requirementCode) : null,
          templateType: t.templateType, name: t.name, content: t.content, version: t.version,
        })),
      });
      result.templates += ed.templates.length;
    }
  }

  // Cross-standard mappings — endpoints must already exist (skip otherwise).
  for (const m of manifest.mappings) {
    const sourceId = requirementIdFor(m.sourceFamily, m.sourceCode);
    const targetId = requirementIdFor(m.targetFamily, m.targetCode);
    const [src, tgt] = await Promise.all([
      db.standardRequirement.findUnique({ where: { id: sourceId }, select: { id: true } }),
      db.standardRequirement.findUnique({ where: { id: targetId }, select: { id: true } }),
    ]);
    if (!src || !tgt) continue;
    await db.requirementMapping.upsert({
      where: { sourceRequirementId_targetRequirementId: { sourceRequirementId: sourceId, targetRequirementId: targetId } },
      update: { relationType: m.relationType, equivalencePercent: m.equivalencePercent ?? null, notes: m.notes ?? null },
      create: {
        sourceRequirementId: sourceId, targetRequirementId: targetId,
        relationType: m.relationType, equivalencePercent: m.equivalencePercent ?? null, notes: m.notes ?? null,
      },
    });
    result.mappings += 1;
  }

  return result;
}

/**
 * Instala la matriz de correspondencia del SIG (ISO 9001 ⇄ 14001 ⇄ 45001).
 * Se ejecuta después de los paquetes porque un mapeo exige que existan sus dos
 * extremos; los pares cuyo requisito no está instalado se omiten sin error.
 */
export async function installCrosswalk(db: Db = prisma): Promise<number> {
  let installed = 0;
  for (const m of SIG_CROSSWALK) {
    const sourceId = requirementIdFor(m.sourceFamily, m.sourceCode);
    const targetId = requirementIdFor(m.targetFamily, m.targetCode);
    const [src, tgt] = await Promise.all([
      db.standardRequirement.findUnique({ where: { id: sourceId }, select: { id: true } }),
      db.standardRequirement.findUnique({ where: { id: targetId }, select: { id: true } }),
    ]);
    if (!src || !tgt) continue;
    await db.requirementMapping.upsert({
      where: { sourceRequirementId_targetRequirementId: { sourceRequirementId: sourceId, targetRequirementId: targetId } },
      update: { relationType: m.relationType ?? "RELATED", equivalencePercent: m.equivalencePercent ?? null, notes: m.notes ?? null },
      create: {
        sourceRequirementId: sourceId, targetRequirementId: targetId,
        relationType: m.relationType ?? "RELATED", equivalencePercent: m.equivalencePercent ?? null, notes: m.notes ?? null,
      },
    });
    installed += 1;
  }
  return installed;
}

/** Install every built-in pack (used by seeds and bootstrap). Order matters for mappings. */
export async function installAllPacks(db: Db = prisma): Promise<InstallPackResult[]> {
  const results: InstallPackResult[] = [];
  for (const pack of STANDARD_PACKS) results.push(await installPack(pack, db));
  // La matriz SIG se instala al final, cuando ya existen todos los requisitos.
  await installCrosswalk(db);
  return results;
}
