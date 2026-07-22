import { redirect } from "next/navigation";

import { PartnerEnrollmentForm } from "@/components/partner-enrollment-form";
import { PartnerProgramLanding } from "@/components/partner-program-landing";
import { getCurrentUserProfile } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { createTranslator, getDictionary, type Locale, withLocale } from "@/lib/i18n";
import { isPartnerProgramEnabled } from "@/lib/partner-program-feature";
import { listActiveKoreanSellerPayoutBanks } from "@/lib/seller-payout-bank-directory";

export async function PartnerJoinPage({
  locale,
  edit = false,
}: {
  locale: Locale;
  edit?: boolean;
}) {
  if (!isPartnerProgramEnabled()) return <PartnerProgramLanding state="unavailable" />;

  const profile = await getCurrentUserProfile();
  if (!profile) {
    const destination = withLocale("/onboarding/partner", locale);
    redirect(`${withLocale("/signup", locale)}?redirect_url=${encodeURIComponent(destination)}`);
  }

  const partner = await getDb().partnerProfile.findFirst({
    where: { userId: profile.id, deletedAt: null },
    select: {
      status: true,
      legalName: true,
      displayName: true,
      contactEmail: true,
      contactPhone: true,
      country: true,
      preferredLanguage: true,
      organizationName: true,
      websiteOrSocialUrl: true,
      promotionDescription: true,
      payoutProfile: {
        select: { bankDirectoryId: true, accountHolder: true },
      },
    },
  });
  if (partner?.status === "ACTIVE" && partner.payoutProfile && !edit) {
    redirect(withLocale("/partner/dashboard", locale));
  }
  if (partner?.status === "SUSPENDED") return <PartnerProgramLanding state="suspended" />;
  if (partner?.status === "PENDING_REVIEW") return <PartnerProgramLanding state="pendingReview" />;
  const banks = await listActiveKoreanSellerPayoutBanks(getDb());
  const t = createTranslator(getDictionary(locale));

  return (
    <main className="bm-grid-surface min-h-[calc(100vh-4rem)] theme-bg">
      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="border p-5 theme-border theme-surface-elevated sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#25825f]">
            TRADE82 PARTNER PROGRAM
          </p>
          <h1 className="mt-2 text-2xl font-semibold theme-foreground">
            {t("partnerProgram.joinTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 theme-muted">
            {t("partnerProgram.joinDescription")}
          </p>
          <div className="mt-7">
            <PartnerEnrollmentForm
              initial={{
                fullName: partner?.legalName ?? profile.displayName,
                email: profile.email,
                phone: partner?.contactPhone ?? profile.phoneNumber,
                preferredLanguage: partner?.preferredLanguage ?? profile.preferredLanguage,
                banks,
                bankDirectoryId: partner?.payoutProfile?.bankDirectoryId ?? "",
                accountHolder: partner?.payoutProfile?.accountHolder ?? profile.displayName,
              }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
