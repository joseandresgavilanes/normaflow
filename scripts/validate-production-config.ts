import { loadEnvConfig } from "@next/env";
import { validateProductionSecurityConfig } from "../src/lib/env";
import { assertStripePlanConfiguration } from "../src/lib/stripe";

loadEnvConfig(process.cwd());

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.includes("...") || value.includes("placeholder") || value.includes("xxxxxxxx")) {
    throw new Error(`${name} debe configurarse con un valor real antes de desplegar producción.`);
  }
  return value;
}

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "DIRECT_URL", "NEXT_PUBLIC_APP_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const) required(name);
required("CRON_SECRET");
validateProductionSecurityConfig(process.env, true);
if (!required("NEXT_PUBLIC_APP_URL").startsWith("https://")) throw new Error("NEXT_PUBLIC_APP_URL debe usar HTTPS en producción.");
if (!required("STRIPE_SECRET_KEY").startsWith("sk_live_")) throw new Error("STRIPE_SECRET_KEY debe ser una clave Stripe live en producción.");
assertStripePlanConfiguration();
console.log("Production security configuration is valid.");
