import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  canTransitionSupplierApplication,
  getSupplierApplicationCapabilities,
  normalizeSupplierBrand,
  parseSupplierApplicationCreateInput,
  parseSupplierApplicationUpdateInput,
  resolveSupplierApplicationCapabilities,
  validateReadyForFullApproval,
  validateReadyForInitialSubmission,
} from "../src/lib/supplier-application.ts";
import {
  SupplierApplicationStatus,
  SupplierBrandVerificationStatus,
  SupplierLegacyClassification,
  SupplierReviewStatus,
} from "../src/generated/prisma/client.ts";
import {
  supplierInventorySampleHeaders,
  validateInventorySample,
} from "../src/lib/supplier-application-files.ts";

const root = new URL("..", import.meta.url);

function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

const validCreate = {
  firstName: "Jin",
  lastName: "Park",
  jobTitle: "Export manager",
  workEmail: "Jin.Park@example.com",
  phoneNumber: "+82 10 1234 5678",
  legalCompanyName: "Trade82 Supplier Co.",
  tradeName: "Trade82 Supplier",
  companyWebsite: "supplier.example.com",
  registrationCountry: "South Korea",
  brandsHandled: ["Trade82 Brand"],
  annualRevenueRange: "USD 1M–5M",
  warehouseType: "Third-party logistics",
  skuCountRange: "500–999",
};

test("supplier application validates the required initial applicant and business fields", () => {
  const input = parseSupplierApplicationCreateInput(validCreate);
  assert.equal(input.companyWebsite, "https://supplier.example.com/");
  assert.equal(input.contact.workEmail, "jin.park@example.com");
  assert.throws(() => parseSupplierApplicationCreateInput({ ...validCreate, workEmail: "not-an-email" }));
  assert.throws(() => parseSupplierApplicationCreateInput({ ...validCreate, legalCompanyName: " " }));
  assert.throws(() => parseSupplierApplicationCreateInput({ ...validCreate, brandsHandled: "Brand" }));
});

test("supplier application validates structured operations and settlement data before persistence", () => {
  const input = parseSupplierApplicationUpdateInput({
    operations: {
      companyMov: "100",
      brandLevelMov: { "Trade82 Brand": 250 },
      defaultLeadTimeDays: 14,
      onHandStockLeadTimeDays: null,
      sourcedAfterOrderLeadTimeDays: 30,
      allowedCountries: ["United States"],
      restrictedCountries: [],
      dailyOrderCapacity: 100,
      dailyUnitCapacity: 5000,
      boxPacking: true,
      palletPacking: false,
      hazardousGoodsPacking: false,
      temperatureControlledPacking: false,
      weekendShipping: false,
      inventoryUpdateMethod: "EXCEL_CSV",
      inventoryUpdateFrequency: "Daily",
    },
    settlement: {
      legalAccountHolder: "Trade82 Supplier Co.",
      bankName: "Example Bank",
      bankCountry: "South Korea",
      accountNumber: "123456789",
      bankCode: "001",
      swiftBic: "EXAMPLE",
      payoutCurrency: "usd",
      taxCountry: "South Korea",
      taxNumber: "123-45-67890",
      vatInformation: "VAT registered",
      invoiceMethod: "Email",
      acceptsPayoutPolicy: true,
    },
  });
  assert.equal(input.operations?.inventoryUpdateMethod, "EXCEL_CSV");
  assert.deepEqual(input.operations?.brandLevelMov, { "Trade82 Brand": "250" });
  assert.equal(input.settlement?.payoutCurrency, "USD");
  assert.throws(() => parseSupplierApplicationUpdateInput({ operations: { inventoryUpdateMethod: "EXCEL_CSV", defaultLeadTimeDays: "14" } }));
  assert.throws(() => parseSupplierApplicationUpdateInput({ settlement: { ...input.settlement, acceptsPayoutPolicy: false } }));
  assert.throws(() => parseSupplierApplicationUpdateInput({ operations: { ...input.operations, brandLevelMov: ["invalid"] } }));
});

test("supplier status transitions are actor-specific and do not allow direct approval", () => {
  assert.equal(
    canTransitionSupplierApplication(
      "APPLICANT",
      SupplierApplicationStatus.DRAFT,
      SupplierApplicationStatus.SUBMITTED,
    ),
    true,
  );
  assert.equal(
    canTransitionSupplierApplication(
      "APPLICANT",
      SupplierApplicationStatus.DRAFT,
      SupplierApplicationStatus.APPROVED,
    ),
    false,
  );
  assert.equal(
    canTransitionSupplierApplication(
      "ADMIN",
      SupplierApplicationStatus.SETTLEMENT_VERIFICATION,
      SupplierApplicationStatus.APPROVED,
    ),
    true,
  );
  assert.equal(
    canTransitionSupplierApplication(
      "ADMIN",
      SupplierApplicationStatus.REJECTED,
      SupplierApplicationStatus.APPROVED,
    ),
    false,
  );
});

const verifiedCompany = {
  id: "legacy-company",
  deletedAt: null,
  verificationStatus: "verified",
  sellerPayoutProfile: { status: "VERIFIED" },
};

test("disabled feature flag never loads the SupplierApplication table", async () => {
  let applicationQueries = 0;
  const capabilities = await getSupplierApplicationCapabilities("user", {
    enabled: false,
    loadCompany: async () => verifiedCompany,
    loadApplication: async () => {
      applicationQueries += 1;
      throw new Error("SupplierApplication must not be queried");
    },
  });
  assert.equal(applicationQueries, 0);
  assert.equal(capabilities.canCreateProductCandidate, true);
  assert.equal(capabilities.canAcceptNewOrders, true);
  assert.equal(capabilities.canAccessAssignedOrders, true);
  assert.equal(capabilities.canShipExistingOrders, true);
  assert.equal(capabilities.canReceivePayout, true);
});

test("legacy grandfathering is limited to conditional and approved states", () => {
  const before = resolveSupplierApplicationCapabilities({
    application: null,
    company: verifiedCompany,
  });
  const backfilled = {
    id: "application",
    status: SupplierApplicationStatus.CONDITIONALLY_APPROVED,
    legacyClassification:
      SupplierLegacyClassification.LEGACY_CONDITIONALLY_APPROVED,
    legacyCompanyId: verifiedCompany.id,
    approvedCompany: null,
    legacyCompany: verifiedCompany,
    brandVerifications: [],
  };
  const after = resolveSupplierApplicationCapabilities({
    application: backfilled,
    company: verifiedCompany,
  });
  for (const capability of [
    "canUploadLiveInventory",
    "canCreateProductCandidate",
    "canPublishOffer",
    "canAcceptNewOrders",
    "canAccessAssignedOrders",
    "canShipExistingOrders",
    "canReceivePayout",
  ] as const) {
    assert.equal(after[capability], before[capability]);
  }
  assert.equal(after.isLegacyFallback, true);
  const approved = resolveSupplierApplicationCapabilities({
    application: {
      ...backfilled,
      status: SupplierApplicationStatus.APPROVED,
    },
    company: verifiedCompany,
  });
  assert.equal(approved.isLegacyFallback, true);
  assert.equal(approved.canAcceptNewOrders, true);
  assert.equal(
    resolveSupplierApplicationCapabilities({
      application: {
        ...backfilled,
        legacyClassification: SupplierLegacyClassification.REVERIFICATION_REQUIRED,
      },
      company: verifiedCompany,
    }).canPublishOffer,
    false,
  );
  const onHold = resolveSupplierApplicationCapabilities({
    application: {
      ...backfilled,
      status: SupplierApplicationStatus.ON_HOLD,
    },
    company: verifiedCompany,
  });
  assert.equal(onHold.isLegacyFallback, false);
  assert.equal(onHold.canCreateProductCandidate, false);
  assert.equal(onHold.canAcceptNewOrders, false);
  assert.equal(onHold.canReceivePayout, false);
  // Operational policy: an on-hold verified company may finish already
  // assigned orders, but cannot receive new orders or exercise grandfathering.
  assert.equal(onHold.canAccessAssignedOrders, true);
  assert.equal(onHold.canShipExistingOrders, true);

  for (const status of [
    SupplierApplicationStatus.REJECTED,
    SupplierApplicationStatus.WITHDRAWN,
    SupplierApplicationStatus.SUSPENDED,
  ]) {
    const blocked = resolveSupplierApplicationCapabilities({
      application: { ...backfilled, status },
      company: verifiedCompany,
    });
    assert.equal(blocked.isLegacyFallback, false, status);
    assert.equal(blocked.canCreateProductCandidate, false, status);
    assert.equal(blocked.canAcceptNewOrders, false, status);
    assert.equal(blocked.canAccessAssignedOrders, false, status);
    assert.equal(blocked.canShipExistingOrders, false, status);
    assert.equal(blocked.canReceivePayout, false, status);
  }

  const restored = resolveSupplierApplicationCapabilities({
    application: backfilled,
    company: verifiedCompany,
  });
  assert.equal(restored.isLegacyFallback, true);
  assert.equal(restored.canAcceptNewOrders, true);
  assert.equal(restored.canReceivePayout, true);
});

test("conditional approval exposes test-order state but no live order access", () => {
  const capabilities = resolveSupplierApplicationCapabilities({
    application: {
      id: "application",
      status: SupplierApplicationStatus.CONDITIONALLY_APPROVED,
      legacyClassification: null,
      legacyCompanyId: null,
      approvedCompany: {
        ...verifiedCompany,
        id: "pending-company",
        verificationStatus: "pending_review",
      },
      legacyCompany: null,
      brandVerifications: [],
    },
    company: null,
  });
  assert.equal(capabilities.canReceiveTestOrder, true);
  assert.equal(capabilities.canAcceptNewOrders, false);
  assert.equal(capabilities.canAccessAssignedOrders, false);
  assert.equal(capabilities.canShipExistingOrders, false);
  assert.equal(capabilities.canCreateProductCandidate, false);
});

test("approved suppliers keep assigned-order fulfillment when verified brands expire", () => {
  const application = {
    id: "application",
    status: SupplierApplicationStatus.APPROVED,
    legacyClassification: null,
    legacyCompanyId: null,
    approvedCompany: verifiedCompany,
    legacyCompany: null,
    brandVerifications: [{
      status: SupplierBrandVerificationStatus.VERIFIED,
      isActive: true,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    }],
  };
  const active = resolveSupplierApplicationCapabilities({
    application,
    company: verifiedCompany,
    now: new Date("2026-08-01T00:00:00.000Z"),
  });
  assert.equal(active.canAcceptNewOrders, true);
  assert.equal(active.canAccessAssignedOrders, true);
  assert.equal(active.canShipExistingOrders, true);
  const capabilities = resolveSupplierApplicationCapabilities({
    application: {
      ...application,
      brandVerifications: application.brandVerifications.map((brand) => ({
        ...brand,
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      })),
    },
    company: verifiedCompany,
    now: new Date("2026-08-01T00:00:00.000Z"),
  });
  assert.equal(capabilities.canAcceptNewOrders, false);
  assert.equal(capabilities.canAccessAssignedOrders, true);
  assert.equal(capabilities.canShipExistingOrders, true);
});

test("brand normalization and readiness validation use active, unexpired evidence", () => {
  assert.equal(normalizeSupplierBrand("  COSRX  "), "cosrx");
  assert.equal(normalizeSupplierBrand("Beauty   of Joseon"), "beauty of joseon");
  const application = {
    status: SupplierApplicationStatus.SETTLEMENT_VERIFICATION,
    legalCompanyName: "Supplier",
    companyWebsite: "https://supplier.example.com",
    registrationCountry: "KR",
    brandsHandled: ["COSRX"],
    annualRevenueRange: "USD 1M-5M",
    warehouseType: "OWN",
    skuCountRange: "100-499",
    contacts: [{
      firstName: "Jin",
      lastName: "Park",
      jobTitle: "Manager",
      workEmail: "jin@example.com",
      phoneNumber: "+821012345678",
    }],
    businessVerification: { reviewStatus: SupplierReviewStatus.VERIFIED },
    brandVerifications: [{
      id: "brand",
      isActive: true,
      status: SupplierBrandVerificationStatus.VERIFIED,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      documents: [{
        documentType: "BRAND_AUTHORIZATION",
        reviewStatus: SupplierReviewStatus.VERIFIED,
      }],
    }],
    operationsProfile: { reviewStatus: SupplierReviewStatus.VERIFIED },
    settlementProfile: { reviewStatus: SupplierReviewStatus.VERIFIED },
    documents: [
      { documentType: "BUSINESS_REGISTRATION", reviewStatus: SupplierReviewStatus.VERIFIED },
      { documentType: "COMPANY_AUTHORITY", reviewStatus: SupplierReviewStatus.VERIFIED },
    ],
    informationRequests: [],
    duplicateFlags: [],
  };
  validateReadyForInitialSubmission(application);
  validateReadyForFullApproval(application);
  assert.throws(() =>
    validateReadyForFullApproval({
      ...application,
      informationRequests: [{ resolvedAt: null }],
    }),
  );
  assert.throws(() =>
    validateReadyForFullApproval({
      ...application,
      brandVerifications: application.brandVerifications.map((brand) => ({
        ...brand,
        isActive: false,
      })),
    }),
  );
  assert.throws(() =>
    validateReadyForFullApproval({
      ...application,
      duplicateFlags: [{ severity: "CRITICAL", resolvedAt: null }],
    }),
  );
  validateReadyForFullApproval(
    {
      ...application,
      duplicateFlags: [{ severity: "CRITICAL", resolvedAt: null }],
    },
    { duplicateOverrideReason: "Reviewed duplicate corporate group." },
  );
});

test("inventory samples enforce the dedicated supplier template and row counters", async () => {
  process.env.SUPPLIER_APPLICATIONS_ENABLED = "true";
  const validRow = [
    "4006381333931",
    "COSRX",
    "Cleanser",
    "100 ml",
    "12.50",
    "USD",
    "50",
    "10",
    "100",
    "3",
    "2030-01-01",
    "Seoul warehouse",
    "US|KR",
    "2026-08-01T12:00:00Z",
  ];
  const invalidRow = [
    "4006381333931",
    "COSRX",
    "Cleanser duplicate",
    "",
    "0",
    "ZZZ",
    "-1",
    "0",
    "-1",
    "1.5",
    "not-a-date",
    "",
    "",
    "not-a-date",
  ];
  const csv = [
    supplierInventorySampleHeaders.join(","),
    validRow.join(","),
    invalidRow.join(","),
  ].join("\n");
  const result = await validateInventorySample(
    new File([csv], "inventory.csv", { type: "text/csv" }),
  );
  assert.equal(result.summary.totalRows, 2);
  assert.equal(result.summary.validRows, 1);
  assert.equal(result.summary.invalidRows, 1);
  assert.equal(result.summary.missingRequiredFieldRows, 1);
  assert.equal(result.summary.duplicateGtinRows, 1);
  assert.equal(result.summary.invalidPriceRows, 1);
  assert.equal(result.summary.invalidQuantityRows, 1);
  assert.equal(result.summary.invalidMoqRows, 1);
  assert.equal(result.summary.invalidMovRows, 1);
  assert.equal(result.summary.invalidLeadTimeRows, 1);
  assert.equal(result.summary.invalidExpirationDateRows, 1);
  assert.equal(result.summary.invalidStockUpdatedAtRows, 1);
  assert.equal(result.summary.invalidCurrencyRows, 1);
});

test("supplier schema and migration keep the approval domain additive, private, and auditable", async () => {
  const [schema, migration] = await Promise.all([
    source("prisma/schema.prisma"),
    source("prisma/migrations/20260801090000_add_supplier_applications/migration.sql"),
  ]);
  for (const model of ["SupplierApplication", "SupplierApplicationDocument", "SupplierInventorySample", "SupplierApplicationStatusHistory", "SupplierApplicationAuditEvent"]) assert.match(schema, new RegExp(`model ${model}`));
  for (const status of ["DRAFT", "SUBMITTED", "CONDITIONALLY_APPROVED", "APPROVED", "SUSPENDED"]) assert.match(schema, new RegExp(`\\b${status}\\b`));
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|TYPE|COLUMN|DATABASE)\b/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE/i);
  assert.match(migration, /SupplierApplicationStatusHistory_immutable/i);
  assert.match(migration, /SupplierApplicationAuditEvent_immutable/i);
  assert.match(migration, /REFERENCES "UserProfile"\("id"\)/);
  assert.match(migration, /SupplierApplicationDocument_warehouseId_fkey/);
  assert.match(migration, /SupplierApplicationDocument_brandVerificationId_fkey/);
});

test("all supplier mutations use server-side auth, origin checks, and private file routes", async () => {
  const files = await Promise.all([
    source("src/app/api/supplier-applications/route.ts"),
    source("src/app/api/supplier-applications/[id]/route.ts"),
    source("src/app/api/supplier-applications/[id]/documents/route.ts"),
    source("src/app/api/supplier-applications/[id]/inventory-samples/route.ts"),
    source("src/app/api/admin/supplier-applications/[id]/transition/route.ts"),
    source("src/app/api/admin/supplier-applications/[id]/reviews/route.ts"),
    source("src/app/api/admin/supplier-applications/[id]/documents/[documentId]/signed-url/route.ts"),
    source("src/app/api/admin/supplier-applications/[id]/brands/[brandVerificationId]/review/route.ts"),
  ]);
  for (const file of files) {
    assert.match(file, /require(Auth|Admin)/);
    if (file.includes("export async function POST") || file.includes("export async function PATCH")) assert.match(file, /assertSameOrigin/);
  }
  assert.match(files[2], /createSignedPrivateFileUrl/);
  assert.match(files[3], /validateInventorySample/);
  assert.match(files[6], /ADMIN_DOCUMENT_SIGNED_URL_ISSUED/);
  assert.match(files[7], /export async function PATCH/);
  assert.match(files[7], /Object\.hasOwn\(body, "expiresAt"\)/);
  assert.match(files[7], /Object\.hasOwn\(body, "countryRestrictions"\)/);
});

test("seller operational APIs are guarded by approval capabilities and legacy onboarding is redirected", async () => {
  const [products, bulkImport, uploads, orders, orderList, paymentRequests, payout, dashboard, onboarding, publicSell, capabilities, backfill] = await Promise.all([
    source("src/app/api/account/products/route.ts"),
    source("src/app/api/account/products/bulk/import/route.ts"),
    source("src/app/api/uploads/route.ts"),
    source("src/app/api/orders/[orderNumber]/route.ts"),
    source("src/app/api/orders/route.ts"),
    source("src/app/api/inquiries/[id]/payment-requests/route.ts"),
    source("src/app/api/account/payout-profile/route.ts"),
    source("src/app/api/dashboard/summary/route.ts"),
    source("src/app/onboarding/seller/page.tsx"),
    source("src/app/sell/page.tsx"),
    source("src/lib/supplier-application.ts"),
    source("scripts/backfill-supplier-applications.ts"),
  ]);
  assert.match(products, /requireApprovedSupplierCapability\("canCreateProductCandidate"\)/);
  assert.match(bulkImport, /requireApprovedSupplierCapability\("canUploadLiveInventory"\)/);
  assert.match(uploads, /requireApprovedSupplierCapability\("canCreateProductCandidate"\)/);
  assert.match(orders, /canShipExistingOrders/);
  assert.match(orders, /canAccessAssignedOrders/);
  assert.match(orderList, /canAccessAssignedOrders/);
  assert.match(
    paymentRequests,
    /requireSupplierCanAcceptNewOrdersForCompanyWithDb/,
  );
  assert.match(payout, /requireApprovedSupplierCapability\("canCreateProductCandidate"\)/);
  assert.match(dashboard, /getSupplierApplicationCapabilities/);
  assert.match(onboarding, /redirect\("\/seller\/apply"\)/);
  assert.match(publicSell, /SupplierProgramPage/);
  assert.match(capabilities, /activeApproved && verifiedBrand/);
  assert.match(capabilities, /Existing verified suppliers should use the supplier dashboard/);
  assert.match(backfill, /--dry-run\|--apply/);
  assert.match(backfill, /SUPPLIER_APPLICATION_BACKFILL_CONFIRM/);
  assert.match(backfill, /Refusing to apply the supplier backfill to Production/);
});

test("payment authorization guards run before every money-moving boundary", async () => {
  const [creation, checkout, webhook, settlement] = await Promise.all([
    source("src/app/api/inquiries/[id]/payment-requests/route.ts"),
    source("src/app/api/payment-requests/[id]/checkout/route.ts"),
    source("src/lib/payment-requests.ts"),
    source("src/lib/stripe-connect-settlements.ts"),
  ]);
  const ownershipLookup = creation.indexOf("const inquiry = await");
  const creationGuard = creation.indexOf(
    "requireSupplierCanAcceptNewOrdersForCompany(",
  );
  const transactionalGuard = creation.indexOf(
    "requireSupplierCanAcceptNewOrdersForCompanyWithDb(",
  );
  const paymentInsert = creation.indexOf("tx.paymentRequest.create(");
  assert.ok(ownershipLookup >= 0 && ownershipLookup < creationGuard);
  assert.ok(creationGuard < transactionalGuard);
  assert.ok(transactionalGuard < paymentInsert);

  const checkoutGuard = checkout.indexOf(
    "requireSupplierCanAcceptNewOrdersForCompany(",
  );
  assert.ok(checkoutGuard >= 0);
  assert.ok(checkoutGuard < checkout.indexOf("const stripe = getStripe()"));
  assert.ok(checkoutGuard < checkout.indexOf("stripe.checkout.sessions.retrieve("));
  assert.match(checkout, /tradeOrderByPaymentRequest/);
  assert.match(checkout, /checkout\.sessions\.expire/);

  assert.match(webhook, /finalizeVerifiedPaymentRequestInTransaction/);
  assert.match(webhook, /supplier_new_order_ineligible/);
  assert.match(settlement, /getSupplierApplicationCapabilitiesWithDb/);
  assert.match(settlement, /!sellerAccess\.canAcceptNewOrders/);
});
