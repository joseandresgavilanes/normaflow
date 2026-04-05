import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signDemoSession, demoCookieName } from "@/lib/demo-auth";
import { isAuthDemoMode, isSupabaseConfigured, sessionSecret } from "@/lib/env";

async function syncAuthUser(authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const email = authUser.email;
  if (!email) return;
  const name =
    (typeof authUser.user_metadata?.full_name === "string" && authUser.user_metadata.full_name) ||
    email.split("@")[0];
  await prisma.user.upsert({
    where: { email },
    create: { email, name, authUserId: authUser.id },
    update: { authUserId: authUser.id, name },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    let response = NextResponse.json({ ok: true });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options as object);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      if (isAuthDemoMode()) {
        const demoEmail = process.env.DEMO_EMAIL || "demo@normaflow.io";
        const demoPass = process.env.DEMO_PASSWORD || "NormaFlow2025!";
        if (email === demoEmail && password === demoPass) {
          try {
            await syncAuthUser({ id: "demo-local", email, user_metadata: { full_name: "Demo" } });
          } catch {
            /* prisma optional in strict demo */
          }
          const token = signDemoSession(email, sessionSecret());
          response = NextResponse.json({ ok: true, demo: true });
          response.cookies.set(demoCookieName, token, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 3600,
            secure: process.env.NODE_ENV === "production",
          });
          return response;
        }
      }
      return NextResponse.json({ error: error?.message || "Credenciales incorrectas" }, { status: 401 });
    }

    try {
      await syncAuthUser({
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata as Record<string, unknown>,
      });
    } catch (e) {
      console.error("syncAuthUser", e);
    }

    return response;
  }

  if (isAuthDemoMode()) {
    const demoEmail = process.env.DEMO_EMAIL || "demo@normaflow.io";
    const demoPass = process.env.DEMO_PASSWORD || "NormaFlow2025!";
    if (email !== demoEmail || password !== demoPass) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }
    try {
      await syncAuthUser({ id: "demo-local", email, user_metadata: { full_name: "Usuario demo" } });
    } catch {
      /* allow UI without DB in edge cases */
    }
    const token = signDemoSession(email, sessionSecret());
    const res = NextResponse.json({ ok: true, demo: true });
    res.cookies.set(demoCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  return NextResponse.json(
    { error: "Configura Supabase o AUTH_DEMO_MODE=true para desarrollo." },
    { status: 503 }
  );
}
