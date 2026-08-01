"use client";

import { FileUp, Send, ShieldCheck, XCircle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CometSpinner } from "@/components/ui/comet-spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getDictionary, withLocale, type Locale } from "@/lib/i18n";

type Contact = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  workEmail: string;
  phoneNumber: string;
};
type Application = {
  id: string;
  applicationNumber: string;
  status: string;
  statusReason: string | null;
  legalCompanyName: string;
  tradeName: string | null;
  companyWebsite: string;
  registrationCountry: string;
  brandsHandled: string[];
  annualRevenueRange: string;
  warehouseType: string;
  skuCountRange: string;
  contacts: Contact[];
  businessVerification: Record<string, string> | null;
  operationsProfile: Record<string, unknown> | null;
  settlementProfile: Record<string, unknown> | null;
  documents: Array<{
    id: string;
    documentType: string;
    originalFilename: string;
    reviewStatus: string;
  }>;
  inventorySamples: Array<{
    id: string;
    originalFilename: string;
    reviewStatus: string;
    validRows: number;
    invalidRows: number;
  }>;
  stakeholders: Array<Record<string, unknown>>;
  warehouses: Array<Record<string, unknown>>;
  supplyChains: Array<Record<string, unknown>>;
  brandVerifications: Array<
    Record<string, unknown> & {
      id: string;
      brand: string;
      isActive: boolean;
    }
  >;
  statusHistory: Array<{
    id: string;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
  informationRequests: Array<{
    id: string;
    section: string;
    message: string;
    applicantResponse: string | null;
    respondedAt: string | null;
    resolvedAt: string | null;
  }>;
  progress: { complete: number; total: number; percent: number };
};

type BasicForm = Contact &
  Pick<
    Application,
    | "legalCompanyName"
    | "tradeName"
    | "companyWebsite"
    | "registrationCountry"
    | "annualRevenueRange"
    | "warehouseType"
    | "skuCountRange"
  > & { brandsHandled: string };

const editableStatuses = new Set([
  "DRAFT",
  "ADDITIONAL_INFORMATION_REQUIRED",
  "ADDITIONAL_DOCUMENTS_REQUIRED",
  "INVENTORY_VERIFICATION_REQUIRED",
]);

function initialBasic(application?: Application | null): BasicForm {
  const contact = application?.contacts[0];
  return {
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    jobTitle: contact?.jobTitle ?? "",
    workEmail: contact?.workEmail ?? "",
    phoneNumber: contact?.phoneNumber ?? "",
    legalCompanyName: application?.legalCompanyName ?? "",
    tradeName: application?.tradeName ?? "",
    companyWebsite: application?.companyWebsite ?? "",
    registrationCountry: application?.registrationCountry ?? "",
    brandsHandled: application?.brandsHandled.join("\n") ?? "",
    annualRevenueRange: application?.annualRevenueRange ?? "",
    warehouseType: application?.warehouseType ?? "",
    skuCountRange: application?.skuCountRange ?? "",
  };
}

function statusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "APPROVED") return "default";
  if (["REJECTED", "SUSPENDED"].includes(status)) return "destructive";
  if (["DRAFT", "WITHDRAWN"].includes(status)) return "outline";
  return "secondary";
}

function compactJson(value: unknown) {
  return JSON.stringify(value ?? [], null, 2);
}

function parseJson(value: string, field: string) {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${field} must be a JSON list.`);
  }
}

export function SupplierApplicationStart({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).supplierApplication;
  const router = useRouter();
  const [form, setForm] = useState<BasicForm>(() => initialBasic());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof BasicForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const response = await fetch("/api/supplier-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        brandsHandled: form.brandsHandled
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    });
    const result = (await response.json().catch(() => null)) as {
      application?: Pick<Application, "id">;
      error?: string;
    } | null;
    if (!response.ok || !result?.application) {
      setError(result?.error ?? copy.saveError);
      setSaving(false);
      return;
    }
    router.replace(
      withLocale(`/seller/apply/${result.application.id}`, locale),
    );
  };

  return (
    <ApplicationFormCard
      copy={copy}
      form={form}
      update={update}
      saving={saving}
      error={error}
      onSubmit={create}
      submitLabel={copy.startApplication}
    />
  );
}

function ApplicationFormCard({
  copy,
  form,
  update,
  saving,
  error,
  onSubmit,
  submitLabel,
  disabled = false,
}: {
  copy: ReturnType<typeof getDictionary>["supplierApplication"];
  form: BasicForm;
  update: (key: keyof BasicForm, value: string) => void;
  saving: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.basic}</CardTitle>
        <CardDescription>{copy.privateNotice}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={copy.firstName}
              value={form.firstName}
              onChange={(value) => update("firstName", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.lastName}
              value={form.lastName}
              onChange={(value) => update("lastName", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.jobTitle}
              value={form.jobTitle}
              onChange={(value) => update("jobTitle", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.workEmail}
              type="email"
              value={form.workEmail}
              onChange={(value) => update("workEmail", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.phone}
              value={form.phoneNumber}
              onChange={(value) => update("phoneNumber", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.legalCompanyName}
              value={form.legalCompanyName}
              onChange={(value) => update("legalCompanyName", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.tradeName}
              value={form.tradeName ?? ""}
              onChange={(value) => update("tradeName", value)}
              disabled={disabled}
            />
            <TextField
              label={copy.website}
              type="url"
              value={form.companyWebsite}
              onChange={(value) => update("companyWebsite", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.country}
              value={form.registrationCountry}
              onChange={(value) => update("registrationCountry", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.annualRevenue}
              value={form.annualRevenueRange}
              onChange={(value) => update("annualRevenueRange", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.warehouseType}
              value={form.warehouseType}
              onChange={(value) => update("warehouseType", value)}
              required
              disabled={disabled}
            />
            <TextField
              label={copy.skuCount}
              value={form.skuCountRange}
              onChange={(value) => update("skuCountRange", value)}
              required
              disabled={disabled}
            />
          </div>
          <Field>
            <FieldLabel htmlFor="brandsHandled">
              {copy.brandsHandled}
            </FieldLabel>
            <Textarea
              id="brandsHandled"
              value={form.brandsHandled}
              onChange={(event) => update("brandsHandled", event.target.value)}
              required
              disabled={disabled}
            />
          </Field>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={saving || disabled}>
            {saving ? (
              <CometSpinner size="xs" />
            ) : null}
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  const id = useMemo(
    () => `supplier-${label.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    [label],
  );
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function SupplierApplicationWorkspace({
  locale,
  applicationId,
}: {
  locale: Locale;
  applicationId: string;
}) {
  const copy = getDictionary(locale).supplierApplication;
  const [application, setApplication] = useState<Application | null>(null);
  const [basic, setBasic] = useState<BasicForm>(() => initialBasic());
  const [structured, setStructured] = useState({
    stakeholders: "[]",
    warehouses: "[]",
    supplyChains: "[]",
    brands: "[]",
  });
  const [business, setBusiness] = useState({
    registrationNumber: "",
    representativeInformation: "",
    registeredAddress: "",
    operatingAddress: "",
    authorityDescription: "",
    taxCountry: "",
  });
  const [operations, setOperations] = useState({
    companyMov: "",
    brandLevelMov: "{}",
    defaultLeadTimeDays: "",
    allowedCountries: "",
    restrictedCountries: "",
    inventoryUpdateMethod: "MANUAL_PORTAL",
    inventoryUpdateFrequency: "",
  });
  const [settlement, setSettlement] = useState({
    legalAccountHolder: "",
    bankName: "",
    bankCountry: "",
    accountNumber: "",
    bankCode: "",
    swiftBic: "",
    payoutCurrency: "",
    taxCountry: "",
    taxNumber: "",
    vatInformation: "",
    invoiceMethod: "",
    acceptsPayoutPolicy: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [documentType, setDocumentType] = useState("BUSINESS_REGISTRATION");
  const [documentBrandId, setDocumentBrandId] = useState("NONE");
  const documentFile = useRef<HTMLInputElement>(null);
  const inventoryFile = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/supplier-applications/${applicationId}`,
      { cache: "no-store" },
    );
    const result = (await response.json().catch(() => null)) as {
      application?: Application;
      error?: string;
    } | null;
    if (!response.ok || !result?.application) {
      setMessage(result?.error ?? copy.saveError);
      return;
    }
    const next = result.application;
    setApplication(next);
    setBasic(initialBasic(next));
    setStructured({
      stakeholders: compactJson(next.stakeholders),
      warehouses: compactJson(next.warehouses),
      supplyChains: compactJson(next.supplyChains),
      brands: compactJson(next.brandVerifications),
    });
    setBusiness({
      registrationNumber: next.businessVerification?.registrationNumber ?? "",
      representativeInformation:
        next.businessVerification?.representativeInformation ?? "",
      registeredAddress: next.businessVerification?.registeredAddress ?? "",
      operatingAddress: next.businessVerification?.operatingAddress ?? "",
      authorityDescription:
        next.businessVerification?.authorityDescription ?? "",
      taxCountry: next.businessVerification?.taxCountry ?? "",
    });
    setOperations({
      companyMov: String(next.operationsProfile?.companyMov ?? ""),
      brandLevelMov: JSON.stringify(
        next.operationsProfile?.brandLevelMov ?? {},
        null,
        2,
      ),
      defaultLeadTimeDays: String(
        next.operationsProfile?.defaultLeadTimeDays ?? "",
      ),
      allowedCountries: Array.isArray(next.operationsProfile?.allowedCountries)
        ? next.operationsProfile.allowedCountries.join("\n")
        : "",
      restrictedCountries: Array.isArray(
        next.operationsProfile?.restrictedCountries,
      )
        ? next.operationsProfile.restrictedCountries.join("\n")
        : "",
      inventoryUpdateMethod: String(
        next.operationsProfile?.inventoryUpdateMethod ?? "MANUAL_PORTAL",
      ),
      inventoryUpdateFrequency: String(
        next.operationsProfile?.inventoryUpdateFrequency ?? "",
      ),
    });
    setSettlement({
      legalAccountHolder: String(
        next.settlementProfile?.legalAccountHolder ?? "",
      ),
      bankName: String(next.settlementProfile?.bankName ?? ""),
      bankCountry: String(next.settlementProfile?.bankCountry ?? ""),
      accountNumber: "",
      bankCode: String(next.settlementProfile?.bankCode ?? ""),
      swiftBic: String(next.settlementProfile?.swiftBic ?? ""),
      payoutCurrency: String(next.settlementProfile?.payoutCurrency ?? ""),
      taxCountry: String(next.settlementProfile?.taxCountry ?? ""),
      taxNumber: "",
      vatInformation: String(next.settlementProfile?.vatInformation ?? ""),
      invoiceMethod: String(next.settlementProfile?.invoiceMethod ?? ""),
      acceptsPayoutPolicy: Boolean(
        next.settlementProfile?.payoutPolicyAcceptedAt,
      ),
    });
    setMessage(null);
  }, [applicationId, copy.saveError]);

  useEffect(() => {
    const deferredLoad = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(deferredLoad);
  }, [load]);
  const editable = Boolean(
    application && editableStatuses.has(application.status),
  );
  const updateBasic = (key: keyof BasicForm, value: string) =>
    setBasic((current) => ({ ...current, [key]: value }));
  const save = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setMessage(null);
    const response = await fetch(
      `/api/supplier-applications/${applicationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) setMessage(result?.error ?? copy.saveError);
    else {
      setMessage(null);
      await load();
    }
    setSaving(false);
  };
  const saveBasic = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save({
      ...basic,
      brandsHandled: basic.brandsHandled
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      contact: {
        firstName: basic.firstName,
        lastName: basic.lastName,
        jobTitle: basic.jobTitle,
        workEmail: basic.workEmail,
        phoneNumber: basic.phoneNumber,
      },
    });
  };
  const saveStructured = () => {
    try {
      void save({
        stakeholders: parseJson(structured.stakeholders, copy.stakeholders),
        warehouses: parseJson(structured.warehouses, copy.warehouses),
        supplyChains: parseJson(structured.supplyChains, copy.supplyChain),
        brands: parseJson(structured.brands, copy.brands),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.saveError);
    }
  };
  const saveOperations = () => {
    try {
      const brandLevelMov = JSON.parse(operations.brandLevelMov) as unknown;
      if (
        !brandLevelMov ||
        typeof brandLevelMov !== "object" ||
        Array.isArray(brandLevelMov)
      ) {
        throw new Error("Brand-level MOV must be a JSON object.");
      }
      void save({
        operations: {
          ...operations,
          brandLevelMov,
          defaultLeadTimeDays: operations.defaultLeadTimeDays
            ? Number(operations.defaultLeadTimeDays)
            : null,
          onHandStockLeadTimeDays: null,
          sourcedAfterOrderLeadTimeDays: null,
          allowedCountries: operations.allowedCountries
            .split("\n")
            .filter(Boolean),
          restrictedCountries: operations.restrictedCountries
            .split("\n")
            .filter(Boolean),
          dailyOrderCapacity: null,
          dailyUnitCapacity: null,
          boxPacking: false,
          palletPacking: false,
          hazardousGoodsPacking: false,
          temperatureControlledPacking: false,
          weekendShipping: false,
        },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.saveError);
    }
  };
  const upload = async (kind: "documents" | "inventory") => {
    const input =
      kind === "documents" ? documentFile.current : inventoryFile.current;
    const file = input?.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    if (kind === "documents") {
      form.set("documentType", documentType);
      if (documentBrandId !== "NONE")
        form.set("brandVerificationId", documentBrandId);
    }
    const response = await fetch(
      `/api/supplier-applications/${applicationId}/${kind === "documents" ? "documents" : "inventory-samples"}`,
      { method: "POST", body: form },
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) setMessage(result?.error ?? copy.saveError);
    else await load();
  };
  const transition = async (action: "submit" | "withdraw") => {
    const response = await fetch(
      `/api/supplier-applications/${applicationId}/${action}`,
      { method: "POST" },
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) setMessage(result?.error ?? copy.submitError);
    else await load();
  };
  const respondToRequest = async (requestId: string, responseText: string) => {
    setSaving(true);
    setMessage(null);
    const response = await fetch(
      `/api/supplier-applications/${applicationId}/information-requests/${requestId}/respond`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: responseText }),
      },
    );
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok) setMessage(result?.error ?? copy.saveError);
    else await load();
    setSaving(false);
  };

  if (!application)
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
        <CometSpinner size="xs" className="mr-2" />
        {copy.loading}
      </div>
    );
  const nav = [
    ["basic", copy.basic],
    ["business", copy.business],
    ["stakeholders", copy.stakeholders],
    ["warehouses", copy.warehouses],
    ["supply-chain", copy.supplyChain],
    ["brands", copy.brands],
    ["inventory", copy.inventory],
    ["operations", copy.operations],
    ["settlement", copy.settlement],
    ["documents", copy.documents],
    ["review", copy.finalReview],
  ] as const;
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:px-8">
      <aside className="h-fit rounded-xl border bg-card p-3 lg:sticky lg:top-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">
            {application.applicationNumber}
          </span>
          <Badge variant={statusVariant(application.status)}>
            {application.status.replaceAll("_", " ")}
          </Badge>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${application.progress.percent}%` }}
          />
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {application.progress.complete}/{application.progress.total}
        </p>
        <nav aria-label={copy.applicationTitle} className="grid gap-1">
          {nav.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 space-y-6">
        <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {copy.applicationTitle}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {copy.privateNotice}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {editable ? (
              <Button
                variant="outline"
                onClick={() => void transition("withdraw")}
              >
                <XCircle aria-hidden="true" />
                {copy.withdraw}
              </Button>
            ) : null}
            {editable ? (
              <Button onClick={() => void transition("submit")}>
                <Send aria-hidden="true" />
                {copy.submit}
              </Button>
            ) : null}
          </div>
        </header>
        {message ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {message}
          </p>
        ) : null}
        {!editable ? (
          <Card>
            <CardContent className="flex gap-3 py-5 text-sm">
              <ShieldCheck
                className="mt-0.5 size-5 text-primary"
                aria-hidden="true"
              />
              {application.status === "APPROVED"
                ? copy.approvedNotice
                : copy.pendingNotice}
            </CardContent>
          </Card>
        ) : null}
        <section id="basic">
          <ApplicationFormCard
            copy={copy}
            form={basic}
            update={updateBasic}
            saving={saving}
            error={null}
            onSubmit={saveBasic}
            submitLabel={copy.save}
            disabled={!editable}
          />
        </section>
        <section id="business">
          <StructuredCard
            title={copy.business}
            description={copy.privateNotice}
            disabled={!editable || saving}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(business).map(([key, value]) => (
                <TextField
                  key={key}
                  label={key}
                  value={value}
                  onChange={(next) =>
                    setBusiness((current) => ({ ...current, [key]: next }))
                  }
                />
              ))}
            </div>
            <Button
              onClick={() => void save({ businessVerification: business })}
              disabled={!editable || saving}
            >
              {copy.save}
            </Button>
          </StructuredCard>
        </section>
        <section id="stakeholders">
          <JsonSection
            title={copy.stakeholders}
            value={structured.stakeholders}
            onChange={(value) =>
              setStructured((current) => ({ ...current, stakeholders: value }))
            }
            disabled={!editable || saving}
            copy={copy}
            onSave={saveStructured}
          />
        </section>
        <section id="warehouses">
          <JsonSection
            title={copy.warehouses}
            value={structured.warehouses}
            onChange={(value) =>
              setStructured((current) => ({ ...current, warehouses: value }))
            }
            disabled={!editable || saving}
            copy={copy}
            onSave={saveStructured}
          />
        </section>
        <section id="supply-chain">
          <JsonSection
            title={copy.supplyChain}
            value={structured.supplyChains}
            onChange={(value) =>
              setStructured((current) => ({ ...current, supplyChains: value }))
            }
            disabled={!editable || saving}
            copy={copy}
            onSave={saveStructured}
          />
        </section>
        <section id="brands">
          <JsonSection
            title={copy.brands}
            value={structured.brands}
            onChange={(value) =>
              setStructured((current) => ({ ...current, brands: value }))
            }
            disabled={!editable || saving}
            copy={copy}
            onSave={saveStructured}
          />
        </section>
        <section id="inventory">
          <UploadCard
            title={copy.inventory}
            description={copy.inventoryHint}
            inputRef={inventoryFile}
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            buttonLabel={copy.uploadInventory}
            disabled={!editable && !application.status.includes("INVENTORY")}
            onUpload={() => void upload("inventory")}
            rows={application.inventorySamples.map(
              (sample) =>
                `${sample.originalFilename} · ${sample.validRows} valid / ${sample.invalidRows} invalid`,
            )}
          />
        </section>
        <section id="operations">
          <StructuredCard
            title={copy.operations}
            disabled={!editable || saving}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(operations).map(([key, value]) =>
                key === "inventoryUpdateMethod" ? (
                  <Field key={key}>
                    <FieldLabel>{key}</FieldLabel>
                    <Select
                      value={value}
                      onValueChange={(next) =>
                        setOperations((current) => ({
                          ...current,
                          inventoryUpdateMethod: next ?? "MANUAL_PORTAL",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "MANUAL_PORTAL",
                          "EXCEL_CSV",
                          "API",
                          "FTP",
                          "ERP",
                        ].map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : key === "brandLevelMov" ? (
                  <Field key={key} className="sm:col-span-2">
                    <FieldLabel>Brand-level MOV</FieldLabel>
                    <Textarea
                      value={value}
                      className="min-h-24 font-mono text-xs"
                      onChange={(event) =>
                        setOperations((current) => ({
                          ...current,
                          brandLevelMov: event.target.value,
                        }))
                      }
                      disabled={!editable || saving}
                    />
                  </Field>
                ) : (
                  <TextField
                    key={key}
                    label={key}
                    value={value}
                    onChange={(next) =>
                      setOperations((current) => ({ ...current, [key]: next }))
                    }
                  />
                ),
              )}
            </div>
            <Button onClick={saveOperations} disabled={!editable || saving}>
              {copy.save}
            </Button>
          </StructuredCard>
        </section>
        <section id="settlement">
          <StructuredCard
            title={copy.settlement}
            description={copy.privateNotice}
            disabled={!editable || saving}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(settlement)
                .filter(
                  (entry): entry is [Exclude<keyof typeof settlement, "acceptsPayoutPolicy">, string] =>
                    entry[0] !== "acceptsPayoutPolicy" &&
                    typeof entry[1] === "string",
                )
                .map(([key, value]) => (
                  <TextField
                    key={key}
                    label={key}
                    value={value}
                    onChange={(next) =>
                      setSettlement((current) => ({ ...current, [key]: next }))
                    }
                  />
                ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settlement.acceptsPayoutPolicy}
                onChange={(event) =>
                  setSettlement((current) => ({
                    ...current,
                    acceptsPayoutPolicy: event.target.checked,
                  }))
                }
                disabled={!editable || saving}
              />
              {copy.privateNotice}
            </label>
            <Button
              onClick={() => void save({ settlement })}
              disabled={!editable || saving}
            >
              {copy.save}
            </Button>
          </StructuredCard>
        </section>
        <section id="documents">
          <UploadCard
            title={copy.documents}
            description={copy.privateNotice}
            inputRef={documentFile}
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            buttonLabel={copy.uploadDocument}
            disabled={
              !editable ||
              (["SUPPLIER_INVOICE", "BRAND_AUTHORIZATION"].includes(
                documentType,
              ) && documentBrandId === "NONE")
            }
            onUpload={() => void upload("documents")}
            rows={application.documents.map(
              (document) =>
                `${document.originalFilename} · ${document.reviewStatus}`,
            )}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Document type</FieldLabel>
                <Select
                  value={documentType}
                  onValueChange={(value) => {
                    const next = value ?? "BUSINESS_REGISTRATION";
                    setDocumentType(next);
                    if (!["SUPPLIER_INVOICE", "BRAND_AUTHORIZATION"].includes(next))
                      setDocumentBrandId("NONE");
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      "BUSINESS_REGISTRATION",
                      "COMPANY_AUTHORITY",
                      "SUPPLIER_INVOICE",
                      "BRAND_AUTHORIZATION",
                      "BANK_DOCUMENT",
                      "OTHER",
                    ].map((type) => (
                      <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {["SUPPLIER_INVOICE", "BRAND_AUTHORIZATION"].includes(documentType) ? (
                <Field>
                  <FieldLabel>Brand</FieldLabel>
                  <Select value={documentBrandId} onValueChange={(value) => setDocumentBrandId(value ?? "NONE")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Select a brand</SelectItem>
                      {application.brandVerifications
                        .filter((brand) => brand.isActive)
                        .map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>{brand.brand}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
          </UploadCard>
        </section>
        <section id="review">
          <StructuredCard title={copy.finalReview}>
            <FieldDescription>
              {application.statusReason
                ? `${copy.statusReason}: ${application.statusReason}`
                : copy.pendingNotice}
            </FieldDescription>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {application.statusHistory.map((event) => (
                <li key={event.id}>
                  {new Date(event.createdAt).toLocaleDateString(
                    locale === "ko" ? "ko-KR" : "en-US",
                  )}{" "}
                  · {event.toStatus.replaceAll("_", " ")}
                  {event.reason ? ` — ${event.reason}` : ""}
                </li>
              ))}
            </ul>
            {application.informationRequests.length ? (
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-medium">
                  {locale === "ko" ? "추가 정보 요청" : "Information requests"}
                </h3>
                {application.informationRequests.map((request) => (
                  <InformationRequestResponse
                    key={request.id}
                    request={request}
                    disabled={saving || Boolean(request.resolvedAt)}
                    locale={locale}
                    onSubmit={respondToRequest}
                  />
                ))}
              </div>
            ) : null}
          </StructuredCard>
        </section>
      </main>
    </div>
  );
}

function InformationRequestResponse({
  request,
  disabled,
  locale,
  onSubmit,
}: {
  request: Application["informationRequests"][number];
  disabled: boolean;
  locale: Locale;
  onSubmit: (requestId: string, response: string) => Promise<void>;
}) {
  const [response, setResponse] = useState(request.applicantResponse ?? "");
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{request.section.replaceAll("_", " ")}</p>
        <Badge variant={request.resolvedAt ? "secondary" : "outline"}>
          {request.resolvedAt
            ? locale === "ko" ? "해결됨" : "Resolved"
            : locale === "ko" ? "응답 필요" : "Response required"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{request.message}</p>
      <Field>
        <FieldLabel>{locale === "ko" ? "답변" : "Response"}</FieldLabel>
        <Textarea
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          disabled={disabled}
        />
      </Field>
      {!request.resolvedAt ? (
        <Button
          variant="outline"
          disabled={disabled || !response.trim()}
          onClick={() => void onSubmit(request.id, response)}
        >
          {locale === "ko" ? "답변 저장" : "Save response"}
        </Button>
      ) : null}
    </div>
  );
}

function StructuredCard({
  title,
  description,
  children,
  disabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Card aria-disabled={disabled}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
function JsonSection({
  title,
  value,
  onChange,
  disabled,
  copy,
  onSave,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  copy: ReturnType<typeof getDictionary>["supplierApplication"];
  onSave: () => void;
}) {
  return (
    <StructuredCard
      title={title}
      description={copy.structuredHint}
      disabled={disabled}
    >
      <Textarea
        aria-label={title}
        className="min-h-40 font-mono text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      <Button onClick={onSave} disabled={disabled}>
        {copy.save}
      </Button>
    </StructuredCard>
  );
}
function UploadCard({
  title,
  description,
  inputRef,
  accept,
  buttonLabel,
  disabled,
  onUpload,
  rows,
  children,
}: {
  title: string;
  description: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  buttonLabel: string;
  disabled: boolean;
  onUpload: () => void;
  rows: string[];
  children?: ReactNode;
}) {
  return (
    <StructuredCard title={title} description={description} disabled={disabled}>
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="block w-full text-sm"
      />
      <Button onClick={onUpload} disabled={disabled}>
        <FileUp aria-hidden="true" />
        {buttonLabel}
      </Button>
      {rows.length ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      ) : null}
    </StructuredCard>
  );
}
