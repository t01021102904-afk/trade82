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
  productFieldRequiresValue,
  productFieldVisibilityLevels,
  type ProductFieldVisibility,
  type ProductFieldVisibilityKey,
  type ProductFieldVisibilityLevel,
} from "@/lib/product-field-visibility";
import { cx } from "@/lib/utils";

type ProductFormVariant = "default" | "dashboard";

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
  Record<
    | "images"
    | "name"
    | "category"
    | "price"
    | "moq"
    | "leadTime"
    | "description"
    | "sampleAvailability"
    | "privateLabelAvailability"
    | "monthlyCapacity"
    | "incoterms"
    | "hsCode"
    | "shelfLife"
    | "storageRequirements"
    | "documentsAvailable"
    | "complianceClaims"
    | "ingredientsOrMaterials"
    | "packageSize"
    | "unitsPerCarton"
    | "cartonWeight"
    | "cartonDimensions"
    | "palletQuantity"
    | "storageTemperature"
    | "packaging",
    string
  >
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
  const normalized = normalizeProductFieldVisibility(product.fieldVisibility);
  const visibleProduct = applyProductVisibilityToFormValue({
    ...product,
    fieldVisibility: normalized,
  });
  const tags = product.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const moq = productFieldRequiresValue(normalized, "moq")
    ? formatMoqValue(visibleProduct.moqQuantity, visibleProduct.moqUnit)
    : "";

  return {
    ...visibleProduct,
    tags,
    moq,
    leadTimeCode: visibleProduct.leadTime,
    countryOfOrigin: SOUTH_KOREA,
    shippingOriginCountry: SOUTH_KOREA,
    origin: SOUTH_KOREA,
    certifications: visibleProduct.complianceClaims,
    packaging: visibleProduct.packaging || visibleProduct.packageSize,
    fieldVisibility: normalized,
  };
}

export function applyProductVisibilityToFormValue(
  product: RichProductFormValue,
): RichProductFormValue {
  const fieldVisibility = normalizeProductFieldVisibility(product.fieldVisibility);
  const next: RichProductFormValue = { ...product, fieldVisibility };

  if (!productFieldRequiresValue(fieldVisibility, "minimumUnitPrice")) {
    next.priceMin = "";
    next.priceMax = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "moq")) {
    next.moqQuantity = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "leadTime")) {
    next.leadTime = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "sampleAvailability")) {
    next.sampleAvailability = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "privateLabelAvailability")) {
    next.privateLabelAvailability = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "monthlySupplyCapacity")) {
    next.monthlyCapacity = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "incoterms")) {
    next.incoterms = [];
  }
  if (!productFieldRequiresValue(fieldVisibility, "hsCode")) {
    next.hsCode = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "shelfLife")) {
    next.shelfLife = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "storageRequirements")) {
    next.storageRequirements = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "documents")) {
    next.documentsAvailable = [];
  }
  if (!productFieldRequiresValue(fieldVisibility, "complianceInfo")) {
    next.complianceClaims = [];
  }
  if (!productFieldRequiresValue(fieldVisibility, "ingredientsMaterials")) {
    next.ingredientsOrMaterials = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "packageSize")) {
    next.packageSize = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "unitsPerCarton")) {
    next.unitsPerCarton = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "cartonWeight")) {
    next.cartonWeight = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "cartonDimensions")) {
    next.cartonDimensions = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "palletQuantity")) {
    next.palletQuantity = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "storageTemperature")) {
    next.storageTemperature = "";
  }
  if (!productFieldRequiresValue(fieldVisibility, "packaging")) {
    next.packaging = "";
  }

  return next;
}

export function validateRichProductForm(
  product: RichProductFormValue,
  t: (key: string) => string,
  options: { requireImages?: boolean } = {},
): RichProductFormErrors {
  const nextErrors: RichProductFormErrors = {};
  const fieldVisibility = normalizeProductFieldVisibility(product.fieldVisibility);
  const publicRequired = t("listing.errors.publicFieldRequired");

  if (options.requireImages && !product.images.length) {
    nextErrors.images = t("listing.errors.images");
  }
  if (!product.name.trim()) nextErrors.name = t("listing.errors.name");
  if (!product.category) nextErrors.category = t("listing.errors.category");
  if (!product.detailedDescription.trim()) {
    nextErrors.description = t("listing.errors.description");
  }
  if (
    productFieldRequiresValue(fieldVisibility, "minimumUnitPrice") &&
    (!product.priceMin || Number(product.priceMin) <= 0)
  ) {
    nextErrors.price = t("listing.errors.price");
  }
  if (
    productFieldRequiresValue(fieldVisibility, "moq") &&
    product.moqUnit !== "Not fixed" &&
    (!product.moqQuantity || Number(product.moqQuantity) <= 0)
  ) {
    nextErrors.moq = t("listing.errors.moq");
  }
  if (productFieldRequiresValue(fieldVisibility, "leadTime") && !product.leadTime) {
    nextErrors.leadTime = t("listing.errors.leadTime");
  }
  if (
    productFieldRequiresValue(fieldVisibility, "sampleAvailability") &&
    !product.sampleAvailability
  ) {
    nextErrors.sampleAvailability = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "privateLabelAvailability") &&
    !product.privateLabelAvailability
  ) {
    nextErrors.privateLabelAvailability = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "monthlySupplyCapacity") &&
    (!product.monthlyCapacity || Number(product.monthlyCapacity) <= 0)
  ) {
    nextErrors.monthlyCapacity = publicRequired;
  }
  if (productFieldRequiresValue(fieldVisibility, "incoterms") && !product.incoterms.length) {
    nextErrors.incoterms = publicRequired;
  }
  if (productFieldRequiresValue(fieldVisibility, "hsCode") && !product.hsCode.trim()) {
    nextErrors.hsCode = publicRequired;
  }
  if (productFieldRequiresValue(fieldVisibility, "shelfLife") && !product.shelfLife.trim()) {
    nextErrors.shelfLife = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "storageRequirements") &&
    !product.storageRequirements.trim()
  ) {
    nextErrors.storageRequirements = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "documents") &&
    !product.documentsAvailable.length
  ) {
    nextErrors.documentsAvailable = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "complianceInfo") &&
    !product.complianceClaims.length
  ) {
    nextErrors.complianceClaims = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "ingredientsMaterials") &&
    !product.ingredientsOrMaterials.trim()
  ) {
    nextErrors.ingredientsOrMaterials = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "packageSize") &&
    !product.packageSize.trim()
  ) {
    nextErrors.packageSize = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "unitsPerCarton") &&
    (!product.unitsPerCarton || Number(product.unitsPerCarton) <= 0)
  ) {
    nextErrors.unitsPerCarton = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "cartonWeight") &&
    !product.cartonWeight.trim()
  ) {
    nextErrors.cartonWeight = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "cartonDimensions") &&
    !product.cartonDimensions.trim()
  ) {
    nextErrors.cartonDimensions = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "palletQuantity") &&
    (!product.palletQuantity || Number(product.palletQuantity) <= 0)
  ) {
    nextErrors.palletQuantity = publicRequired;
  }
  if (
    productFieldRequiresValue(fieldVisibility, "storageTemperature") &&
    !product.storageTemperature.trim()
  ) {
    nextErrors.storageTemperature = publicRequired;
  }
  if (productFieldRequiresValue(fieldVisibility, "packaging") && !product.packaging.trim()) {
    nextErrors.packaging = publicRequired;
  }

  return nextErrors;
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
  variant = "default",
}: {
  value: RichProductFormValue;
  errors?: RichProductFormErrors;
  onChange: <K extends keyof RichProductFormValue>(
    key: K,
    nextValue: RichProductFormValue[K],
  ) => void;
  onUploadingChange: (uploading: boolean) => void;
  variant?: ProductFormVariant;
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
      variant={variant}
    />
  );
  const requiresValue = (key: ProductFieldVisibilityKey) =>
    productFieldRequiresValue(fieldVisibility, key);
  const parsedMoq = {
    quantity: value.moqQuantity || parseMoqValue(formatMoqValue(value.moqQuantity, value.moqUnit)).quantity,
    unit: value.moqUnit || "Units",
  };

  return (
    <div className={cx("grid gap-5", variant === "dashboard" && "gap-6")}>
      <Section id="product-images" title={t("productForm.productImages")} variant={variant}>
        <div className="sm:col-span-2">
          <ListingImageUploader
            value={value.images}
            onChange={(images) => onChange("images", images)}
            onUploadingChange={onUploadingChange}
            variant={variant}
          />
          {errors.images ? <ErrorText>{errors.images}</ErrorText> : null}
        </div>
      </Section>

      <Section id="basic-information" title={t("productForm.basicInfo")} variant={variant}>
        <TextField
          label={t("settings.productName")}
          value={value.name}
          onChange={(nextValue) => onChange("name", nextValue)}
          error={errors.name}
          required
          variant={variant}
        />
        <SelectField
          label={t("listing.category")}
          value={value.category}
          onChange={(nextValue) => onChange("category", nextValue)}
          options={categoryOptions}
          placeholder={t("listing.selectCategory")}
          error={errors.category}
          required
          variant={variant}
        />
        <TextField
          label={t("productForm.shortSummary")}
          value={value.shortDescription}
          onChange={(nextValue) => onChange("shortDescription", nextValue)}
          className="sm:col-span-2"
          maxLength={240}
          variant={variant}
        />
        <TextareaField
          label={t("productForm.detailedOverview")}
          value={value.detailedDescription}
          onChange={(nextValue) => onChange("detailedDescription", nextValue)}
          placeholder={t("listing.descriptionPlaceholder")}
          error={errors.description}
          required
          variant={variant}
        />
        <TextField
          label={t("listing.tags")}
          value={value.tags}
          onChange={(nextValue) => onChange("tags", nextValue)}
          placeholder={t("listing.tagsPlaceholder")}
          className="sm:col-span-2"
          variant={variant}
        />
        <TextareaField
          label={t("productForm.buyerNotes")}
          value={value.buyerNotes}
          onChange={(nextValue) => onChange("buyerNotes", nextValue)}
          rows={3}
          variant={variant}
        />
      </Section>

      <Section id="pricing-order-terms" title={t("productForm.pricingTerms")} variant={variant}>
        <NumberWithSelect
          label={t("settings.priceMin")}
          value={value.priceMin}
          selectValue={value.priceUnit}
          onValueChange={(nextValue) => onChange("priceMin", nextValue)}
          onSelectChange={(nextValue) => onChange("priceUnit", nextValue)}
          options={getPriceUnitOptions(locale)}
          error={errors.price}
          required={requiresValue("minimumUnitPrice")}
          prefix={value.currency}
          helper={t("settings.minimumUnitPriceHelper")}
          visibility={visibilityControl("minimumUnitPrice")}
          variant={variant}
        />
        <NumberWithSelect
          label={t("marketplace.moq")}
          value={parsedMoq.quantity}
          selectValue={parsedMoq.unit}
          onValueChange={(nextValue) => onChange("moqQuantity", nextValue)}
          onSelectChange={(nextValue) => onChange("moqUnit", nextValue)}
          options={getMoqUnitOptions(locale)}
          error={errors.moq}
          required={requiresValue("moq")}
          visibility={visibilityControl("moq")}
          variant={variant}
        />
        <SelectField
          label={t("settings.leadTime")}
          value={value.leadTime}
          onChange={(nextValue) => onChange("leadTime", nextValue)}
          options={leadTimeOptions}
          placeholder={t("onboarding.select")}
          error={errors.leadTime}
          required={requiresValue("leadTime")}
          visibility={visibilityControl("leadTime")}
          variant={variant}
        />
        <SelectField
          label={t("productForm.sampleAvailability")}
          value={value.sampleAvailability}
          onChange={(nextValue) => onChange("sampleAvailability", nextValue)}
          options={getSampleAvailabilityOptions(locale)}
          placeholder={t("onboarding.select")}
          error={errors.sampleAvailability}
          required={requiresValue("sampleAvailability")}
          visibility={visibilityControl("sampleAvailability")}
          variant={variant}
        />
        <SelectField
          label={t("productForm.privateLabelAvailability")}
          value={value.privateLabelAvailability}
          onChange={(nextValue) => onChange("privateLabelAvailability", nextValue)}
          options={getPrivateLabelOptions(locale)}
          placeholder={t("onboarding.select")}
          error={errors.privateLabelAvailability}
          required={requiresValue("privateLabelAvailability")}
          visibility={visibilityControl("privateLabelAvailability")}
          variant={variant}
        />
        <NumberWithSelect
          label={t("productForm.monthlySupplyCapacity")}
          value={value.monthlyCapacity}
          selectValue={value.monthlyCapacityUnit}
          onValueChange={(nextValue) => onChange("monthlyCapacity", nextValue)}
          onSelectChange={(nextValue) => onChange("monthlyCapacityUnit", nextValue)}
          options={getPriceUnitOptions(locale)}
          error={errors.monthlyCapacity}
          required={requiresValue("monthlySupplyCapacity")}
          visibility={visibilityControl("monthlySupplyCapacity")}
          variant={variant}
        />
      </Section>

      <Section id="origin-shipping" title={t("productForm.originShipping")} variant={variant}>
        <SelectField
          label={t("productForm.countryOfOrigin")}
          value={SOUTH_KOREA}
          onChange={() => onChange("countryOfOrigin", SOUTH_KOREA)}
          options={[{ value: SOUTH_KOREA, label: locale === "ko" ? "대한민국" : SOUTH_KOREA }]}
          disabled
          variant={variant}
        />
        <SelectField
          label={t("productForm.shippingOriginCountry")}
          value={SOUTH_KOREA}
          onChange={() => onChange("shippingOriginCountry", SOUTH_KOREA)}
          options={[{ value: SOUTH_KOREA, label: locale === "ko" ? "대한민국" : SOUTH_KOREA }]}
          disabled
          variant={variant}
        />
        <SelectField
          label={t("productForm.shippingOriginRegion")}
          value={value.shippingOriginRegion}
          onChange={(nextValue) => onChange("shippingOriginRegion", nextValue)}
          options={getKoreanRegionOptions(locale)}
          placeholder={t("settings.selectCityRegion")}
          variant={variant}
        />
        <CheckboxGroup
          label={t("productForm.incoterms")}
          values={value.incoterms}
          onChange={(nextValue) => onChange("incoterms", nextValue)}
          options={getIncotermOptions(locale)}
          className="sm:col-span-2"
          error={errors.incoterms}
          visibility={visibilityControl("incoterms")}
          variant={variant}
        />
        <TextField
          label={t("productForm.hsCode")}
          value={value.hsCode}
          onChange={(nextValue) => onChange("hsCode", nextValue)}
          error={errors.hsCode}
          required={requiresValue("hsCode")}
          visibility={visibilityControl("hsCode")}
          variant={variant}
        />
        <TextField
          label={t("productForm.shelfLife")}
          value={value.shelfLife}
          onChange={(nextValue) => onChange("shelfLife", nextValue)}
          error={errors.shelfLife}
          required={requiresValue("shelfLife")}
          visibility={visibilityControl("shelfLife")}
          variant={variant}
        />
        <TextareaField
          label={t("productForm.storageRequirements")}
          value={value.storageRequirements}
          onChange={(nextValue) => onChange("storageRequirements", nextValue)}
          rows={3}
          error={errors.storageRequirements}
          required={requiresValue("storageRequirements")}
          visibility={visibilityControl("storageRequirements")}
          variant={variant}
        />
      </Section>

      <Section id="compliance" title={t("productForm.complianceDocuments")} variant={variant}>
        <CheckboxGroup
          label={t("productForm.sellerProvidedDocuments")}
          values={value.documentsAvailable}
          onChange={(nextValue) => onChange("documentsAvailable", nextValue)}
          options={getSellerDocumentOptions(locale)}
          className="sm:col-span-2"
          error={errors.documentsAvailable}
          visibility={visibilityControl("documents")}
          variant={variant}
        />
        <CheckboxGroup
          label={t("productForm.sellerProvidedCompliance")}
          values={value.complianceClaims}
          onChange={(nextValue) => onChange("complianceClaims", nextValue)}
          options={getComplianceClaimOptions(locale)}
          className="sm:col-span-2"
          error={errors.complianceClaims}
          visibility={visibilityControl("complianceInfo")}
          variant={variant}
        />
        <TextareaField
          label={t("settings.ingredientsMaterials")}
          value={value.ingredientsOrMaterials}
          onChange={(nextValue) => onChange("ingredientsOrMaterials", nextValue)}
          rows={3}
          error={errors.ingredientsOrMaterials}
          required={requiresValue("ingredientsMaterials")}
          visibility={visibilityControl("ingredientsMaterials")}
          variant={variant}
        />
      </Section>

      <Section id="packaging-logistics" title={t("productForm.packagingLogistics")} variant={variant}>
        <TextField
          label={t("productForm.packageSize")}
          value={value.packageSize}
          onChange={(nextValue) => onChange("packageSize", nextValue)}
          error={errors.packageSize}
          required={requiresValue("packageSize")}
          visibility={visibilityControl("packageSize")}
          variant={variant}
        />
        <TextField
          label={t("productForm.unitsPerCarton")}
          value={value.unitsPerCarton}
          onChange={(nextValue) => onChange("unitsPerCarton", nextValue)}
          type="number"
          error={errors.unitsPerCarton}
          required={requiresValue("unitsPerCarton")}
          visibility={visibilityControl("unitsPerCarton")}
          variant={variant}
        />
        <TextField
          label={t("productForm.cartonWeight")}
          value={value.cartonWeight}
          onChange={(nextValue) => onChange("cartonWeight", nextValue)}
          error={errors.cartonWeight}
          required={requiresValue("cartonWeight")}
          visibility={visibilityControl("cartonWeight")}
          variant={variant}
        />
        <TextField
          label={t("productForm.cartonDimensions")}
          value={value.cartonDimensions}
          onChange={(nextValue) => onChange("cartonDimensions", nextValue)}
          error={errors.cartonDimensions}
          required={requiresValue("cartonDimensions")}
          visibility={visibilityControl("cartonDimensions")}
          variant={variant}
        />
        <TextField
          label={t("productForm.palletQuantity")}
          value={value.palletQuantity}
          onChange={(nextValue) => onChange("palletQuantity", nextValue)}
          type="number"
          error={errors.palletQuantity}
          required={requiresValue("palletQuantity")}
          visibility={visibilityControl("palletQuantity")}
          variant={variant}
        />
        <TextField
          label={t("productForm.storageTemperature")}
          value={value.storageTemperature}
          onChange={(nextValue) => onChange("storageTemperature", nextValue)}
          error={errors.storageTemperature}
          required={requiresValue("storageTemperature")}
          visibility={visibilityControl("storageTemperature")}
          variant={variant}
        />
        <TextareaField
          label={t("settings.packaging")}
          value={value.packaging}
          onChange={(nextValue) => onChange("packaging", nextValue)}
          rows={3}
          error={errors.packaging}
          required={requiresValue("packaging")}
          visibility={visibilityControl("packaging")}
          variant={variant}
        />
        <CheckboxGroup
          label={t("productForm.suggestedUsChannels")}
          values={value.suggestedUsChannels}
          onChange={(nextValue) => onChange("suggestedUsChannels", nextValue)}
          options={getSalesChannelOptions(locale)}
          className="sm:col-span-2"
          variant={variant}
        />
      </Section>
      <p
        className={cx(
          "rounded-md border p-3 text-xs leading-5",
          variant === "dashboard"
            ? "border-white/10 bg-white/[0.03] text-zinc-400"
            : "border-zinc-200 bg-zinc-50 text-zinc-600",
        )}
      >
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
  id,
  title,
  children,
  variant = "default",
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  variant?: ProductFormVariant;
}) {
  return (
    <section
      id={id}
      className={cx(
        "scroll-mt-28 grid gap-4 rounded-lg border p-4 sm:grid-cols-2 sm:p-5",
        variant === "dashboard"
          ? "rounded-2xl border-white/10 bg-white/[0.045] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
          : "border-zinc-200 bg-white",
      )}
    >
      <h3
        className={cx(
          "text-base font-semibold sm:col-span-2",
          variant === "dashboard" ? "text-zinc-50" : "text-zinc-950",
        )}
      >
        {title}
      </h3>
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
  variant = "default",
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
  variant?: ProductFormVariant;
}) {
  return (
    <label className={`grid gap-1 text-sm ${className ?? ""}`}>
      <FieldLabel label={label} required={required} visibility={visibility} variant={variant} />
      <input
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass(variant)}
        aria-invalid={Boolean(error)}
      />
      {error ? <ErrorText variant={variant}>{error}</ErrorText> : null}
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
  variant = "default",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  error?: string;
  required?: boolean;
  visibility?: React.ReactNode;
  variant?: ProductFormVariant;
}) {
  return (
    <label className="grid gap-1 text-sm sm:col-span-2">
      <FieldLabel label={label} required={required} visibility={visibility} variant={variant} />
      <textarea
        rows={rows}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cx(inputClass(variant), "h-auto min-h-24 py-2 leading-6")}
        aria-invalid={Boolean(error)}
      />
      {error ? <ErrorText variant={variant}>{error}</ErrorText> : null}
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
  variant = "default",
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
  variant?: ProductFormVariant;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <FieldLabel label={label} required={required} visibility={visibility} variant={variant} />
      <select
        value={value}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass(variant)}
        aria-invalid={Boolean(error)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <ErrorText variant={variant}>{error}</ErrorText> : null}
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
  variant = "default",
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
  variant?: ProductFormVariant;
}) {
  return (
    <fieldset className="grid min-w-0 gap-1 text-sm">
      <legend className="w-full">
        <FieldLabel label={label} required={required} visibility={visibility} variant={variant} />
      </legend>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(96px,128px)] items-center gap-2">
        <div
          className={cx(
            "flex h-11 min-w-0 items-center",
            inputShellClass(variant),
          )}
        >
          {prefix ? (
            <span
              className={cx(
                "px-3 text-sm",
                variant === "dashboard" ? "text-zinc-500" : "text-zinc-500",
              )}
            >
              {prefix}
            </span>
          ) : null}
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={value}
            required={required}
            onChange={(event) => onValueChange(event.target.value)}
            className={cx(
              "h-full min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 outline-none",
              variant === "dashboard" ? "text-zinc-100 placeholder:text-zinc-600" : "",
            )}
            aria-invalid={Boolean(error)}
          />
        </div>
        <select
          value={selectValue}
          onChange={(event) => onSelectChange(event.target.value)}
          className={cx(selectClass(variant), "h-11 min-w-0 px-2")}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {helper ? (
        <span
          className={cx(
            "text-xs leading-5",
            variant === "dashboard" ? "text-zinc-500" : "text-zinc-500",
          )}
        >
          {helper}
        </span>
      ) : null}
      {error ? <ErrorText variant={variant}>{error}</ErrorText> : null}
    </fieldset>
  );
}

function CheckboxGroup({
  label,
  values,
  onChange,
  options,
  className,
  error,
  visibility,
  variant = "default",
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  className?: string;
  error?: string;
  visibility?: React.ReactNode;
  variant?: ProductFormVariant;
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
        <FieldLabel label={label} visibility={visibility} variant={variant} />
      </legend>
      <div
        className={cx(
          "grid gap-2 rounded-md border p-3 sm:grid-cols-2",
          variant === "dashboard"
            ? "border-white/10 bg-zinc-950/70"
            : "border-zinc-200 bg-white",
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              "flex items-center gap-2",
              variant === "dashboard" ? "text-zinc-300" : "text-zinc-700",
            )}
          >
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
      {error ? <ErrorText variant={variant}>{error}</ErrorText> : null}
    </fieldset>
  );
}

function FieldLabel({
  label,
  required = false,
  visibility,
  variant = "default",
}: {
  label: string;
  required?: boolean;
  visibility?: React.ReactNode;
  variant?: ProductFormVariant;
}) {
  return (
    <span
      className={cx(
        "flex min-w-0 flex-wrap items-center justify-between gap-2 font-medium",
        variant === "dashboard" ? "text-zinc-200" : "text-zinc-700",
      )}
    >
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
  variant = "default",
}: {
  value: ProductFieldVisibilityLevel;
  onChange: (value: ProductFieldVisibilityLevel) => void;
  variant?: ProductFormVariant;
}) {
  const { t } = useI18n();
  const labels: Record<ProductFieldVisibilityLevel, string> = {
    public: t("productForm.visibilityPublic"),
    inquiry_required: t("productForm.visibilityInquiryRequired"),
    private: t("productForm.visibilityPrivate"),
  };
  const helpers: Record<ProductFieldVisibilityLevel, string> = {
    public: t("productForm.visibilityPublicHelper"),
    private: t("productForm.visibilityPrivateHelper"),
    inquiry_required: t("productForm.visibilityInquiryHelper"),
  };

  if (variant === "dashboard") {
    return (
      <div className="grid min-w-[240px] gap-1">
        <div
          role="radiogroup"
          aria-label={t("productForm.visibility")}
          className="grid grid-cols-3 rounded-xl border border-white/10 bg-zinc-950/80 p-1"
        >
          {productFieldVisibilityLevels.map((level) => {
            const selected = value === level;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(level)}
                className={cx(
                  "min-h-8 rounded-lg px-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
                  selected
                    ? "bg-zinc-100 text-zinc-950 shadow-sm"
                    : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200",
                )}
              >
                {labels[level]}
              </button>
            );
          })}
        </div>
        <span className="text-[11px] leading-4 text-zinc-500">{helpers[value]}</span>
      </div>
    );
  }

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

function inputClass(variant: ProductFormVariant) {
  return cx(
    "h-10 rounded-md border px-3 outline-none transition",
    variant === "dashboard"
      ? "rounded-xl border-white/10 bg-zinc-950/80 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/15 disabled:bg-zinc-900 disabled:text-zinc-500"
      : "border-zinc-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
  );
}

function selectClass(variant: ProductFormVariant) {
  return cx(
    "h-10 rounded-md border px-3 outline-none transition",
    variant === "dashboard"
      ? "rounded-xl border-white/10 bg-zinc-950/80 text-zinc-100 focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/15 disabled:bg-zinc-900 disabled:text-zinc-500"
      : "border-zinc-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-50 disabled:text-zinc-500",
  );
}

function inputShellClass(variant: ProductFormVariant) {
  return cx(
    "rounded-md border transition focus-within:ring-2",
    variant === "dashboard"
      ? "rounded-xl border-white/10 bg-zinc-950/80 focus-within:border-emerald-400/70 focus-within:ring-emerald-400/15"
      : "border-zinc-200 bg-white focus-within:border-blue-400 focus-within:ring-blue-100",
  );
}

function ErrorText({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: ProductFormVariant;
}) {
  return (
    <span className={cx("text-sm", variant === "dashboard" ? "text-red-300" : "text-red-700")}>
      {children}
    </span>
  );
}
