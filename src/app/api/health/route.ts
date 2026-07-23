import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe. Unauthenticated and intentionally minimal: it
 * reveals only up/down + DB reachability, never counts or tenant data. Load
 * balancers and uptime monitors poll this; detailed queue metrics live behind
 * CRON_SECRET at /api/internal/ops-metrics.
 */
export async function GET() {
  const started = Date.now();
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  const body = {
    status: db ? "ok" : "degraded",
    env: process.env.NORMAFLOW_ENV || process.env.NODE_ENV || "development",
    time: new Date().toISOString(),
    checks: { database: db },
    latencyMs: Date.now() - started,
  };
  return NextResponse.json(body, { status: db ? 200 : 503, headers: { "cache-control": "no-store" } });
}
