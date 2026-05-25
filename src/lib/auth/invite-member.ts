import { getSupabaseAdmin } from "@/lib/supabase";

export type InviteMemberResult =
  | { ok: true; method: "invite" | "existing_auth_user" }
  | { ok: false; error: string };

export function isSupabaseInviteConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_APP_URL
  );
}

export function getInviteRedirectUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/login`;
}

function isAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("already exists") ||
    m.includes("user already registered") ||
    m.includes("email address has already been registered")
  );
}

/**
 * Opción A: Supabase Auth envía el correo de invitación / establecer contraseña.
 * NormaFlow solo crea User + Membership en Prisma antes de llamar esto.
 */
export async function sendSupabaseMemberInvite(params: {
  email: string;
  name: string;
  organizationName: string;
  redirectTo?: string;
}): Promise<InviteMemberResult> {
  const supabase = getSupabaseAdmin();
  const redirectTo = params.redirectTo ?? getInviteRedirectUrl();

  if (!supabase || !redirectTo) {
    return {
      ok: false,
      error: "Configura SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_APP_URL para enviar invitaciones.",
    };
  }

  const { error } = await supabase.auth.admin.inviteUserByEmail(params.email, {
    data: {
      full_name: params.name,
      organization_name: params.organizationName,
    },
    redirectTo,
  });

  if (!error) {
    return { ok: true, method: "invite" };
  }

  if (isAlreadyRegisteredError(error.message)) {
    return { ok: true, method: "existing_auth_user" };
  }

  if (process.env.NODE_ENV === "development") {
    console.error("[invite] Supabase inviteUserByEmail:", error.message);
  }

  return { ok: false, error: error.message };
}
