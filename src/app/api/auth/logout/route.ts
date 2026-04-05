import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { demoCookieName } from "@/lib/demo-auth";
import { isSupabaseConfigured } from "@/lib/env";

export async function POST(request: NextRequest) {
  let response = NextResponse.json({ ok: true });

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
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options as object);
            });
          },
        },
      }
    );
    await supabase.auth.signOut();
  }

  response.cookies.set(demoCookieName, "", { maxAge: 0, path: "/" });
  response.cookies.set("nf_org", "", { maxAge: 0, path: "/" });
  return response;
}
