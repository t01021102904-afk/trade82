"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/badge";

type VerificationRequest = {
  id: string;
  status: string;
  documentFilename: string | null;
  createdAt: string;
  company: {
    legalName: string;
    companyRole: string;
    website: string;
    businessAddress: string;
    owner: { email: string };
    sellerProfile: { koreanBusinessRegistrationNumber: string } | null;
  };
};

type PendingReview = {
  id: string;
  rating: number;
  reviewTitle: string | null;
  reviewText: string;
  reviewerCompany: { legalName: string; companyRole: string };
  reviewedCompany: { legalName: string; tradeName: string | null; companyRole: string };
};

type AnonymousReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerCompanyRole: string;
  reviewedCompany: { legalName: string; tradeName: string | null; companyRole: string };
};

export function AdminVerifications() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [companyReviews, setCompanyReviews] = useState<AnonymousReview[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const [verificationResponse, reviewResponse] = await Promise.all([
      fetch("/api/admin/verifications"),
      fetch("/api/admin/company-reviews"),
    ]);
    if (!verificationResponse.ok || !reviewResponse.ok) {
      setError("Unable to load the admin review queue.");
      return;
    }
    const verificationResult = (await verificationResponse.json()) as {
      requests: VerificationRequest[];
      reviews: PendingReview[];
    };
    const reviewResult = (await reviewResponse.json()) as {
      reviews: AnonymousReview[];
    };
    setRequests(verificationResult.requests);
    setReviews(verificationResult.reviews);
    setCompanyReviews(reviewResult.reviews);
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      const [verificationResponse, reviewResponse] = await Promise.all([
        fetch("/api/admin/verifications"),
        fetch("/api/admin/company-reviews"),
      ]);
      if (!active) return;
      if (!verificationResponse.ok || !reviewResponse.ok) {
        setError("Unable to load the admin review queue.");
        return;
      }
      const verificationResult = (await verificationResponse.json()) as {
        requests: VerificationRequest[];
        reviews: PendingReview[];
      };
      const reviewResult = (await reviewResponse.json()) as {
        reviews: AnonymousReview[];
      };
      setRequests(verificationResult.requests);
      setReviews(verificationResult.reviews);
      setCompanyReviews(reviewResult.reviews);
    })();

    return () => {
      active = false;
    };
  }, []);

  async function reviewCompany(
    requestId: string,
    verificationStatus: "verified" | "rejected",
  ) {
    const response = await fetch("/api/admin/verifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, verificationStatus }),
    });
    if (response.ok) await load();
  }

  async function openVerificationDocument(requestId: string) {
    setError("");
    const response = await fetch(
      `/api/storage/verification-documents/${requestId}`,
    );
    const result = (await response.json().catch(() => null)) as
      | { signedUrl?: string; error?: string }
      | null;
    if (!response.ok || !result?.signedUrl) {
      setError(result?.error ?? "Unable to open verification document.");
      return;
    }
    window.open(result.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function moderateReview(reviewId: string, approved: boolean) {
    const response = await fetch("/api/admin/verifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", reviewId, approved }),
    });
    if (response.ok) await load();
  }

  async function deleteAnonymousReview(reviewId: string) {
    const response = await fetch(`/api/company-reviews/${reviewId}`, {
      method: "DELETE",
    });
    if (response.ok) await load();
  }

  return (
    <div className="grid gap-8">
      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
      <section>
        <h2 className="text-xl font-semibold text-zinc-950">Company profile review requests</h2>
        <div className="mt-4 grid gap-4">
          {requests.map((item) => (
            <article key={item.id} className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-5 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex gap-2"><h3 className="font-semibold text-zinc-950">{item.company.legalName}</h3><Badge tone="amber">{item.status.replace("_", " ")}</Badge><Badge>{item.company.companyRole}</Badge></div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Email</dt><dd>{item.company.owner.email}</dd></div><div><dt className="text-zinc-500">Website</dt><dd>{item.company.website}</dd></div><div><dt className="text-zinc-500">Address</dt><dd>{item.company.businessAddress}</dd></div><div><dt className="text-zinc-500">Document</dt><dd>{item.documentFilename ? <button type="button" onClick={() => void openVerificationDocument(item.id)} className="font-medium text-blue-700 hover:underline">Open {item.documentFilename}</button> : "Not uploaded"}</dd></div></dl>
              </div>
              <div className="flex gap-2"><button onClick={() => void reviewCompany(item.id, "verified")} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white">Approve</button><button onClick={() => void reviewCompany(item.id, "rejected")} className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700">Reject</button></div>
            </article>
          ))}
          {!requests.length ? <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">No company requests.</p> : null}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-zinc-950">Pending deal reviews</h2>
        <div className="mt-4 grid gap-4">
          {reviews.map((review) => <article key={review.id} className="rounded-lg border border-zinc-200 bg-white p-5"><div className="flex flex-wrap gap-2"><Badge tone="blue">{review.rating}/5</Badge><Badge>{review.reviewerCompany.legalName} → {review.reviewedCompany.legalName}</Badge></div><p className="mt-3 text-sm text-zinc-700">{review.reviewText}</p><div className="mt-4 flex gap-2"><button onClick={() => void moderateReview(review.id, true)} className="rounded-md bg-zinc-950 px-3 py-2 text-sm text-white">Approve</button><button onClick={() => void moderateReview(review.id, false)} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700">Hide</button></div></article>)}
          {!reviews.length ? <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">No pending reviews.</p> : null}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-zinc-950">Anonymous company reviews</h2>
        <div className="mt-4 grid gap-4">
          {companyReviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">{review.rating}/5</Badge>
                <Badge>{review.reviewedCompany.tradeName || review.reviewedCompany.legalName}</Badge>
                <Badge tone="amber">{review.reviewerCompanyRole}</Badge>
              </div>
              <p className="mt-3 text-sm text-zinc-700">{review.comment}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">{new Date(review.createdAt).toLocaleDateString()}</p>
                <button
                  onClick={() => void deleteAnonymousReview(review.id)}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {!companyReviews.length ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
              No anonymous reviews.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
