"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminCompanyLogo } from "@/components/admin-company-logo";
import { Badge } from "@/components/badge";
import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type RequestFilter = "pending" | "listed" | "rejected" | "all";

type VerificationRequest = {
  id: string;
  status: string;
  adminNote: string | null;
  documentFilename: string | null;
  createdAt: string;
  reviewedAt: string | null;
  company: {
    id: string;
    legalName: string;
    tradeName: string | null;
    companyRole: "seller" | "buyer";
    website: string;
    businessAddress: string;
    country: string;
    stateOrProvince: string;
    city: string;
    description: string;
    categories: string[];
    verificationStatus: string;
    logoOriginalUrl: string | null;
    logoThumbnailUrl: string | null;
    logoUrl: string | null;
    useDefaultLogo: boolean;
    owner: { email: string; displayName: string };
    sellerProfile: {
      koreanBusinessRegistrationNumber: string;
      representativeName: string;
      exportExperience: string;
      exportCountries: string[];
      productCategories: string[];
      minimumOrderQuantity: string;
      leadTime: string;
      shippingTerms: string[];
      paymentTerms: string[];
      factoryOrDistributorStatus: string;
    } | null;
    buyerProfile: {
      buyerType: string;
      purchasingCategories: string[];
      preferredSupplierType: string;
      targetOrderSize: string;
      monthlyImportVolume: string;
      importExperience: string;
      purchaseTimeline: string;
      salesChannels: string[];
    } | null;
    _count: {
      products: number;
      buyerInquiries: number;
      sellerInquiries: number;
    };
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
  const { locale, messages } = useI18n();
  const admin = messages.admin;
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [companyReviews, setCompanyReviews] = useState<AnonymousReview[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("pending");
  const [actionState, setActionState] = useState<Record<string, { pending: boolean; error: string }>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const filteredRequests = useMemo(
    () => requests.filter((request) => requestMatchesFilter(request, requestFilter)),
    [requests, requestFilter],
  );

  async function load() {
    setError("");
    const [verificationResponse, reviewResponse] = await Promise.all([
      fetch(`/api/admin/verifications?filter=${requestFilter}`),
      fetch("/api/admin/company-reviews"),
    ]);
    if (!verificationResponse.ok || !reviewResponse.ok) {
      setError(admin.unableLoadQueue);
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
        fetch(`/api/admin/verifications?filter=${requestFilter}`),
        fetch("/api/admin/company-reviews"),
      ]);
      if (!active) return;
      if (!verificationResponse.ok || !reviewResponse.ok) {
        setError(admin.unableLoadQueue);
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
  }, [admin.unableLoadQueue, requestFilter]);

  async function reviewCompany(
    request: VerificationRequest,
    verificationStatus: "verified" | "rejected",
  ) {
    if (
      verificationStatus === "rejected" &&
      !window.confirm(admin.confirmRejectListing)
    ) {
      return;
    }
    setNotice("");
    setActionState((prev) => ({
      ...prev,
      [request.id]: { pending: true, error: "" },
    }));

    const response = await fetch("/api/admin/verifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: request.id, verificationStatus }),
    });
    const result = (await response.json().catch(() => null)) as
      | { ok?: boolean; verificationStatus?: string; error?: string }
      | null;

    if (!response.ok || !result?.ok) {
      setActionState((prev) => ({
        ...prev,
        [request.id]: {
          pending: false,
          error: result?.error ?? admin.actionFailed,
        },
      }));
      return;
    }

    setRequests((prev) =>
      prev.map((item) =>
        item.id === request.id ||
        (item.company.id === request.company.id && item.status === "pending_review")
          ? {
              ...item,
              status: verificationStatus,
              reviewedAt: new Date().toISOString(),
              company: {
                ...item.company,
                verificationStatus: result.verificationStatus ?? verificationStatus,
              },
            }
          : item,
      ),
    );
    setActionState((prev) => ({
      ...prev,
      [request.id]: { pending: false, error: "" },
    }));
    setSelectedRequest(null);
    setNotice(admin.actionDone);
    setTimeout(() => setNotice(""), 3000);
    void load();
  }

  async function deleteCompany(request: VerificationRequest) {
    if (!window.confirm(admin.confirmDeleteCompanyPermanent)) return;

    setNotice("");
    setActionState((prev) => ({
      ...prev,
      [request.id]: { pending: true, error: "" },
    }));

    const response = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: request.company.id, action: "delete_company" }),
    });
    const result = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (!response.ok || !result?.ok) {
      setActionState((prev) => ({
        ...prev,
        [request.id]: {
          pending: false,
          error: result?.error ?? admin.companyDeleteFailed,
        },
      }));
      return;
    }

    setRequests((prev) =>
      prev.filter((item) => item.company.id !== request.company.id),
    );
    setActionState((prev) => ({
      ...prev,
      [request.id]: { pending: false, error: "" },
    }));
    setSelectedRequest(null);
    setNotice(admin.companyDeleted);
    setTimeout(() => setNotice(""), 3000);
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
      setError(result?.error ?? admin.documentOpenFailed);
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
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p> : null}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">{admin.companyRequests}</h2>
            <p className="mt-1 text-sm text-zinc-500">{admin.companyRequestsHelp}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions(admin).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRequestFilter(option.id)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  requestFilter === option.id
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-blue-200 hover:text-blue-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4">
          {filteredRequests.map((item) => {
            const { label, tone } = requestStatusMeta(item.status, admin);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedRequest(item)}
                className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-5 text-left transition hover:border-blue-200 hover:shadow-sm lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
                  <AdminCompanyLogo
                    companyName={item.company.tradeName || item.company.legalName}
                    logoUrl={
                      item.company.useDefaultLogo
                        ? ""
                        : item.company.logoThumbnailUrl || item.company.logoUrl || item.company.logoOriginalUrl
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <h3 className="font-semibold text-zinc-950">{item.company.tradeName || item.company.legalName}</h3>
                      <Badge tone={tone}>{label}</Badge>
                      <Badge>{roleLabel(item.company.companyRole, admin)}</Badge>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-zinc-500">{admin.email}</dt>
                        <dd className="truncate font-mono text-xs">{item.company.owner.email}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{admin.location}</dt>
                        <dd>{formatLocation(item.company, locale)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{admin.created}</dt>
                        <dd>{formatDateUtc(item.createdAt, locale)}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">{admin.submittedDocument}</dt>
                        <dd>{item.documentFilename || admin.notUploaded}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <span className="self-start rounded-md border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-zinc-700">
                  {admin.reviewDetails}
                </span>
              </button>
            );
          })}
          {!filteredRequests.length ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6">
              <p className="text-sm text-zinc-600">{emptyQueueText(requestFilter, admin)}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={withLocale("/admin/companies", locale)} className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700">{admin.viewAllCompanies}</a>
                <a href={withLocale("/admin", locale)} className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700">{admin.goToAdmin}</a>
              </div>
              <p className="mt-4 text-xs text-zinc-500">{admin.testSubmissionHelp}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-950">{admin.dealReviewsWaiting}</h2>
        <div className="mt-4 grid gap-4">
          {reviews.map((review) => <article key={review.id} className="rounded-lg border border-zinc-200 bg-white p-5"><div className="flex flex-wrap gap-2"><Badge tone="blue">{review.rating}/5</Badge><Badge>{review.reviewerCompany.legalName} → {review.reviewedCompany.legalName}</Badge></div><p className="mt-3 text-sm text-zinc-700">{review.reviewText}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => void moderateReview(review.id, true)} className="rounded-md bg-zinc-950 px-3 py-2 text-sm text-white">{admin.showReview}</button><button type="button" onClick={() => void moderateReview(review.id, false)} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700">{admin.hideReview}</button></div></article>)}
          {!reviews.length ? <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">{admin.noDealReviews}</p> : null}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-950">{admin.companyReviewsTitle}</h2>
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
                <p className="text-xs text-zinc-500">{formatDateUtc(review.createdAt, locale)}</p>
                <button
                  type="button"
                  onClick={() => void deleteAnonymousReview(review.id)}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700"
                >
                  {admin.delete}
                </button>
              </div>
            </article>
          ))}
          {!companyReviews.length ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
              {admin.noCompanyReviews}
            </p>
          ) : null}
        </div>
      </section>

      {selectedRequest ? (
        <CompanyReviewModal
          request={selectedRequest}
          actionState={actionState[selectedRequest.id]}
          onClose={() => setSelectedRequest(null)}
          onOpenDocument={() => void openVerificationDocument(selectedRequest.id)}
          onReview={(status) => void reviewCompany(selectedRequest, status)}
          onDeleteCompany={() => void deleteCompany(selectedRequest)}
        />
      ) : null}
    </div>
  );
}

function CompanyReviewModal({
  request,
  actionState,
  onClose,
  onOpenDocument,
  onReview,
  onDeleteCompany,
}: {
  request: VerificationRequest;
  actionState: { pending: boolean; error: string } | undefined;
  onClose: () => void;
  onOpenDocument: () => void;
  onReview: (status: "verified" | "rejected") => void;
  onDeleteCompany: () => void;
}) {
  const { locale, messages } = useI18n();
  const admin = messages.admin;
  const company = request.company;
  const logoUrl = company.useDefaultLogo
    ? ""
    : company.logoThumbnailUrl || company.logoUrl || company.logoOriginalUrl || "";
  const inquiryCount = company._count.buyerInquiries + company._count.sellerInquiries;
  const { label, tone } = requestStatusMeta(request.status, admin);
  const isPending = actionState?.pending ?? false;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/40 p-4">
      <div className="mx-auto my-8 max-w-5xl rounded-lg bg-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-6">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-zinc-500">{company.legalName.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <h3 className="break-words text-xl font-semibold text-zinc-950">{company.tradeName || company.legalName}</h3>
                <Badge tone={tone}>{label}</Badge>
                <Badge>{roleLabel(company.companyRole, admin)}</Badge>
              </div>
              <p className="mt-1 break-words text-sm text-zinc-500">{company.legalName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
          >
            {admin.backToList}
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="grid gap-6">
            <section>
              <h4 className="font-semibold text-zinc-950">{admin.companyProfile}</h4>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <DetailItem label={admin.legalName} value={company.legalName} />
                <DetailItem label={admin.accountType} value={roleLabel(company.companyRole, admin)} />
                <DetailItem label={admin.email} value={company.owner.email} mono />
                <DetailItem label={admin.website} value={company.website} />
                <DetailItem label={admin.address} value={company.businessAddress} />
                <DetailItem label={admin.location} value={formatLocation(company, locale)} />
                <DetailItem label={admin.created} value={formatDateUtc(request.createdAt, locale)} />
                <DetailItem label={admin.publicListingStatus} value={requestStatusMeta(company.verificationStatus, admin).label} />
              </dl>
              <div className="mt-4">
                <p className="text-sm font-medium text-zinc-500">{admin.companyDescription}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">
                  {company.description || admin.notProvided}
                </p>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-zinc-500">{admin.productCategoryInfo}</p>
                <p className="mt-1 break-words text-sm leading-6 text-zinc-700">
                  {formatList(company.categories, admin.notProvided)}
                </p>
              </div>
            </section>

            {company.sellerProfile ? (
              <section>
                <h4 className="font-semibold text-zinc-950">{admin.sellerInformation}</h4>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <DetailItem label={admin.businessRegistrationNumber} value={company.sellerProfile.koreanBusinessRegistrationNumber} />
                  <DetailItem label={admin.representativeName} value={company.sellerProfile.representativeName} />
                  <DetailItem label={admin.exportExperience} value={company.sellerProfile.exportExperience} />
                  <DetailItem label={admin.exportCountries} value={formatList(company.sellerProfile.exportCountries, admin.notProvided)} />
                  <DetailItem label={admin.productCategories} value={formatList(company.sellerProfile.productCategories, admin.notProvided)} />
                  <DetailItem label={admin.minimumOrderQuantity} value={company.sellerProfile.minimumOrderQuantity} />
                  <DetailItem label={admin.leadTime} value={company.sellerProfile.leadTime} />
                  <DetailItem label={admin.shippingTerms} value={formatList(company.sellerProfile.shippingTerms, admin.notProvided)} />
                  <DetailItem label={admin.paymentTerms} value={formatList(company.sellerProfile.paymentTerms, admin.notProvided)} />
                  <DetailItem label={admin.supplierType} value={company.sellerProfile.factoryOrDistributorStatus} />
                </dl>
              </section>
            ) : null}

            {company.buyerProfile ? (
              <section>
                <h4 className="font-semibold text-zinc-950">{admin.buyerInformation}</h4>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <DetailItem label={admin.buyerType} value={company.buyerProfile.buyerType} />
                  <DetailItem label={admin.purchasingCategories} value={formatList(company.buyerProfile.purchasingCategories, admin.notProvided)} />
                  <DetailItem label={admin.preferredSupplierType} value={company.buyerProfile.preferredSupplierType} />
                  <DetailItem label={admin.targetOrderSize} value={company.buyerProfile.targetOrderSize} />
                  <DetailItem label={admin.monthlyImportVolume} value={company.buyerProfile.monthlyImportVolume} />
                  <DetailItem label={admin.importExperience} value={company.buyerProfile.importExperience} />
                  <DetailItem label={admin.purchaseTimeline} value={company.buyerProfile.purchaseTimeline} />
                  <DetailItem label={admin.salesChannels} value={formatList(company.buyerProfile.salesChannels, admin.notProvided)} />
                </dl>
              </section>
            ) : null}
          </div>

          <aside className="grid content-start gap-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <h4 className="font-semibold text-zinc-950">{admin.reviewSummary}</h4>
              <dl className="mt-4 grid gap-3 text-sm">
                <DetailItem label={admin.products} value={String(company._count.products)} />
                <DetailItem label={admin.inquiries} value={String(inquiryCount)} />
                <DetailItem label={admin.submittedDocument} value={request.documentFilename || admin.notUploaded} />
                <DetailItem label={admin.rejectionReason} value={request.adminNote || admin.noRejectionReason} />
              </dl>
              {request.documentFilename ? (
                <button
                  type="button"
                  onClick={onOpenDocument}
                  className="mt-4 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
                >
                  {admin.openDocument}
                </button>
              ) : null}
            </div>

            {actionState?.error ? (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionState.error}</p>
            ) : null}

            <div className="grid gap-2">
              {request.status !== "verified" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onReview("verified")}
                  className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.makePublic}
                </button>
              ) : null}
              {request.status !== "rejected" ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onReview("rejected")}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isPending ? admin.saving : admin.reject}
                </button>
              ) : null}
              <button
                type="button"
                disabled={isPending}
                onClick={onDeleteCompany}
                className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-wait disabled:opacity-60"
              >
                {isPending ? admin.saving : admin.deletePermanently}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-blue-200 hover:text-blue-700"
              >
                {admin.backToList}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`mt-1 break-words text-zinc-800 ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function filterOptions(
  admin: ReturnType<typeof useI18n>["messages"]["admin"],
): Array<{ id: RequestFilter; label: string }> {
  return [
    { id: "pending", label: admin.filterPending },
    { id: "listed", label: admin.filterListed },
    { id: "rejected", label: admin.filterRejected },
    { id: "all", label: admin.filterAll },
  ];
}

function requestMatchesFilter(request: VerificationRequest, filter: RequestFilter) {
  if (filter === "all") return true;
  if (filter === "listed") return request.status === "verified";
  if (filter === "rejected") return request.status === "rejected";
  return request.status !== "verified" && request.status !== "rejected";
}

function roleLabel(
  role: string,
  admin: ReturnType<typeof useI18n>["messages"]["admin"],
) {
  return role === "seller" ? admin.roleSeller : admin.roleBuyer;
}

function requestStatusMeta(
  status: string,
  admin: ReturnType<typeof useI18n>["messages"]["admin"],
) {
  if (status === "verified") {
    return { label: admin.requestStatusPublic, tone: "green" as const };
  }
  if (status === "rejected") {
    return { label: admin.requestStatusRejected, tone: "red" as const };
  }
  return { label: admin.requestStatusPending, tone: "amber" as const };
}

function emptyQueueText(
  filter: RequestFilter,
  admin: ReturnType<typeof useI18n>["messages"]["admin"],
) {
  if (filter === "pending") return admin.noCompanyRequests;
  if (filter === "listed") return admin.noListedCompanyRequests;
  if (filter === "rejected") return admin.noRejectedCompanyRequests;
  return admin.noAnyCompanyRequests;
}

function formatLocation(
  company: Pick<VerificationRequest["company"], "city" | "stateOrProvince" | "country">,
  locale: "en" | "ko",
) {
  const parts = [company.city, company.stateOrProvince, company.country].filter(Boolean);
  if (!parts.length) return locale === "ko" ? "—" : "—";
  return parts.join(", ");
}

function formatList(values: string[], fallback: string) {
  const filtered = values.map((value) => value.trim()).filter(Boolean);
  return filtered.length ? filtered.join(", ") : fallback;
}

function formatDateUtc(value: string, locale: "en" | "ko") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return locale === "ko" ? `${year}.${month}.${day}` : `${month}/${day}/${year}`;
}
