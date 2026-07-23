import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthDemoMode, isSupabaseConfigured } from "@/lib/env";

const NF_DEMO_COOKIE = "nf_demo";

function secure(response: NextResponse) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "upgrade-insecure-requests",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return response;
}

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
    return secure(NextResponse.next());
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
    return secure(NextResponse.redirect(url));
  }

  return secure(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
