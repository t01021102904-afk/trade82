import { OnboardingChangeRoleLink } from "@/components/onboarding-change-role-link";
import { OnboardingForm } from "@/components/onboarding-form";
import { OnboardingPageShell } from "@/components/onboarding-page-shell";
import { SellerPayoutOnboardingStep } from "@/components/seller-payout-onboarding-step";
import { getDictionary } from "@/lib/i18n";
import { requireOnboardingRole } from "@/lib/require-auth";

export default async function KoSellerOnboardingPage() {
  const { canChangeRole, hasSellerCompany } = await requireOnboardingRole(
    "/ko/onboarding/seller",
    "seller",
  );
  const messages = getDictionary("ko");
  return (
    <OnboardingPageShell
      backFallbackHref="/onboarding/role"
      label={hasSellerCompany ? messages.onboarding.stepPayoutInformation : messages.onboarding.sellerLabel}
      title={hasSellerCompany ? messages.onboarding.sellerPayoutTitle : messages.onboarding.sellerTitle}
      description={hasSellerCompany ? messages.onboarding.sellerPayoutDescription : messages.onboarding.sellerDescription}
    >
      {canChangeRole ? <OnboardingChangeRoleLink locale="ko" /> : null}
      {hasSellerCompany ? (
        <SellerPayoutOnboardingStep locale="ko" completeOnboardingAfterSave />
      ) : (
        <OnboardingForm kind="seller" />
      )}
    </OnboardingPageShell>
  );
}
