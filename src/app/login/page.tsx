import { isAuthDemoMode } from "@/lib/env";
import { getDemoLoginAccounts } from "@/lib/demo-accounts";
import LoginPageClient, { type DemoLoginCredentials } from "@/components/auth/LoginPageClient";

export default function LoginPage() {
  const demoAccounts: DemoLoginCredentials | undefined = isAuthDemoMode()
    ? getDemoLoginAccounts()
    : undefined;
  return <LoginPageClient demoAccounts={demoAccounts} />;
}
