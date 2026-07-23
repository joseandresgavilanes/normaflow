# Production readiness checklist

Gate for onboarding paying customers. Re-review before major releases.

## Environments & config
- [ ] Four environments separated: development / testing / staging / production ([environment-separation.md](environment-separation.md)).
- [ ] Production DB URLs distinct from staging/testing; tests/drills refuse prod hosts.
- [ ] `npm run validate:production-config` passes with prod secrets (HTTPS app URL, `sk_live_` Stripe, all required env present, `CRON_SECRET` set).
- [ ] Strong, unique secrets per env: `NEXTAUTH_SECRET`, `DEMO_SESSION_SECRET`, `CRON_SECRET`, `STRIPE_WEBHOOK_SECRET`.
- [ ] `AUTH_DEMO_MODE=false` in staging and production.

## Data & backups
- [ ] Supabase on a paid, non-pausing plan with PITR enabled.
- [ ] Backup frequency/encryption/retention documented and matches the plan ([backup-restore.md](backup-restore.md)).
- [ ] **Restore drill executed** with a `PASS` evidence file in `backups/restore-drills/` (RTO recorded).
- [ ] Data export + guarded offboarding tooling verified on a test org ([data-governance.md](data-governance.md)).
- [ ] Retention windows agreed and reflected in the customer DPA.

## Security
- [ ] RLS enabled on every tenant table; tenant-isolation live suite green (`npm run test:live`).
- [ ] Storage buckets private; `org-<id>/` prefix policies active.
- [ ] Audit log append-only; covers create/update/delete/status changes.
- [ ] Secret-rotation procedure known ([runbooks/security-incident.md](runbooks/security-incident.md)).

## Observability & jobs
- [ ] Log drain configured; `LOG_LEVEL=info` in prod.
- [ ] Error tracker active (`@sentry/nextjs` + `SENTRY_DSN`) or a conscious decision to run logger-only.
- [ ] `OPS_ALERT_WEBHOOK` set; `/api/cron/ops-monitor` firing; a test alert received.
- [ ] External uptime monitor on `/api/health` (independent of Vercel).
- [ ] All Vercel Crons scheduled: reminders, notification-delivery, report-delivery, billing-enforcement, ops-monitor.
- [ ] Workers verified draining; stuck-job recovery confirmed (report 180s lease, notification 15 min).

## CI/CD
- [ ] `quality` gates green: tsc, prisma validate + drift guard, lint, plans, runtime-config, build, e2e.
- [ ] `p0-gate` active (P0/do-not-merge label blocks merge).
- [ ] Staging build + live-security jobs runnable on dispatch; migrations applied via `db:deploy:safe` (auto pg_dump).
- [ ] Rollback path rehearsed ([runbooks/rollback.md](runbooks/rollback.md)).

## Support
- [ ] Severity/SLA/escalation published to the team ([support-sla.md](support-sla.md)).
- [ ] On-call rotation + contacts defined.
- [ ] Status page / customer comms channel ready.
- [ ] Runbooks reviewed and reachable by on-call ([runbooks/](runbooks/)).

## Commercial
- [ ] Stripe live plans configured; webhook endpoint verified; test event replays OK.
- [ ] Plan entitlements (`validate:plans`) consistent with billing.
- [ ] DPA / terms / privacy published.
