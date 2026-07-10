"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BuyerRfqForm } from "@/components/buyer-rfq-form";
import { StatusBadge } from "@/components/buyer-rfqs";
import { useI18n } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import { WholesalePriceGate } from "@/components/wholesale-price-gate";
import { withLocale } from "@/lib/i18n";
import {
  canCancelRfq,
  canEditRfq,
  isRfqRecord,
  rfqApiErrorMessage,
  rfqMatchReasonLabel,
  rfqSellerQuoteStatusLabel,
  type RfqRecord,
  type RfqSellerQuote,
  type RfqSuggestedMatch,
} from "@/lib/rfq";

export function BuyerRfqDetail({ id }: { id: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [rfq, setRfq] = useState<RfqRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [selectingSellerId, setSelectingSellerId] = useState<string | null>(null);
  const [openingChatQuoteId, setOpeningChatQuoteId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRfq() {
      try {
        const response = await fetch(`/api/rfqs/${id}`, { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as
          | RfqRecord
          | { error?: string }
          | null;
        if (!active) return;
        if (!response.ok || !isRfqRecord(data)) {
          setError(rfqApiErrorMessage(data, t("rfq.loadFailed")));
          return;
        }
        setRfq(data);
      } catch {
        if (active) setError(t("rfq.loadFailed"));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRfq();
    return () => {
      active = false;
    };
  }, [id, t]);

  async function updateStatus(action: "cancel" | "close") {
    if (action === "cancel" && !window.confirm(t("rfq.confirmCancel"))) return;
    setActionPending(true);
    setError("");
    try {
      const response = await fetch(`/api/rfqs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json().catch(() => null)) as
        | RfqRecord
        | { error?: string }
        | null;
      if (!response.ok || !isRfqRecord(data)) {
        setError(rfqApiErrorMessage(data, t("rfq.actionFailed")));
        return;
      }
      setRfq(data);
      router.refresh();
    } catch {
      setError(t("rfq.actionFailed"));
    } finally {
      setActionPending(false);
    }
  }

  async function selectSeller(match: RfqSuggestedMatch) {
    const sellerCompanyId = match.product.sellerId;
    setSelectingSellerId(sellerCompanyId);
    setError("");
    try {
      const response = await fetch(`/api/rfqs/${id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: match.productId,
          sellerCompanyId,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | RfqRecord
        | { error?: string }
        | null;
      if (!response.ok || !isRfqRecord(data)) {
        setError(rfqApiErrorMessage(data, t("rfq.selectSellerFailed")));
        return;
      }
      setRfq(data);
      router.refresh();
    } catch {
      setError(t("rfq.selectSellerFailed"));
    } finally {
      setSelectingSellerId(null);
    }
  }

  async function openQuoteChat(quote: RfqSellerQuote) {
    setOpeningChatQuoteId(quote.id);
    setError("");
    try {
      const response = await fetch(`/api/rfqs/${id}/quotes/${quote.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = (await response.json().catch(() => null)) as
        | { rfq?: RfqRecord; messageRoute?: string; error?: string }
        | null;
      if (!response.ok || !data?.rfq || !isRfqRecord(data.rfq)) {
        setError(rfqApiErrorMessage(data, t("rfq.chatFailed")));
        return;
      }
      setRfq(data.rfq);
      router.push(withLocale(data.messageRoute ?? "/messages", locale));
    } catch {
      setError(t("rfq.chatFailed"));
    } finally {
      setOpeningChatQuoteId(null);
    }
  }

  if (loading) return <p className="text-sm theme-muted">{t("common.loading")}</p>;

  if (error && !rfq) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (!rfq) return null;

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border p-5 theme-surface-elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold theme-foreground">{rfq.productName}</h2>
              <StatusBadge status={rfq.status} />
            </div>
            <p className="mt-2 text-sm theme-muted">{t("rfq.reviewNotice")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={withLocale("/dashboard/rfqs", locale)}
              className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium theme-secondary-button"
            >
              {t("rfq.backToRfqs")}
            </Link>
            {canCancelRfq(rfq.status) ? (
              <button
                type="button"
                onClick={() => void updateStatus("cancel")}
                disabled={actionPending}
                className="inline-flex h-9 items-center rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                {t("rfq.cancel")}
              </button>
            ) : null}
            {rfq.status === "MATCHING_READY" || rfq.status === "APPROVED" ? (
              <button
                type="button"
                onClick={() => void updateStatus("close")}
                disabled={actionPending}
                className="inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium theme-secondary-button disabled:opacity-60"
              >
                {t("rfq.close")}
              </button>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {rfq.status === "REJECTED" && rfq.adminNote ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {rfq.adminNote}
          </p>
        ) : null}
      </section>

      {canEditRfq(rfq.status) ? (
        <BuyerRfqForm rfq={rfq} mode="edit" />
      ) : (
        <ReadOnlyRfq rfq={rfq} />
      )}

      {rfq.status === "MATCHING_READY" || rfq.status === "APPROVED" ? (
        <>
          <SuggestedMatches
            matches={rfq.suggestedMatches ?? []}
            quotes={rfq.sellerQuotes ?? []}
            selectingSellerId={selectingSellerId}
            onSelectSeller={(match) => void selectSeller(match)}
          />
          <QuoteComparison
            quotes={rfq.sellerQuotes ?? []}
            openingChatQuoteId={openingChatQuoteId}
            onOpenChat={(quote) => void openQuoteChat(quote)}
          />
        </>
      ) : null}
    </div>
  );
}

function ReadOnlyRfq({ rfq }: { rfq: RfqRecord }) {
  const { t } = useI18n();
  const fields = [
    [t("rfq.category"), rfq.category],
    [t("rfq.sourcingType"), rfq.sourcingType],
    [t("rfq.sourcingPurpose"), rfq.sourcingPurpose],
    [t("rfq.quantity"), rfq.quantity],
    [t("rfq.tradeTerms"), rfq.tradeTerms],
    [t("rfq.destinationCountry"), rfq.destinationCountry],
    [
      t("rfq.preferredUnitPrice"),
      rfq.preferredUnitPriceAmount
        ? `${rfq.preferredUnitPriceCurrency ?? ""} ${rfq.preferredUnitPriceAmount}`
        : "",
    ],
    [t("rfq.targetDeliveryDate"), rfq.targetDeliveryDate?.slice(0, 10)],
    [t("rfq.shape"), rfq.shape],
    [t("rfq.capacity"), rfq.capacity],
    [t("rfq.material"), rfq.material],
    [t("rfq.certification"), rfq.certification],
    [t("rfq.feature"), rfq.feature],
  ].filter(([, value]) => Boolean(value));

  return (
    <section className="grid gap-4 rounded-2xl border p-5 theme-surface-elevated">
      <div>
        <h2 className="text-base font-semibold theme-foreground">
          {t("rfq.requestDetails")}
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3 theme-surface">
            <p className="text-xs font-semibold uppercase tracking-wide theme-muted">
              {label}
            </p>
            <p className="mt-1 text-sm theme-foreground">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-4 theme-surface">
        <p className="text-xs font-semibold uppercase tracking-wide theme-muted">
          {t("rfq.details")}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 theme-foreground">
          {rfq.details}
        </p>
      </div>
    </section>
  );
}

function SuggestedMatches({
  matches,
  quotes,
  selectingSellerId,
  onSelectSeller,
}: {
  matches: RfqSuggestedMatch[];
  quotes: RfqSellerQuote[];
  selectingSellerId: string | null;
  onSelectSeller: (match: RfqSuggestedMatch) => void;
}) {
  const { locale, t } = useI18n();
  const selectedSellerIds = new Set(quotes.map((quote) => quote.sellerCompanyId));

  return (
    <section className="grid gap-4 rounded-2xl border p-5 theme-surface-elevated">
      <div>
        <h2 className="text-base font-semibold theme-foreground">
          {t("rfq.suggestedMatches")}
        </h2>
        <p className="mt-1 text-sm theme-muted">{t("rfq.reviewNotice")}</p>
      </div>

      {matches.length ? (
        <div className="grid gap-3">
          {matches.map((match) => {
            const product = match.product;
            const selected = selectedSellerIds.has(product.sellerId);
            const selecting = selectingSellerId === product.sellerId;
            return (
              <article
                key={match.id}
                className="grid gap-4 rounded-xl border p-3 theme-surface md:grid-cols-[120px_1fr]"
              >
                <Link
                  href={withLocale(`/products/${product.id}`, locale)}
                  className="block"
                >
                  <ProductImage
                    urls={[product.imagePlaceholder, ...(product.imageUrls ?? [])]}
                    alt={product.name}
                    sizes="120px"
                    className="aspect-square rounded-lg"
                    imageClassName="bg-white object-contain p-2"
                    placeholderLabel={t("dashboard.noProductImage")}
                  />
                </Link>
                <div className="grid min-w-0 gap-3">
                  <div className="min-w-0">
                    <Link href={withLocale(`/products/${product.id}`, locale)}>
                      <h3 className="line-clamp-2 text-sm font-semibold theme-foreground hover:text-[var(--accent-foreground)]">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="mt-1 text-xs theme-muted">
                      {product.sellerName} · {product.category}
                    </p>
                  </div>
                  <div className="grid gap-1 text-sm">
                    <WholesalePriceGate
                      value={product.wholesalePrice}
                      valueClassName="font-semibold theme-foreground"
                      gateClassName="text-sm"
                    />
                    <p className="text-xs theme-muted">
                      {t("rfq.moq")}: {product.moq || t("rfq.moqOnInquiry")}
                    </p>
                  </div>
                  {match.reasons.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {match.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full border px-2 py-0.5 text-[11px] font-medium theme-surface-muted theme-foreground"
                        >
                          {rfqMatchReasonLabel(reason, locale)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={withLocale(`/products/${product.id}`, locale)}
                      className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold theme-primary-button"
                    >
                      {t("rfq.viewProduct")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => onSelectSeller(match)}
                      disabled={selected || selecting}
                      className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium theme-secondary-button disabled:cursor-default disabled:opacity-70"
                    >
                      {selected
                        ? t("rfq.selected")
                        : selecting
                          ? t("rfq.selecting")
                          : t("rfq.selectSeller")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border p-5 text-sm theme-surface">
          <p className="theme-muted">{t("rfq.noSuggestedMatches")}</p>
        </div>
      )}
    </section>
  );
}

function QuoteComparison({
  quotes,
  openingChatQuoteId,
  onOpenChat,
}: {
  quotes: RfqSellerQuote[];
  openingChatQuoteId: string | null;
  onOpenChat: (quote: RfqSellerQuote) => void;
}) {
  const { locale, t } = useI18n();

  return (
    <section className="grid gap-4 rounded-2xl border p-5 theme-surface-elevated">
      <div>
        <h2 className="text-base font-semibold theme-foreground">
          {t("rfq.quoteComparison")}
        </h2>
        <p className="mt-1 text-sm theme-muted">{t("rfq.quoteComparisonSubtitle")}</p>
      </div>

      {quotes.length ? (
        <div className="overflow-x-auto rounded-xl border theme-surface">
          <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
            <thead className="border-b theme-surface-muted">
              <tr className="text-xs font-semibold uppercase tracking-wide theme-muted">
                <th className="px-4 py-3">{t("rfq.seller")}</th>
                <th className="px-4 py-3">{t("rfq.product")}</th>
                <th className="px-4 py-3">{t("rfq.unitPrice")}</th>
                <th className="px-4 py-3">{t("rfq.moq")}</th>
                <th className="px-4 py-3">{t("rfq.leadTime")}</th>
                <th className="px-4 py-3">{t("rfq.incoterms")}</th>
                <th className="px-4 py-3">{t("rfq.sample")}</th>
                <th className="px-4 py-3">{t("rfq.privateLabel")}</th>
                <th className="px-4 py-3">{t("rfq.quoteStatus")}</th>
                <th className="px-4 py-3">{t("rfq.chat")}</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 align-middle">
                    <div className="max-w-[180px]">
                      <p className="truncate font-medium theme-foreground">
                        {quote.sellerName}
                      </p>
                      {quote.status === "REQUESTED" ? (
                        <p className="mt-1 text-xs theme-muted">
                          {t("rfq.waitingForSellerQuote")}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {quote.product ? (
                      <Link
                        href={withLocale(`/products/${quote.product.id}`, locale)}
                        className="line-clamp-2 max-w-[220px] font-medium theme-foreground hover:text-[var(--accent-foreground)]"
                      >
                        {quote.product.name}
                      </Link>
                    ) : (
                      <span className="theme-muted">{t("rfq.waiting")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle theme-foreground">
                    {quotePrice(quote, t("rfq.waiting"))}
                  </td>
                  <td className="px-4 py-3 align-middle theme-foreground">
                    {displayValue(quote.moq, t("rfq.waiting"))}
                  </td>
                  <td className="px-4 py-3 align-middle theme-foreground">
                    {displayValue(quote.leadTime, t("rfq.waiting"))}
                  </td>
                  <td className="px-4 py-3 align-middle theme-foreground">
                    {displayValue(quote.incoterms, t("rfq.waiting"))}
                  </td>
                  <td className="px-4 py-3 align-middle theme-foreground">
                    {booleanValue(quote.sampleAvailable, t)}
                  </td>
                  <td className="px-4 py-3 align-middle theme-foreground">
                    {booleanValue(quote.privateLabelAvailable, t)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium theme-surface-muted theme-foreground">
                      {rfqSellerQuoteStatusLabel(quote.status, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <button
                      type="button"
                      onClick={() => onOpenChat(quote)}
                      disabled={openingChatQuoteId === quote.id}
                      className="inline-flex h-8 items-center whitespace-nowrap rounded-md px-2.5 text-xs font-semibold theme-primary-button disabled:opacity-60"
                    >
                      {openingChatQuoteId === quote.id
                        ? t("common.loading")
                        : t("rfq.chatNow")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border p-5 text-sm theme-surface">
          <p className="theme-muted">{t("rfq.quoteEmptyState")}</p>
        </div>
      )}
    </section>
  );
}

function displayValue(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

function quotePrice(quote: RfqSellerQuote, fallback: string) {
  if (!quote.unitPriceAmount) return fallback;
  return `${quote.unitPriceCurrency ?? ""} ${quote.unitPriceAmount}`.trim();
}

function booleanValue(
  value: boolean | null,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (value === true) return t("rfq.yes");
  if (value === false) return t("rfq.no");
  return t("rfq.waiting");
}
