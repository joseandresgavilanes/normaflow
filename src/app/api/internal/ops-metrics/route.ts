import { NextResponse, type NextRequest } from "next/server";
import { collectOpsMetrics } from "@/lib/ops-metrics";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Operational metrics for dashboards and alert pollers. CRON_SECRET-gated
 * because it exposes queue depths and failure counts. Returns HTTP 200 with a
 * `status` of ok|degraded|down so a monitor can page on non-ok.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!secret || supplied !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const metrics = await collectOpsMetrics();
    if (metrics.status !== "ok") logger.warn("ops.metrics.non_ok", { status: metrics.status, alerts: metrics.alerts.map((a) => a.code) });
    return NextResponse.json(metrics, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("ops.metrics.failed", error);
    return NextResponse.json({ error: "ops-metrics failed" }, { status: 500 });
  }
}
