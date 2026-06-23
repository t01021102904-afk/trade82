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
  hasContractFile: boolean;
  contractFileName: string | null;
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
  const [uploadingContract, setUploadingContract] = useState(false);

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

  async function uploadContract(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      setError(t("reviews.contractFileTooLarge"));
      return;
    }
    setUploadingContract(true);
    setError("");
    const formData = new FormData();
    formData.set("uploadType", "contract_file");
    formData.set("dealId", dealId);
    formData.set("file", file);
    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as
      | { filename?: string; error?: string }
      | null;
    if (response.ok) {
      setDeal((current) =>
        current
          ? {
              ...current,
              hasContractFile: true,
              contractFileName: result?.filename ?? file.name,
            }
          : current,
      );
    } else {
      setError(result?.error ?? t("reviews.contractUploadFailed"));
    }
    setUploadingContract(false);
  }

  async function openContract() {
    const response = await fetch(`/api/storage/contracts/${dealId}`);
    const result = (await response.json().catch(() => null)) as
      | { signedUrl?: string; error?: string }
      | null;
    if (!response.ok || !result?.signedUrl) {
      setError(result?.error ?? t("reviews.contractOpenFailed"));
      return;
    }
    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
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
      <div className="grid gap-2 rounded-md border border-zinc-200 p-4">
        <span className="text-sm font-medium text-zinc-700">
          {t("reviews.contractFile")}
        </span>
        {deal.contractFileName ? (
          <button
            type="button"
            onClick={() => void openContract()}
            className="w-fit text-sm font-medium text-blue-700 hover:underline"
          >
            {deal.contractFileName}
          </button>
        ) : null}
        <label className="inline-flex min-h-11 w-fit cursor-pointer items-center rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700">
          {uploadingContract
            ? t("listing.uploading")
            : t("reviews.uploadContractFile")}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            disabled={uploadingContract}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadContract(file);
              event.target.value = "";
            }}
          />
        </label>
        <p className="text-xs text-zinc-500">
          {t("reviews.contractPrivateNotice")}
        </p>
      </div>
      <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-700">{t("reviews.rating")}</span><select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="h-10 rounded-md border border-zinc-200 px-3">{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label>
      <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-700">{t("reviews.title")}</span><input value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} className="h-10 rounded-md border border-zinc-200 px-3" /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-700">{t("reviews.review")}</span><textarea required rows={6} value={reviewText} onChange={(event) => setReviewText(event.target.value)} className="rounded-md border border-zinc-200 px-3 py-2" /></label>
      <label className="grid gap-1 text-sm"><span className="font-medium text-zinc-700">{t("reviews.contractPrivacy")}</span><select value={publicValueDisplay} onChange={(event) => setPublicValueDisplay(event.target.value)} className="h-10 rounded-md border border-zinc-200 px-3"><option value="hidden">{t("reviews.hidden")}</option><option value="range">{t("reviews.range")}</option><option value="exact">{t("reviews.exact")}</option></select></label>
      <button className="w-fit rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white">{t("reviews.submit")}</button>
    </form>
  );
}
