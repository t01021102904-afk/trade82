import Link from "next/link";

import { SectionHeader } from "@/components/section-header";
import { getDictionary, type Locale, withLocale } from "@/lib/i18n";

type CardProps = {
  title: string;
  description: string;
  href?: string;
  disabled?: boolean;
  note?: string;
};

function AdminCard({ title, description, href, disabled, note }: CardProps) {
  const inner = (
    <div className="grid h-full gap-2 rounded-lg border p-5 transition theme-surface theme-card-hover">
      <h2 className={`font-semibold ${disabled ? "theme-muted" : "theme-foreground"}`}>{title}</h2>
      <p className="text-sm leading-6 theme-muted">{description}</p>
      {note ? <p className="mt-1 text-xs theme-muted">{note}</p> : null}
    </div>
  );

  if (disabled || !href) return <div className="opacity-60">{inner}</div>;
  return <Link href={href}>{inner}</Link>;
}

export function AdminConsolePageContent({ locale }: { locale: Locale }) {
  const messages = getDictionary(locale);
  const admin = messages.admin;

  return (
    <div className="theme-bg">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label={admin.label}
          title={admin.consoleTitle}
          description={admin.consoleDescription}
        />

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide theme-muted">{admin.companyManagement}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminCard title={admin.companyQueueTitle} description={admin.companyQueueDescription} href={withLocale("/admin/verifications", locale)} />
            <AdminCard title={admin.allCompanies} description={admin.allCompaniesDescription} href={`${withLocale("/admin/companies", locale)}?status=all`} />
            <AdminCard title={admin.sellerCompanies} description={admin.sellerCompaniesDescription} href={`${withLocale("/admin/companies", locale)}?role=seller&status=all`} />
            <AdminCard title={admin.buyerCompanies} description={admin.buyerCompaniesDescription} href={`${withLocale("/admin/companies", locale)}?role=buyer&status=all`} />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide theme-muted">{admin.reviewsContent}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminCard title={admin.dealReviews} description={admin.dealReviewsDescription} href={withLocale("/admin/verifications", locale)} />
            <AdminCard title={admin.companyReviews} description={admin.companyReviewsDescription} href={withLocale("/admin/verifications", locale)} />
            <AdminCard title={messages.rfq.adminReviewTitle} description={messages.rfq.adminReviewDescription} href={withLocale("/admin/rfqs", locale)} />
            <AdminCard title={messages.payments.adminCardTitle} description={messages.payments.adminCardDescription} href={withLocale("/admin/payments", locale)} />
            <AdminCard title={admin.inquiryHistory} description={admin.inquiryHistoryDescription} disabled note={admin.comingLater} />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide theme-muted">{messages.orders.operationsTitle}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminCard title={messages.orders.adminTitle} description={messages.orders.operationsOrdersDescription} href={withLocale("/admin/orders", locale)} />
            <AdminCard title={messages.payouts.adminTitle} description={messages.orders.operationsPayoutsDescription} href={withLocale("/admin/payouts", locale)} />
            <AdminCard title={messages.payouts.profileTitle} description={messages.orders.operationsProfilesDescription} href={withLocale("/admin/payout-profiles", locale)} />
            <AdminCard title={messages.payouts.bankDirectoryTitle} description={messages.orders.operationsBanksDescription} href={withLocale("/admin/banks", locale)} />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide theme-muted">{admin.filesDocuments}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminCard title={admin.privateDocuments} description={admin.privateDocumentsDescription} href={withLocale("/admin/verifications", locale)} />
            <AdminCard title={admin.reportedReviews} description={admin.reportedReviewsDescription} disabled note={admin.comingLater} />
          </div>
        </section>
      </div>
    </div>
  );
}
