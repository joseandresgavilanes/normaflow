# Runbook — Stripe / billing failure

NormaFlow ingests Stripe webhooks (signature-verified, idempotent via
`StripeWebhookEvent`) and enforces plan grace periods hourly via
`/api/cron/billing-enforcement`.

## Symptoms
- Subscriptions not activating/updating after checkout.
- Webhook 4xx/5xx in Stripe dashboard → "Failed" deliveries.
- Customers wrongly suspended or wrongly retaining access.

## Diagnose
1. Stripe Dashboard → Developers → Webhooks → recent deliveries + response codes.
2. Confirm `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret for this environment (staging uses test keys, prod uses `sk_live_`).
3. Search logs for `stripe.webhook.*` events; check `StripeWebhookEvent` for the event id (idempotency).

## Resolution
- **Signature failures (400):** the webhook secret is wrong/rotated → set the correct `STRIPE_WEBHOOK_SECRET`, redeploy, then **Resend** the failed events from Stripe.
- **Handler 5xx:** fix the handler, deploy, then Resend events. Idempotency makes replays safe.
- **Missed events during an outage:** replay from Stripe (they retry up to 3 days) or reconcile from the Stripe API.
- **Wrong access state:** verify `Subscription` status; the hourly enforcement cron reconciles grace/suspension on the next tick, or trigger it manually with the CRON_SECRET bearer.

## Verification
- Send a Stripe test event → 2xx; `StripeWebhookEvent` row recorded once.
- Affected org shows the correct plan/entitlements.

## Guardrails
- Billing keys are environment-scoped; never use `sk_live_` outside production (CI `validate:production-config` enforces `sk_live_` in prod).
