import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import { Pool } from "pg";

import {
  PaymentRequestEventType,
  Prisma,
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
process.env.DATABASE_POOL_MAX = "2";
const supplierApplications = await import(
  new URL("../src/lib/supplier-application.ts", import.meta.url).href
);
const paymentRequests = await import(
  new URL("../src/lib/payment-requests.ts", import.meta.url).href
);
const tradeOrders = await import(
  new URL("../src/lib/trade-orders.ts", import.meta.url).href
);
const settlements = await import(
  new URL("../src/lib/stripe-connect-settlements.ts", import.meta.url).href
);
const commerceBoundary = await import(
  new URL("../src/lib/supplier-commerce-boundary.ts", import.meta.url).href
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

type CommerceFixture = Awaited<ReturnType<typeof createCommerceFixture>>;

async function createCommerceFixture({
  status,
  withApplication = true,
  brandExpiresAt = null,
}: {
  status?: SupplierApplicationStatus;
  withApplication?: boolean;
  brandExpiresAt?: Date | null;
} = {}) {
  const [seller, buyer] = await Promise.all([createApplicant(), createApplicant()]);
  const suffix = unique("commerce");
  const [sellerCompany, buyerCompany] = await Promise.all([
    db.company.create({
      data: {
        ownerUserId: seller.id,
        companyRole: "seller",
        legalName: `Seller ${suffix}`,
        tradeName: `Seller ${suffix}`,
        country: "KR",
        city: "Seoul",
        businessAddress: "Seller address",
        verificationStatus: "verified",
      },
    }),
    db.company.create({
      data: {
        ownerUserId: buyer.id,
        companyRole: "buyer",
        legalName: `Buyer ${suffix}`,
        tradeName: `Buyer ${suffix}`,
        country: "US",
        city: "New York",
        businessAddress: "Buyer address",
      },
    }),
  ]);
  const product = await db.product.create({
    data: {
      sellerCompanyId: sellerCompany.id,
      name: `Product ${suffix}`,
      slug: `product-${suffix}`,
      category: "Beauty",
      shortDescription: "Supplier capability integration product.",
      detailedDescription: "Supplier capability integration product.",
      priceMin: "10.00",
      priceMax: "12.00",
      currency: "USD",
      moq: "10",
      moqQuantity: "10",
      moqUnit: "Units",
      leadTime: "14 days",
      ingredientsOrMaterials: "Test material",
      packaging: "Test packaging",
      status: "active",
    },
  });
  const inquiry = await db.inquiry.create({
    data: {
      buyerCompanyId: buyerCompany.id,
      sellerCompanyId: sellerCompany.id,
      productId: product.id,
      senderUserId: buyer.id,
      recipientCompanyId: sellerCompany.id,
      message: "Please send a payment request.",
    },
  });
  const application = withApplication
    ? await createApplication(
        seller.id,
        status ?? SupplierApplicationStatus.DRAFT,
      )
    : null;
  if (application) {
    await db.supplierApplication.update({
      where: { id: application.id },
      data: { approvedCompanyId: sellerCompany.id },
    });
    await db.supplierBrandVerification.create({
      data: {
        applicationId: application.id,
        brand: "COSRX",
        normalizedBrand: "cosrx",
        relationshipType: "BRAND_DIRECT",
        status: "VERIFIED",
        evidenceStatus: "VERIFIED",
        isActive: true,
        expiresAt: brandExpiresAt,
        verifiedAt: new Date(),
      },
    });
  }
  return {
    seller,
    buyer,
    sellerCompany,
    buyerCompany,
    product,
    inquiry,
    application,
  };
}

async function createAuthorizedPaymentRequest(
  fixture: CommerceFixture,
  {
    enabled = true,
    afterCommerceLock,
  }: {
    enabled?: boolean;
    afterCommerceLock?: (tx: Prisma.TransactionClient) => Promise<void>;
  } = {},
) {
  return db.$transaction(async (tx) => {
    await commerceBoundary.lockSupplierCommerceBoundary(tx, fixture.sellerCompany.id);
    await afterCommerceLock?.(tx);
    const lockedInquiry = await tx.inquiry.findFirst({
      where: {
        id: fixture.inquiry.id,
        sellerCompanyId: fixture.sellerCompany.id,
        sellerCompany: { ownerUserId: fixture.seller.id, deletedAt: null },
      },
      select: { id: true },
    });
    if (!lockedInquiry) throw new Error("Locked inquiry is unavailable.");
    await supplierApplications.requireSupplierCanAcceptNewOrdersForCompanyWithDb(
      fixture.seller.id,
      fixture.sellerCompany.id,
      tx,
      { enabled },
    );
    const paymentRequest = await tx.paymentRequest.create({
      data: {
        inquiryId: fixture.inquiry.id,
        buyerCompanyId: fixture.buyerCompany.id,
        sellerCompanyId: fixture.sellerCompany.id,
        createdByUserId: fixture.seller.id,
        productName: fixture.product.name,
        quantity: "10",
        unit: "units",
        productAmount: 10_000,
        shippingAmount: 1_000,
        grossAmount: 11_000,
        platformFeeAmount: 550,
        sellerPayableAmount: 10_450,
        currency: "usd",
        paymentDueDate: new Date(Date.now() + 86_400_000),
        orderTerms: "Supplier capability integration terms.",
      },
    });
    await tx.paymentRequestEvent.create({
      data: {
        paymentRequestId: paymentRequest.id,
        eventType: PaymentRequestEventType.CREATED,
        actorUserId: fixture.seller.id,
        message: "Seller created a payment request.",
      },
    });
    const order = await tradeOrders.createTradeOrderForPaymentRequest(
      tx,
      paymentRequest.id,
    );
    return { paymentRequest, order };
  });
}

async function assertNoCommerceSideEffects(fixture: CommerceFixture) {
  const [paymentRequestCount, eventCount, orderCount] = await Promise.all([
    db.paymentRequest.count({ where: { inquiryId: fixture.inquiry.id } }),
    db.paymentRequestEvent.count({
      where: { paymentRequest: { inquiryId: fixture.inquiry.id } },
    }),
    db.tradeOrder.count({ where: { inquiryId: fixture.inquiry.id } }),
  ]);
  assert.deepEqual(
    { paymentRequestCount, eventCount, orderCount },
    { paymentRequestCount: 0, eventCount: 0, orderCount: 0 },
  );
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

test("payment-request creation is atomically blocked for ineligible supplier states", async () => {
  const blockedStatuses = [
    SupplierApplicationStatus.DRAFT,
    SupplierApplicationStatus.CONDITIONALLY_APPROVED,
    SupplierApplicationStatus.ON_HOLD,
    SupplierApplicationStatus.REJECTED,
    SupplierApplicationStatus.WITHDRAWN,
    SupplierApplicationStatus.SUSPENDED,
  ];
  for (const status of blockedStatuses) {
    const fixture = await createCommerceFixture({ status });
    await assert.rejects(
      createAuthorizedPaymentRequest(fixture),
      (error: unknown) => error instanceof Response && error.status === 403,
      `${status} must not create a payment request`,
    );
    await assertNoCommerceSideEffects(fixture);
  }

  const expiredBrand = await createCommerceFixture({
    status: SupplierApplicationStatus.APPROVED,
    brandExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
  });
  await assert.rejects(
    createAuthorizedPaymentRequest(expiredBrand),
    (error: unknown) => error instanceof Response && error.status === 403,
  );
  await assertNoCommerceSideEffects(expiredBrand);
});

test("approved suppliers and feature-off verified legacy sellers create payment requests with orders", async () => {
  const approved = await createCommerceFixture({
    status: SupplierApplicationStatus.APPROVED,
  });
  const approvedResult = await createAuthorizedPaymentRequest(approved);
  assert.equal(approvedResult.order.paymentRequestId, approvedResult.paymentRequest.id);
  assert.equal(
    await db.paymentRequestEvent.count({
      where: {
        paymentRequestId: approvedResult.paymentRequest.id,
        eventType: PaymentRequestEventType.CREATED,
      },
    }),
    1,
  );

  const legacy = await createCommerceFixture({ withApplication: false });
  const legacyResult = await createAuthorizedPaymentRequest(legacy, {
    enabled: false,
  });
  assert.equal(legacyResult.order.paymentRequestId, legacyResult.paymentRequest.id);
  const legacyAccess = await supplierApplications.getSupplierApplicationCapabilities(
    legacy.seller.id,
    { enabled: false },
  );
  assert.equal(legacyAccess.canAcceptNewOrders, true);
  assert.equal(legacyAccess.isLegacyFallback, true);
});

test("capability loss holds pending checkout before Stripe reuse or creation", async () => {
  const fixture = await createCommerceFixture({
    status: SupplierApplicationStatus.APPROVED,
  });
  const { paymentRequest } = await createAuthorizedPaymentRequest(fixture);
  const checkoutSessionId = `cs_${unique("supplier-hold")}`;
  await db.paymentRequest.update({
    where: { id: paymentRequest.id },
    data: { stripeCheckoutSessionId: checkoutSessionId },
  });
  const admin = await createApplicant("admin");
  await supplierApplications.transitionSupplierApplication({
    applicationId: fixture.application!.id,
    actorUserId: admin.id,
    actor: "ADMIN",
    targetStatus: SupplierApplicationStatus.ON_HOLD,
    reason: "Pause new commercial activity during review.",
  });

  await assert.rejects(
    supplierApplications.requireSupplierCanAcceptNewOrdersForCompany(
      fixture.seller.id,
      fixture.sellerCompany.id,
    ),
    (error: unknown) => error instanceof Response && error.status === 403,
  );
  const held = await db.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequest.id },
  });
  assert.equal(held.status, "PENDING");
  assert.equal(held.requiresManualReconciliation, true);
  assert.equal(held.stripeCheckoutSessionId, checkoutSessionId);
  assert.equal(held.checkoutLockToken, null);
  assert.match(held.reconciliationNote ?? "", /checkout is unavailable/i);
  assert.equal(
    await db.paymentRequestEvent.count({
      where: {
        paymentRequestId: paymentRequest.id,
        eventType: PaymentRequestEventType.RECONCILIATION_REQUIRED,
      },
    }),
    1,
  );
});

test("brand review capability loss places pending payments on manual hold", async () => {
  const fixture = await createCommerceFixture({
    status: SupplierApplicationStatus.APPROVED,
  });
  const { paymentRequest } = await createAuthorizedPaymentRequest(fixture);
  const brand = await db.supplierBrandVerification.findFirstOrThrow({
    where: { applicationId: fixture.application!.id },
  });
  const admin = await createApplicant("admin");
  await supplierApplications.reviewSupplierBrandVerification({
    applicationId: fixture.application!.id,
    brandVerificationId: brand.id,
    adminUserId: admin.id,
    input: {
      status: SupplierBrandVerificationStatus.EXPIRED,
      evidenceStatus: SupplierReviewStatus.EXPIRED_DOCUMENT,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      reason: "The only verified brand authorization expired.",
    },
  });
  const held = await db.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequest.id },
  });
  assert.equal(held.requiresManualReconciliation, true);
  assert.equal(
    await db.paymentRequestEvent.count({
      where: {
        paymentRequestId: paymentRequest.id,
        eventType: PaymentRequestEventType.RECONCILIATION_REQUIRED,
      },
    }),
    1,
  );
});

async function finalizeVerifiedSupplierPayment(
  fixture: CommerceFixture,
  paymentRequestId: string,
  { stripeEventCreatedAt = new Date() }: { stripeEventCreatedAt?: Date } = {},
) {
  const checkoutSessionId = `cs_${unique("supplier-payment")}`;
  const paymentIntentId = `pi_${unique("supplier-payment")}`;
  const chargeId = `ch_${unique("supplier-payment")}`;
  const stripeEventId = `evt_${unique("supplier-payment")}`;
  const result = await db.$transaction(async (tx) => {
    const current = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: paymentRequestId },
      include: {
        inquiry: { select: { buyerCompanyId: true, sellerCompanyId: true } },
        sellerCompany: { select: { ownerUserId: true } },
      },
    });
    return paymentRequests.finalizeVerifiedPaymentRequestInTransaction({
      tx,
      current,
      updateData: {
        stripeCheckoutSessionId: checkoutSessionId,
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: chargeId,
        stripeProcessingFeeAmount: 330,
        stripeFeeSyncStatus: "SYNCED",
        stripeFeeSyncError: null,
        stripeFeeSyncedAt: new Date(),
        checkoutLockToken: null,
        checkoutLockExpiresAt: null,
      },
      stripeEvent: {
        stripeEventId,
        stripeEventType: "checkout.session.completed",
        stripeEventCreatedAt,
      },
      stripeProcessingFeeAmount: 330,
    });
  });
  return {
    ...result,
    evidence: {
      paymentRequestId,
      paymentIntentId,
      checkoutSessionId,
      grossAmount: 11_000,
      currency: "usd",
      confirmationSource: "checkout_session" as const,
    },
    fixture,
  };
}

async function withSettlementLedgerEnabled<T>(run: () => Promise<T>) {
  const previous = process.env.STRIPE_CONNECT_SETTLEMENT_MODE;
  process.env.STRIPE_CONNECT_SETTLEMENT_MODE = "on";
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.STRIPE_CONNECT_SETTLEMENT_MODE;
    else process.env.STRIPE_CONNECT_SETTLEMENT_MODE = previous;
  }
}

test("ineligible paid webhook is recorded for manual reconciliation without order or settlement sync", async () => {
  const fixture = await createCommerceFixture({
    status: SupplierApplicationStatus.APPROVED,
  });
  const { paymentRequest, order } = await createAuthorizedPaymentRequest(fixture);
  const admin = await createApplicant("admin");
  await supplierApplications.transitionSupplierApplication({
    applicationId: fixture.application!.id,
    actorUserId: admin.id,
    actor: "ADMIN",
    targetStatus: SupplierApplicationStatus.ON_HOLD,
    reason: "Capability changed after Checkout was opened.",
  });

  const finalized = await finalizeVerifiedSupplierPayment(
    fixture,
    paymentRequest.id,
  );
  assert.equal(finalized.paid, true);
  assert.equal(finalized.supplierEligible, false);
  assert.equal(finalized.paymentConfirmedOrderId, null);
  const [storedPayment, storedOrder, paidEvents, reconciliationEvents] =
    await Promise.all([
      db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } }),
      db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } }),
      db.paymentRequestEvent.count({
        where: {
          paymentRequestId: paymentRequest.id,
          eventType: PaymentRequestEventType.PAID,
        },
      }),
      db.paymentRequestEvent.count({
        where: {
          paymentRequestId: paymentRequest.id,
          eventType: PaymentRequestEventType.RECONCILIATION_REQUIRED,
        },
      }),
    ]);
  assert.equal(storedPayment.status, "PAID");
  assert.equal(storedPayment.requiresManualReconciliation, true);
  assert.match(storedPayment.reconciliationNote ?? "", /payment completion/i);
  assert.equal(storedOrder.paymentStatus, "PENDING");
  assert.equal(paidEvents, 1);
  assert.equal(reconciliationEvents, 2);
  assert.equal(
    await withSettlementLedgerEnabled(() =>
      settlements.createPendingSettlementForVerifiedWebhookPayment(
        finalized.evidence,
      ),
    ),
    null,
  );
  assert.equal(
    await db.settlement.count({ where: { paymentRequestId: paymentRequest.id } }),
    0,
  );
  assert.equal(
    await db.sellerPayout.count({ where: { orderId: order.id } }),
    0,
  );
});

test("eligible paid webhook preserves normal order and settlement creation", async () => {
  const fixture = await createCommerceFixture({
    status: SupplierApplicationStatus.APPROVED,
  });
  const { paymentRequest, order } = await createAuthorizedPaymentRequest(fixture);
  const finalized = await finalizeVerifiedSupplierPayment(
    fixture,
    paymentRequest.id,
  );
  assert.equal(finalized.paid, true);
  assert.equal(finalized.supplierEligible, true);
  assert.equal(finalized.paymentConfirmedOrderId, order.id);
  assert.equal(
    (await db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } }))
      .paymentStatus,
    "PAID",
  );
  const settlement = await withSettlementLedgerEnabled(() =>
    settlements.createPendingSettlementForVerifiedWebhookPayment(
      finalized.evidence,
    ),
  );
  assert.ok(settlement);
  assert.equal(
    await db.settlement.count({ where: { paymentRequestId: paymentRequest.id } }),
    1,
  );
});

test("payment event time, not delayed webhook time, determines brand eligibility and paidAt", async () => {
  const eventTime = new Date();
  const fixture = await createCommerceFixture({
    status: SupplierApplicationStatus.APPROVED,
    brandExpiresAt: new Date(eventTime.getTime() + 60_000),
  });
  const { paymentRequest, order } = await createAuthorizedPaymentRequest(fixture);
  // The stored expiry is after the event but can be before delayed webhook
  // processing; eligibility must use the Stripe event time, not processing now.
  await db.supplierBrandVerification.updateMany({
    where: { applicationId: fixture.application!.id },
    data: { expiresAt: new Date(eventTime.getTime() + 30_000) },
  });
  const finalized = await finalizeVerifiedSupplierPayment(fixture, paymentRequest.id, {
    stripeEventCreatedAt: eventTime,
  });
  assert.equal(finalized.supplierEligible, true);
  const stored = await db.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequest.id },
  });
  assert.equal(stored.paidAt?.toISOString(), eventTime.toISOString());
  assert.equal(
    (await db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus,
    "PAID",
  );
  assert.ok(await withSettlementLedgerEnabled(() =>
    settlements.createPendingSettlementForVerifiedWebhookPayment(finalized.evidence),
  ));
});

test("brand expiry before the Stripe event requires manual reconciliation", async () => {
  const eventTime = new Date();
  const fixture = await createCommerceFixture({
    status: SupplierApplicationStatus.APPROVED,
    brandExpiresAt: new Date(eventTime.getTime() + 60_000),
  });
  const { paymentRequest, order } = await createAuthorizedPaymentRequest(fixture);
  await db.supplierBrandVerification.updateMany({
    where: { applicationId: fixture.application!.id },
    data: { expiresAt: new Date(eventTime.getTime() - 30_000) },
  });
  const finalized = await finalizeVerifiedSupplierPayment(fixture, paymentRequest.id, {
    stripeEventCreatedAt: eventTime,
  });
  assert.equal(finalized.supplierEligible, false);
  const [stored, storedOrder] = await Promise.all([
    db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } }),
    db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } }),
  ]);
  assert.equal(stored.requiresManualReconciliation, true);
  assert.equal(storedOrder.paymentStatus, "PENDING");
  assert.equal(await withSettlementLedgerEnabled(() =>
    settlements.createPendingSettlementForVerifiedWebhookPayment(finalized.evidence),
  ), null);
});

test("anomalous future Stripe event timestamps are manual-only", async () => {
  const fixture = await createCommerceFixture({ status: SupplierApplicationStatus.APPROVED });
  const { paymentRequest, order } = await createAuthorizedPaymentRequest(fixture);
  const finalized = await finalizeVerifiedSupplierPayment(fixture, paymentRequest.id, {
    stripeEventCreatedAt: new Date(Date.now() + 10 * 60_000),
  });
  assert.equal(finalized.supplierEligible, true);
  const [stored, storedOrder] = await Promise.all([
    db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } }),
    db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } }),
  ]);
  assert.equal(stored.requiresManualReconciliation, true);
  assert.match(stored.reconciliationNote ?? "", /timestamp/i);
  assert.equal(storedOrder.paymentStatus, "PENDING");
  assert.equal(await withSettlementLedgerEnabled(() =>
    settlements.createPendingSettlementForVerifiedWebhookPayment(finalized.evidence),
  ), null);
});

test("settlement remains creatable after an eligible payment is later put on hold", async () => {
  const fixture = await createCommerceFixture({ status: SupplierApplicationStatus.APPROVED });
  const { paymentRequest } = await createAuthorizedPaymentRequest(fixture);
  const finalized = await finalizeVerifiedSupplierPayment(fixture, paymentRequest.id);
  const admin = await createApplicant("admin");
  await supplierApplications.transitionSupplierApplication({
    applicationId: fixture.application!.id,
    actorUserId: admin.id,
    actor: "ADMIN",
    targetStatus: SupplierApplicationStatus.ON_HOLD,
    reason: "Post-payment operational review.",
  });
  assert.ok(await withSettlementLedgerEnabled(() =>
    settlements.createPendingSettlementForVerifiedWebhookPayment(finalized.evidence),
  ));
});

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function commerceLockKey(companyId: string) {
  return `supplier-commerce:${companyId}`;
}

test("independent connections serialize ON_HOLD before payment-request creation", async () => {
  const fixture = await createCommerceFixture({ status: SupplierApplicationStatus.APPROVED });
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const [{ pid: holdPid }] = (await connection.query<{ pid: number }>(
      "SELECT pg_backend_pid() AS pid",
    )).rows;
    await connection.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [commerceLockKey(fixture.sellerCompany.id)],
    );

    let creationPid: number | null = null;
    const blockedCreation = createAuthorizedPaymentRequest(fixture, {
      afterCommerceLock: async (tx) => {
        const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>(
          Prisma.sql`SELECT pg_backend_pid() AS pid`,
        );
        creationPid = pid;
      },
    });
    let creationSettled = false;
    void blockedCreation.then(
      () => { creationSettled = true; },
      () => { creationSettled = true; },
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(creationSettled, false, "creation must wait for another connection's commerce lock");

    await connection.query(
      'UPDATE "SupplierApplication" SET "status" = $1::"SupplierApplicationStatus" WHERE "id" = $2',
      [SupplierApplicationStatus.ON_HOLD, fixture.application!.id],
    );
    await connection.query("COMMIT");
    await assert.rejects(
      blockedCreation,
      (error: unknown) => error instanceof Response && error.status === 403,
    );
    assert.notEqual(creationPid, holdPid);
    await assertNoCommerceSideEffects(fixture);
  } finally {
    await connection.query("ROLLBACK").catch(() => undefined);
    connection.release();
  }
});

test("payment request wins the commerce lock atomically before a later ON_HOLD transition", async () => {
  const fixture = await createCommerceFixture({ status: SupplierApplicationStatus.APPROVED });
  const locked = deferred();
  const releaseCreation = deferred();
  const creation = createAuthorizedPaymentRequest(fixture, {
    afterCommerceLock: async () => {
      locked.resolve();
      await releaseCreation.promise;
    },
  });
  await locked.promise;
  const admin = await createApplicant("admin");
  const hold = supplierApplications.transitionSupplierApplication({
    applicationId: fixture.application!.id,
    actorUserId: admin.id,
    actor: "ADMIN",
    targetStatus: SupplierApplicationStatus.ON_HOLD,
    reason: "Concurrent compliance hold.",
  });
  let holdSettled = false;
  void hold.then(
    () => { holdSettled = true; },
    () => { holdSettled = true; },
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(holdSettled, false, "status transition must wait for the payment-request lock");
  releaseCreation.resolve();
  const { paymentRequest, order } = await creation;
  await hold;
  const [storedRequest, storedOrder] = await Promise.all([
    db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } }),
    db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } }),
  ]);
  assert.equal(storedRequest.requiresManualReconciliation, true);
  assert.equal(storedOrder.paymentStatus, "PENDING");
});

test("webhook finalization and ON_HOLD resolve to a complete eligible-or-manual outcome", async () => {
  const fixture = await createCommerceFixture({ status: SupplierApplicationStatus.APPROVED });
  const { paymentRequest, order } = await createAuthorizedPaymentRequest(fixture);
  const locked = deferred();
  const releaseFinalization = deferred();
  const checkoutSessionId = `cs_${unique("race-webhook")}`;
  const paymentIntentId = `pi_${unique("race-webhook")}`;
  const finalization = db.$transaction(async (tx) => {
    await commerceBoundary.lockSupplierCommerceBoundary(tx, fixture.sellerCompany.id);
    locked.resolve();
    await releaseFinalization.promise;
    const current = await tx.paymentRequest.findUniqueOrThrow({
      where: { id: paymentRequest.id },
      include: {
        inquiry: { select: { buyerCompanyId: true, sellerCompanyId: true } },
        sellerCompany: { select: { ownerUserId: true } },
      },
    });
    return paymentRequests.finalizeVerifiedPaymentRequestInTransaction({
      tx,
      current,
      commerceLockAlreadyHeld: true,
      updateData: {
        stripeCheckoutSessionId: checkoutSessionId,
        stripePaymentIntentId: paymentIntentId,
      },
      stripeEvent: {
        stripeEventId: unique("race-webhook"),
        stripeEventType: "checkout.session.completed",
        stripeEventCreatedAt: new Date(),
      },
      stripeProcessingFeeAmount: null,
    });
  });
  await locked.promise;
  const admin = await createApplicant("admin");
  const hold = supplierApplications.transitionSupplierApplication({
    applicationId: fixture.application!.id,
    actorUserId: admin.id,
    actor: "ADMIN",
    targetStatus: SupplierApplicationStatus.ON_HOLD,
    reason: "Concurrent payment review.",
  });
  releaseFinalization.resolve();
  const finalized = await finalization;
  await hold;
  assert.equal(finalized.supplierEligible, true);
  const [storedRequest, storedOrder] = await Promise.all([
    db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } }),
    db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } }),
  ]);
  assert.equal(storedRequest.status, "PAID");
  assert.equal(storedRequest.requiresManualReconciliation, false);
  assert.equal(storedOrder.paymentStatus, "PAID");
  assert.ok(await withSettlementLedgerEnabled(() =>
    settlements.createPendingSettlementForVerifiedWebhookPayment({
      paymentRequestId: paymentRequest.id,
      paymentIntentId,
      checkoutSessionId,
      grossAmount: 11_000,
      currency: "usd",
      confirmationSource: "checkout_session",
    }),
  ));
});

test("ON_HOLD winning the commerce lock makes a concurrent webhook manual-only", async () => {
  const fixture = await createCommerceFixture({ status: SupplierApplicationStatus.APPROVED });
  const { paymentRequest, order } = await createAuthorizedPaymentRequest(fixture);
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [commerceLockKey(fixture.sellerCompany.id)],
    );
    await connection.query(
      'UPDATE "SupplierApplication" SET "status" = $1::"SupplierApplicationStatus" WHERE "id" = $2',
      [SupplierApplicationStatus.ON_HOLD, fixture.application!.id],
    );
    await connection.query(
      'UPDATE "PaymentRequest" SET "requiresManualReconciliation" = true WHERE "id" = $1',
      [paymentRequest.id],
    );
    const finalization = db.$transaction(async (tx) => {
      const current = await tx.paymentRequest.findUniqueOrThrow({
        where: { id: paymentRequest.id },
        include: {
          inquiry: { select: { buyerCompanyId: true, sellerCompanyId: true } },
          sellerCompany: { select: { ownerUserId: true } },
        },
      });
      return paymentRequests.finalizeVerifiedPaymentRequestInTransaction({
        tx,
        current,
        updateData: {},
        stripeEvent: {
          stripeEventId: unique("race-hold-webhook"),
          stripeEventType: "checkout.session.completed",
          stripeEventCreatedAt: new Date(),
        },
        stripeProcessingFeeAmount: null,
      });
    });
    let finalizationSettled = false;
    void finalization.then(
      () => { finalizationSettled = true; },
      () => { finalizationSettled = true; },
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(finalizationSettled, false, "webhook finalization must wait for the hold lock");
    await connection.query("COMMIT");
    const finalized = await finalization;
    assert.equal(finalized.supplierEligible, false);
    const [storedRequest, storedOrder] = await Promise.all([
      db.paymentRequest.findUniqueOrThrow({ where: { id: paymentRequest.id } }),
      db.tradeOrder.findUniqueOrThrow({ where: { id: order.id } }),
    ]);
    assert.equal(storedRequest.status, "PAID");
    assert.equal(storedRequest.requiresManualReconciliation, true);
    assert.equal(storedOrder.paymentStatus, "PENDING");
    assert.equal(await withSettlementLedgerEnabled(() =>
      settlements.createPendingSettlementForVerifiedWebhookPayment({
        paymentRequestId: paymentRequest.id,
        paymentIntentId: "pi_not_created",
        checkoutSessionId: null,
        grossAmount: 11_000,
        currency: "usd",
        confirmationSource: "payment_intent",
      }),
    ), null);
  } finally {
    await connection.query("ROLLBACK").catch(() => undefined);
    connection.release();
  }
});
