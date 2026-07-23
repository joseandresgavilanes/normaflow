import "server-only";

import { isAuthDemoMode } from "@/lib/env";

export type DemoLoginAccounts = {
  demo: { id: "demo-local"; email: string; password: string; name: string };
  customer: { id: "customer-local"; email: string; password: string; name: string };
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatorio cuando AUTH_DEMO_MODE=true.`);
  return value;
}

/** Local accounts are explicit test/demo configuration, never production defaults. */
export function getDemoLoginAccounts(): DemoLoginAccounts {
  if (!isAuthDemoMode()) throw new Error("Las cuentas demo no están disponibles fuera del modo demo local.");
  return {
    demo: {
      id: "demo-local",
      email: required("DEMO_EMAIL").toLowerCase(),
      password: required("DEMO_PASSWORD"),
      name: process.env.DEMO_NAME?.trim() || "Cuenta demo",
    },
    customer: {
      id: "customer-local",
      email: required("CUSTOMER_EMAIL").toLowerCase(),
      password: required("CUSTOMER_PASSWORD"),
      name: process.env.CUSTOMER_NAME?.trim() || "Cuenta cliente",
    },
  };
}
