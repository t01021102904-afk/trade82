import "server-only";

import { createHash } from "node:crypto";

import {
  AccountRole,
  SupplierApplicationSection,
  SupplierApplicationStatus,
  SupplierBrandVerificationStatus,
  SupplierReviewStatus,
  SupplierSupplyChainType,
  type Prisma,
} from "@/generated/prisma/client";
import { validationError } from "@/lib/api-security";
import { getDb } from "@/lib/db";
import {
  encryptPayoutData,
  lastFour,
  maskAccountNumber,
} from "@/lib/payout-crypto";

const APPLICATION_NUMBER_PREFIX = "T82-SA";

export const supplierApplicationEditableStatuses =
  new Set<SupplierApplicationStatus>([
    SupplierApplicationStatus.DRAFT,
    SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
    SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED,
    SupplierApplicationStatus.INVENTORY_VERIFICATION_REQUIRED,
  ]);

const applicantTransitions: Readonly<
  Partial<
    Record<SupplierApplicationStatus, readonly SupplierApplicationStatus[]>
  >
> = {
  [SupplierApplicationStatus.DRAFT]: [
    SupplierApplicationStatus.SUBMITTED,
    SupplierApplicationStatus.WITHDRAWN,
  ],
  [SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED]: [
    SupplierApplicationStatus.SUBMITTED,
    SupplierApplicationStatus.WITHDRAWN,
  ],
  [SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED]: [
    SupplierApplicationStatus.SUBMITTED,
    SupplierApplicationStatus.WITHDRAWN,
  ],
  [SupplierApplicationStatus.INVENTORY_VERIFICATION_REQUIRED]: [
    SupplierApplicationStatus.SUBMITTED,
    SupplierApplicationStatus.WITHDRAWN,
  ],
};

const adminTransitions: Readonly<
  Partial<
    Record<SupplierApplicationStatus, readonly SupplierApplicationStatus[]>
  >
> = {
  [SupplierApplicationStatus.DRAFT]: [
    SupplierApplicationStatus.BUSINESS_VERIFICATION,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.REJECTED,
  ],
  [SupplierApplicationStatus.SUBMITTED]: [
    SupplierApplicationStatus.BUSINESS_VERIFICATION,
    SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
    SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.REJECTED,
  ],
  [SupplierApplicationStatus.BUSINESS_VERIFICATION]: [
    SupplierApplicationStatus.PRODUCT_AUTHENTICITY_VERIFICATION,
    SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
    SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.REJECTED,
  ],
  [SupplierApplicationStatus.PRODUCT_AUTHENTICITY_VERIFICATION]: [
    SupplierApplicationStatus.OPERATIONS_VERIFICATION,
    SupplierApplicationStatus.INVENTORY_VERIFICATION_REQUIRED,
    SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
    SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.REJECTED,
  ],
  [SupplierApplicationStatus.OPERATIONS_VERIFICATION]: [
    SupplierApplicationStatus.SETTLEMENT_VERIFICATION,
    SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
    SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.REJECTED,
  ],
  [SupplierApplicationStatus.SETTLEMENT_VERIFICATION]: [
    SupplierApplicationStatus.CONDITIONALLY_APPROVED,
    SupplierApplicationStatus.APPROVED,
    SupplierApplicationStatus.TEST_ORDER_REQUIRED,
    SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
    SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.REJECTED,
  ],
  [SupplierApplicationStatus.INVENTORY_VERIFICATION_REQUIRED]: [
    SupplierApplicationStatus.PRODUCT_AUTHENTICITY_VERIFICATION,
    SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.REJECTED,
  ],
  [SupplierApplicationStatus.TEST_ORDER_REQUIRED]: [
    SupplierApplicationStatus.CONDITIONALLY_APPROVED,
    SupplierApplicationStatus.APPROVED,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.REJECTED,
  ],
  [SupplierApplicationStatus.CONDITIONALLY_APPROVED]: [
    SupplierApplicationStatus.APPROVED,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.SUSPENDED,
  ],
  [SupplierApplicationStatus.APPROVED]: [
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.SUSPENDED,
  ],
  [SupplierApplicationStatus.ON_HOLD]: [
    SupplierApplicationStatus.BUSINESS_VERIFICATION,
    SupplierApplicationStatus.PRODUCT_AUTHENTICITY_VERIFICATION,
    SupplierApplicationStatus.OPERATIONS_VERIFICATION,
    SupplierApplicationStatus.SETTLEMENT_VERIFICATION,
    SupplierApplicationStatus.CONDITIONALLY_APPROVED,
    SupplierApplicationStatus.APPROVED,
    SupplierApplicationStatus.REJECTED,
  ],
  [SupplierApplicationStatus.SUSPENDED]: [
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.CONDITIONALLY_APPROVED,
    SupplierApplicationStatus.APPROVED,
  ],
};

const statusReasonRequired = new Set<SupplierApplicationStatus>([
  SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED,
  SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED,
  SupplierApplicationStatus.INVENTORY_VERIFICATION_REQUIRED,
  SupplierApplicationStatus.TEST_ORDER_REQUIRED,
  SupplierApplicationStatus.ON_HOLD,
  SupplierApplicationStatus.REJECTED,
  SupplierApplicationStatus.SUSPENDED,
]);

type ApplicationActor = "APPLICANT" | "ADMIN" | "SYSTEM";

export type SupplierApplicationCapabilities = {
  applicationId: string | null;
  status: SupplierApplicationStatus | null;
  companyId: string | null;
  canEditApplication: boolean;
  canUploadInventorySample: boolean;
  canUploadLiveInventory: boolean;
  canCreateProductCandidate: boolean;
  canPublishOffer: boolean;
  canReceiveOrder: boolean;
  canShipOrder: boolean;
  canReceivePayout: boolean;
  isLegacyFallback: boolean;
};

export type SupplierApplicationCreateInput = {
  contact: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    workEmail: string;
    phoneNumber: string;
  };
  legalCompanyName: string;
  tradeName?: string | null;
  companyWebsite: string;
  registrationCountry: string;
  brandsHandled: string[];
  annualRevenueRange: string;
  warehouseType: string;
  skuCountRange: string;
};

export type SupplierApplicationUpdateInput = Partial<{
  legalCompanyName: string;
  tradeName: string | null;
  companyWebsite: string;
  registrationCountry: string;
  brandsHandled: string[];
  annualRevenueRange: string;
  warehouseType: string;
  skuCountRange: string;
  contact: SupplierApplicationCreateInput["contact"];
  businessVerification: {
    registrationNumber: string;
    representativeInformation: string;
    registeredAddress: string;
    operatingAddress: string;
    authorityDescription: string;
    taxCountry: string;
  };
  operations: {
    companyMov: string;
    brandLevelMov: Record<string, string>;
    defaultLeadTimeDays: number | null;
    onHandStockLeadTimeDays: number | null;
    sourcedAfterOrderLeadTimeDays: number | null;
    allowedCountries: string[];
    restrictedCountries: string[];
    dailyOrderCapacity: number | null;
    dailyUnitCapacity: number | null;
    boxPacking: boolean;
    palletPacking: boolean;
    hazardousGoodsPacking: boolean;
    temperatureControlledPacking: boolean;
    weekendShipping: boolean;
    inventoryUpdateMethod:
      "EXCEL_CSV" | "MANUAL_PORTAL" | "API" | "FTP" | "ERP";
    inventoryUpdateFrequency: string;
  };
  stakeholders: Array<{
    fullName: string;
    title: string;
    relationship: string;
    ownershipPercent: string;
    country: string;
  }>;
  warehouses: Array<{
    name: string;
    address: string;
    operator: string;
    contactName: string;
    contactPhone: string;
    openingHours: string;
    dailyOrderCapacity: number | null;
    warehouseType: string;
  }>;
  supplyChains: Array<{
    relationshipType: SupplierSupplyChainType;
    supplierCompany: string;
    countries: string[];
    description: string;
  }>;
  brands: Array<{
    brand: string;
    relationshipType: SupplierSupplyChainType;
    supplierCompany: string;
    transactionStartedAt: Date | null;
    countryRestrictions: string[];
  }>;
  settlement: {
    legalAccountHolder: string;
    bankName: string;
    bankCountry: string;
    accountNumber: string | null;
    bankCode: string;
    swiftBic: string;
    payoutCurrency: string;
    taxCountry: string;
    taxNumber: string | null;
    vatInformation: string;
    invoiceMethod: string;
    acceptsPayoutPolicy: boolean;
  };
}>;

function text(value: unknown, field: string, max: number, required = false) {
  if (value === undefined || value === null) {
    if (required) throw validationError(`${field} is required.`);
    return "";
  }
  if (typeof value !== "string")
    throw validationError(`${field} must be text.`);
  const normalized = value.trim();
  if (required && !normalized) throw validationError(`${field} is required.`);
  if (normalized.length > max) throw validationError(`${field} is too long.`);
  return normalized;
}

function requiredEmail(value: unknown) {
  const email = text(value, "workEmail", 320, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validationError("workEmail is invalid.");
  }
  return email;
}

function normalizedWebsite(value: unknown) {
  const raw = text(value, "companyWebsite", 500, true);
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new Error();
    return { url: url.toString(), domain: url.hostname.toLowerCase() };
  } catch {
    throw validationError("companyWebsite is invalid.");
  }
}

function stringList(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
) {
  if (!Array.isArray(value)) throw validationError(`${field} must be a list.`);
  if (value.length > maxItems)
    throw validationError(`${field} has too many items.`);
  return Array.from(
    new Set(
      value.map((item) => text(item, field, maxLength, true)).filter(Boolean),
    ),
  );
}

function nullableText(value: unknown, field: string, max: number) {
  if (value === null || value === undefined) return null;
  return text(value, field, max) || null;
}

function positiveInteger(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 10_000_000
  ) {
    throw validationError(`${field} must be a non-negative integer.`);
  }
  return value;
}

function requiredArray(value: unknown, field: string, maxItems: number) {
  if (!Array.isArray(value)) throw validationError(`${field} must be a list.`);
  if (value.length > maxItems)
    throw validationError(`${field} has too many items.`);
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw validationError(`${field} contains an invalid item.`);
    }
    return item as Record<string, unknown>;
  });
}

function nullableDate(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw validationError(`${field} is invalid.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw validationError(`${field} is invalid.`);
  return date;
}

function supplyChainType(value: unknown, field: string) {
  const normalized = text(value, field, 40, true) as SupplierSupplyChainType;
  if (!Object.values(SupplierSupplyChainType).includes(normalized)) {
    throw validationError(`${field} is invalid.`);
  }
  return normalized;
}

function applicationNumber() {
  return `${APPLICATION_NUMBER_PREFIX}-${new Date().getUTCFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

function duplicateValueHash(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function stringRecord(
  value: unknown,
  field: string,
  maxEntries = 100,
  maxValueLength = 160,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(`${field} is invalid.`);
  }
  const entries = Object.entries(value);
  if (entries.length > maxEntries) {
    throw validationError(`${field} has too many entries.`);
  }
  return Object.fromEntries(
    entries.map(([key, item]) => [
      text(key, `${field}.key`, 160, true),
      text(
        typeof item === "string" || typeof item === "number"
          ? String(item)
          : item,
        `${field}.${key}`,
        maxValueLength,
        true,
      ),
    ]),
  );
}

export function parseSupplierApplicationCreateInput(
  source: Record<string, unknown>,
): SupplierApplicationCreateInput {
  const website = normalizedWebsite(source.companyWebsite);
  return {
    contact: {
      firstName: text(source.firstName, "firstName", 120, true),
      lastName: text(source.lastName, "lastName", 120, true),
      jobTitle: text(source.jobTitle, "jobTitle", 160, true),
      workEmail: requiredEmail(source.workEmail),
      phoneNumber: text(source.phoneNumber, "phoneNumber", 50, true),
    },
    legalCompanyName: text(
      source.legalCompanyName,
      "legalCompanyName",
      160,
      true,
    ),
    tradeName: nullableText(source.tradeName, "tradeName", 160),
    companyWebsite: website.url,
    registrationCountry: text(
      source.registrationCountry,
      "registrationCountry",
      100,
      true,
    ),
    brandsHandled: stringList(source.brandsHandled, "brandsHandled", 50, 120),
    annualRevenueRange: text(
      source.annualRevenueRange,
      "annualRevenueRange",
      80,
      true,
    ),
    warehouseType: text(source.warehouseType, "warehouseType", 120, true),
    skuCountRange: text(source.skuCountRange, "skuCountRange", 80, true),
  };
}

export function parseSupplierApplicationUpdateInput(
  source: Record<string, unknown>,
): SupplierApplicationUpdateInput {
  const next: SupplierApplicationUpdateInput = {};
  if ("legalCompanyName" in source)
    next.legalCompanyName = text(
      source.legalCompanyName,
      "legalCompanyName",
      160,
      true,
    );
  if ("tradeName" in source)
    next.tradeName = nullableText(source.tradeName, "tradeName", 160);
  if ("companyWebsite" in source)
    next.companyWebsite = normalizedWebsite(source.companyWebsite).url;
  if ("registrationCountry" in source)
    next.registrationCountry = text(
      source.registrationCountry,
      "registrationCountry",
      100,
      true,
    );
  if ("brandsHandled" in source)
    next.brandsHandled = stringList(
      source.brandsHandled,
      "brandsHandled",
      50,
      120,
    );
  if ("annualRevenueRange" in source)
    next.annualRevenueRange = text(
      source.annualRevenueRange,
      "annualRevenueRange",
      80,
      true,
    );
  if ("warehouseType" in source)
    next.warehouseType = text(source.warehouseType, "warehouseType", 120, true);
  if ("skuCountRange" in source)
    next.skuCountRange = text(source.skuCountRange, "skuCountRange", 80, true);
  if ("contact" in source) {
    const contact = source.contact;
    if (!contact || typeof contact !== "object" || Array.isArray(contact))
      throw validationError("contact is invalid.");
    const record = contact as Record<string, unknown>;
    next.contact = {
      firstName: text(record.firstName, "firstName", 120, true),
      lastName: text(record.lastName, "lastName", 120, true),
      jobTitle: text(record.jobTitle, "jobTitle", 160, true),
      workEmail: requiredEmail(record.workEmail),
      phoneNumber: text(record.phoneNumber, "phoneNumber", 50, true),
    };
  }
  if ("businessVerification" in source) {
    const business = source.businessVerification;
    if (!business || typeof business !== "object" || Array.isArray(business))
      throw validationError("businessVerification is invalid.");
    const record = business as Record<string, unknown>;
    next.businessVerification = {
      registrationNumber: text(
        record.registrationNumber,
        "registrationNumber",
        160,
      ),
      representativeInformation: text(
        record.representativeInformation,
        "representativeInformation",
        500,
      ),
      registeredAddress: text(
        record.registeredAddress,
        "registeredAddress",
        500,
      ),
      operatingAddress: text(record.operatingAddress, "operatingAddress", 500),
      authorityDescription: text(
        record.authorityDescription,
        "authorityDescription",
        1_000,
      ),
      taxCountry: text(record.taxCountry, "taxCountry", 100),
    };
  }
  if ("operations" in source) {
    const operations = source.operations;
    if (
      !operations ||
      typeof operations !== "object" ||
      Array.isArray(operations)
    )
      throw validationError("operations is invalid.");
    const record = operations as Record<string, unknown>;
    const method = text(
      record.inventoryUpdateMethod,
      "inventoryUpdateMethod",
      40,
      true,
    );
    if (!["EXCEL_CSV", "MANUAL_PORTAL", "API", "FTP", "ERP"].includes(method)) {
      throw validationError("inventoryUpdateMethod is invalid.");
    }
    next.operations = {
      companyMov: text(record.companyMov, "companyMov", 80),
      brandLevelMov: stringRecord(record.brandLevelMov ?? {}, "brandLevelMov"),
      defaultLeadTimeDays: positiveInteger(
        record.defaultLeadTimeDays,
        "defaultLeadTimeDays",
      ),
      onHandStockLeadTimeDays: positiveInteger(
        record.onHandStockLeadTimeDays,
        "onHandStockLeadTimeDays",
      ),
      sourcedAfterOrderLeadTimeDays: positiveInteger(
        record.sourcedAfterOrderLeadTimeDays,
        "sourcedAfterOrderLeadTimeDays",
      ),
      allowedCountries: stringList(
        record.allowedCountries ?? [],
        "allowedCountries",
        100,
        100,
      ),
      restrictedCountries: stringList(
        record.restrictedCountries ?? [],
        "restrictedCountries",
        100,
        100,
      ),
      dailyOrderCapacity: positiveInteger(
        record.dailyOrderCapacity,
        "dailyOrderCapacity",
      ),
      dailyUnitCapacity: positiveInteger(
        record.dailyUnitCapacity,
        "dailyUnitCapacity",
      ),
      boxPacking: record.boxPacking === true,
      palletPacking: record.palletPacking === true,
      hazardousGoodsPacking: record.hazardousGoodsPacking === true,
      temperatureControlledPacking:
        record.temperatureControlledPacking === true,
      weekendShipping: record.weekendShipping === true,
      inventoryUpdateMethod:
        method as NonNullable<
          SupplierApplicationUpdateInput["operations"]
        >["inventoryUpdateMethod"],
      inventoryUpdateFrequency: text(
        record.inventoryUpdateFrequency,
        "inventoryUpdateFrequency",
        80,
      ),
    };
  }
  if ("stakeholders" in source) {
    next.stakeholders = requiredArray(
      source.stakeholders,
      "stakeholders",
      50,
    ).map((record) => ({
      fullName: text(record.fullName, "stakeholder.fullName", 160, true),
      title: text(record.title, "stakeholder.title", 160),
      relationship: text(record.relationship, "stakeholder.relationship", 160),
      ownershipPercent: text(
        record.ownershipPercent,
        "stakeholder.ownershipPercent",
        32,
      ),
      country: text(record.country, "stakeholder.country", 100),
    }));
  }
  if ("warehouses" in source) {
    next.warehouses = requiredArray(source.warehouses, "warehouses", 30).map(
      (record) => ({
        name: text(record.name, "warehouse.name", 160, true),
        address: text(record.address, "warehouse.address", 500, true),
        operator: text(record.operator, "warehouse.operator", 160),
        contactName: text(record.contactName, "warehouse.contactName", 160),
        contactPhone: text(record.contactPhone, "warehouse.contactPhone", 50),
        openingHours: text(record.openingHours, "warehouse.openingHours", 160),
        dailyOrderCapacity: positiveInteger(
          record.dailyOrderCapacity,
          "warehouse.dailyOrderCapacity",
        ),
        warehouseType: text(
          record.warehouseType,
          "warehouse.warehouseType",
          120,
        ),
      }),
    );
  }
  if ("supplyChains" in source) {
    next.supplyChains = requiredArray(
      source.supplyChains,
      "supplyChains",
      50,
    ).map((record) => ({
      relationshipType: supplyChainType(
        record.relationshipType,
        "supplyChain.relationshipType",
      ),
      supplierCompany: text(
        record.supplierCompany,
        "supplyChain.supplierCompany",
        160,
      ),
      countries: stringList(
        record.countries ?? [],
        "supplyChain.countries",
        100,
        100,
      ),
      description: text(record.description, "supplyChain.description", 2_000),
    }));
  }
  if ("brands" in source) {
    const seenBrands = new Set<string>();
    next.brands = requiredArray(source.brands, "brands", 100).map((record) => {
      const brand = text(record.brand, "brand.brand", 160, true);
      const key = brand.toLocaleLowerCase();
      if (seenBrands.has(key))
        throw validationError("brands contains duplicate brands.");
      seenBrands.add(key);
      return {
        brand,
        relationshipType: supplyChainType(
          record.relationshipType,
          "brand.relationshipType",
        ),
        supplierCompany: text(
          record.supplierCompany,
          "brand.supplierCompany",
          160,
        ),
        transactionStartedAt: nullableDate(
          record.transactionStartedAt,
          "brand.transactionStartedAt",
        ),
        countryRestrictions: stringList(
          record.countryRestrictions ?? [],
          "brand.countryRestrictions",
          100,
          100,
        ),
      };
    });
  }
  if ("settlement" in source) {
    const settlement = source.settlement;
    if (
      !settlement ||
      typeof settlement !== "object" ||
      Array.isArray(settlement)
    )
      throw validationError("settlement is invalid.");
    const record = settlement as Record<string, unknown>;
    const accountNumber = nullableText(
      record.accountNumber,
      "settlement.accountNumber",
      160,
    );
    const taxNumber = nullableText(
      record.taxNumber,
      "settlement.taxNumber",
      160,
    );
    if (record.acceptsPayoutPolicy !== true)
      throw validationError("settlement.acceptsPayoutPolicy is required.");
    next.settlement = {
      legalAccountHolder: text(
        record.legalAccountHolder,
        "settlement.legalAccountHolder",
        160,
        true,
      ),
      bankName: text(record.bankName, "settlement.bankName", 160, true),
      bankCountry: text(
        record.bankCountry,
        "settlement.bankCountry",
        100,
        true,
      ),
      accountNumber,
      bankCode: text(record.bankCode, "settlement.bankCode", 80),
      swiftBic: text(record.swiftBic, "settlement.swiftBic", 80),
      payoutCurrency: text(
        record.payoutCurrency,
        "settlement.payoutCurrency",
        8,
        true,
      ).toUpperCase(),
      taxCountry: text(record.taxCountry, "settlement.taxCountry", 100),
      taxNumber,
      vatInformation: text(
        record.vatInformation,
        "settlement.vatInformation",
        500,
      ),
      invoiceMethod: text(
        record.invoiceMethod,
        "settlement.invoiceMethod",
        160,
      ),
      acceptsPayoutPolicy: true,
    };
  }
  if (!Object.keys(next).length)
    throw validationError("No supported application fields were provided.");
  return next;
}

async function writeDuplicateFlags(
  tx: Prisma.TransactionClient,
  application: { id: string; legalCompanyName: string; companyWebsite: string },
  contact: { workEmail: string; phoneNumber: string },
) {
  const domain = new URL(application.companyWebsite).hostname.toLowerCase();
  const [companies, applications] = await Promise.all([
    tx.company.findMany({
      where: {
        OR: [
          {
            legalName: {
              equals: application.legalCompanyName,
              mode: "insensitive",
            },
          },
          { website: { contains: domain, mode: "insensitive" } },
        ],
      },
      select: { id: true, legalName: true, website: true },
      take: 20,
    }),
    tx.supplierApplication.findMany({
      where: {
        id: { not: application.id },
        OR: [
          {
            legalCompanyName: {
              equals: application.legalCompanyName,
              mode: "insensitive",
            },
          },
          { websiteDomain: domain },
          { contacts: { some: { workEmail: contact.workEmail } } },
          { contacts: { some: { phoneNumber: contact.phoneNumber } } },
        ],
      },
      select: {
        id: true,
        legalCompanyName: true,
        websiteDomain: true,
        contacts: { select: { workEmail: true, phoneNumber: true } },
      },
      take: 20,
    }),
  ]);
  const flags: Array<{
    signal: string;
    matchedEntityType: string;
    matchedEntityId?: string;
    value: string;
  }> = [];
  for (const company of companies) {
    if (
      company.legalName.localeCompare(application.legalCompanyName, undefined, {
        sensitivity: "accent",
      }) === 0
    ) {
      flags.push({
        signal: "LEGAL_COMPANY_NAME",
        matchedEntityType: "COMPANY",
        matchedEntityId: company.id,
        value: application.legalCompanyName,
      });
    }
    if (company.website.toLowerCase().includes(domain)) {
      flags.push({
        signal: "WEBSITE_DOMAIN",
        matchedEntityType: "COMPANY",
        matchedEntityId: company.id,
        value: domain,
      });
    }
  }
  for (const existing of applications) {
    if (
      existing.legalCompanyName.localeCompare(
        application.legalCompanyName,
        undefined,
        { sensitivity: "accent" },
      ) === 0
    ) {
      flags.push({
        signal: "LEGAL_COMPANY_NAME",
        matchedEntityType: "SUPPLIER_APPLICATION",
        matchedEntityId: existing.id,
        value: application.legalCompanyName,
      });
    }
    if (existing.websiteDomain === domain) {
      flags.push({
        signal: "WEBSITE_DOMAIN",
        matchedEntityType: "SUPPLIER_APPLICATION",
        matchedEntityId: existing.id,
        value: domain,
      });
    }
  }
  const contactSignals = [
    {
      signal: "WORK_EMAIL",
      value: contact.workEmail,
      matches: (existing: (typeof applications)[number]) =>
        existing.contacts.some(
          (candidate) =>
            candidate.workEmail.toLowerCase() ===
            contact.workEmail.toLowerCase(),
        ),
    },
    {
      signal: "PHONE_NUMBER",
      value: contact.phoneNumber,
      matches: (existing: (typeof applications)[number]) =>
        existing.contacts.some(
          (candidate) => candidate.phoneNumber === contact.phoneNumber,
        ),
    },
  ];
  for (const signal of contactSignals) {
    const matched = applications.some(
      (item) => item.id !== application.id && signal.matches(item),
    );
    if (matched)
      flags.push({
        signal: signal.signal,
        matchedEntityType: "SUPPLIER_APPLICATION",
        value: signal.value,
      });
  }
  if (flags.length) {
    await tx.supplierDuplicateFlag.createMany({
      data: flags.map((flag) => ({
        applicationId: application.id,
        signal: flag.signal,
        matchedEntityType: flag.matchedEntityType,
        matchedEntityId: flag.matchedEntityId,
        matchedValueHash: duplicateValueHash(flag.value),
      })),
      skipDuplicates: true,
    });
    await tx.supplierApplication.update({
      where: { id: application.id },
      data: { riskLevel: "DUPLICATE_REVIEW" },
    });
  }
}

export async function createOrResumeSupplierApplication({
  userId,
  input,
}: {
  userId: string;
  input: SupplierApplicationCreateInput;
}) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`supplier-application:${userId}`}, 0))`;
    const existing = await tx.supplierApplication.findFirst({
      where: {
        applicantUserId: userId,
        status: {
          notIn: [
            SupplierApplicationStatus.REJECTED,
            SupplierApplicationStatus.WITHDRAWN,
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
      include: { contacts: { where: { isPrimary: true }, take: 1 } },
    });
    if (existing) return { application: existing, resumed: true };
    const existingVerifiedSupplier = await tx.company.findUnique({
      where: {
        ownerUserId_companyRole: {
          ownerUserId: userId,
          companyRole: "seller",
        },
      },
      select: { verificationStatus: true, deletedAt: true },
    });
    if (
      existingVerifiedSupplier &&
      !existingVerifiedSupplier.deletedAt &&
      existingVerifiedSupplier.verificationStatus === "verified"
    ) {
      throw new Response(
        "Existing verified suppliers should use the supplier dashboard. Contact support if a verification update is required.",
        { status: 409 },
      );
    }
    const website = normalizedWebsite(input.companyWebsite);
    const application = await tx.supplierApplication.create({
      data: {
        applicationNumber: applicationNumber(),
        applicantUserId: userId,
        legalCompanyName: input.legalCompanyName,
        tradeName: input.tradeName,
        companyWebsite: website.url,
        websiteDomain: website.domain,
        registrationCountry: input.registrationCountry,
        brandsHandled: input.brandsHandled,
        annualRevenueRange: input.annualRevenueRange,
        warehouseType: input.warehouseType,
        skuCountRange: input.skuCountRange,
        contacts: {
          create: {
            ...input.contact,
            contactType: "PRIMARY",
            isPrimary: true,
          },
        },
        auditEvents: {
          create: { action: "CREATED", before: {}, after: { status: "DRAFT" } },
        },
        statusHistory: {
          create: {
            toStatus: SupplierApplicationStatus.DRAFT,
            actorUserId: userId,
            actorType: "APPLICANT",
          },
        },
      },
      include: { contacts: { where: { isPrimary: true }, take: 1 } },
    });
    await writeDuplicateFlags(tx, application, input.contact);
    return { application, resumed: false };
  });
}

export async function getCurrentSupplierApplication(userId: string) {
  return getDb().supplierApplication.findFirst({
    where: { applicantUserId: userId },
    orderBy: { updatedAt: "desc" },
    include: applicationDetailInclude,
  });
}

const applicationDetailInclude = {
  contacts: { orderBy: { isPrimary: "desc" as const } },
  businessVerification: true,
  stakeholders: { orderBy: { createdAt: "asc" as const } },
  warehouses: { orderBy: { createdAt: "asc" as const } },
  supplyChains: { orderBy: { createdAt: "asc" as const } },
  brandVerifications: { orderBy: { createdAt: "asc" as const } },
  operationsProfile: true,
  settlementProfile: true,
  documents: { orderBy: { createdAt: "desc" as const } },
  inventorySamples: { orderBy: { createdAt: "desc" as const } },
  reviews: { orderBy: { createdAt: "desc" as const } },
  statusHistory: { orderBy: { createdAt: "desc" as const } },
  informationRequests: { orderBy: { createdAt: "desc" as const } },
  duplicateFlags: { orderBy: { createdAt: "desc" as const } },
  approvedCompany: {
    select: {
      id: true,
      verificationStatus: true,
      sellerPayoutProfile: { select: { status: true } },
    },
  },
} satisfies Prisma.SupplierApplicationInclude;

export async function getSupplierApplicationForApplicant(
  applicationId: string,
  userId: string,
) {
  const application = await getDb().supplierApplication.findFirst({
    where: { id: applicationId, applicantUserId: userId },
    include: applicationDetailInclude,
  });
  if (!application)
    throw new Response("Supplier application not found.", { status: 404 });
  return application;
}

export async function getSupplierApplicationForAdmin(applicationId: string) {
  const application = await getDb().supplierApplication.findUnique({
    where: { id: applicationId },
    include: {
      ...applicationDetailInclude,
      applicant: {
        select: {
          id: true,
          email: true,
          displayName: true,
          preferredLanguage: true,
        },
      },
      assignedAdmin: { select: { id: true, displayName: true, email: true } },
    },
  });
  if (!application)
    throw new Response("Supplier application not found.", { status: 404 });
  return application;
}

export function canEditSupplierApplication(status: SupplierApplicationStatus) {
  return supplierApplicationEditableStatuses.has(status);
}

export async function updateSupplierApplication({
  applicationId,
  userId,
  input,
}: {
  applicationId: string;
  userId: string;
  input: SupplierApplicationUpdateInput;
}) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    const application = await tx.supplierApplication.findFirst({
      where: { id: applicationId, applicantUserId: userId },
      include: { contacts: { where: { isPrimary: true }, take: 1 } },
    });
    if (!application)
      throw new Response("Supplier application not found.", { status: 404 });
    if (!canEditSupplierApplication(application.status)) {
      throw new Response("This supplier application is read-only.", {
        status: 409,
      });
    }
    const website = input.companyWebsite
      ? normalizedWebsite(input.companyWebsite)
      : null;
    const updated = await tx.supplierApplication.update({
      where: { id: application.id },
      data: {
        legalCompanyName: input.legalCompanyName,
        tradeName: input.tradeName,
        companyWebsite: website?.url,
        websiteDomain: website?.domain,
        registrationCountry: input.registrationCountry,
        brandsHandled: input.brandsHandled,
        annualRevenueRange: input.annualRevenueRange,
        warehouseType: input.warehouseType,
        skuCountRange: input.skuCountRange,
        ...(input.businessVerification
          ? {
              businessVerification: {
                upsert: {
                  create: input.businessVerification,
                  update: input.businessVerification,
                },
              },
            }
          : {}),
        ...(input.operations
          ? {
              operationsProfile: {
                upsert: { create: input.operations, update: input.operations },
              },
            }
          : {}),
      },
    });
    if (input.contact) {
      const primary = application.contacts[0];
      if (primary) {
        await tx.supplierApplicationContact.update({
          where: { id: primary.id },
          data: input.contact,
        });
      } else {
        await tx.supplierApplicationContact.create({
          data: {
            applicationId: application.id,
            ...input.contact,
            contactType: "PRIMARY",
            isPrimary: true,
          },
        });
      }
    }
    const duplicateContact = input.contact ?? application.contacts[0];
    if (
      duplicateContact &&
      (input.legalCompanyName !== undefined ||
        input.companyWebsite !== undefined ||
        input.contact !== undefined)
    ) {
      await writeDuplicateFlags(
        tx,
        {
          id: application.id,
          legalCompanyName: updated.legalCompanyName,
          companyWebsite: updated.companyWebsite,
        },
        duplicateContact,
      );
    }
    if (input.stakeholders) {
      await tx.supplierStakeholder.deleteMany({
        where: { applicationId: application.id },
      });
      if (input.stakeholders.length) {
        await tx.supplierStakeholder.createMany({
          data: input.stakeholders.map((stakeholder) => ({
            applicationId: application.id,
            ...stakeholder,
          })),
        });
      }
    }
    if (input.warehouses) {
      await tx.supplierWarehouse.deleteMany({
        where: { applicationId: application.id },
      });
      if (input.warehouses.length) {
        await tx.supplierWarehouse.createMany({
          data: input.warehouses.map((warehouse) => ({
            applicationId: application.id,
            ...warehouse,
          })),
        });
      }
    }
    if (input.supplyChains) {
      await tx.supplierSupplyChain.deleteMany({
        where: { applicationId: application.id },
      });
      if (input.supplyChains.length) {
        await tx.supplierSupplyChain.createMany({
          data: input.supplyChains.map((supplyChain) => ({
            applicationId: application.id,
            ...supplyChain,
          })),
        });
      }
    }
    if (input.brands) {
      // Preserve prior verification evidence and its audit trail. A changed
      // brand record is reset to PENDING by the reviewer workflow rather than
      // deleting an already reviewed authorization silently.
      for (const brand of input.brands) {
        await tx.supplierBrandVerification.upsert({
          where: {
            applicationId_brand: {
              applicationId: application.id,
              brand: brand.brand,
            },
          },
          create: { applicationId: application.id, ...brand },
          update: {
            relationshipType: brand.relationshipType,
            supplierCompany: brand.supplierCompany,
            transactionStartedAt: brand.transactionStartedAt,
            countryRestrictions: brand.countryRestrictions,
            status: SupplierBrandVerificationStatus.PENDING,
            evidenceStatus: SupplierReviewStatus.PENDING,
            verifiedAt: null,
            expiresAt: null,
          },
        });
      }
    }
    if (input.settlement) {
      const accountEncryption = input.settlement.accountNumber
        ? encryptPayoutData(input.settlement.accountNumber)
        : null;
      const taxEncryption = input.settlement.taxNumber
        ? encryptPayoutData(input.settlement.taxNumber)
        : null;
      const settlementData = {
        legalAccountHolder: input.settlement.legalAccountHolder,
        bankName: input.settlement.bankName,
        bankCountry: input.settlement.bankCountry,
        bankCode: input.settlement.bankCode,
        swiftBic: input.settlement.swiftBic,
        payoutCurrency: input.settlement.payoutCurrency,
        taxCountry: input.settlement.taxCountry,
        vatInformation: input.settlement.vatInformation,
        invoiceMethod: input.settlement.invoiceMethod,
        payoutPolicyAcceptedAt: new Date(),
        ...(accountEncryption
          ? {
              accountNumberCiphertext: new Uint8Array(
                accountEncryption.ciphertext,
              ),
              accountNumberIv: new Uint8Array(accountEncryption.iv),
              accountNumberAuthTag: new Uint8Array(accountEncryption.authTag),
              accountNumberKeyVersion: accountEncryption.keyVersion,
              accountNumberLast4: lastFour(
                input.settlement.accountNumber ?? "",
              ),
              accountNumberMasked: maskAccountNumber(
                input.settlement.accountNumber ?? "",
              ),
            }
          : {
              accountNumberCiphertext: null,
              accountNumberIv: null,
              accountNumberAuthTag: null,
              accountNumberKeyVersion: null,
              accountNumberLast4: null,
              accountNumberMasked: null,
            }),
        ...(taxEncryption
          ? {
              taxNumberCiphertext: new Uint8Array(taxEncryption.ciphertext),
              taxNumberIv: new Uint8Array(taxEncryption.iv),
              taxNumberAuthTag: new Uint8Array(taxEncryption.authTag),
              taxNumberKeyVersion: taxEncryption.keyVersion,
              taxNumberLast4: lastFour(input.settlement.taxNumber ?? ""),
            }
          : {
              taxNumberCiphertext: null,
              taxNumberIv: null,
              taxNumberAuthTag: null,
              taxNumberKeyVersion: null,
              taxNumberLast4: null,
            }),
      };
      await tx.supplierSettlementProfile.upsert({
        where: { applicationId: application.id },
        create: { applicationId: application.id, ...settlementData },
        update: settlementData,
      });
    }
    await tx.supplierApplicationAuditEvent.create({
      data: {
        applicationId: application.id,
        actorUserId: userId,
        action: "APPLICANT_UPDATED",
        before: { status: application.status },
        after: {
          status: updated.status,
          fields: Object.keys(input).filter(
            (key) => key !== "businessVerification",
          ),
        },
      },
    });
    return updated;
  });
}

export function canTransitionSupplierApplication(
  actor: Exclude<ApplicationActor, "SYSTEM">,
  current: SupplierApplicationStatus,
  target: SupplierApplicationStatus,
) {
  const transitions =
    actor === "APPLICANT" ? applicantTransitions : adminTransitions;
  return transitions[current]?.includes(target) ?? false;
}

async function approvalRequirementsMet(
  tx: Prisma.TransactionClient,
  applicationId: string,
  conditional: boolean,
) {
  const application = await tx.supplierApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      contacts: { where: { isPrimary: true }, take: 1 },
      businessVerification: true,
      brandVerifications: true,
      operationsProfile: true,
      settlementProfile: true,
    },
  });
  if (
    !application.contacts[0] ||
    !application.legalCompanyName ||
    !application.registrationCountry
  ) {
    throw validationError(
      "Basic supplier application information is incomplete.",
    );
  }
  if (
    application.businessVerification?.reviewStatus !==
    SupplierReviewStatus.VERIFIED
  ) {
    throw validationError(
      "Business verification must be verified before approval.",
    );
  }
  if (
    !application.brandVerifications.some(
      (brand) => brand.status === SupplierBrandVerificationStatus.VERIFIED,
    )
  ) {
    throw validationError(
      "At least one brand must be verified before approval.",
    );
  }
  if (
    !conditional &&
    application.operationsProfile?.reviewStatus !==
      SupplierReviewStatus.VERIFIED
  ) {
    throw validationError(
      "Operations verification must be verified before full approval.",
    );
  }
  if (
    !conditional &&
    application.settlementProfile?.reviewStatus !==
      SupplierReviewStatus.VERIFIED
  ) {
    throw validationError(
      "Settlement verification must be verified before full approval.",
    );
  }
  return application;
}

/**
 * A conditionally approved supplier still needs a private operational Company
 * record for a test order or other explicitly limited work. The capability
 * service remains the source of truth: this does not grant product creation,
 * inventory upload, or offer publishing until the application is APPROVED and
 * a brand is verified.
 */
async function ensureApprovedCompany(
  tx: Prisma.TransactionClient,
  applicationId: string,
  conditional: boolean,
) {
  const application = await approvalRequirementsMet(
    tx,
    applicationId,
    conditional,
  );
  const business = application.businessVerification!;
  const existing =
    application.approvedCompanyId || application.legacyCompanyId
      ? await tx.company.findFirst({
          where: {
            id:
              application.approvedCompanyId ??
              application.legacyCompanyId ??
              "",
          },
        })
      : await tx.company.findUnique({
          where: {
            ownerUserId_companyRole: {
              ownerUserId: application.applicantUserId,
              companyRole: "seller",
            },
          },
        });
  const company = existing
    ? await tx.company.update({
        where: { id: existing.id },
        data: {
          verificationStatus: "verified",
          verifiedSellerSince: existing.verifiedSellerSince ?? new Date(),
        },
      })
    : await tx.company.create({
        data: {
          ownerUserId: application.applicantUserId,
          companyRole: "seller",
          legalName: application.legalCompanyName,
          tradeName: application.tradeName,
          website: application.companyWebsite,
          country: application.registrationCountry,
          city: "",
          businessAddress: business.registeredAddress,
          verificationStatus: "verified",
          verifiedSellerSince: new Date(),
        },
      });
  await tx.sellerProfile.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      koreanBusinessRegistrationNumber: business.registrationNumber,
      representativeName: business.representativeInformation,
      exportExperience: "Supplier application verified",
      exportCountries: application.operationsProfile?.allowedCountries ?? [],
      productCategories: [],
      minimumOrderQuantity: application.operationsProfile?.companyMov ?? "",
      leadTime:
        application.operationsProfile?.defaultLeadTimeDays?.toString() ?? "",
      factoryOrDistributorStatus: "supplier_application",
    },
    update: {},
  });
  const profile = await tx.userProfile.findUniqueOrThrow({
    where: { id: application.applicantUserId },
    select: { role: true },
  });
  if (profile.role !== AccountRole.admin) {
    await tx.userProfile.update({
      where: { id: application.applicantUserId },
      data: {
        role:
          profile.role === AccountRole.buyer
            ? AccountRole.both
            : AccountRole.seller,
      },
    });
  }
  return company;
}

export async function transitionSupplierApplication({
  applicationId,
  actorUserId,
  actor,
  targetStatus,
  reason,
}: {
  applicationId: string;
  actorUserId: string;
  actor: Exclude<ApplicationActor, "SYSTEM">;
  targetStatus: SupplierApplicationStatus;
  reason?: string | null;
}) {
  const trimmedReason = reason?.trim() || null;
  if (statusReasonRequired.has(targetStatus) && !trimmedReason) {
    throw validationError("A reason is required for this status change.");
  }
  const db = getDb();
  return db.$transaction(async (tx) => {
    const application = await tx.supplierApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application)
      throw new Response("Supplier application not found.", { status: 404 });
    if (!canTransitionSupplierApplication(actor, application.status, targetStatus)) {
      throw validationError(
        "This supplier application transition is not allowed.",
      );
    }
    if (actor === "APPLICANT" && application.applicantUserId !== actorUserId) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (
      targetStatus === SupplierApplicationStatus.SUBMITTED &&
      !application.legalCompanyName
    ) {
      throw validationError(
        "Complete the initial supplier application before submitting.",
      );
    }
    const conditional =
      targetStatus === SupplierApplicationStatus.CONDITIONALLY_APPROVED;
    const company =
      targetStatus === SupplierApplicationStatus.APPROVED || conditional
        ? await ensureApprovedCompany(tx, application.id, conditional)
        : null;
    const now = new Date();
    const updated = await tx.supplierApplication.update({
      where: { id: application.id },
      data: {
        status: targetStatus,
        statusReason: trimmedReason,
        submittedAt:
          targetStatus === SupplierApplicationStatus.SUBMITTED
            ? now
            : application.submittedAt,
        withdrawnAt:
          targetStatus === SupplierApplicationStatus.WITHDRAWN
            ? now
            : application.withdrawnAt,
        approvedAt:
          targetStatus === SupplierApplicationStatus.APPROVED
            ? now
            : application.approvedAt,
        approvedCompanyId: company?.id ?? application.approvedCompanyId,
      },
    });
    await tx.supplierApplicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: application.status,
        toStatus: targetStatus,
        reason: trimmedReason,
        actorUserId,
        actorType: actor,
      },
    });
    await tx.supplierApplicationAuditEvent.create({
      data: {
        applicationId: application.id,
        actorUserId,
        action: "STATUS_TRANSITION",
        before: { status: application.status },
        after: { status: targetStatus, reasonProvided: Boolean(trimmedReason) },
      },
    });
    return updated;
  });
}

export async function createSupplierInformationRequest({
  applicationId,
  adminUserId,
  section,
  message,
  targetStatus,
}: {
  applicationId: string;
  adminUserId: string;
  section: SupplierApplicationSection;
  message: string;
  targetStatus:
    | typeof SupplierApplicationStatus.ADDITIONAL_INFORMATION_REQUIRED
    | typeof SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED
    | typeof SupplierApplicationStatus.INVENTORY_VERIFICATION_REQUIRED;
}) {
  const requestMessage = text(message, "message", 4_000, true);
  return getDb().$transaction(async (tx) => {
    const application = await tx.supplierApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application)
      throw new Response("Supplier application not found.", { status: 404 });
    if (!canTransitionSupplierApplication("ADMIN", application.status, targetStatus)) {
      throw validationError(
        "This supplier application transition is not allowed.",
      );
    }
    const updated = await tx.supplierApplication.update({
      where: { id: applicationId },
      data: { status: targetStatus, statusReason: requestMessage },
    });
    await tx.supplierInformationRequest.create({
      data: {
        applicationId,
        section,
        message: requestMessage,
        requestedByUserId: adminUserId,
      },
    });
    await tx.supplierApplicationStatusHistory.create({
      data: {
        applicationId,
        fromStatus: application.status,
        toStatus: targetStatus,
        reason: requestMessage,
        actorUserId: adminUserId,
        actorType: "ADMIN",
      },
    });
    await tx.supplierApplicationAuditEvent.create({
      data: {
        applicationId,
        actorUserId: adminUserId,
        action: "INFORMATION_REQUESTED",
        before: { status: application.status },
        after: { status: targetStatus, section },
      },
    });
    return updated;
  });
}

export async function recordSupplierApplicationReview({
  applicationId,
  adminUserId,
  section,
  status,
  notes,
}: {
  applicationId: string;
  adminUserId: string;
  section: SupplierApplicationSection;
  status: SupplierReviewStatus;
  notes?: string;
}) {
  const db = getDb();
  const note = text(notes ?? "", "notes", 4_000);
  return db.$transaction(async (tx) => {
    const application = await tx.supplierApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application)
      throw new Response("Supplier application not found.", { status: 404 });
    const review = await tx.supplierApplicationReview.create({
      data: {
        applicationId,
        section,
        status,
        notes: note,
        reviewedByUserId: adminUserId,
      },
    });
    if (section === SupplierApplicationSection.BUSINESS_VERIFICATION) {
      await tx.supplierBusinessVerification.updateMany({
        where: { applicationId },
        data: { reviewStatus: status, reviewedAt: new Date() },
      });
    }
    if (section === SupplierApplicationSection.OPERATIONS) {
      await tx.supplierOperationsProfile.updateMany({
        where: { applicationId },
        data: { reviewStatus: status, reviewedAt: new Date() },
      });
    }
    if (section === SupplierApplicationSection.SETTLEMENT) {
      await tx.supplierSettlementProfile.updateMany({
        where: { applicationId },
        data: { reviewStatus: status, reviewedAt: new Date() },
      });
    }
    if (section === SupplierApplicationSection.BRANDS) {
      const brandStatus =
        status === SupplierReviewStatus.VERIFIED
          ? SupplierBrandVerificationStatus.VERIFIED
          : status === SupplierReviewStatus.ADDITIONAL_INFORMATION_REQUIRED
            ? SupplierBrandVerificationStatus.ADDITIONAL_EVIDENCE_REQUIRED
            : status === SupplierReviewStatus.REJECTED ||
                status === SupplierReviewStatus.INVALID_DOCUMENT
              ? SupplierBrandVerificationStatus.REJECTED
              : SupplierBrandVerificationStatus.PENDING;
      await tx.supplierBrandVerification.updateMany({
        where: {
          applicationId,
          status: SupplierBrandVerificationStatus.PENDING,
        },
        data: {
          evidenceStatus: status,
          status: brandStatus,
          verifiedAt:
            brandStatus === SupplierBrandVerificationStatus.VERIFIED
              ? new Date()
              : null,
        },
      });
    }
    if (section === SupplierApplicationSection.DOCUMENTS) {
      await tx.supplierApplicationDocument.updateMany({
        where: { applicationId, reviewStatus: SupplierReviewStatus.PENDING },
        data: { reviewStatus: status, reviewedAt: new Date() },
      });
    }
    if (section === SupplierApplicationSection.INVENTORY_SAMPLE) {
      await tx.supplierInventorySample.updateMany({
        where: { applicationId, reviewStatus: SupplierReviewStatus.PENDING },
        data: { reviewStatus: status, reviewedAt: new Date() },
      });
    }
    await tx.supplierApplicationAuditEvent.create({
      data: {
        applicationId,
        actorUserId: adminUserId,
        action: "SECTION_REVIEWED",
        before: {},
        after: { section, status },
      },
    });
    return review;
  });
}

export async function getSupplierApplicationCapabilities(
  userId: string,
): Promise<SupplierApplicationCapabilities> {
  const db = getDb();
  const [application, company] = await Promise.all([
    db.supplierApplication.findFirst({
      where: { applicantUserId: userId },
      orderBy: { updatedAt: "desc" },
      include: {
        approvedCompany: {
          select: {
            id: true,
            verificationStatus: true,
            sellerPayoutProfile: { select: { status: true } },
          },
        },
        brandVerifications: { select: { status: true } },
      },
    }),
    db.company.findUnique({
      where: {
        ownerUserId_companyRole: { ownerUserId: userId, companyRole: "seller" },
      },
      include: { sellerPayoutProfile: { select: { status: true } } },
    }),
  ]);
  if (!application) {
    const legacyVerified = Boolean(
      company &&
      !company.deletedAt &&
      company.verificationStatus === "verified",
    );
    return {
      applicationId: null,
      status: null,
      companyId: company?.id ?? null,
      canEditApplication: false,
      canUploadInventorySample: false,
      // Existing verified sellers remain operational until the dry-run and
      // reviewed legacy backfill has assigned an application status.
      canUploadLiveInventory: legacyVerified,
      canCreateProductCandidate: legacyVerified,
      canPublishOffer: legacyVerified,
      canReceiveOrder: legacyVerified,
      canShipOrder: legacyVerified,
      canReceivePayout:
        legacyVerified && company?.sellerPayoutProfile?.status === "VERIFIED",
      isLegacyFallback: legacyVerified,
    };
  }
  const approvedCompany = application.approvedCompany ?? company;
  const activeApproved =
    application.status === SupplierApplicationStatus.APPROVED &&
    approvedCompany?.verificationStatus === "verified";
  const verifiedBrand = application.brandVerifications.some(
    (brand) => brand.status === SupplierBrandVerificationStatus.VERIFIED,
  );
  const conditional =
    application.status === SupplierApplicationStatus.CONDITIONALLY_APPROVED;
  return {
    applicationId: application.id,
    status: application.status,
    companyId: approvedCompany?.id ?? null,
    canEditApplication: canEditSupplierApplication(application.status),
    canUploadInventorySample: ([
      SupplierApplicationStatus.PRODUCT_AUTHENTICITY_VERIFICATION,
      SupplierApplicationStatus.INVENTORY_VERIFICATION_REQUIRED,
      SupplierApplicationStatus.ADDITIONAL_DOCUMENTS_REQUIRED,
    ] as readonly SupplierApplicationStatus[]).includes(application.status),
    canUploadLiveInventory: Boolean(activeApproved && verifiedBrand),
    canCreateProductCandidate: Boolean(activeApproved && verifiedBrand),
    canPublishOffer: Boolean(activeApproved && verifiedBrand),
    canReceiveOrder: Boolean(
      (activeApproved || conditional) &&
      approvedCompany?.verificationStatus === "verified",
    ),
    canShipOrder: Boolean(
      (activeApproved || conditional) &&
      approvedCompany?.verificationStatus === "verified",
    ),
    canReceivePayout: Boolean(
      activeApproved &&
      approvedCompany?.sellerPayoutProfile?.status === "VERIFIED",
    ),
    isLegacyFallback: false,
  };
}

export async function requireSupplierCapability(
  userId: string,
  capability: keyof Omit<
    SupplierApplicationCapabilities,
    "applicationId" | "status" | "companyId" | "isLegacyFallback"
  >,
) {
  const access = await getSupplierApplicationCapabilities(userId);
  if (!access[capability]) {
    throw new Response("Supplier approval is required for this action.", {
      status: 403,
    });
  }
  return access;
}

export function supplierApplicationProgress(application: {
  contacts: Array<unknown>;
  businessVerification: unknown;
  warehouses: Array<unknown>;
  supplyChains: Array<unknown>;
  brandVerifications: Array<unknown>;
  inventorySamples: Array<unknown>;
  operationsProfile: unknown;
  settlementProfile: unknown;
  documents: Array<unknown>;
}) {
  const sections = [
    Boolean(application.contacts.length),
    Boolean(application.businessVerification),
    Boolean(application.warehouses.length),
    Boolean(application.supplyChains.length),
    Boolean(application.brandVerifications.length),
    Boolean(application.inventorySamples.length),
    Boolean(application.operationsProfile),
    Boolean(application.settlementProfile),
    Boolean(application.documents.length),
  ];
  const complete = sections.filter(Boolean).length;
  return {
    complete,
    total: sections.length,
    percent: Math.round((complete / sections.length) * 100),
  };
}

export function supplierApplicationSafeResponse(
  application: Awaited<ReturnType<typeof getSupplierApplicationForApplicant>>,
) {
  const {
    settlementProfile,
    businessVerification,
    documents,
    inventorySamples,
    ...applicationWithPrivateRelations
  } = application;
  const safeApplication = Object.fromEntries(
    Object.entries(applicationWithPrivateRelations).filter(
      ([key]) => key !== "reviews" && key !== "duplicateFlags",
    ),
  ) as Omit<
    typeof applicationWithPrivateRelations,
    "reviews" | "duplicateFlags"
  >;
  return {
    ...safeApplication,
    businessVerification: businessVerification
      ? {
          ...businessVerification,
          taxNumberCiphertext: undefined,
          taxNumberIv: undefined,
          taxNumberAuthTag: undefined,
          taxNumberKeyVersion: undefined,
        }
      : null,
    settlementProfile: settlementProfile
      ? {
          ...settlementProfile,
          accountNumberCiphertext: undefined,
          accountNumberIv: undefined,
          accountNumberAuthTag: undefined,
          accountNumberKeyVersion: undefined,
          taxNumberCiphertext: undefined,
          taxNumberIv: undefined,
          taxNumberAuthTag: undefined,
          taxNumberKeyVersion: undefined,
        }
      : null,
    documents: documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      reviewStatus: document.reviewStatus,
      reviewedAt: document.reviewedAt,
      createdAt: document.createdAt,
    })),
    inventorySamples: inventorySamples.map((sample) => ({
      id: sample.id,
      format: sample.format,
      originalFilename: sample.originalFilename,
      mimeType: sample.mimeType,
      sizeBytes: sample.sizeBytes,
      totalRows: sample.totalRows,
      validRows: sample.validRows,
      invalidRows: sample.invalidRows,
      duplicateGtins: sample.duplicateGtins,
      validationSummary: sample.validationSummary,
      reviewStatus: sample.reviewStatus,
      reviewedAt: sample.reviewedAt,
      createdAt: sample.createdAt,
    })),
    progress: supplierApplicationProgress(application),
  };
}

/**
 * Admins review private records through short-lived signed URLs. Returning a
 * database storage path or encrypted financial blobs in the detail payload is
 * unnecessary and makes accidental disclosure through browser tooling easier.
 */
export function supplierApplicationAdminResponse(
  application: Awaited<ReturnType<typeof getSupplierApplicationForAdmin>>,
) {
  const {
    settlementProfile,
    businessVerification,
    documents,
    inventorySamples,
    ...safeApplication
  } = application;
  return {
    ...safeApplication,
    businessVerification: businessVerification
      ? {
          ...businessVerification,
          taxNumberCiphertext: undefined,
          taxNumberIv: undefined,
          taxNumberAuthTag: undefined,
          taxNumberKeyVersion: undefined,
        }
      : null,
    settlementProfile: settlementProfile
      ? {
          ...settlementProfile,
          accountNumberCiphertext: undefined,
          accountNumberIv: undefined,
          accountNumberAuthTag: undefined,
          accountNumberKeyVersion: undefined,
          taxNumberCiphertext: undefined,
          taxNumberIv: undefined,
          taxNumberAuthTag: undefined,
          taxNumberKeyVersion: undefined,
        }
      : null,
    documents: documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      warehouseId: document.warehouseId,
      brandVerificationId: document.brandVerificationId,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      reviewStatus: document.reviewStatus,
      reviewedAt: document.reviewedAt,
      createdAt: document.createdAt,
    })),
    inventorySamples: inventorySamples.map((sample) => ({
      id: sample.id,
      format: sample.format,
      originalFilename: sample.originalFilename,
      mimeType: sample.mimeType,
      sizeBytes: sample.sizeBytes,
      totalRows: sample.totalRows,
      validRows: sample.validRows,
      invalidRows: sample.invalidRows,
      duplicateGtins: sample.duplicateGtins,
      validationSummary: sample.validationSummary,
      reviewStatus: sample.reviewStatus,
      reviewedAt: sample.reviewedAt,
      createdAt: sample.createdAt,
    })),
    progress: supplierApplicationProgress(application),
  };
}
