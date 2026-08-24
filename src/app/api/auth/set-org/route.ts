import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppContext } from "@/lib/app-context";
import { parseId } from "@/lib/validation/common";
import { ACTIVE_ORG_COOKIE, activeOrgCookieOptions } from "@/lib/auth/session-cookies";

export async function POST(request: NextRequest) {
  const ctx = await getAppContext();
  if (!ctx || ctx.mode !== "live") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  let organizationId: string;
  try { organizationId = parseId(body.organizationId); }
  catch { return NextResponse.json({ error: "organizationId inválido" }, { status: 400 }); }

  const allowed = await prisma.membership.findFirst({
    where: { userId: ctx.user.id, organizationId },
  });
  if (!allowed) {
    return NextResponse.json({ error: "Sin acceso a la organización" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_ORG_COOKIE, organizationId, activeOrgCookieOptions());
  return res;
}
