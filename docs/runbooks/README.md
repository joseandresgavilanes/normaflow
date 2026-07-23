# NormaFlow Runbooks

Operational runbooks for running NormaFlow with paying customers. Each runbook
is self-contained: **symptoms → immediate actions → resolution → verification → rollback**.

| Runbook | When to use |
|---|---|
| [deploy.md](deploy.md) | Shipping a release to staging / production |
| [rollback.md](rollback.md) | A release is bad and must be reverted |
| [migration.md](migration.md) | Applying a Prisma migration to staging / production |
| [supabase-outage.md](supabase-outage.md) | DB/Storage/Auth (Supabase) is down or degraded |
| [stripe-failure.md](stripe-failure.md) | Stripe webhooks or billing failing |
| [resend-failure.md](resend-failure.md) | Email delivery (Resend) failing |
| [storage.md](storage.md) | Supabase Storage errors, quota, orphaned objects |
| [security-incident.md](security-incident.md) | Suspected/confirmed security incident |

## On-call quick reference

- **Health:** `GET /api/health` (public, DB reachability).
- **Ops metrics:** `GET /api/internal/ops-metrics` with `Authorization: Bearer $CRON_SECRET` → queue depths, stuck jobs, failures, `status: ok|degraded|down`.
- **Watchdog:** `/api/cron/ops-monitor` runs every 10 min and posts to `OPS_ALERT_WEBHOOK` on non-ok.
- **Environments & DB URLs:** [../environment-separation.md](../environment-separation.md).
- **Severity & SLA:** [../support-sla.md](../support-sla.md).

## Golden rules

1. Production migrations only via `npm run db:deploy:safe` (takes a `pg_dump` first).
2. Never point tests or drills at production URLs — the tooling refuses matching hosts.
3. Every P0 gets an incident record (`/app/incidents`) and a post-incident review.
