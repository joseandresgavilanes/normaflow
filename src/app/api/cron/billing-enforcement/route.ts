import { NextResponse, type NextRequest } from "next/server";
import { enforceBillingGracePeriods } from "@/lib/billing-enforcement";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await enforceBillingGracePeriods()) });
}
