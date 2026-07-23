import { NextResponse, type NextRequest } from "next/server";
import { collectOpsMetrics } from "@/lib/ops-metrics";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Scheduled watchdog. Collects ops metrics and, when the system is not "ok",
 * posts a compact alert to OPS_ALERT_WEBHOOK (Slack/Teams/PagerDuty-compatible
 * JSON `{text}`). Delivery failures are logged, never thrown, so the cron stays
 * green and the next tick retries.
 */
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!secret || supplied !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const metrics = await collectOpsMetrics();
  const webhook = process.env.OPS_ALERT_WEBHOOK?.trim();

  if (metrics.status !== "ok" && webhook) {
    const summary = metrics.alerts.map((a) => `• [${a.severity}] ${a.message}`).join("\n") || metrics.status;
    const text = `🚨 NormaFlow (${process.env.NORMAFLOW_ENV ?? process.env.NODE_ENV ?? "unknown"}) status=${metrics.status}\n${summary}`;
    try {
      const res = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) logger.warn("ops.monitor.webhook_non_2xx", { httpStatus: res.status });
    } catch (error) {
      logger.error("ops.monitor.webhook_failed", error);
    }
  }
  logger.info("ops.monitor.tick", { status: metrics.status, alerts: metrics.alerts.length });
  return NextResponse.json(metrics, { headers: { "cache-control": "no-store" } });
}

export const GET = run;
export const POST = run;
