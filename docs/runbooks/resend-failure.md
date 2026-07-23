# Runbook — Resend / email delivery failure

Email is decoupled from the request path: business actions create in-app
notifications + a `NotificationDeliveryJob`, and `/api/cron/notification-delivery`
(every 5 min) sends via Resend with retry/backoff. So email delays never break the app.

## Symptoms
- `ops-metrics` shows `notification_jobs_stuck` or `notification_failures`, or a growing `notifications.pending`.
- Customers not receiving invites/reminders.

## Diagnose
1. `GET /api/internal/ops-metrics` → `notifications` block (pending, processing, stuck, failed24h, oldestPendingAgeSec).
2. Logs: `notification.*` events and `lastError` on failing `NotificationDeliveryJob` rows.
3. Resend dashboard: API key validity, domain verification (SPF/DKIM), sending limits, bounces.

## Resolution
- **Auth/401 from Resend:** fix `RESEND_API_KEY`; redeploy. Jobs retry automatically (max attempts, then `PERMANENTLY_FAILED`).
- **Unverified domain / bad `RESEND_FROM_EMAIL`:** verify the domain, set a from-address on the verified domain.
- **Stuck `PROCESSING`:** jobs older than 15 min are auto-recovered to retry; confirm the cron is running (Vercel Cron logs). Manually hit the endpoint with the CRON_SECRET bearer to force a drain.
- **Provider outage:** wait/retry; backlog drains when Resend recovers. Consider a secondary provider if repeated.

## Verification
- Trigger a notification; confirm the job reaches `SENT` and the email arrives.
- `ops-metrics` `notifications.stuck = 0`, backlog shrinking.
