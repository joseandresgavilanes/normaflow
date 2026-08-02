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
import { iso22301Pack } from "./iso-22301-2019.pack";
import { sigPack } from "./sig-9001-14001-45001.pack";
import { materializePackTemplateContent } from "./template-content";

export * from "./pack-schema";
export * from "./lifecycle";
export * from "./readiness";
export * from "./entitlements";
export * from "./promotion";
export { SIG_CROSSWALK } from "./sig-crosswalk";

type Db = PrismaClient | Prisma.TransactionClient;

/** Built-in packs shipped with NormaFlow. New norms drop a manifest in here.
 * Order matters for cross-standard mappings: a pack's mappings only install
 * when both endpoints already exist, so packs that map to ISO 9001 come after it. */
export const STANDARD_PACKS: StandardPackInput[] = [
  iso9001Pack, iso27001Pack, iso14001Pack, iso45001Pack, iso42001Pack, iso37301Pack,
  iso37001Pack, iso50001Pack, iso22000Pack, iso20000Pack, iso22301Pack, iso13485Pack,
  sigPack,
];

/** Familias cuya activación debe (re)instalar la matriz de correspondencia del SIG. */
export const SIG_CROSSWALK_FAMILIES = new Set(["ISO_9001", "ISO_14001", "ISO_45001", "SIG_9001_14001_45001"]);

export function getPack(code: string): StandardPackInput | null {
  return STANDARD_PACKS.find((p) => p.code === code) ?? null;
}

/** Pack whose edition matches a family code — used by adoption helpers. */
export function getPackForFamily(familyCode: string): StandardPackInput | null {
  return STANDARD_PACKS.find((p) => p.editions.some((e) => e.familyCode === familyCode)) ?? null;
}

export type InstallPackResult = {
  packCode: string;
  lifecycleStatus: string;
  editions: number;
  requirements: number;
  evidenceRules: number;
  gapQuestions: number;
  auditChecklist: number;
  templates: number;
  mappings: number;
  frozenActiveEditions: number;
};

const levelFromCode = (code: string) => code.split(".").length;

/**
 * Install (or update) a pack — idempotent.
 *
 * Reglas de historial:
 * - Datos de organización (assessments, coverage, OrganizationStandard) NUNCA se tocan.
 * - Una edición ACTIVE con la misma catalogVersion NO muta títulos/resúmenes de requisitos
 *   (solo refresca artefactos de catálogo: evidence/GAP/checklist/templates).
 * - Para cambiar requisitos de una edición ACTIVE: publicar nueva editionCode en el manifest
 *   (la edición anterior permanece; márquela SUPERSEDED en un paso explícito posterior).
 * - Si el manifest trae catalogVersion distinta sobre la misma editionCode ACTIVE → error
 *   (fuerza bump de editionCode, no silent overwrite).
 */
export async function installPack(input: unknown, db: Db = prisma): Promise<InstallPackResult> {
  const manifest = parsePackManifest(input);
  const result: InstallPackResult = {
    packCode: manifest.code,
    lifecycleStatus: manifest.lifecycleStatus,
    editions: 0, requirements: 0, evidenceRules: 0, gapQuestions: 0, auditChecklist: 0, templates: 0, mappings: 0,
    frozenActiveEditions: 0,
  };

  const pack = await db.standardPack.upsert({
    where: { code: manifest.code },
    update: {
      name: manifest.name, version: manifest.version, description: manifest.description ?? null,
      requiredModules: manifest.requiredModules, featureFlags: manifest.featureFlags,
      // El lifecycle comercial es gobernado exclusivamente por
      // promotePackLifecycle(). Una reinstalación del catálogo nunca puede
      // degradar un pack LIVE al estado editorial del manifiesto.
    },
    create: {
      code: manifest.code, name: manifest.name, version: manifest.version, description: manifest.description ?? null,
      requiredModules: manifest.requiredModules, featureFlags: manifest.featureFlags,
      lifecycleStatus: manifest.lifecycleStatus,
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

    const existing = await db.standardEdition.findUnique({
      where: { familyId_editionCode: { familyId: family.id, editionCode: ed.editionCode } },
    });

    if (
      existing
      && existing.status === "ACTIVE"
      && existing.catalogVersion
      && ed.catalogVersion
      && existing.catalogVersion !== ed.catalogVersion
    ) {
      throw new Error(
        `No se puede mutar la edición ACTIVE ${ed.familyCode}/${ed.editionCode} ` +
        `(catalogVersion ${existing.catalogVersion} → ${ed.catalogVersion}). ` +
        `Crea una nueva editionCode en el manifest (p. ej. "${ed.editionCode}b") y deja la anterior intacta.`,
      );
    }

    const freezeRequirements = Boolean(existing && existing.status === "ACTIVE");

    const edition = await db.standardEdition.upsert({
      where: { familyId_editionCode: { familyId: family.id, editionCode: ed.editionCode } },
      update: freezeRequirements
        ? {
            // Metadatos de presentación OK; no tocar status ni forzar reescritura de requisitos.
            name: ed.name, version: ed.version, year: ed.year ?? null, description: ed.description ?? null,
          }
        : {
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
    if (freezeRequirements) result.frozenActiveEditions += 1;

    await db.standardPackEdition.upsert({
      where: { packId_editionId: { packId: pack.id, editionId: edition.id } },
      update: {},
      create: { packId: pack.id, editionId: edition.id },
    });

    const ordered = [...ed.requirements].sort((a, b) => (a.parent ? 1 : 0) - (b.parent ? 1 : 0));
    for (const [index, req] of ordered.entries()) {
      const id = requirementIdFor(ed.familyCode, req.code);
      if (freezeRequirements) {
        // Solo asegura existencia (idempotente); no sobrescribe título/resumen de ACTIVE.
        const found = await db.standardRequirement.findUnique({ where: { id }, select: { id: true } });
        if (!found) {
          await db.standardRequirement.create({
            data: {
              id, standardId: edition.id, code: req.code, title: req.title, summary: req.summary ?? null,
              description: req.description ?? null, mandatory: req.mandatory,
              level: req.level ?? levelFromCode(req.code), order: index,
              parentId: req.parent ? requirementIdFor(ed.familyCode, req.parent) : null,
            },
          });
        }
        result.requirements += 1;
        continue;
      }

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

    // Catalog artifacts: replace per edition (no org data).
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
          templateType: t.templateType,
          name: t.name,
          content: materializePackTemplateContent({
            familyCode: ed.familyCode,
            requirementCode: t.requirementCode,
            templateType: t.templateType,
            name: t.name,
            content: t.content,
          }),
          version: t.version,
        })),
      });
      result.templates += ed.templates.length;
    }
  }

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
