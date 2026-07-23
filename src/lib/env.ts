export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const REJECTED_SECRET_VALUES = new Set([
  "normaflow-dev-change-me",
  "change-me",
  "changeme",
  "secret",
  "default",
  "password",
  "opcional-si-no-usas-nexauth-secret",
]);

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isTruthy(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function assertStrongSecret(value: string | undefined, name: string): asserts value is string {
  const normalized = value?.trim();
  if (!normalized || normalized.length < 32) {
    throw new Error(`${name} debe tener al menos 32 caracteres aleatorios.`);
  }
  const lower = normalized.toLowerCase();
  if (
    REJECTED_SECRET_VALUES.has(lower) ||
    lower.includes("change-me") ||
    lower.includes("placeholder") ||
    lower.includes("genera-un-secreto") ||
    lower.includes("example")
  ) {
    throw new Error(`${name} contiene un valor por defecto o de ejemplo y no puede usarse.`);
  }
}

/**
 * Demo is intentionally a local/test-only capability. Never use a public
 * client flag as an authorization decision: production fails closed instead.
 */
export function validateProductionSecurityConfig(env: Record<string, string | undefined> = process.env, production = isProduction()): void {
  if (!production) return;

  if (isTruthy(env.AUTH_DEMO_MODE) || isTruthy(env.NEXT_PUBLIC_AUTH_DEMO_MODE)) {
    throw new Error("AUTH_DEMO_MODE y NEXT_PUBLIC_AUTH_DEMO_MODE deben estar desactivados en producción.");
  }

  for (const [name, value] of [
    ["NEXTAUTH_SECRET", env.NEXTAUTH_SECRET],
    ["DEMO_SESSION_SECRET", env.DEMO_SESSION_SECRET],
    ["CRON_SECRET", env.CRON_SECRET],
  ] as const) {
    if (value) assertStrongSecret(value, name);
  }
}

export function assertProductionSecurityConfig(): void {
  validateProductionSecurityConfig();
}

export function isAuthDemoMode(): boolean {
  assertProductionSecurityConfig();
  // Only the server-side flag can enable demo. The public flag is informational
  // and must match it in non-production to avoid a split demo/live UI.
  const enabled = !isProduction() && isTruthy(process.env.AUTH_DEMO_MODE);
  if (!isProduction() && isTruthy(process.env.NEXT_PUBLIC_AUTH_DEMO_MODE) !== enabled) {
    throw new Error("NEXT_PUBLIC_AUTH_DEMO_MODE debe coincidir con AUTH_DEMO_MODE fuera de producción.");
  }
  return enabled;
}

export function sessionSecret(): string {
  if (!isAuthDemoMode()) {
    throw new Error("El secreto de sesión demo solo puede solicitarse en modo demo local.");
  }
  const secret = process.env.DEMO_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  assertStrongSecret(secret, "DEMO_SESSION_SECRET");
  return secret;
}
