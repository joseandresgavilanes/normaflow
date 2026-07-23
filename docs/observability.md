# Observability

## Structured logging
`src/lib/logger.ts` emits one JSON object per line (stdout for info/debug,
stderr for warn/error). Every record carries `ts, level, service, env, event`
plus context. Secrets are redacted recursively (passwords, tokens, keys, DSNs,
cookies, auth headers). `LOG_LEVEL` controls verbosity (default: `debug` in dev,
`info` elsewhere).

```ts
import { logger } from "@/lib/logger";
logger.info("report.worker.processed", { count, durationMs });
logger.error("stripe.webhook.failed", err, { eventId });
const log = logger.child({ requestId, organizationId }); // request/tenant-scoped
```

Ship stdout/stderr to your log platform (Vercel log drain → Datadog/Logtail/Loki).
Index on `event`, `level`, `organizationId`.

## Error tracking (Sentry or equivalent)
`src/instrumentation.ts` initializes an error tracker **only if** `@sentry/nextjs`
is installed and `SENTRY_DSN` is set — otherwise it is a no-op and the logger is
the source of truth. `onRequestError` routes every uncaught server error to the
logger (which forwards to the tracker via `globalThis.__nfCaptureError`).

Activate:
```bash
npm i @sentry/nextjs
# env: SENTRY_DSN=…  SENTRY_TRACES_SAMPLE_RATE=0.1
```
`release` is tagged from `VERCEL_GIT_COMMIT_SHA`. No other code change needed.

## Metrics
`GET /api/internal/ops-metrics` (Bearer `CRON_SECRET`) returns queue health and a
computed `status: ok|degraded|down`:
- **reports:** queued, processing, completed24h, failed24h, **stuck** (PROCESSING past the 180s lease), oldestQueuedAgeSec.
- **notifications:** pending, processing, sent24h, failed24h, **stuck** (PROCESSING > 15 min), oldestPendingAgeSec.
- **db:** reachability + latency.

Point a dashboard/scraper at it. `/api/health` is the public, unauthenticated
liveness/readiness probe (DB reachability only — no counts).

## Tracing
- App is serverless (Vercel functions) — use per-request tracing via the tracker
  (Sentry performance) once enabled; `tracesSampleRate` controls sampling.
- Structured logs are correlated by `requestId` (set on child loggers) and, for
  server errors, by the `onRequestError` hook.

## Alerts
`/api/cron/ops-monitor` runs every 10 min, calls `collectOpsMetrics`, and POSTs a
`{text}` alert to `OPS_ALERT_WEBHOOK` (Slack/Teams/PagerDuty) when `status !== ok`.

| Alert | Condition | Severity | Runbook |
|---|---|---|---|
| `db_unreachable` | `SELECT 1` fails | critical / P0 | [supabase-outage](runbooks/supabase-outage.md) |
| `report_jobs_stuck` / `notification_jobs_stuck` | PROCESSING past lease | warning / P2 | [resend-failure](runbooks/resend-failure.md) |
| `*_queue_backlog` | oldest item > 15 min in queue | warning / P2 | worker not running — check Vercel Cron |
| `report_failures` / `notification_failures` | ≥ 10 failures / 24h | warning / P2 | inspect `lastError`, provider status |

Add an **external** uptime monitor on `/api/health` (independent of Vercel) so a
full platform outage still pages.
