export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isAuthDemoMode(): boolean {
  return (
    process.env.AUTH_DEMO_MODE === "true" || process.env.NEXT_PUBLIC_AUTH_DEMO_MODE === "true"
  );
}

export function sessionSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.DEMO_SESSION_SECRET || "normaflow-dev-change-me";
}
