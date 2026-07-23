# Backups & restore

## Backup layers
| Layer | What | Frequency | Encryption | Retention | Owner |
|---|---|---|---|---|---|
| Supabase automated | Full managed backups + PITR (paid plan) | Continuous WAL + daily snapshot | At rest (provider-managed, AES-256) + TLS in transit | ≥ 7 days PITR + 30 days snapshots (set `BACKUP_RETENTION_DAYS` doc value to match the plan) | Infra |
| Pre-migration dumps | `pg_dump` taken automatically by `db:deploy:safe` before every staging/prod migration | Every migration | Store in an encrypted bucket / KMS-encrypted volume | 90 days | Release owner |
| On-demand export | `pg_dump` before risky maintenance | As needed | Same as above | 90 days | On-call |

> The repository never stores credentials or backup artifacts. Dumps land in
> `backups/<env>/` on the operator's machine/CI runner and must be shipped to
> encrypted, access-controlled storage. Backups contain personal data — treat as
> confidential (Annex A A.8.13).

## Restore drill (proof, with evidence)
Restores are validated regularly — a backup you have never restored is a hope,
not a control. Use the drill script against an **ephemeral** DB:

```bash
export RESTORE_TARGET_URL="postgres://…/nf_restore_drill"   # throwaway DB
export RESTORE_SOURCE_URL="$STAGING_DIRECT_URL"             # or RESTORE_SOURCE=/path/to/dump
export RESTORE_DRILL_CONFIRM=run
npm run restore:drill
```

It refuses any target whose host matches `DATABASE_URL`/`DIRECT_URL`/
`PRODUCTION_*`. It restores, verifies (`_prisma_migrations` applied + key table
counts), times each phase, and writes evidence to
`backups/restore-drills/restore-<timestamp>.json`:

```json
{ "drill":"restore","result":"PASS","totalDurationSec":42,"restoreDurationSec":31,
  "migrationsApplied":31,"latestMigration":"20260723200000_security_operations",
  "tableCounts":{"organizations":2,"users":14,"documents":8,"security_incidents":0} }
```

### Cadence & evidence
- **Quarterly** minimum, and after any major migration or DB provider change.
- Attach the evidence JSON to the continuity control / management review.
- Record in the drill log: date, operator, source, **time to restore (RTO proxy)**, data window, result. A `FAIL` opens a P1.

## Production PITR restore (real recovery)
For actual data loss, use Supabase PITR (dashboard) to the target timestamp into
a new project/branch, validate with the drill verification queries, then cut the
app over by switching `DATABASE_URL`/`DIRECT_URL`. See
[runbooks/migration.md](runbooks/migration.md) "Restore path".
