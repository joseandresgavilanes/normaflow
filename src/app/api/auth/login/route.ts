import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_CREDENTIALS, DEMO_CREDENTIALS } from "@/lib/constants";
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

type LocalAuthAccount = {
  kind: "demo" | "customer";
  id: string;
  email: string;
  password: string;
  name: string;
};

function localAuthAccounts(): LocalAuthAccount[] {
  return [
    {
      kind: "demo",
      id: "demo-local",
      email: process.env.DEMO_EMAIL || DEMO_CREDENTIALS.email,
      password: process.env.DEMO_PASSWORD || DEMO_CREDENTIALS.password,
      name: process.env.DEMO_NAME || "Ana García",
    },
    {
      kind: "customer",
      id: "customer-local",
      email: process.env.CUSTOMER_EMAIL || CUSTOMER_CREDENTIALS.email,
      password: process.env.CUSTOMER_PASSWORD || CUSTOMER_CREDENTIALS.password,
      name: process.env.CUSTOMER_NAME || "Admin Cliente",
    },
  ];
}

function matchLocalAuthAccount(email: string, password: string): LocalAuthAccount | null {
  return localAuthAccounts().find(account => account.email === email && account.password === password) ?? null;
}

function shouldUseSecureCookie(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  return process.env.NODE_ENV === "production" && protocol === "https";
}

async function signLocalResponse(account: LocalAuthAccount, request: NextRequest) {
  const token = signDemoSession(account.email, sessionSecret());
  const response = NextResponse.json({ ok: true, demo: account.kind === "demo", local: true, account: account.kind });
  response.cookies.set(demoCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
    secure: shouldUseSecureCookie(request),
  });
  return response;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 });
  }

  const localAccount = isAuthDemoMode() ? matchLocalAuthAccount(email, password) : null;
  if (localAccount) return signLocalResponse(localAccount, request);

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
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "Configura Supabase o AUTH_DEMO_MODE=true para desarrollo." },
    { status: 503 }
  );
}
