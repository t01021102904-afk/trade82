import { BackButton } from "@/components/back-button";
import { CompanyProfileSettings } from "@/components/company-profile-settings";
import { ContactProfileSettings } from "@/components/contact-profile-settings";
import { DeleteAccountDangerZone } from "@/components/delete-account-danger-zone";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { AccountRole } from "@/lib/types";
import Link from "next/link";

export function SettingsPage({
  locale,
  mode,
  role,
}: {
  locale: Locale;
  mode: "profile" | "company";
  role?: AccountRole;
}) {
  const messages = getDictionary(locale);
  const profile = mode === "profile";
  const buyerProfile = !profile && role === "buyer";
  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/dashboard" />
        <SectionHeader
          label={messages.settings.accountSettings}
          title={
            profile
              ? messages.settings.editContactProfile
              : buyerProfile
                ? messages.settings.editBuyerProfile
              : messages.settings.editCompanyProfile
          }
          description={
            profile
              ? messages.settings.contactProfileDescription
              : buyerProfile
                ? messages.settings.buyerProfileDescription
              : messages.settings.companyProfileDescription
          }
        />
        {profile ? (
          <>
            <ContactProfileSettings />
            <DeleteAccountDangerZone />
          </>
        ) : (
          <>
            <CompanyProfileSettings />
            {(role === "seller" || role === "both") && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  {messages.stripeDirectChargeMerchant.eyebrow}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                  {messages.stripeDirectChargeMerchant.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                  {messages.stripeDirectChargeMerchant.settingsDescription}
                </p>
                <Link
                  href={locale === "ko" ? "/ko/settings/stripe-merchant" : "/settings/stripe-merchant"}
                  className="mt-5 inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:border-emerald-500 hover:text-emerald-700"
                >
                  {messages.stripeDirectChargeMerchant.openSettings}
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
