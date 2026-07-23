# Runbook — Rollback

## Symptoms
Post-deploy: elevated 5xx, `/api/health` degraded, `ops-metrics` `down`/`degraded`, broken core flow (login, billing, reports), or a confirmed regression.

## Immediate actions (target < 10 min)
1. Declare severity ([support-sla.md](../support-sla.md)); open an incident in `/app/incidents`.
2. **Redeploy the previous good build** (Vercel: promote the prior production deployment — instant, no rebuild).
3. Re-check `/api/health` → `ok`.

## Code vs. data
- **Code-only release (no migration):** redeploying the previous build fully resolves it. Done.
- **Release included a migration:** migrations are **forward-only**. Do NOT auto-revert the schema. Options, in order of preference:
  1. Prefer a **forward fix** migration if the schema change is additive/compatible with the old code.
  2. If the old code cannot run against the new schema, restore from the pre-migration `pg_dump` taken by `db:deploy:safe` (in `backups/<env>/`) — see [migration.md](migration.md) "Restore path". This loses writes since the dump; only for true emergencies.

## Verification
- `/api/health` 200 `ok`; `/api/internal/ops-metrics` `status: ok`.
- Exercise the flow that failed; confirm fixed.
- Confirm workers draining (report/notification `queued`/`pending` not growing).

## After
- Keep the incident open until the post-incident review; capture timeline + root cause + lessons in the incident record and a post-mortem.
