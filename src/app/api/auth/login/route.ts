import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { signDemoSession, demoCookieName } from "@/lib/demo-auth";
import { getDemoLoginAccounts } from "@/lib/demo-accounts";
import { syncAuthUser } from "@/lib/auth/sync-auth-user";
import { appendClearAuthCookies } from "@/lib/auth/session-cookies";
import { isAuthDemoMode, isSupabaseConfigured, sessionSecret } from "@/lib/env";
import { clientAddress, rateLimitResponse, takeRateLimit } from "@/lib/rate-limit";
import { parseInput } from "@/lib/validation/common";
import { loginSchema } from "@/lib/validation/workflows";

type LocalAuthAccount = {
  kind: "demo" | "customer";
  id: string;
  email: string;
  password: string;
  name: string;
};

function localAuthAccounts(): LocalAuthAccount[] {
  const accounts = getDemoLoginAccounts();
  return [
    {
      kind: "demo",
      ...accounts.demo,
    },
    {
      kind: "customer",
      ...accounts.customer,
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
  // El modo demo local es imposible en producción (`src/lib/env.ts` lanza si se
  // activa), así que ahí se afloja el límite: la suite E2E autentica una vez
  // por caso y agotaba los 10 intentos a mitad de ejecución.
  const limit = takeRateLimit(`login:${clientAddress(request)}`, {
    limit: isAuthDemoMode() ? 200 : 10,
    windowMs: 15 * 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
  let email: string; let password: string;
  try { ({ email, password } = parseInput(loginSchema, await request.json().catch(() => ({})))); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Credenciales inválidas" }, { status: 400 }); }

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

    // Cerrar sesión previa (demo u otro usuario Supabase) antes del login explícito.
    await supabase.auth.signOut();
    appendClearAuthCookies(response);

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
