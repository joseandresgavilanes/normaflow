import { NextResponse, type NextRequest } from "next/server";
import { runReminders } from "@/lib/reminders";

// Always run server-side, never cached.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily reminder job. Vercel Cron automatically sends
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is configured.
 * Manual runs must pass the same header.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no está configurado." }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await runReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/reminders] failed:", err);
    return NextResponse.json({ ok: false, error: "Fallo al ejecutar recordatorios." }, { status: 500 });
  }
}
