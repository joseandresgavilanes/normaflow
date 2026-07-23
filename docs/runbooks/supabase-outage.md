# Runbook — Supabase outage (DB / Storage / Auth)

Supabase backs the database, Storage, and Auth. Free-tier projects auto-pause;
production must be on a paid, non-pausing plan.

## Symptoms
- `/api/health` returns 503 `degraded` (DB check false); `ops-metrics` `down` (`db_unreachable`).
- App shows `LiveDataUnavailable`; NXDOMAIN or connection timeouts to the pooler host.
- Logins fail (Auth), uploads/downloads fail (Storage).

## Immediate actions
1. Declare severity; open incident. Check the [Supabase status page](https://status.supabase.com) and the project dashboard.
2. **DB unreachable / project paused:** unpause/restore from the Supabase dashboard (Claude/app cannot do this). Confirm the pooler host resolves again.
3. **Degraded (slow):** check connection saturation — Prisma uses the pooler (`DATABASE_URL`, port 6543, `pgbouncer=true`); `DIRECT_URL` (5432) is for migrations only. Reduce load if a runaway query is implicated.
4. Communicate status to affected customers per SLA.

## Resolution
- Once the project is back, verify `/api/health` `ok` and `/api/internal/ops-metrics` `ok`.
- Workers self-heal: report jobs re-queue after the 180s lease; notification jobs recover from stale `PROCESSING` after 15 min. Confirm queues drain.
- If Auth was down, existing sessions may need re-login; verify a real login.

## Prevention / follow-up
- Production on a paid Supabase plan (no auto-pause), PITR enabled.
- Alerting on `/api/health` from an external monitor (independent of Vercel).
- Post-incident review; if recurring, evaluate a non-pausing/managed Postgres.
