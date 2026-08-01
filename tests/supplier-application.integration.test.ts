import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import { Pool } from "pg";

import {
  SupplierApplicationStatus,
  SupplierBrandVerificationStatus,
  SupplierReviewStatus,
  type PrismaClient,
} from "../src/generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;
assert.ok(connectionString, "DATABASE_URL is required.");
const databaseUrl = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1"].includes(databaseUrl.hostname));
assert.match(databaseUrl.pathname.slice(1), /^trade82_order_payout_test_/);

process.env.SUPPLIER_APPLICATIONS_ENABLED = "true";
const supplierApplications = await import(
  new URL("../src/lib/supplier-application.ts", import.meta.url).href
);
const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const db = getDb() as PrismaClient;
const pool = new Pool({ connectionString, max: 1 });

after(async () => {
  await db.$disconnect();
  await pool.end();
});

function unique(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

async function createApplicant(role: "user" | "admin" = "user") {
  const suffix = unique("supplier");
  return db.userProfile.create({
    data: {
      clerkUserId: suffix,
      email: `${suffix}@example.test`,
      displayName: suffix,
      role,
    },
  });
}

async function createApplication(
  applicantUserId: string,
  status: SupplierApplicationStatus = SupplierApplicationStatus.DRAFT,
) {
  const suffix = unique("application");
  return db.supplierApplication.create({
    data: {
      applicationNumber: suffix,
      applicantUserId,
      status,
      legalCompanyName: `Company ${suffix}`,
      companyWebsite: `https://${suffix}.example.test`,
      websiteDomain: `${suffix}.example.test`,
      registrationCountry: "KR",
      brandsHandled: ["COSRX"],
      annualRevenueRange: "USD 1M-5M",
      warehouseType: "OWN",
      skuCountRange: "100-499",
      contacts: {
        create: {
          firstName: "Jin",
          lastName: "Park",
          jobTitle: "Manager",
          workEmail: `${suffix}@example.test`,
          phoneNumber: "+821012345678",
          isPrimary: true,
        },
      },
    },
  });
}

async function prepareApprovalEvidence({
  applicationId,
  applicantUserId,
  includeFullApproval = false,
}: {
  applicationId: string;
  applicantUserId: string;
  includeFullApproval?: boolean;
}) {
  const brand = await db.supplierBrandVerification.create({
    data: {
      applicationId,
      brand: "COSRX",
      normalizedBrand: "cosrx",
      relationshipType: "BRAND_DIRECT",
      status: "VERIFIED",
      evidenceStatus: "VERIFIED",
      verifiedAt: new Date(),
    },
  });
  await db.supplierBusinessVerification.create({
    data: {
      applicationId,
      registrationNumber: unique("registration"),
      registeredAddress: "Seoul",
      reviewStatus: "VERIFIED",
      reviewedAt: new Date(),
    },
  });
  const document = (documentType: "SUPPLIER_INVOICE" | "BUSINESS_REGISTRATION" | "COMPANY_AUTHORITY", brandVerificationId?: string) => ({
    applicationId,
    uploadedByUserId: applicantUserId,
    documentType,
    brandVerificationId,
    originalFilename: `${documentType}.pdf`,
    storedFilename: `${unique(documentType)}.pdf`,
    storageBucket: "supplier-test-private",
    storagePath: `supplier-test/${unique(documentType)}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 4,
    sha256Hash: unique("hash"),
    reviewStatus: SupplierReviewStatus.VERIFIED,
    reviewedAt: new Date(),
  });
  await db.supplierApplicationDocument.create({
    data: document("SUPPLIER_INVOICE", brand.id),
  });
  if (includeFullApproval) {
    await Promise.all([
      db.supplierApplicationDocument.create({
        data: document("BUSINESS_REGISTRATION"),
      }),
      db.supplierApplicationDocument.create({
        data: document("COMPANY_AUTHORITY"),
      }),
      db.supplierOperationsProfile.create({
        data: { applicationId, reviewStatus: "VERIFIED", reviewedAt: new Date() },
      }),
      db.supplierSettlementProfile.create({
        data: {
          applicationId,
          legalAccountHolder: "Supplier",
          bankName: "Test Bank",
          bankCountry: "KR",
          payoutCurrency: "USD",
          payoutPolicyAcceptedAt: new Date(),
          reviewStatus: "VERIFIED",
          reviewedAt: new Date(),
        },
      }),
    ]);
  }
  return brand;
}

test("supplier migration is additive and protected by RLS", async () => {
  const supplierTables = [
    "SupplierApplication",
    "SupplierApplicationContact",
    "SupplierBusinessVerification",
    "SupplierStakeholder",
    "SupplierWarehouse",
    "SupplierSupplyChain",
    "SupplierBrandVerification",
    "SupplierOperationsProfile",
    "SupplierSettlementProfile",
    "SupplierApplicationDocument",
    "SupplierInventorySample",
    "SupplierApplicationReview",
    "SupplierApplicationStatusHistory",
    "SupplierInformationRequest",
    "SupplierDuplicateFlag",
    "SupplierApplicationAuditEvent",
  ];
  const result = await pool.query<{
    table_name: string;
    relrowsecurity: boolean;
    anon_select: boolean;
    anon_insert: boolean;
    authenticated_select: boolean;
    authenticated_insert: boolean;
    authenticated_update: boolean;
    authenticated_delete: boolean;
  }>(`
    SELECT
      requested.table_name,
      c.relrowsecurity,
      has_table_privilege('anon', format('%I.%I', 'public', requested.table_name), 'SELECT') AS anon_select,
      has_table_privilege('anon', format('%I.%I', 'public', requested.table_name), 'INSERT') AS anon_insert,
      has_table_privilege('authenticated', format('%I.%I', 'public', requested.table_name), 'SELECT') AS authenticated_select,
      has_table_privilege('authenticated', format('%I.%I', 'public', requested.table_name), 'INSERT') AS authenticated_insert,
      has_table_privilege('authenticated', format('%I.%I', 'public', requested.table_name), 'UPDATE') AS authenticated_update,
      has_table_privilege('authenticated', format('%I.%I', 'public', requested.table_name), 'DELETE') AS authenticated_delete
    FROM unnest($1::text[]) AS requested(table_name)
    JOIN pg_class c
      ON c.oid = to_regclass(format('%I.%I', 'public', requested.table_name))
  `, [supplierTables]);
  assert.equal(result.rows.length, supplierTables.length);
  for (const table of result.rows) {
    assert.equal(table.relrowsecurity, true, `${table.table_name} must enable RLS`);
    assert.equal(table.anon_select, false, `${table.table_name} must revoke anon SELECT`);
    assert.equal(table.anon_insert, false, `${table.table_name} must revoke anon INSERT`);
    assert.equal(table.authenticated_select, false, `${table.table_name} must revoke authenticated SELECT`);
    assert.equal(table.authenticated_insert, false, `${table.table_name} must revoke authenticated INSERT`);
    assert.equal(table.authenticated_update, false, `${table.table_name} must revoke authenticated UPDATE`);
    assert.equal(table.authenticated_delete, false, `${table.table_name} must revoke authenticated DELETE`);
  }
  const columns = await pool.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SupplierBrandVerification'
  `);
  assert.equal(
    ["normalizedBrand", "isActive", "removedAt"].every((column) =>
      columns.rows.some((row) => row.column_name === column),
    ),
    true,
  );
});

test("applicant ownership and administrator transition checks are enforced", async () => {
  const [owner, other] = await Promise.all([createApplicant(), createApplicant()]);
  const application = await createApplication(owner.id);
  await assert.rejects(
    supplierApplications.updateSupplierApplication({
      applicationId: application.id,
      userId: other.id,
      input: { tradeName: "Forbidden edit" },
    }),
    (error: unknown) => error instanceof Response && error.status === 404,
  );
  await assert.rejects(
    supplierApplications.transitionSupplierApplication({
      applicationId: application.id,
      actorUserId: other.id,
      actor: "ADMIN",
      targetStatus: SupplierApplicationStatus.BUSINESS_VERIFICATION,
    }),
    (error: unknown) => error instanceof Response && error.status === 403,
  );
});

test("individual brand review does not mutate sibling brands", async () => {
  const [applicant, admin] = await Promise.all([
    createApplicant(),
    createApplicant("admin"),
  ]);
  const application = await createApplication(applicant.id);
  const [first, second] = await Promise.all([
    db.supplierBrandVerification.create({
      data: {
        applicationId: application.id,
        brand: "COSRX",
        normalizedBrand: "cosrx",
        relationshipType: "BRAND_DIRECT",
        reviewNotes: "Preserve this note",
        countryRestrictions: ["US"],
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    }),
    db.supplierBrandVerification.create({
      data: {
        applicationId: application.id,
        brand: "Beauty of Joseon",
        normalizedBrand: "beauty of joseon",
        relationshipType: "OFFICIAL_DISTRIBUTOR",
      },
    }),
  ]);
  await supplierApplications.reviewSupplierBrandVerification({
    applicationId: application.id,
    brandVerificationId: first.id,
    adminUserId: admin.id,
    input: {
      status: SupplierBrandVerificationStatus.VERIFIED,
      evidenceStatus: SupplierReviewStatus.VERIFIED,
      reason: "Verified against submitted authorization.",
    },
  });
  const brands = await db.supplierBrandVerification.findMany({
    where: { applicationId: application.id },
    orderBy: { normalizedBrand: "asc" },
  });
  const reviewed = brands.find((brand) => brand.id === first.id);
  assert.equal(reviewed?.status, "VERIFIED");
  assert.equal(reviewed?.reviewNotes, "Preserve this note");
  assert.deepEqual(reviewed?.countryRestrictions, ["US"]);
  assert.equal(reviewed?.expiresAt?.toISOString(), "2099-01-01T00:00:00.000Z");
  assert.equal(brands.find((brand) => brand.id === second.id)?.status, "PENDING");

  await supplierApplications.reviewSupplierBrandVerification({
    applicationId: application.id,
    brandVerificationId: first.id,
    adminUserId: admin.id,
    input: {
      status: SupplierBrandVerificationStatus.VERIFIED,
      evidenceStatus: SupplierReviewStatus.VERIFIED,
      reviewNotes: null,
      countryRestrictions: null,
      expiresAt: null,
      reason: "Clear optional review fields explicitly.",
    },
  });
  const cleared = await db.supplierBrandVerification.findUniqueOrThrow({
    where: { id: first.id },
  });
  assert.equal(cleared.reviewNotes, "");
  assert.deepEqual(cleared.countryRestrictions, []);
  assert.equal(cleared.expiresAt, null);

  for (const status of [
    SupplierBrandVerificationStatus.REJECTED,
    SupplierBrandVerificationStatus.ADDITIONAL_EVIDENCE_REQUIRED,
  ]) {
    await assert.rejects(
      supplierApplications.reviewSupplierBrandVerification({
        applicationId: application.id,
        brandVerificationId: first.id,
        adminUserId: admin.id,
        input: {
          status,
          evidenceStatus: SupplierReviewStatus.REJECTED,
          reason: "",
        },
      }),
      /reason is required/,
    );
  }

  await assert.rejects(
    supplierApplications.reviewSupplierBrandVerification({
      applicationId: application.id,
      brandVerificationId: first.id,
      adminUserId: admin.id,
      input: {
        status: SupplierBrandVerificationStatus.RESTRICTED,
        evidenceStatus: SupplierReviewStatus.VERIFIED,
        reason: "Restriction requires a country.",
      },
    }),
    /at least one country restriction/,
  );
  await assert.rejects(
    supplierApplications.reviewSupplierBrandVerification({
      applicationId: application.id,
      brandVerificationId: first.id,
      adminUserId: admin.id,
      input: {
        status: SupplierBrandVerificationStatus.EXPIRED,
        evidenceStatus: SupplierReviewStatus.EXPIRED_DOCUMENT,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        reason: "Future expiry is not expired.",
      },
    }),
    /cannot be in the future/,
  );
  const expiredAt = new Date("2020-01-01T00:00:00.000Z");
  await supplierApplications.reviewSupplierBrandVerification({
    applicationId: application.id,
    brandVerificationId: first.id,
    adminUserId: admin.id,
    input: {
      status: SupplierBrandVerificationStatus.EXPIRED,
      evidenceStatus: SupplierReviewStatus.EXPIRED_DOCUMENT,
      expiresAt: expiredAt,
      reason: "Authorization has expired.",
    },
  });
  assert.equal(
    (await db.supplierBrandVerification.findUniqueOrThrow({
      where: { id: first.id },
    })).expiresAt?.toISOString(),
    expiredAt.toISOString(),
  );
});

test("removed and changed verified brands are excluded or reset without deleting evidence", async () => {
  const applicant = await createApplicant();
  const application = await createApplication(applicant.id);
  const brand = await db.supplierBrandVerification.create({
    data: {
      applicationId: application.id,
      brand: "COSRX",
      normalizedBrand: "cosrx",
      relationshipType: "BRAND_DIRECT",
      status: "VERIFIED",
      evidenceStatus: "VERIFIED",
      verifiedAt: new Date(),
    },
  });
  await supplierApplications.updateSupplierApplication({
    applicationId: application.id,
    userId: applicant.id,
    input: { brands: [] },
  });
  const removed = await db.supplierBrandVerification.findUniqueOrThrow({
    where: { id: brand.id },
  });
  assert.equal(removed.isActive, false);
  assert.ok(removed.removedAt);
  await supplierApplications.updateSupplierApplication({
    applicationId: application.id,
    userId: applicant.id,
    input: {
      brands: [
        {
          brand: " Cosrx ",
          relationshipType: "OFFICIAL_DISTRIBUTOR",
          supplierCompany: "Updated source",
          transactionStartedAt: null,
          countryRestrictions: [],
        },
      ],
    },
  });
  const reactivated = await db.supplierBrandVerification.findUniqueOrThrow({
    where: { id: brand.id },
  });
  assert.equal(reactivated.isActive, true);
  assert.equal(reactivated.status, "PENDING");
  assert.equal(reactivated.evidenceStatus, "PENDING");
});

test("conditional approval keeps the company private and full approval blocks unresolved requests", async () => {
  const [applicant, admin] = await Promise.all([
    createApplicant(),
    createApplicant("admin"),
  ]);
  const conditionalApplication = await createApplication(
    applicant.id,
    SupplierApplicationStatus.SETTLEMENT_VERIFICATION,
  );
  await prepareApprovalEvidence({
    applicationId: conditionalApplication.id,
    applicantUserId: applicant.id,
  });
  await supplierApplications.transitionSupplierApplication({
    applicationId: conditionalApplication.id,
    actorUserId: admin.id,
    actor: "ADMIN",
    targetStatus: SupplierApplicationStatus.CONDITIONALLY_APPROVED,
    reason: "Limited test-order evaluation only.",
  });
  const conditional = await db.supplierApplication.findUniqueOrThrow({
    where: { id: conditionalApplication.id },
    include: { approvedCompany: true },
  });
  assert.equal(conditional.approvedCompany?.verificationStatus, "pending_review");
  assert.equal(conditional.approvedCompany?.verifiedSellerSince, null);

  const blockedApplication = await createApplication(
    (await createApplicant()).id,
    SupplierApplicationStatus.SETTLEMENT_VERIFICATION,
  );
  await prepareApprovalEvidence({
    applicationId: blockedApplication.id,
    applicantUserId: blockedApplication.applicantUserId,
    includeFullApproval: true,
  });
  const informationRequest = await db.supplierInformationRequest.create({
    data: {
      applicationId: blockedApplication.id,
      section: "FINAL_REVIEW",
      message: "Clarify the ownership structure.",
      requestedByUserId: admin.id,
      applicantResponse: "Response awaiting administrator resolution.",
      respondedAt: new Date(),
    },
  });
  await assert.rejects(
    supplierApplications.transitionSupplierApplication({
      applicationId: blockedApplication.id,
      actorUserId: admin.id,
      actor: "ADMIN",
      targetStatus: SupplierApplicationStatus.APPROVED,
      reason: "Final review completed.",
    }),
    /Resolve all information requests/,
  );
  await supplierApplications.resolveSupplierInformationRequest({
    applicationId: blockedApplication.id,
    requestId: informationRequest.id,
    adminUserId: admin.id,
    resolutionNote: "Ownership evidence accepted.",
  });
  const approved = await supplierApplications.transitionSupplierApplication({
    applicationId: blockedApplication.id,
    actorUserId: admin.id,
    actor: "ADMIN",
    targetStatus: SupplierApplicationStatus.APPROVED,
    reason: "Final review completed.",
  });
  const repeated = await supplierApplications.transitionSupplierApplication({
    applicationId: blockedApplication.id,
    actorUserId: admin.id,
    actor: "ADMIN",
    targetStatus: SupplierApplicationStatus.APPROVED,
    reason: "Idempotent retry.",
  });
  assert.equal(repeated.id, approved.id);
  assert.equal(
    await db.supplierApplicationReview.count({
      where: {
        applicationId: blockedApplication.id,
        section: "FINAL_REVIEW",
      },
    }),
    1,
  );
});
