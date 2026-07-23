/**
 * Structured JSON logger for NormaFlow.
 *
 * - One JSON object per line (stdout for debug/info, stderr for warn/error) so
 *   the platform's log drain (Vercel, Datadog, Loki, …) can parse and index it.
 * - Secrets are redacted recursively before serialization.
 * - `error`-level logs are forwarded to the optional error tracker registered
 *   by `instrumentation.ts` (Sentry or equivalent) via `globalThis.__nfCaptureError`.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("report.worker.processed", { count, durationMs });
 *   logger.error("stripe.webhook.failed", err, { eventId });
 *   const log = logger.child({ requestId, organizationId });
 */

type Level = "debug" | "info" | "warn" | "error";
const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SERVICE = "normaflow";
const ENV = process.env.NORMAFLOW_ENV || process.env.NODE_ENV || "development";
const MIN_WEIGHT = LEVEL_WEIGHT[(process.env.LOG_LEVEL as Level) in LEVEL_WEIGHT ? (process.env.LOG_LEVEL as Level) : (ENV === "development" ? "debug" : "info")];

const REDACT_KEYS = /^(password|passwordhash|token|secret|authorization|cookie|apikey|api_key|serviceroletoken|service_role_key|dsn|stripe.*secret|resend.*key|nextauth_secret|cron_secret|access[_-]?token|refresh[_-]?token)$/i;
const REDACTED = "[redacted]";

type Ctx = Record<string, unknown>;

function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[circular]";
  seen.add(value as object);
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => redact(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.test(k) ? REDACTED : redact(v, seen);
  }
  return out;
}

function serializeError(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return { message: String(err) };
}

function emit(level: Level, event: string, base: Ctx, context?: Ctx, error?: unknown) {
  if (LEVEL_WEIGHT[level] < MIN_WEIGHT) return;
  const record: Ctx = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    env: ENV,
    event,
    ...(redact(base) as Ctx),
    ...(context ? (redact(context) as Ctx) : {}),
    ...(error ? { error: serializeError(error) } : {}),
  };
  const line = JSON.stringify(record);
  const toErr = level === "error" || level === "warn";
  const stream = toErr ? process.stderr : process.stdout;
  // Node runtime writes a single line to the right stream; edge/other runtimes
  // fall back to console (process.stdout is unavailable there).
  if (stream && typeof stream.write === "function") stream.write(line + "\n");
  else (toErr ? console.error : console.log)(line);

  if (level === "error") {
    const capture = (globalThis as { __nfCaptureError?: (e: unknown, c?: Ctx) => void }).__nfCaptureError;
    if (typeof capture === "function") {
      try { capture(error ?? new Error(event), record); } catch { /* never let telemetry break the request */ }
    }
  }
}

function make(base: Ctx) {
  return {
    debug: (event: string, context?: Ctx) => emit("debug", event, base, context),
    info: (event: string, context?: Ctx) => emit("info", event, base, context),
    warn: (event: string, context?: Ctx) => emit("warn", event, base, context),
    /** `error(event, err, context)` — err is serialized and forwarded to the tracker. */
    error: (event: string, error?: unknown, context?: Ctx) => emit("error", event, base, context, error),
    child: (extra: Ctx) => make({ ...base, ...extra }),
  };
}

export type Logger = ReturnType<typeof make>;
export const logger = make({});
