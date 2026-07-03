import { RolePageContent } from "@/components/role-page";
import { requireOnboardingEntry } from "@/lib/require-auth";

export default async function KoRoleOnboardingPage() {
  await requireOnboardingEntry("/ko/onboarding/role");

  return <RolePageContent locale="ko" />;
}
