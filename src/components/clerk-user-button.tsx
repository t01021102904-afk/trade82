"use client";

import { UserButton, useUser } from "@clerk/nextjs";

import { CompanyProfileSettings } from "@/components/company-profile-settings";
import { ContactProfileSettings } from "@/components/contact-profile-settings";
import { useI18n } from "@/components/i18n-provider";
import { ProductManagement } from "@/components/product-management";

export function ClerkUserButton() {
  const { t } = useI18n();
  const { user } = useUser();
  const role = user?.publicMetadata.role;
  const hasCompanyRole =
    role === "seller" || role === "buyer" || role === "both";
  const canManageProducts = role === "seller" || role === "both";

  return (
    <UserButton userProfileMode="modal">
      <UserButton.UserProfilePage
        label={t("settings.professionalInfo")}
        labelIcon={<PageIcon label="I" />}
        url="professional"
      >
        <div className="w-full min-w-0 py-2">
          <p className="mb-5 text-xs font-semibold uppercase text-zinc-500">
            {t("settings.professionalInfo")}
          </p>
          <ContactProfileSettings />
        </div>
      </UserButton.UserProfilePage>
      {hasCompanyRole ? (
        <UserButton.UserProfilePage
          label={t("settings.myCompany")}
          labelIcon={<PageIcon label="C" />}
          url="company"
        >
          <div className="w-full min-w-0 py-2">
            <p className="mb-5 text-xs font-semibold uppercase text-zinc-500">
              {t("settings.marketplace")}
            </p>
            <CompanyProfileSettings />
          </div>
        </UserButton.UserProfilePage>
      ) : null}
      {canManageProducts ? (
        <UserButton.UserProfilePage
          label={t("settings.myProducts")}
          labelIcon={<PageIcon label="P" />}
          url="products"
        >
          <div className="w-full min-w-0 py-2">
            <p className="mb-5 text-xs font-semibold uppercase text-zinc-500">
              {t("settings.marketplace")}
            </p>
            <ProductManagement />
          </div>
        </UserButton.UserProfilePage>
      ) : null}
    </UserButton>
  );
}

function PageIcon({ label }: { label: string }) {
  return (
    <span
      className="flex size-4 items-center justify-center rounded-sm border border-current text-[9px] font-semibold"
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
