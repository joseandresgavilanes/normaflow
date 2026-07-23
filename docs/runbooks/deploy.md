# Runbook — Deployment

## Preconditions
- CI `quality` job green on the commit (tsc, prisma validate + drift guard, lint, plans, runtime-config, build, e2e).
- No `P0` / `do-not-merge` label on the PR (the `p0-gate` job blocks merge otherwise).
- [Production readiness checklist](../production-readiness-checklist.md) reviewed for release-affecting changes.

## Deploy to staging
1. Merge to `main` (or trigger the `staging-build` workflow via `workflow_dispatch`).
2. If the release includes migrations, follow [migration.md](migration.md) against staging first.
3. Smoke: `curl -sf https://staging.<domain>/api/health` → `status: ok`.
4. Run live acceptance: `npm run test:live` against the isolated test project.

## Promote to production
1. Confirm staging healthy for ≥ 30 min (`/api/health`, `/api/internal/ops-metrics` all `ok`).
2. Apply migrations to production per [migration.md](migration.md) (pg_dump is automatic).
3. Deploy the same build artifact/commit that passed staging.
4. Post-deploy verification:
   - `GET /api/health` → 200 `ok`.
   - `GET /api/internal/ops-metrics` (Bearer CRON_SECRET) → `status: ok`, no stuck jobs.
   - Trigger one report export + one notification; confirm they reach `COMPLETED` / `SENT`.
   - Stripe test event replays a webhook OK (see [stripe-failure.md](stripe-failure.md)).

## If verification fails
Go to [rollback.md](rollback.md). Do not "fix forward" under a customer-facing outage unless the fix is trivial and already tested.
