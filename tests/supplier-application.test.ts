import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  canTransitionSupplierApplication,
  parseSupplierApplicationCreateInput,
  parseSupplierApplicationUpdateInput,
} from "../src/lib/supplier-application.ts";
import { SupplierApplicationStatus } from "../src/generated/prisma/client.ts";

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
  ]);
  for (const file of files) {
    assert.match(file, /require(Auth|Admin)/);
    if (file.includes("export async function POST") || file.includes("export async function PATCH")) assert.match(file, /assertSameOrigin/);
  }
  assert.match(files[2], /createSignedPrivateFileUrl/);
  assert.match(files[3], /validateInventorySample/);
  assert.match(files[6], /ADMIN_DOCUMENT_SIGNED_URL_ISSUED/);
});

test("seller operational APIs are guarded by approval capabilities and legacy onboarding is redirected", async () => {
  const [products, bulkImport, uploads, orders, payout, dashboard, onboarding, publicSell, capabilities, backfill] = await Promise.all([
    source("src/app/api/account/products/route.ts"),
    source("src/app/api/account/products/bulk/import/route.ts"),
    source("src/app/api/uploads/route.ts"),
    source("src/app/api/orders/[orderNumber]/route.ts"),
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
  assert.match(orders, /canShipOrder/);
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
