import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppContext } from "@/lib/app-context";

export async function POST(request: NextRequest) {
  const ctx = await getAppContext();
  if (!ctx || ctx.mode !== "live") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId requerido" }, { status: 400 });
  }

  const allowed = await prisma.membership.findFirst({
    where: { userId: ctx.user.id, organizationId },
  });
  if (!allowed) {
    return NextResponse.json({ error: "Sin acceso a la organización" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("nf_org", organizationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
