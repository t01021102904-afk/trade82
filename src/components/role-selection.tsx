"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import { cx } from "@/lib/utils";

type Role = "buyer" | "seller";

const roleCards: Array<{
  role: Role;
  titleKey: string;
  descriptionKey: string;
  buttonKey: string;
}> = [
  {
    role: "buyer",
    titleKey: "onboarding.roleBuyerTitle",
    descriptionKey: "onboarding.roleBuyerDescription",
    buttonKey: "onboarding.continueAsBuyer",
  },
  {
    role: "seller",
    titleKey: "onboarding.roleSellerTitle",
    descriptionKey: "onboarding.roleSellerDescription",
    buttonKey: "onboarding.continueAsSeller",
  },
];

export function RoleSelection() {
  const { isLoaded, user } = useUser();
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [error, setError] = useState("");

  async function chooseRole(role: Role) {
    setPendingRole(role);
    setError("");

    const response = await fetch("/api/user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      setError(t("onboarding.roleError"));
      setPendingRole(null);
      return;
    }

    await user?.reload();
    router.push(withLocale(`/onboarding/${role}`, locale));
  }

  if (!isLoaded) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 md:grid-cols-2">
        {roleCards.map((card) => {
          const loading = pendingRole === card.role;

          return (
            <article
              key={card.role}
              className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div>
                <h2 className="text-2xl font-semibold text-zinc-950">
                  {t(card.titleKey)}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {t(card.descriptionKey)}
                </p>
              </div>
              <button
                type="button"
                disabled={pendingRole !== null}
                onClick={() => void chooseRole(card.role)}
                className={cx(
                  "inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium text-white transition",
                  loading ? "bg-blue-700" : "bg-zinc-950 hover:bg-blue-700",
                  pendingRole !== null ? "cursor-wait opacity-80" : "",
                )}
              >
                {loading ? t("onboarding.savingRole") : t(card.buttonKey)}
              </button>
            </article>
          );
        })}
      </div>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
