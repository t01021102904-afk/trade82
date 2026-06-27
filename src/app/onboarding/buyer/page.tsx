import { OnboardingForm } from "@/components/onboarding-form";
import { SectionHeader } from "@/components/section-header";
import { getDictionary } from "@/lib/i18n";
import { requireOnboardingRole } from "@/lib/require-auth";

export default async function BuyerOnboardingPage() {
  await requireOnboardingRole("/onboarding/buyer", "buyer");
  const messages = getDictionary("en");
  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={messages.onboarding.buyerLabel}
          title={messages.onboarding.buyerTitle}
          description={messages.onboarding.buyerDescription}
        />
        <OnboardingForm kind="buyer" />
      </div>
    </div>
  );
}
