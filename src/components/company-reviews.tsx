"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/badge";
import { useI18n } from "@/components/i18n-provider";
import { useUserContext } from "@/hooks/use-user-context";
import { withLocale } from "@/lib/i18n";
import { safeInternalPath } from "@/lib/url-security";

type CompanyReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerCompanyRole: "seller" | "buyer";
};

export function CompanyReviewsSection({
  companyId,
  companyRole,
}: {
  companyId: string;
  companyRole: "seller" | "buyer";
}) {
  const { context: userContext, isLoaded, user } = useUserContext();
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const [reviews, setReviews] = useState<CompanyReview[]>([]);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canReview, setCanReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isAdmin = userContext?.isAdmin === true;

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      const response = await fetch(`/api/company-reviews?companyId=${companyId}`);
      if (!active) return;

      if (!response.ok) {
        setReviews([]);
        setAverage(0);
        setCanReview(false);
        setLoading(false);
        return;
      }

      const result = (await response.json()) as {
        reviews: CompanyReview[];
        averageRating: number;
        canReview?: boolean;
      };
      if (!active) return;
      setReviews(result.reviews);
      setAverage(result.averageRating);
      setCanReview(result.canReview !== false);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [companyId]);

  async function load() {
    const response = await fetch(`/api/company-reviews?companyId=${companyId}`);
    if (!response.ok) {
      setReviews([]);
      setAverage(0);
      setCanReview(false);
      setLoading(false);
      return;
    }

    const result = (await response.json()) as {
      reviews: CompanyReview[];
      averageRating: number;
      canReview?: boolean;
    };
    setReviews(result.reviews);
    setAverage(result.averageRating);
    setCanReview(result.canReview !== false);
    setLoading(false);
  }

  async function submitReview() {
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/company-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewedCompanyId: companyId, rating, comment }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.ok) {
      setComment("");
      setRating(5);
      await load();
    } else {
      setError(result?.error ?? t("reviews.submitFailed"));
    }
    setSubmitting(false);
  }

  async function deleteReview(reviewId: string) {
    const response = await fetch(`/api/company-reviews/${reviewId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      await load();
    }
  }

  const loginHref = withLocale(
    `/login?redirect_url=${encodeURIComponent(safeInternalPath(pathname || "/", "/"))}`,
    locale,
  );

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">
            {companyRole === "seller"
              ? t("reviews.buyerReviews")
              : t("reviews.sellerReviews")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {loading ? t("common.loading") : `${average.toFixed(1)}/5 · ${reviews.length}`}
          </p>
        </div>
        {canReview && isLoaded && user ? (
          <div className="grid gap-3 sm:min-w-[320px]">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-zinc-700">{t("reviews.rating")}</span>
              <select
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
                className="h-10 rounded-md border border-zinc-200 px-3"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} / 5
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-zinc-700">{t("reviews.comment")}</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                className="rounded-md border border-zinc-200 px-3 py-2"
                placeholder={t("reviews.commentPlaceholder")}
              />
            </label>
            <button
              type="button"
              onClick={() => void submitReview()}
              disabled={submitting || !comment.trim()}
              className="inline-flex w-fit items-center justify-center rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? t("common.saving") : t("reviews.submitAnonymousReview")}
            </button>
          </div>
        ) : canReview ? (
          <a
            href={loginHref}
            className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
          >
            {t("reviews.loginToReview")}
          </a>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {reviews.map((review) => (
          <article
            key={review.id}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="blue">{stars(review.rating)}</Badge>
              <Badge tone="amber">{t("reviews.anonymous")}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-700">{review.comment}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-500">{formatDateUtc(review.createdAt, locale)}</p>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => void deleteReview(review.id)}
                  className="text-xs font-medium text-red-700 hover:text-red-800"
                >
                  {t("reviews.adminDelete")}
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!loading && !reviews.length ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-600">
            {t("reviews.noReviewsYet")}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function stars(value: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <span key={index} className={index < value ? "text-amber-500" : "text-zinc-300"}>
      ★
    </span>
  ));
}

function formatDateUtc(value: string, locale: "en" | "ko") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return locale === "ko" ? `${year}.${month}.${day}` : `${month}/${day}/${year}`;
}
