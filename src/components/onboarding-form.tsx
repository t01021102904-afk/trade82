"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { withLocale } from "@/lib/i18n";

type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "url" | "textarea" | "select" | "file";
  options?: string[];
  optional?: boolean;
};

const buyerFields: Field[] = [
  { name: "companyName", label: "Company name" },
  { name: "email", label: "Work email", type: "email" },
  { name: "website", label: "Company website", type: "url" },
  { name: "businessAddress", label: "Business address", type: "textarea" },
  {
    name: "buyerType",
    label: "Buyer role",
    type: "select",
    options: ["Importer", "Distributor", "Retailer", "Online Seller", "Department Store Buyer"],
  },
  { name: "purchasingCategories", label: "Purchasing categories", type: "textarea" },
  { name: "estimatedMonthlyOrderVolume", label: "Estimated monthly order volume" },
  {
    name: "profileLink",
    label: "LinkedIn or professional profile",
    type: "url",
    optional: true,
  },
];

const sellerFields: Field[] = [
  { name: "companyName", label: "Company name" },
  { name: "businessRegistrationNumber", label: "Korean business registration number" },
  { name: "representativeName", label: "Representative name" },
  { name: "businessAddress", label: "Business address", type: "textarea" },
  { name: "email", label: "Company email", type: "email" },
  { name: "website", label: "Website", type: "url" },
  { name: "exportExperience", label: "Export experience", type: "textarea" },
  { name: "productCategories", label: "Product category", type: "textarea" },
  {
    name: "certificateFileName",
    label: "Business registration certificate",
    type: "file",
  },
];

export function OnboardingForm({ kind }: { kind: "buyer" | "seller" }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const fields = kind === "buyer" ? buyerFields : sellerFields;
  const initialState = useMemo(
    () =>
      fields.reduce<Record<string, string>>((accumulator, field) => {
        accumulator[field.name] = "";
        return accumulator;
      }, {}),
    [fields],
  );
  const [form, setForm] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [verificationDocument, setVerificationDocument] =
    useState<File | null>(null);

  function updateField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    const categories = (
      kind === "seller" ? form.productCategories : form.purchasingCategories
    )
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const companyResponse = await fetch("/api/account/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      companyRole: kind,
      legalName: form.companyName,
      useDefaultLogo: true,
      website: form.website,
      country: kind === "seller" ? "South Korea" : "United States",
      city: "",
      stateOrProvince: "",
      businessAddress: form.businessAddress,
      description:
        kind === "seller"
          ? form.exportExperience
          : "American buyer sourcing export-ready Korean products.",
      categories,
      sellerProfile:
        kind === "seller"
          ? {
              koreanBusinessRegistrationNumber:
                form.businessRegistrationNumber,
              representativeName: form.representativeName,
              exportExperience: form.exportExperience,
              exportCountries: ["United States"],
              productCategories: categories,
              minimumOrderQuantity: "",
              leadTime: "",
              certifications: [],
              shippingTerms: [],
              paymentTerms: [],
              factoryOrDistributorStatus: "factory",
            }
          : undefined,
      buyerProfile:
        kind === "buyer"
          ? {
              buyerType:
                form.buyerType === "Distributor"
                  ? "distributor"
                  : form.buyerType === "Retailer"
                    ? "retailer"
                    : form.buyerType === "Online Seller"
                      ? "online_seller"
                      : "importer",
              purchasingCategories: categories,
              targetOrderSize: form.estimatedMonthlyOrderVolume,
              monthlyImportVolume: form.estimatedMonthlyOrderVolume,
              importExperience: "",
              salesChannels: [],
              purchaseTimeline: "",
            }
          : undefined,
      }),
    });
    if (!companyResponse.ok) {
      setError("Unable to save company onboarding.");
      setIsSubmitting(false);
      return;
    }
    const company = (await companyResponse.json()) as { id: string };

    if (kind === "seller" && verificationDocument) {
      const documentForm = new FormData();
      documentForm.set("uploadType", "verification_document");
      documentForm.set("companyId", company.id);
      documentForm.set("file", verificationDocument);
      const uploadResponse = await fetch("/api/uploads", {
        method: "POST",
        body: documentForm,
      });
      if (!uploadResponse.ok) {
        const result = (await uploadResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(result?.error ?? "Unable to upload verification document.");
        setIsSubmitting(false);
        return;
      }
    }

    const response = await fetch("/api/user/onboarding", {
      method: "POST",
    });

    if (!response.ok) {
      setError(t("onboarding.completeError"));
      setIsSubmitting(false);
      return;
    }

    router.push(withLocale("/dashboard", locale));
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-5">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
        {kind === "seller"
          ? t("onboarding.manualReviewNotice")
          : t("onboarding.buyerReviewNotice")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label
            key={field.name}
            className={field.type === "textarea" ? "grid gap-1 text-sm sm:col-span-2" : "grid gap-1 text-sm"}
          >
            <span className="font-medium text-zinc-700">{t(`onboarding.${field.name}`, field.label)}</span>
            {field.type === "textarea" ? (
              <textarea
                required={!field.optional}
                rows={4}
                value={form[field.name]}
                onChange={(event) => updateField(field.name, event.target.value)}
                className="resize-none rounded-md border border-zinc-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            ) : field.type === "select" ? (
              <select
                required={!field.optional}
                value={form[field.name]}
                onChange={(event) => updateField(field.name, event.target.value)}
                className="h-10 rounded-md border border-zinc-200 bg-white px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">{t("onboarding.select")}</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === "file" ? (
              <>
                <input
                  required={!field.optional}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setVerificationDocument(file);
                    updateField(field.name, file?.name ?? "");
                  }}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-700 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm"
                />
                <span className="text-xs leading-5 text-zinc-500">
                  {t("onboarding.privateDocumentNotice")}
                </span>
              </>
            ) : (
              <input
                required={!field.optional}
                type={field.type ?? "text"}
                value={form[field.name]}
                onChange={(event) => updateField(field.name, event.target.value)}
                className="h-10 rounded-md border border-zinc-200 px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            )}
            {field.optional ? (
              <span className="text-xs text-zinc-500">{t("onboarding.optional")}</span>
            ) : null}
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 sm:w-fit"
      >
        {isSubmitting
          ? t("onboarding.savingProfile")
          : kind === "buyer"
            ? t("onboarding.saveBuyer")
            : t("onboarding.saveSeller")}
      </button>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
