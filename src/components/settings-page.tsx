import { BackButton } from "@/components/back-button";
import { CompanyProfileSettings } from "@/components/company-profile-settings";
import { ContactProfileSettings } from "@/components/contact-profile-settings";
import { DeleteAccountDangerZone } from "@/components/delete-account-danger-zone";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale } from "@/lib/i18n";

export function SettingsPage({
  locale,
  mode,
}: {
  locale: Locale;
  mode: "profile" | "company";
}) {
  const messages = getDictionary(locale);
  const profile = mode === "profile";
  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <BackButton fallbackHref="/dashboard" />
        <SectionHeader
          label={messages.settings.accountSettings}
          title={
            profile
              ? messages.settings.editContactProfile
              : messages.settings.editCompanyProfile
          }
          description={
            profile
              ? messages.settings.contactProfileDescription
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
