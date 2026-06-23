import { RoleSelection } from "@/components/role-selection";
import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale } from "@/lib/i18n";

export function RolePageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={messages.onboarding.roleLabel}
          title={messages.onboarding.roleTitle}
          description={messages.onboarding.roleDescription}
        />
        <RoleSelection />
      </div>
    </div>
  );
}
