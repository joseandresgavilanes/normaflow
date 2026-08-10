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
| [iso-9001-support.md](iso-9001-support.md) | ISO 9001 customer support — clause coverage, common issues |
| [iso-27001-support.md](iso-27001-support.md) | ISO 27001 customer support — clause coverage, common issues |
| [iso-14001-support.md](iso-14001-support.md) | ISO 14001 customer support — clause coverage, common issues |
| [iso-45001-support.md](iso-45001-support.md) | ISO 45001 customer support — clause coverage, common issues |
| [sig-support.md](sig-support.md) | Sistema Integrado (9001+14001+45001) customer support |
| [iso-22301-support.md](iso-22301-support.md) | ISO 22301 (continuidad del negocio) customer support |
| [iso-42001-support.md](iso-42001-support.md) | ISO/IEC 42001 (gestión de IA) customer support |
| [iso-37301-support.md](iso-37301-support.md) | ISO 37301 (compliance) customer support |
| [iso-50001-support.md](iso-50001-support.md) | ISO 50001 (gestión energética) customer support |
| [iso-22000-support.md](iso-22000-support.md) | ISO 22000 (inocuidad alimentaria / HACCP) customer support |
| [iso-20000-support.md](iso-20000-support.md) | ISO/IEC 20000 (ITSM) customer support |
| [iso-13485-support.md](iso-13485-support.md) | ISO 13485 (medical device QMS) customer support |
| [iso-37001-support.md](iso-37001-support.md) | ISO 37001 (anti-bribery) customer support |

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
