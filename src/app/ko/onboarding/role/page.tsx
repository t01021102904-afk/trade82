import { RolePageContent } from "@/components/role-page";
import { requireAuth } from "@/lib/require-auth";

export default async function KoRoleOnboardingPage() {
  await requireAuth("/ko/onboarding/role");

  return <RolePageContent locale="ko" />;
}
