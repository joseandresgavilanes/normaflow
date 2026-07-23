import { NextRequest, NextResponse } from "next/server";
import { runReportWorker } from "@/lib/report-worker";

export const runtime = "nodejs";
export const maxDuration = 120;

async function run(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied || supplied !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runReportWorker(5));
  } catch (error) {
    console.error("[report-worker] failed", error);
    return NextResponse.json({ error: "Report worker failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
