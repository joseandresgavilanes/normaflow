import { loadEnvConfig } from "@next/env";
import { assertStrongSecret, validateProductionSecurityConfig } from "../src/lib/env";
import { assertStripePlanConfiguration } from "../src/lib/stripe";

loadEnvConfig(process.cwd());

type RuntimeEnvironment = "development" | "testing" | "staging" | "production";

function runtimeEnvironment(): RuntimeEnvironment {
  const value = (process.env.NORMAFLOW_ENV ?? process.env.NODE_ENV ?? "development").trim().toLowerCase();
  if (["development", "testing", "staging", "production"].includes(value)) return value as RuntimeEnvironment;
  throw new Error("NORMAFLOW_ENV debe ser development, testing, staging o production.");
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.includes("...") || value.includes("xxxxxxxx") || value.includes("[PASSWORD]") || value.includes("[PROJECT-REF]")) {
    throw new Error(`${name} debe configurarse con un valor real para este ambiente.`);
  }
  return value;
}

function requireUrl(name: string, protocol?: string) {
  const value = required(name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} no contiene una URL válida.`);
  }
  if (protocol && parsed.protocol !== protocol) throw new Error(`${name} debe usar ${protocol}.`);
  return value;
}

function validateNonProductionRuntime(mode: Exclude<RuntimeEnvironment, "development" | "testing">) {
  requireUrl("NEXT_PUBLIC_SUPABASE_URL", "https:");
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  required("SUPABASE_SERVICE_ROLE_KEY");
  required("DATABASE_URL");
  required("DIRECT_URL");
  requireUrl("NEXT_PUBLIC_APP_URL", "https:");
  required("STRIPE_SECRET_KEY");
  required("STRIPE_WEBHOOK_SECRET");
  required("STRIPE_PRICE_STARTER");
  required("STRIPE_PRICE_GROWTH");
  required("RESEND_API_KEY");
  required("RESEND_FROM_EMAIL");
  required("CRON_SECRET");

  if (process.env.AUTH_DEMO_MODE?.trim().toLowerCase() === "true" || process.env.NEXT_PUBLIC_AUTH_DEMO_MODE?.trim().toLowerCase() === "true") {
    throw new Error(`El modo demo está prohibido en ${mode}.`);
  }
  assertStrongSecret(process.env.CRON_SECRET, "CRON_SECRET");
  if (process.env.NEXTAUTH_SECRET) assertStrongSecret(process.env.NEXTAUTH_SECRET, "NEXTAUTH_SECRET");
  if (process.env.DEMO_SESSION_SECRET) assertStrongSecret(process.env.DEMO_SESSION_SECRET, "DEMO_SESSION_SECRET");

  const stripeKey = process.env.STRIPE_SECRET_KEY!.trim();
  if (mode === "staging" && !stripeKey.startsWith("sk_test_")) throw new Error("Staging debe usar una clave Stripe test.");
  // Stripe LIVE aún no es obligatorio: se permite desplegar con clave test y
  // billing en modo prueba. Antes de aceptar clientes pagados, configurar
  // STRIPE_SECRET_KEY=sk_live_... (y esta advertencia desaparecerá).
  if (mode === "production" && !stripeKey.startsWith("sk_live_")) console.warn("⚠ ADVERTENCIA: Stripe en modo TEST en producción — el cobro real requiere una clave sk_live_ antes de aceptar clientes pagados.");
  assertStripePlanConfiguration();

  if (process.env.NORMAFLOW_AI_ENABLED?.trim().toLowerCase() === "true") required("ANTHROPIC_API_KEY");
}

function validateTestingRuntime() {
  for (const name of ["TEST_DATABASE_URL", "TEST_DIRECT_URL", "TEST_SUPABASE_URL", "TEST_SUPABASE_ANON_KEY", "TEST_SUPABASE_SERVICE_ROLE_KEY"] as const) required(name);
  requireUrl("TEST_SUPABASE_URL", "https:");
  const normalDb = process.env.DATABASE_URL?.trim();
  const normalSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (normalDb && normalDb === process.env.TEST_DATABASE_URL?.trim()) throw new Error("TEST_DATABASE_URL no puede coincidir con DATABASE_URL.");
  if (normalSupabase && normalSupabase === process.env.TEST_SUPABASE_URL?.trim()) throw new Error("TEST_SUPABASE_URL no puede coincidir con el proyecto normal.");
  if (process.env.AUTH_DEMO_MODE?.trim().toLowerCase() === "true") throw new Error("Los tests live deben usar Supabase Auth, no AUTH_DEMO_MODE.");
}

const mode = runtimeEnvironment();
validateProductionSecurityConfig(process.env, mode === "production");
if (mode === "testing") validateTestingRuntime();
if (mode === "staging" || mode === "production") validateNonProductionRuntime(mode);
console.log(`Runtime configuration is valid for ${mode}.`);
