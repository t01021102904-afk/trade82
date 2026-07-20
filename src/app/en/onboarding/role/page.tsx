import { RolePageContent } from "@/components/role-page";
import { requireOnboardingEntry } from "@/lib/require-auth";

export default async function EnRoleOnboardingPage() {
  const state = await requireOnboardingEntry("/en/onboarding/role");

  return <RolePageContent locale="en" deletionPending={state.deletionPending} />;
}
