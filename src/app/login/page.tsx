import { isAuthDemoMode } from "@/lib/env";
import { getDemoLoginAccounts } from "@/lib/demo-accounts";
import LoginPageClient, { type DemoLoginCredentials } from "@/components/auth/LoginPageClient";
import { getServerPreferences } from "@/lib/preferences/server";

export default async function LoginPage() {
  const demoAccounts: DemoLoginCredentials | undefined = isAuthDemoMode()
    ? getDemoLoginAccounts()
    : undefined;
  /* La página de inicio se resuelve en el servidor: es una cookie, y leerla
     aquí evita que el cliente tenga que hurgar en document.cookie. */
  const { home } = await getServerPreferences();
  return <LoginPageClient demoAccounts={demoAccounts} home={home} />;
}
