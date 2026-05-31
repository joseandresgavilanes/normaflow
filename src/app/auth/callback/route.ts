import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { syncAuthUser } from "@/lib/auth/sync-auth-user";
import { appendClearAuthCookies } from "@/lib/auth/session-cookies";
import { isSupabaseConfigured } from "@/lib/env";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/auth/set-password";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/confirm${request.nextUrl.search}`);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=supabase_not_configured`);
  }

  const cookieStore = await cookies();
  let response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as object);
            response.cookies.set(name, value, options as object);
          });
        },
      },
    }
  );

  // Evitar mezclar la invitación con una sesión demo o Supabase previa.
  await supabase.auth.signOut();
  appendClearAuthCookies(response);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth/callback]", error?.message);
    const msg = encodeURIComponent(error?.message || "No se pudo validar el enlace.");
    return NextResponse.redirect(`${origin}/login?error=${msg}`);
  }

  try {
    await syncAuthUser({
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata as Record<string, unknown>,
    });
  } catch (e) {
    console.error("[auth/callback] syncAuthUser", e);
  }

  return response;
}
