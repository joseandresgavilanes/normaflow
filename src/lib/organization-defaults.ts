import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ARCHIVE_METHODS,
  DEFAULT_DISPOSITIONS,
  DEFAULT_LOCATIONS,
  DEFAULT_POSITIONS,
  DEFAULT_RECORD_TYPES,
  DEFAULT_ADMIN_CATALOGS,
  DEFAULT_RETENTION_TIMES,
} from "@/lib/catalog-defaults";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Completa los catálogos base de una organización de forma idempotente.
 *
 * Se puede ejecutar tanto al crear una organización como al entrar en una
 * organización creada antes de esta inicialización. Nunca elimina ni pisa
 * registros existentes y siempre filtra por organizationId.
 */
export async function ensureOrganizationDefaults(
  organizationId: string,
  db: Db = prisma,
) {
  const [positions, locations, retentionTimes, dispositions, archiveMethods, recordTypes] = await Promise.all([
    db.position.findMany({ where: { organizationId }, select: { name: true } }),
    db.location.findMany({ where: { organizationId }, select: { name: true } }),
    db.retentionTime.findMany({ where: { organizationId }, select: { name: true } }),
    db.disposition.findMany({ where: { organizationId }, select: { name: true } }),
    db.archiveMethod.findMany({ where: { organizationId }, select: { name: true } }),
    db.recordType.findMany({ where: { organizationId }, select: { name: true } }),
  ]);

  const includesAll = (rows: { name: string }[], names: readonly string[]) =>
    names.every((name) => rows.some((row) => row.name === name));

  if (
    includesAll(positions, DEFAULT_POSITIONS.map((item) => item.name)) &&
    includesAll(locations, DEFAULT_LOCATIONS.map((item) => item.name)) &&
    includesAll(retentionTimes, DEFAULT_RETENTION_TIMES.map((item) => item.name)) &&
    includesAll(dispositions, DEFAULT_DISPOSITIONS) &&
    includesAll(archiveMethods, DEFAULT_ARCHIVE_METHODS) &&
    includesAll(recordTypes, DEFAULT_RECORD_TYPES)
  ) {
    return;
  }

  await Promise.all([
    ...DEFAULT_POSITIONS.map((position) =>
      db.position.upsert({
        where: { organizationId_name: { organizationId, name: position.name } },
        update: {},
        create: { organizationId, ...position },
      }),
    ),
    ...DEFAULT_LOCATIONS.map((location) =>
      db.location.upsert({
        where: { organizationId_name: { organizationId, name: location.name } },
        update: {},
        create: { organizationId, ...location },
      }),
    ),
    ...DEFAULT_RETENTION_TIMES.map((retention) =>
      db.retentionTime.upsert({
        where: { organizationId_name: { organizationId, name: retention.name } },
        update: { months: retention.months },
        create: { organizationId, ...retention },
      }),
    ),
    ...DEFAULT_DISPOSITIONS.map((name) =>
      db.disposition.upsert({
        where: { organizationId_name: { organizationId, name } },
        update: {},
        create: { organizationId, name },
      }),
    ),
    ...DEFAULT_ARCHIVE_METHODS.map((name) =>
      db.archiveMethod.upsert({
        where: { organizationId_name: { organizationId, name } },
        update: {},
        create: { organizationId, name },
      }),
    ),
    ...DEFAULT_RECORD_TYPES.map((name) =>
      db.recordType.upsert({
        where: { organizationId_name: { organizationId, name } },
        update: {},
        create: { organizationId, name },
      }),
    ),
    ...Object.entries(DEFAULT_ADMIN_CATALOGS).flatMap(([kind, names]) =>
      names.map((name, sortOrder) =>
        db.organizationCatalogItem.upsert({
          where: { organizationId_kind_name: { organizationId, kind, name } },
          update: {},
          create: { organizationId, kind, name, sortOrder },
        }),
      ),
    ),
  ]);
}
