import { RolePageContent } from "@/components/role-page";
import { requireAuth } from "@/lib/require-auth";

export default async function EnRoleOnboardingPage() {
  await requireAuth("/en/onboarding/role");

  return <RolePageContent locale="en" />;
}
