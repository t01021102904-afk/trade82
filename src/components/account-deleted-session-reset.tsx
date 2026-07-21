"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

export function AccountDeletedSessionReset() {
  const { locale, t } = useI18n();
  const { signOut } = useClerk();
  const [automaticResetFailed, setAutomaticResetFailed] = useState(false);
  const signupPath = withLocale("/signup", locale);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        await signOut();
        if (mounted) {
          window.location.replace(signupPath);
        }
      } catch {
        if (mounted) setAutomaticResetFailed(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [signOut, signupPath]);

  return (
    <section className="mx-auto flex min-h-[520px] max-w-xl items-center px-4 py-12 sm:px-6">
      <div className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-950">
          {t("auth.accountDeletedTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {t("auth.accountDeletedText")}
        </p>
        {automaticResetFailed ? (
          <button
            type="button"
            onClick={() => window.location.replace(signupPath)}
            className="mt-6 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {t("auth.continueToSignup")}
          </button>
        ) : (
          <p className="mt-6 text-sm text-zinc-500" aria-live="polite">
            {t("auth.resettingSession")}
          </p>
        )}
      </div>
    </section>
  );
}
