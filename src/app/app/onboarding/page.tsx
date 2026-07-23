import { getAppContext } from "@/lib/app-context";
import { getOnboardingPayload, type OnboardingPayload } from "@/lib/server-queries";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export const metadata = { title: "Configura tu workspace | NormaFlow" };

export default async function OnboardingPage() {
  const ctx = await getAppContext();
  let payload: OnboardingPayload | null = null;
  if (ctx?.mode === "live") {
    try {
      payload = await getOnboardingPayload();
    } catch (error) {
      console.error("[onboarding] payload failed:", error);
    }
  }
  return <OnboardingWizard initial={payload} userName={ctx?.user.name ?? ""} needsOrganization={ctx?.mode === "needs_organization"} />;
}
