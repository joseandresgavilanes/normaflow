# Runbook — Database migration

Prisma migrations are the canonical schema history (`prisma/migrations`). They
are **forward-only** and hand-written (RLS, triggers, role functions). Never run
`prisma db push` or ad-hoc SQL against staging/production.

## Pre-flight (any environment)
1. `npx prisma validate` and confirm CI's drift guard passed.
2. Dry-run the DDL/RLS on a throwaway Postgres if the migration is non-trivial (see how the SoA/assets/security-ops migrations were smoke-tested).
3. Review that new tables have: tenant `organizationId` FK, indexes, GRANTs to `authenticated`, RLS policies, tenant-validation trigger, and role-permission updates where a new module is added.

## Apply to staging
```bash
export NORMAFLOW_DB_ENV=staging
export NORMAFLOW_MIGRATION_CONFIRM=apply-staging
npm run db:deploy:safe      # pg_dump → prisma migrate deploy → migrate status
export NORMAFLOW_DB_ENV=staging && npm run db:smoke
```
Then run `npm run test:live` (isolated project) for RLS/tenant regressions.

## Apply to production
```bash
export NORMAFLOW_DB_ENV=production
export NORMAFLOW_MIGRATION_CONFIRM=apply-production
export NORMAFLOW_ALLOW_PRODUCTION_MIGRATIONS=true
npm run db:deploy:safe
export NORMAFLOW_DB_ENV=production && npm run db:status   # must be "up to date"
```
A `pg_dump` is written to `backups/production/` **before** the migration runs — this is the rollback point.

## Verification
- `npm run db:status` → up to date.
- `/api/health` `ok`; `/api/internal/ops-metrics` `ok`.
- Spot-check a query on a new table via the app (not psql-as-superuser) so RLS is exercised.

## Restore path (emergency only)
If a migration corrupts data and forward-fix isn't viable:
1. Put the app in maintenance / redeploy prior build.
2. Restore the pre-migration dump into a fresh DB and validate with `npm run restore:drill` (see [backup-restore.md](../backup-restore.md)), then cut over.
3. Record data loss window (everything written after the dump) in the incident.
