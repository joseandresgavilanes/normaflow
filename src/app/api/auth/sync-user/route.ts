import { NextResponse } from "next/server";
import { syncAuthUser } from "@/lib/auth/sync-auth-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
    }
    await syncAuthUser({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata as Record<string, unknown>,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sync-user]", e);
    return NextResponse.json({ error: "Error al sincronizar usuario" }, { status: 500 });
  }
}
