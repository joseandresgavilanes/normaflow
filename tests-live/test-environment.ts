/**
 * Live security tests are deliberately opt-in and can only use explicitly
 * named TEST_* credentials. This prevents an inherited production .env from
 * becoming the target of a destructive fixture run.
 */
const CONFIRMATION = "isolated";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value || value.includes("...") || value.includes("xxxxxxxx")) {
    throw new Error(`La suite de seguridad requiere ${name} con un valor real del entorno de testing.`);
  }
  return value;
}

function connectionTarget(value: string): string {
  const at = value.lastIndexOf("@");
  return (at >= 0 ? value.slice(at + 1) : value).replace(/\/$/, "");
}

export function getLiveTestEnvironment() {
  if (process.env.LIVE_TEST_ALLOW_MUTATIONS !== "true" || process.env.NORMAFLOW_TEST_ENV !== CONFIRMATION) {
    throw new Error("La suite live solo se ejecuta con LIVE_TEST_ALLOW_MUTATIONS=true y NORMAFLOW_TEST_ENV=isolated.");
  }

  const databaseUrl = required("TEST_DATABASE_URL");
  const directUrl = required("TEST_DIRECT_URL");
  const supabaseUrl = required("TEST_SUPABASE_URL");
  const normalDatabaseUrl = process.env.DATABASE_URL?.trim();
  const normalDirectUrl = process.env.DIRECT_URL?.trim();
  const normalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (normalDatabaseUrl && connectionTarget(databaseUrl) === connectionTarget(normalDatabaseUrl)) {
    throw new Error("TEST_DATABASE_URL comparte el mismo target que DATABASE_URL; el entorno de testing debe ser exclusivo.");
  }
  if (normalDirectUrl && connectionTarget(directUrl) === connectionTarget(normalDirectUrl)) {
    throw new Error("TEST_DIRECT_URL comparte el mismo target que DIRECT_URL; el entorno de testing debe ser exclusivo.");
  }
  if (normalSupabaseUrl && supabaseUrl === normalSupabaseUrl) {
    throw new Error("TEST_SUPABASE_URL no puede ser el mismo proyecto Supabase del entorno normal.");
  }

  return {
    databaseUrl,
    directUrl,
    supabaseUrl,
    supabaseAnonKey: required("TEST_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("TEST_SUPABASE_SERVICE_ROLE_KEY"),
  };
}
