import { BackButton } from "@/components/back-button";
import { CompanyProfileSettings } from "@/components/company-profile-settings";
import { ContactProfileSettings } from "@/components/contact-profile-settings";
import { DeleteAccountDangerZone } from "@/components/delete-account-danger-zone";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { AccountRole } from "@/lib/types";

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
          <CompanyProfileSettings />
        )}
      </div>
    </div>
  );
}
