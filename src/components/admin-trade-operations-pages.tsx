import { AdminBankDirectory } from "@/components/admin-bank-directory";
import { AdminOrderManagement } from "@/components/admin-order-management";
import { AdminPayoutManagement } from "@/components/admin-payout-management";
import { AdminPayoutProfileManagement } from "@/components/admin-payout-profile-management";
import { AdminSettlementManagement } from "@/components/admin-settlement-management";
import { AdminSettlementOperationsSummary } from "@/components/admin-settlement-operations-summary";
import { getDictionary, type Locale } from "@/lib/i18n";

export function AdminOrdersPageContent({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).orders;
  return (
    <main className="mx-auto grid max-w-[1600px] gap-5 px-4 py-8 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.18em] theme-success-text">{copy.adminLabel}</p>
        <h1 className="mt-2 text-2xl font-semibold theme-foreground">{copy.adminTitle}</h1>
        <p className="mt-2 text-sm theme-muted">{copy.adminDescription}</p>
      </header>
      <AdminOrderManagement />
    </main>
  );
}

export function AdminOrderDetailPageContent({ locale, id }: { locale: Locale; id: string }) {
  const copy = getDictionary(locale).orders;
  return (
    <main className="mx-auto grid max-w-[1600px] gap-5 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold theme-foreground">{copy.adminDetailTitle}</h1>
      <AdminOrderManagement selectedId={id} />
    </main>
  );
}

export function AdminPayoutsPageContent({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).payouts;
  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.18em] theme-success-text">{copy.adminLabel}</p>
        <h1 className="mt-2 text-2xl font-semibold theme-foreground">{copy.adminTitle}</h1>
        <p className="mt-2 text-sm theme-muted">{copy.adminDescription}</p>
      </header>
      <AdminPayoutManagement />
    </main>
  );
}

export function AdminSettlementsPageContent({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).settlements;
  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.18em] theme-success-text">{copy.adminLabel}</p>
        <h1 className="mt-2 text-2xl font-semibold theme-foreground">{copy.adminTitle}</h1>
        <p className="mt-2 text-sm theme-muted">{copy.adminDescription}</p>
      </header>
      <AdminSettlementOperationsSummary locale={locale} />
      <AdminSettlementManagement copy={copy} />
    </main>
  );
}

export function AdminPayoutDetailPageContent({ locale, id }: { locale: Locale; id: string }) {
  const copy = getDictionary(locale).payouts;
  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold theme-foreground">{copy.adminDetailTitle}</h1>
      <AdminPayoutManagement selectedId={id} />
    </main>
  );
}

export function AdminPayoutProfilesPageContent({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).payouts;
  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold theme-foreground">{copy.profileTitle}</h1>
        <p className="mt-2 text-sm theme-muted">{copy.profileDescription}</p>
      </header>
      <AdminPayoutProfileManagement />
    </main>
  );
}

export function AdminBanksPageContent({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).payouts;
  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold theme-foreground">{copy.bankDirectoryTitle}</h1>
        <p className="mt-2 text-sm theme-muted">{copy.bankDirectoryDescription}</p>
      </header>
      <AdminBankDirectory />
    </main>
  );
}
