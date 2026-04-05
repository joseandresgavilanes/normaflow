import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthDemoMode, isSupabaseConfigured } from "@/lib/env";

const NF_DEMO_COOKIE = "nf_demo";

function looksLikeSignedDemoCookie(raw: string): boolean {
  const i = raw.lastIndexOf(".");
  if (i <= 0 || i === raw.length - 1) return false;
  const payload = raw.slice(0, i);
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    const json = atob(b64 + "=".repeat(padLen));
    const data = JSON.parse(json) as { exp?: number };
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  let authed = false;

  if (isSupabaseConfigured()) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options as object));
          },
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) authed = true;
  }

  if (!authed && isAuthDemoMode()) {
    const raw = request.cookies.get(NF_DEMO_COOKIE)?.value;
    if (raw && looksLikeSignedDemoCookie(raw)) authed = true;
  }

  if (!authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*"],
};
