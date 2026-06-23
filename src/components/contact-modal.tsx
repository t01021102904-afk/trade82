"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";
import type { Buyer, Product, Seller } from "@/lib/types";
import { cx } from "@/lib/utils";

type ContactContext =
  | { type: "product"; product?: Product | null }
  | { type: "seller"; seller?: Seller | null }
  | { type: "buyer"; buyer?: Buyer | null };

type InquiryForm = {
  senderName: string;
  senderCompany: string;
  email: string;
  expectedOrderQuantity: string;
  targetDate: string;
  message: string;
};

const emptyForm: InquiryForm = {
  senderName: "",
  senderCompany: "",
  email: "",
  expectedOrderQuantity: "",
  targetDate: "",
  message: "",
};

function contextDetails(context: ContactContext) {
  if (context.type === "product") {
    const product = context.product;
    return {
      valid: Boolean(product?.id && product?.sellerId),
      title: product?.name ?? "Product unavailable",
      company: product?.sellerName ?? "Seller unavailable",
      participantName: product?.sellerName ?? "Seller team",
      participantCompany: product?.sellerName ?? "Seller unavailable",
    };
  }

  if (context.type === "seller") {
    const seller = context.seller;
    return {
      valid: Boolean(seller?.id),
      title: seller?.name ?? "Seller unavailable",
      company: seller?.name ?? "Seller unavailable",
      participantName: seller?.contactPerson ?? "Seller team",
      participantCompany: seller?.name ?? "Seller unavailable",
    };
  }

  const buyer = context.buyer;
  return {
    valid: Boolean(buyer?.id),
    title: buyer?.name ?? "Buyer unavailable",
    company: buyer?.name ?? "Buyer unavailable",
    participantName: buyer?.contactPerson ?? "Buyer team",
    participantCompany: buyer?.name ?? "Buyer unavailable",
  };
}

export function ContactModal({
  context,
  buttonLabel,
  className,
  variant = "primary",
}: {
  context: ContactContext;
  buttonLabel: string;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();
  const [open, setOpen] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [form, setForm] = useState<InquiryForm>(emptyForm);
  const [isVerifiedBuyer, setIsVerifiedBuyer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const redirecting = useRef(false);
  const [errors, setErrors] = useState<Partial<Record<keyof InquiryForm | "context", string>>>({});
  const details = contextDetails(context);
  const isVerified = isVerifiedBuyer;
  const helper =
    context.type === "product"
      ? t("contact.productInquiry")
      : context.type === "seller"
        ? t("contact.sellerInquiry")
        : t("contact.buyerInquiry");

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!isSignedIn || !user) {
      return;
    }

    void fetch("/api/user/context")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          context:
            | {
                companies?: Array<{
                  companyRole: string;
                  verificationStatus: string;
                }>;
              }
            | null,
        ) => {
          setIsVerifiedBuyer(
            context?.companies?.some(
              (company) =>
                company.companyRole === "buyer" &&
                company.verificationStatus === "verified",
            ) ?? false,
          );
        },
      );
  }, [isSignedIn, user]);

  function updateField(field: keyof InquiryForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const nextErrors: typeof errors = {};

    if (!details.valid) nextErrors.context = t("contact.unavailable");
    if (!form.senderName.trim()) nextErrors.senderName = t("contact.requiredField");
    if (!form.senderCompany.trim()) nextErrors.senderCompany = t("contact.requiredField");
    if (!form.email.trim() || !form.email.includes("@")) {
      nextErrors.email = t("contact.validEmail");
    }
    if (!form.message.trim()) nextErrors.message = t("contact.requiredField");

    if (isVerified) {
      if (!form.expectedOrderQuantity.trim()) {
        nextErrors.expectedOrderQuantity = t("contact.requiredField");
      }
      if (!form.targetDate) nextErrors.targetDate = t("contact.requiredField");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !validate()) return;

    const sellerCompanyId =
        context.type === "product"
          ? context.product?.sellerId
          : context.type === "seller"
            ? context.seller?.id
            : null;
    if (!sellerCompanyId) {
      setErrors({ context: t("contact.unavailable") });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerCompanyId,
          productId:
            context.type === "product" ? context.product?.id : undefined,
          message: form.message.trim(),
          quantity: isVerified
            ? form.expectedOrderQuantity.trim()
            : t("contact.limitedInquiry"),
          targetDate: isVerified ? form.targetDate : undefined,
        }),
      });
      if (response.ok) {
        const inquiry = (await response.json()) as { id: string };
        setSuccessId(inquiry.id);
      } else {
        setErrors({ context: t("contact.unavailable") });
      }
    } catch {
      setErrors({ context: t("contact.unavailable") });
    } finally {
      setSubmitting(false);
    }
  }

  function redirectToLogin() {
    if (typeof window === "undefined" || redirecting.current) return;
    redirecting.current = true;
    const currentUrl = `${pathname}${window.location.search}`;
    window.location.assign(
      `${withLocale("/login", locale)}?redirect_url=${encodeURIComponent(currentUrl)}`,
    );
  }

  const modal =
    open ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-3 sm:p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-title"
          className="max-h-[90vh] w-[95%] max-w-[760px] overflow-y-auto rounded-lg bg-white shadow-2xl"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-700">{helper}</p>
              <h2 id="inquiry-title" className="mt-1 truncate text-xl font-semibold text-zinc-950">
                {t("contact.contact")} {details.company}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950"
            >
              {t("contact.close")}
            </button>
          </div>

          {successId ? (
            <div className="p-5 sm:p-7">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                <h3 className="text-lg font-semibold text-emerald-900">
                  {t("contact.inquirySaved")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-emerald-800">
                  {t("contact.inquirySavedText")}
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={withLocale("/messages", locale)}
                    className="inline-flex items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {t("contact.viewMessages")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700"
                  >
                    {t("contact.keepBrowsing")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form noValidate onSubmit={submitInquiry} className="grid gap-5 p-5 sm:p-7">
              {!isVerified ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {t("contact.limitedNotice")}
                </div>
              ) : null}
              {errors.context ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errors.context}
                </p>
              ) : null}
              <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
                <ReadOnlyField label={context.type === "product" ? t("contact.product") : t("contact.profile")} value={details.title} />
                <ReadOnlyField label={t("contact.company")} value={details.company} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t("contact.yourName")} value={form.senderName} error={errors.senderName} onChange={(value) => updateField("senderName", value)} />
                <FormField label={t("contact.company")} value={form.senderCompany} error={errors.senderCompany} onChange={(value) => updateField("senderCompany", value)} />
                <FormField label={t("contact.email")} type="email" value={form.email} error={errors.email} onChange={(value) => updateField("email", value)} />
                {isVerified ? (
                  <FormField label={t("contact.expectedOrderQuantity")} value={form.expectedOrderQuantity} error={errors.expectedOrderQuantity} onChange={(value) => updateField("expectedOrderQuantity", value)} />
                ) : null}
                {isVerified ? (
                  <FormField label={t("contact.targetDate")} type="date" value={form.targetDate} error={errors.targetDate} onChange={(value) => updateField("targetDate", value)} className="sm:col-span-2" />
                ) : null}
                <label className="grid gap-1 text-sm sm:col-span-2">
                  <span className="font-medium text-zinc-700">{t("contact.message")}</span>
                  <textarea
                    value={form.message}
                    onChange={(event) => updateField("message", event.target.value)}
                    rows={5}
                    placeholder={t("contact.messagePlaceholder")}
                    className="w-full resize-none rounded-md border border-zinc-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  {errors.message ? <span className="text-xs text-red-600">{errors.message}</span> : null}
                </label>
              </div>
              <button
                type="submit"
                disabled={!details.valid || submitting}
                className="rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? t("common.loading") : t("contact.sendInquiry")}
              </button>
            </form>
          )}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        type="button"
        disabled={!isLoaded}
        onClick={() => {
          if (!isSignedIn) {
            redirectToLogin();
            return;
          }
          setForm(emptyForm);
          setErrors({});
          setSuccessId(null);
          setOpen(true);
        }}
        className={cx(
          "inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-70",
          variant === "primary"
            ? "bg-zinc-950 text-white hover:bg-blue-700"
            : "border border-zinc-200 bg-white text-zinc-700 hover:border-blue-200 hover:text-blue-700",
          className,
        )}
      >
        {buttonLabel}
      </button>
      {typeof document !== "undefined" && modal
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <input
        value={value}
        readOnly
        className="w-full min-w-0 truncate rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-700"
      />
    </label>
  );
}

function FormField({
  label,
  value,
  onChange,
  error,
  type = "text",
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: "text" | "email" | "date";
  className?: string;
}) {
  return (
    <label className={cx("grid min-w-0 gap-1 text-sm", className)}>
      <span className="font-medium text-zinc-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 rounded-md border border-zinc-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
