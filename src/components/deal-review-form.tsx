"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type Deal = {
  id: string;
  contractTitle: string;
  contractValue: string;
  currency: string;
  dealStatus: string;
  buyerCompany: { legalName: string };
  sellerCompany: { legalName: string };
  reviews: Array<{ id: string }>;
};

export function DealReviewForm({ dealId }: { dealId: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [publicValueDisplay, setPublicValueDisplay] = useState("hidden");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/deals")
      .then((response) => (response.ok ? response.json() : []))
      .then((deals: Deal[]) => setDeal(deals.find((item) => item.id === dealId) ?? null));
  }, [dealId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/deals/${dealId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating,
        reviewTitle,
        reviewText,
        publicValueDisplay,
        isPublic: true,
      }),
    });
    if (response.ok) {
      router.push(withLocale("/dashboard", locale));
      return;
    }
    const result = (await response.json()) as { error?: string };
    setError(result.error ?? "Unable to submit review.");
  }

  if (!deal) return <p className="text-sm text-zinc-600">{t("common.loading")}</p>;

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-5 rounded-lg border border-zinc-200 bg-white p-6">
      <div>
        <p className="text-sm text-zinc-500">{deal.contractTitle}</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950">{t("reviews.writeReview")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{deal.buyerCompany.legalName} · {deal.sellerCompany.legalName}</p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-700">{t("reviews.rating")}</span><select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="h-10 rounded-md border border-zinc-200 px-3">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label>
      <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-700">{t("reviews.title")}</span><input value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} className="h-10 rounded-md border border-zinc-200 px-3" /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-700">{t("reviews.review")}</span><textarea required rows={6} value={reviewText} onChange={(event) => setReviewText(event.target.value)} className="rounded-md border border-zinc-200 px-3 py-2" /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-700">{t("reviews.contractPrivacy")}</span><select value={publicValueDisplay} onChange={(event) => setPublicValueDisplay(event.target.value)} className="h-10 rounded-md border border-zinc-200 px-3"><option value="hidden">{t("reviews.hidden")}</option><option value="range">{t("reviews.range")}</option><option value="exact">{t("reviews.exact")}</option></select></label>
      <button className="w-fit rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white">{t("reviews.submit")}</button>
    </form>
  );
}
