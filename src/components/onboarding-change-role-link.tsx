import Link from "next/link";

import { withLocale, type Locale } from "@/lib/i18n";

const copy: Record<Locale, string> = {
  en: "Change role",
  ko: "역할 변경",
};

export function OnboardingChangeRoleLink({ locale }: { locale: Locale }) {
  return (
    <div className="flex justify-end">
      <Link
        href={withLocale("/onboarding/role", locale)}
        className="text-sm font-medium theme-muted hover:text-[var(--foreground)] hover:underline"
      >
        {copy[locale]}
      </Link>
    </div>
  );
}
