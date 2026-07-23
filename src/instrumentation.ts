/**
 * Next.js instrumentation hook (runs once per server/runtime at startup).
 *
 * Observability is provider-agnostic. The structured logger (src/lib/logger.ts)
 * is always the source of truth; `logger.error` forwards to whatever error
 * tracker has registered `globalThis.__nfCaptureError`.
 *
 * ── Enabling Sentry (or an equivalent) ──────────────────────────────────────
 * 1. `npm i @sentry/nextjs`
 * 2. Create `sentry.server.config.ts` / `sentry.edge.config.ts` per Sentry docs
 *    with `Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NORMAFLOW_ENV,
 *    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1) })`, and
 *    in `register()` below import them when `process.env.NEXT_RUNTIME` matches.
 * 3. Bridge the tracker into the logger so error-level logs are captured:
 *      globalThis.__nfCaptureError = (err, ctx) => Sentry.captureException(err, { extra: ctx });
 * No other code changes are needed — every `logger.error` already routes through
 * the bridge, and `onRequestError` below feeds it uncaught request errors.
 */
import { logger } from "@/lib/logger";

export async function register() {
  logger.info("observability.initialized", {
    runtime: process.env.NEXT_RUNTIME ?? "unknown",
    tracker: process.env.SENTRY_DSN ? "sentry-configured" : "logger-only",
  });
}

/**
 * Next.js server error hook — every uncaught request error lands here. Logging
 * it structurally also forwards it to the error tracker via `logger.error`, so
 * nothing is silently swallowed.
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; renderSource?: string },
) {
  logger.error("request.error", error, {
    path: request?.path,
    method: request?.method,
    routerKind: context?.routerKind,
    routePath: context?.routePath,
    renderSource: context?.renderSource,
  });
}
