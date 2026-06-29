"use client";

import { ListingImageUploader } from "@/components/image-uploader";
import { useI18n } from "@/components/i18n-provider";
import {
  formatMoqValue,
  getComplianceClaimOptions,
  getIncotermOptions,
  getKoreanRegionOptions,
  getLeadTimeOptions,
  getMoqUnitOptions,
  getPriceUnitOptions,
  getPrivateLabelOptions,
  getSampleAvailabilityOptions,
  getSalesChannelOptions,
  getSellerDocumentOptions,
  getSellerProductCategoryOptions,
  parseMoqValue,
  SOUTH_KOREA,
  type SelectOption,
} from "@/lib/company-select-options";
import type { UploadedListingImage } from "@/lib/marketplace";
import {
  defaultProductFieldVisibility,
  normalizeProductFieldVisibility,
  productFieldVisibilityLevels,
  type ProductFieldVisibility,
  type ProductFieldVisibilityKey,
  type ProductFieldVisibilityLevel,
} from "@/lib/product-field-visibility";

export type RichProductFormValue = {
  images: UploadedListingImage[];
  name: string;
  category: string;
  tags: string;
  shortDescription: string;
  detailedDescription: string;
  priceMin: string;
  priceMax: string;
  currency: string;
  priceUnit: string;
  moqQuantity: string;
  moqUnit: string;
  leadTime: string;
  sampleAvailability: string;
  privateLabelAvailability: string;
  monthlyCapacity: string;
  monthlyCapacityUnit: string;
  countryOfOrigin: string;
  shippingOriginCountry: string;
  shippingOriginRegion: string;
  incoterms: string[];
  hsCode: string;
  shelfLife: string;
  storageRequirements: string;
  documentsAvailable: string[];
  complianceClaims: string[];
  buyerNotes: string;
  packageSize: string;
  unitsPerCarton: string;
  cartonWeight: string;
  cartonDimensions: string;
  palletQuantity: string;
  storageTemperature: string;
  suggestedUsChannels: string[];
  ingredientsOrMaterials: string;
  packaging: string;
  fieldVisibility: ProductFieldVisibility;
  exportReadiness: boolean;
  status: "active" | "inactive" | "draft";
};

export type RichProductFormErrors = Partial<
  Record<"images" | "name" | "category" | "price" | "moq" | "leadTime" | "description", string>
>;

export const emptyRichProductForm: RichProductFormValue = {
  images: [],
  name: "",
  category: "",
  tags: "",
  shortDescription: "",
  detailedDescription: "",
  priceMin: "",
  priceMax: "",
  currency: "USD",
  priceUnit: "unit",
  moqQuantity: "",
  moqUnit: "Units",
  leadTime: "",
  sampleAvailability: "",
  privateLabelAvailability: "",
  monthlyCapacity: "",
  monthlyCapacityUnit: "unit",
  countryOfOrigin: SOUTH_KOREA,
  shippingOriginCountry: SOUTH_KOREA,
  shippingOriginRegion: "",
  incoterms: [],
  hsCode: "",
  shelfLife: "",
  storageRequirements: "",
  documentsAvailable: [],
  complianceClaims: [],
  buyerNotes: "",
  packageSize: "",
  unitsPerCarton: "",
  cartonWeight: "",
  cartonDimensions: "",
  palletQuantity: "",
  storageTemperature: "",
  suggestedUsChannels: [],
  ingredientsOrMaterials: "",
  packaging: "",
  fieldVisibility: defaultProductFieldVisibility,
  exportReadiness: true,
  status: "active",
};

export function productPayloadFromForm(product: RichProductFormValue) {
  const tags = product.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const moq = formatMoqValue(product.moqQuantity, product.moqUnit);

  return {
    ...product,
    tags,
    moq,
    leadTimeCode: product.leadTime,
    countryOfOrigin: SOUTH_KOREA,
    shippingOriginCountry: SOUTH_KOREA,
    origin: SOUTH_KOREA,
    certifications: product.complianceClaims,
    packaging: product.packaging || product.packageSize,
    fieldVisibility: normalizeProductFieldVisibility(product.fieldVisibility),
  };
}

export function formFromProductRecord(product: Record<string, unknown>): RichProductFormValue {
  const parsedMoq = parseMoqValue(String(product.moq ?? ""));
  return {
    ...emptyRichProductForm,
    images: Array.isArray(product.images)
      ? (product.images as UploadedListingImage[])
      : [],
    name: String(product.name ?? ""),
    category: String(product.category ?? ""),
    tags: Array.isArray(product.tags) ? (product.tags as string[]).join(", ") : "",
    shortDescription: String(product.shortDescription ?? ""),
    detailedDescription: String(product.detailedDescription ?? ""),
    priceMin: product.priceMin == null ? "" : String(product.priceMin),
    priceMax: product.priceMax == null ? "" : String(product.priceMax),
    currency: String(product.currency ?? "USD"),
    priceUnit: String(product.priceUnit ?? "unit"),
    moqQuantity: String(product.moqQuantity ?? parsedMoq.quantity),
    moqUnit: String(product.moqUnit ?? parsedMoq.unit),
    leadTime: String(product.leadTimeCode ?? product.leadTime ?? ""),
    sampleAvailability: String(product.sampleAvailability ?? ""),
    privateLabelAvailability: String(product.privateLabelAvailability ?? ""),
    monthlyCapacity: String(product.monthlyCapacity ?? ""),
    monthlyCapacityUnit: String(product.monthlyCapacityUnit ?? "unit"),
    countryOfOrigin: String(product.countryOfOrigin ?? SOUTH_KOREA),
    shippingOriginCountry: String(product.shippingOriginCountry ?? SOUTH_KOREA),
    shippingOriginRegion: String(product.shippingOriginRegion ?? ""),
    incoterms: arrayOfStrings(product.incoterms),
    hsCode: String(product.hsCode ?? ""),
    shelfLife: String(product.shelfLife ?? ""),
    storageRequirements: String(product.storageRequirements ?? ""),
    documentsAvailable: arrayOfStrings(product.documentsAvailable),
    complianceClaims: arrayOfStrings(product.complianceClaims ?? product.certifications),
    buyerNotes: String(product.buyerNotes ?? ""),
    packageSize: String(product.packageSize ?? ""),
    unitsPerCarton: String(product.unitsPerCarton ?? ""),
    cartonWeight: String(product.cartonWeight ?? ""),
    cartonDimensions: String(product.cartonDimensions ?? ""),
    palletQuantity: String(product.palletQuantity ?? ""),
    storageTemperature: String(product.storageTemperature ?? ""),
    suggestedUsChannels: arrayOfStrings(product.suggestedUsChannels),
    ingredientsOrMaterials: String(product.ingredientsOrMaterials ?? ""),
    packaging: String(product.packaging ?? ""),
    fieldVisibility: normalizeProductFieldVisibility(product.fieldVisibility),
    exportReadiness: product.exportReadiness !== false,
    status:
      product.status === "inactive" || product.status === "draft"
        ? product.status
        : "active",
  };
}

export function RichProductFormFields({
  value,
  errors = {},
  onChange,
  onUploadingChange,
}: {
  value: RichProductFormValue;
  errors?: RichProductFormErrors;
  onChange: <K extends keyof RichProductFormValue>(
    key: K,
    nextValue: RichProductFormValue[K],
  ) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const { locale, t } = useI18n();
  const categoryOptions = withCurrentOption(
    getSellerProductCategoryOptions(locale),
    value.category,
  );
  const leadTimeOptions = withCurrentOption(getLeadTimeOptions(locale), value.leadTime);
  const fieldVisibility = normalizeProductFieldVisibility(value.fieldVisibility);
  const updateVisibility = (
    key: ProductFieldVisibilityKey,
    nextValue: ProductFieldVisibilityLevel,
  ) => {
    onChange("fieldVisibility", { ...fieldVisibility, [key]: nextValue });
  };
  const visibilityControl = (key: ProductFieldVisibilityKey) => (
    <VisibilitySelect
      value={fieldVisibility[key]}
      onChange={(nextValue) => updateVisibility(key, nextValue)}
    />
  );
  const parsedMoq = {
    quantity: value.moqQuantity || parseMoqValue(formatMoqValue(value.moqQuantity, value.moqUnit)).quantity,
    unit: value.moqUnit || "Units",
  };

  return (
    <div className="grid gap-5">
      <Section title={t("productForm.basicInfo")}>
        <div className="sm:col-span-2">
          <ListingImageUploader
            value={value.images}
            onChange={(images) => onChange("images", images)}
            onUploadingChange={onUploadingChange}
          />
          {errors.images ? <ErrorText>{errors.images}</ErrorText> : null}
        </div>
        <TextField
          label={t("settings.productName")}
          value={value.name}
          onChange={(nextValue) => onChange("name", nextValue)}
          error={errors.name}
          required
        />
        <SelectField
          label={t("listing.category")}
          value={value.category}
          onChange={(nextValue) => onChange("category", nextValue)}
          options={categoryOptions}
          placeholder={t("listing.selectCategory")}
          error={errors.category}
          required
        />
        <TextField
          label={t("productForm.shortSummary")}
          value={value.shortDescription}
          onChange={(nextValue) => onChange("shortDescription", nextValue)}
          className="sm:col-span-2"
          maxLength={240}
        />
        <TextareaField
          label={t("productForm.detailedOverview")}
          value={value.detailedDescription}
          onChange={(nextValue) => onChange("detailedDescription", nextValue)}
          placeholder={t("listing.descriptionPlaceholder")}
          error={errors.description}
          required
        />
        <TextField
          label={t("listing.tags")}
          value={value.tags}
          onChange={(nextValue) => onChange("tags", nextValue)}
          placeholder={t("listing.tagsPlaceholder")}
          className="sm:col-span-2"
        />
        <TextareaField
          label={t("productForm.buyerNotes")}
          value={value.buyerNotes}
          onChange={(nextValue) => onChange("buyerNotes", nextValue)}
          rows={3}
        />
      </Section>

      <Section title={t("productForm.pricingTerms")}>
        <NumberWithSelect
          label={t("settings.priceMin")}
          value={value.priceMin}
          selectValue={value.priceUnit}
          onValueChange={(nextValue) => onChange("priceMin", nextValue)}
          onSelectChange={(nextValue) => onChange("priceUnit", nextValue)}
          options={getPriceUnitOptions(locale)}
          error={errors.price}
          required
          prefix={value.currency}
          helper={t("settings.minimumUnitPriceHelper")}
          visibility={visibilityControl("minimumUnitPrice")}
        />
        <NumberWithSelect
          label={t("marketplace.moq")}
          value={parsedMoq.quantity}
          selectValue={parsedMoq.unit}
          onValueChange={(nextValue) => onChange("moqQuantity", nextValue)}
          onSelectChange={(nextValue) => onChange("moqUnit", nextValue)}
          options={getMoqUnitOptions(locale)}
          error={errors.moq}
          required
          visibility={visibilityControl("moq")}
        />
        <SelectField
          label={t("settings.leadTime")}
          value={value.leadTime}
          onChange={(nextValue) => onChange("leadTime", nextValue)}
          options={leadTimeOptions}
          placeholder={t("onboarding.select")}
          error={errors.leadTime}
          required
          visibility={visibilityControl("leadTime")}
        />
        <SelectField
          label={t("productForm.sampleAvailability")}
          value={value.sampleAvailability}
          onChange={(nextValue) => onChange("sampleAvailability", nextValue)}
          options={getSampleAvailabilityOptions(locale)}
          placeholder={t("onboarding.select")}
          visibility={visibilityControl("sampleAvailability")}
        />
        <SelectField
          label={t("productForm.privateLabelAvailability")}
          value={value.privateLabelAvailability}
          onChange={(nextValue) => onChange("privateLabelAvailability", nextValue)}
          options={getPrivateLabelOptions(locale)}
          placeholder={t("onboarding.select")}
          visibility={visibilityControl("privateLabelAvailability")}
        />
        <NumberWithSelect
          label={t("productForm.monthlySupplyCapacity")}
          value={value.monthlyCapacity}
          selectValue={value.monthlyCapacityUnit}
          onValueChange={(nextValue) => onChange("monthlyCapacity", nextValue)}
          onSelectChange={(nextValue) => onChange("monthlyCapacityUnit", nextValue)}
          options={getPriceUnitOptions(locale)}
          visibility={visibilityControl("monthlySupplyCapacity")}
        />
      </Section>

      <Section title={t("productForm.originShipping")}>
        <SelectField
          label={t("productForm.countryOfOrigin")}
          value={SOUTH_KOREA}
          onChange={() => onChange("countryOfOrigin", SOUTH_KOREA)}
          options={[{ value: SOUTH_KOREA, label: locale === "ko" ? "대한민국" : SOUTH_KOREA }]}
          disabled
        />
        <SelectField
          label={t("productForm.shippingOriginCountry")}
          value={SOUTH_KOREA}
          onChange={() => onChange("shippingOriginCountry", SOUTH_KOREA)}
          options={[{ value: SOUTH_KOREA, label: locale === "ko" ? "대한민국" : SOUTH_KOREA }]}
          disabled
        />
        <SelectField
          label={t("productForm.shippingOriginRegion")}
          value={value.shippingOriginRegion}
          onChange={(nextValue) => onChange("shippingOriginRegion", nextValue)}
          options={getKoreanRegionOptions(locale)}
          placeholder={t("settings.selectCityRegion")}
        />
        <CheckboxGroup
          label={t("productForm.incoterms")}
          values={value.incoterms}
          onChange={(nextValue) => onChange("incoterms", nextValue)}
          options={getIncotermOptions(locale)}
          className="sm:col-span-2"
          visibility={visibilityControl("incoterms")}
        />
        <TextField
          label={t("productForm.hsCode")}
          value={value.hsCode}
          onChange={(nextValue) => onChange("hsCode", nextValue)}
          visibility={visibilityControl("hsCode")}
        />
        <TextField
          label={t("productForm.shelfLife")}
          value={value.shelfLife}
          onChange={(nextValue) => onChange("shelfLife", nextValue)}
          visibility={visibilityControl("shelfLife")}
        />
        <TextareaField
          label={t("productForm.storageRequirements")}
          value={value.storageRequirements}
          onChange={(nextValue) => onChange("storageRequirements", nextValue)}
          rows={3}
          visibility={visibilityControl("storageRequirements")}
        />
      </Section>

      <Section title={t("productForm.complianceDocuments")}>
        <CheckboxGroup
          label={t("productForm.sellerProvidedDocuments")}
          values={value.documentsAvailable}
          onChange={(nextValue) => onChange("documentsAvailable", nextValue)}
          options={getSellerDocumentOptions(locale)}
          className="sm:col-span-2"
          visibility={visibilityControl("documents")}
        />
        <CheckboxGroup
          label={t("productForm.sellerProvidedCompliance")}
          values={value.complianceClaims}
          onChange={(nextValue) => onChange("complianceClaims", nextValue)}
          options={getComplianceClaimOptions(locale)}
          className="sm:col-span-2"
          visibility={visibilityControl("complianceInfo")}
        />
        <TextareaField
          label={t("settings.ingredientsMaterials")}
          value={value.ingredientsOrMaterials}
          onChange={(nextValue) => onChange("ingredientsOrMaterials", nextValue)}
          rows={3}
          visibility={visibilityControl("ingredientsMaterials")}
        />
      </Section>

      <Section title={t("productForm.packagingLogistics")}>
        <TextField
          label={t("productForm.packageSize")}
          value={value.packageSize}
          onChange={(nextValue) => onChange("packageSize", nextValue)}
          visibility={visibilityControl("packageSize")}
        />
        <TextField
          label={t("productForm.unitsPerCarton")}
          value={value.unitsPerCarton}
          onChange={(nextValue) => onChange("unitsPerCarton", nextValue)}
          type="number"
          visibility={visibilityControl("unitsPerCarton")}
        />
        <TextField
          label={t("productForm.cartonWeight")}
          value={value.cartonWeight}
          onChange={(nextValue) => onChange("cartonWeight", nextValue)}
          visibility={visibilityControl("cartonWeight")}
        />
        <TextField
          label={t("productForm.cartonDimensions")}
          value={value.cartonDimensions}
          onChange={(nextValue) => onChange("cartonDimensions", nextValue)}
          visibility={visibilityControl("cartonDimensions")}
        />
        <TextField
          label={t("productForm.palletQuantity")}
          value={value.palletQuantity}
          onChange={(nextValue) => onChange("palletQuantity", nextValue)}
          type="number"
          visibility={visibilityControl("palletQuantity")}
        />
        <TextField
          label={t("productForm.storageTemperature")}
          value={value.storageTemperature}
          onChange={(nextValue) => onChange("storageTemperature", nextValue)}
          visibility={visibilityControl("storageTemperature")}
        />
        <TextareaField
          label={t("settings.packaging")}
          value={value.packaging}
          onChange={(nextValue) => onChange("packaging", nextValue)}
          rows={3}
          visibility={visibilityControl("packaging")}
        />
        <CheckboxGroup
          label={t("productForm.suggestedUsChannels")}
          values={value.suggestedUsChannels}
          onChange={(nextValue) => onChange("suggestedUsChannels", nextValue)}
          options={getSalesChannelOptions(locale)}
          className="sm:col-span-2"
        />
      </Section>
      <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
        {t("productForm.visibilityHelper")} {t("productForm.imagesPublicNote")}
      </p>
    </div>
  );
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function withCurrentOption(options: SelectOption[], value: string) {
  if (!value || options.some((option) => option.value === value)) return options;
  return [{ value, label: value }, ...options];
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 sm:p-5">
      <h3 className="text-base font-semibold text-zinc-950 sm:col-span-2">{title}</h3>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  className,
  placeholder,
  error,
  required = false,
  maxLength,
  visibility,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  className?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
  visibility?: React.ReactNode;
}) {
  return (
    <label className={`grid gap-1 text-sm ${className ?? ""}`}>
      <FieldLabel label={label} required={required} visibility={visibility} />
      <input
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        aria-invalid={Boolean(error)}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 5,
  placeholder,
  error,
  required = false,
  visibility,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  error?: string;
  required?: boolean;
  visibility?: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm sm:col-span-2">
      <FieldLabel label={label} required={required} visibility={visibility} />
      <textarea
        rows={rows}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-zinc-200 bg-white px-3 py-2 leading-6 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        aria-invalid={Boolean(error)}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  required = false,
  disabled = false,
  visibility,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  visibility?: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <FieldLabel label={label} required={required} visibility={visibility} />
      <select
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-200 bg-white px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-50 disabled:text-zinc-500"
        aria-invalid={Boolean(error)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </label>
  );
}

function NumberWithSelect({
  label,
  value,
  selectValue,
  onValueChange,
  onSelectChange,
  options,
  prefix,
  helper,
  error,
  required = false,
  visibility,
}: {
  label: string;
  value: string;
  selectValue: string;
  onValueChange: (value: string) => void;
  onSelectChange: (value: string) => void;
  options: SelectOption[];
  prefix?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  visibility?: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-1 text-sm">
      <legend className="w-full">
        <FieldLabel label={label} required={required} visibility={visibility} />
      </legend>
      <div className="grid gap-2 sm:grid-cols-[1fr_132px]">
        <div className="flex min-w-0 items-center rounded-md border border-zinc-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
          {prefix ? <span className="px-3 text-sm text-zinc-500">{prefix}</span> : null}
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={value}
            required={required}
            onChange={(event) => onValueChange(event.target.value)}
            className="h-10 min-w-0 flex-1 rounded-md border-0 bg-transparent px-3 outline-none"
            aria-invalid={Boolean(error)}
          />
        </div>
        <select
          value={selectValue}
          onChange={(event) => onSelectChange(event.target.value)}
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {helper ? <span className="text-xs leading-5 text-zinc-500">{helper}</span> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </fieldset>
  );
}

function CheckboxGroup({
  label,
  values,
  onChange,
  options,
  className,
  visibility,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  className?: string;
  visibility?: React.ReactNode;
}) {
  function toggle(value: string) {
    const next = new Set(values);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(Array.from(next));
  }

  return (
    <fieldset className={`grid gap-2 text-sm ${className ?? ""}`}>
      <legend className="w-full">
        <FieldLabel label={label} visibility={visibility} />
      </legend>
      <div className="grid gap-2 rounded-md border border-zinc-200 bg-white p-3 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-zinc-700">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="size-4 rounded border-zinc-300"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FieldLabel({
  label,
  required = false,
  visibility,
}: {
  label: string;
  required?: boolean;
  visibility?: React.ReactNode;
}) {
  return (
    <span className="flex min-w-0 flex-wrap items-center justify-between gap-2 font-medium text-zinc-700">
      <span>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {visibility}
    </span>
  );
}

function VisibilitySelect({
  value,
  onChange,
}: {
  value: ProductFieldVisibilityLevel;
  onChange: (value: ProductFieldVisibilityLevel) => void;
}) {
  const { t } = useI18n();
  const labels: Record<ProductFieldVisibilityLevel, string> = {
    public: t("productForm.visibilityPublic"),
    inquiry_required: t("productForm.visibilityInquiryRequired"),
    private: t("productForm.visibilityPrivate"),
  };

  return (
    <select
      value={value}
      aria-label={t("productForm.visibility")}
      onChange={(event) => onChange(event.target.value as ProductFieldVisibilityLevel)}
      className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
    >
      {productFieldVisibilityLevels.map((level) => (
        <option key={level} value={level}>
          {labels[level]}
        </option>
      ))}
    </select>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-red-700">{children}</span>;
}
