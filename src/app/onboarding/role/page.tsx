import { RolePageContent } from "@/components/role-page";
import { requireAuth } from "@/lib/require-auth";

export default async function RoleOnboardingPage() {
  await requireAuth("/onboarding/role");

  return <RolePageContent locale="en" />;
}
