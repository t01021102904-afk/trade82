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
  const result = await pool.query<{
    table_name: string;
    relrowsecurity: boolean;
  }>(`
    SELECT c.relname AS table_name, c.relrowsecurity
    FROM pg_class c
    WHERE c.relname IN (
      'SupplierApplication',
      'SupplierBrandVerification',
      'SupplierInformationRequest'
    )
  `);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows.every((row) => row.relrowsecurity), true);
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
  assert.equal(brands.find((brand) => brand.id === first.id)?.status, "VERIFIED");
  assert.equal(brands.find((brand) => brand.id === second.id)?.status, "PENDING");
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
