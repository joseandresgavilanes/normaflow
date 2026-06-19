import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test("every public RLS table is reachable by authenticated before policy evaluation", async () => {
  const prisma = new PrismaClient();
  try {
    const schemaUsage = await prisma.$queryRaw<Array<{ allowed: boolean }>>`
      SELECT has_schema_privilege('authenticated', 'public', 'USAGE') AS allowed
    `;
    expect(schemaUsage[0]?.allowed).toBe(true);

    const missing = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT relation.relname AS "tableName"
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind = 'r'
        AND relation.relrowsecurity
        AND NOT has_table_privilege('authenticated', relation.oid, 'SELECT')
      ORDER BY relation.relname
    `;
    expect(missing).toEqual([]);
  } finally {
    await prisma.$disconnect();
  }
});
