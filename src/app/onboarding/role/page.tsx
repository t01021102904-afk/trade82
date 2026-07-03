import { RolePageContent } from "@/components/role-page";
import { requireOnboardingEntry } from "@/lib/require-auth";

export default async function RoleOnboardingPage() {
  await requireOnboardingEntry("/onboarding/role");

  return <RolePageContent locale="en" />;
}
