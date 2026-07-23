import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import { PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration suite.");
  const url = new URL(value);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(url.hostname),
    "The integration database must be localhost only.",
  );
  assert.match(
    url.pathname.slice(1),
    /^trade82_order_payout_test_[a-z0-9_-]+$/i,
    "The integration database name is not disposable.",
  );
}

assertDisposableDatabase();
process.env.PARTNER_PROGRAM_MODE = "on";

const { getDb } = await import(
  new URL("../src/lib/db.ts", import.meta.url).href,
);
const { getAdminPartnerListData, parseAdminPartnerListQuery } = await import(
  new URL("../src/lib/admin-partners.ts", import.meta.url).href,
);
const { getAdminPartnerDashboardData } = await import(
  new URL("../src/lib/partner-dashboard.ts", import.meta.url).href,
);
const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

async function createPartnerFixture({
  label,
  status = "ACTIVE",
  deletedAt = null,
}: {
  label: string;
  status?: "ACTIVE" | "SUSPENDED";
  deletedAt?: Date | null;
}) {
  const id = suffix();
  const user = await db.userProfile.create({
    data: {
      clerkUserId: `${label}-user-${id}`,
      email: `${label}-${id}@example.test`,
      displayName: `${label} User`,
      role: "user",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: user.id,
      referralCode: `${label.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)}${id.slice(0, 10).toUpperCase()}`,
      status,
      displayName: `${label} Partner`,
      legalName: `${label} Legal`,
      organizationName: `${label} Organization`,
      contactEmail: user.email,
      country: "KR",
      preferredLanguage: "en",
      deletedAt,
    },
  });
  return { id, user, partner };
}

test("admin partner list batches referral analytics and excludes deleted partners", async () => {
  const id = suffix();
  const partnerUser = await db.userProfile.create({
    data: {
      clerkUserId: `admin-list-partner-${id}`,
      email: `admin-list-partner-${id}@example.test`,
      displayName: "Admin List Partner",
      role: "user",
    },
  });
  const referredSeller = await db.userProfile.create({
    data: {
      clerkUserId: `admin-list-seller-${id}`,
      email: `admin-list-seller-${id}@example.test`,
      displayName: "Referred Seller",
      role: "seller",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: partnerUser.id,
      referralCode: `T82-ADMIN-${id.toUpperCase()}`,
      status: "ACTIVE",
      displayName: "Admin List Partner",
      legalName: "Admin List Partner LLC",
      organizationName: "Admin List Organization",
      contactEmail: partnerUser.email,
      country: "KR",
      preferredLanguage: "ko",
    },
  });
  const deletedUser = await db.userProfile.create({
    data: {
      clerkUserId: `admin-list-deleted-${id}`,
      email: `admin-list-deleted-${id}@example.test`,
      displayName: "Deleted Partner User",
      role: "user",
    },
  });
  await db.partnerProfile.create({
    data: {
      userId: deletedUser.id,
      referralCode: `T82-DELETED-${id.toUpperCase()}`,
      status: "ACTIVE",
      deletedAt: new Date(),
    },
  });

  const attribution = await db.referralAttribution.create({
    data: {
      referredUserId: referredSeller.id,
      partnerProfileId: partner.id,
      referralCode: partner.referralCode,
      status: "LOCKED",
      lockedAt: new Date("2026-07-20T00:00:00.000Z"),
    },
  });
  await db.referralClickDailyVisitor.create({
    data: {
      partnerProfileId: partner.id,
      visitorHash: `visitor-${id}`,
      day: new Date("2026-07-20T00:00:00.000Z"),
      clickCount: 3,
    },
  });
  await db.referralConversion.create({
    data: {
      partnerProfileId: partner.id,
      referralAttributionId: attribution.id,
      subjectType: "SELLER",
      convertedAt: new Date("2026-07-20T00:00:00.000Z"),
    },
  });

  const query = parseAdminPartnerListQuery({
    search: " admin list partner ",
    country: "KR",
    analyticsRange: "all",
  });
  const data = await getAdminPartnerListData(query);

  assert.equal(data.total, 1);
  assert.equal(data.rows.length, 1);
  const row = data.rows[0];
  assert.ok(row);
  assert.equal(row.id, partner.id);
  assert.equal(row.displayName, "Admin List Partner");
  assert.equal(row.contactEmail, partnerUser.email);
  assert.equal(row.country, "KR");
  assert.equal(row.linkVisits, 3);
  assert.equal(row.uniqueVisitors, 1);
  assert.equal(row.attributedSignups, 1);
  assert.equal(row.sellerRegistrations, 1);
  assert.equal(row.buyerRegistrations, 0);
  assert.equal(row.payoutSetup, "notStarted");
  assert.equal("visitorHash" in row, false);
  assert.equal("clerkUserId" in row, false);
});

test("admin partner list status and payout filters are server-backed", async () => {
  const id = suffix();
  const user = await db.userProfile.create({
    data: {
      clerkUserId: `admin-filter-partner-${id}`,
      email: `admin-filter-partner-${id}@example.test`,
      displayName: "Suspended Partner",
      role: "user",
    },
  });
  const partner = await db.partnerProfile.create({
    data: {
      userId: user.id,
      referralCode: `T82-FILTER-${id.toUpperCase()}`,
      status: "SUSPENDED",
      country: "US",
    },
  });
  const bank = await db.bankDirectory.create({
    data: {
      countryCode: "KR",
      bankNameLocal: `테스트은행 ${id}`,
      bankNameEnglish: `Test Bank ${id}`,
      sourceType: "SEED",
      isActive: true,
    },
    select: { id: true },
  });
  await db.partnerPayoutProfile.create({
    data: {
      partnerProfileId: partner.id,
      bankDirectoryId: bank.id,
      country: "KR",
      bankName: "Test Bank",
      accountHolder: "Suspended Partner",
      accountNumberCiphertext: Buffer.from([1]),
      accountNumberIv: Buffer.alloc(12, 1),
      accountNumberAuthTag: Buffer.alloc(16, 2),
      accountNumberKeyVersion: "local-test-v1",
      accountNumberLast4: "1234",
      accountNumberMasked: "•••• 1234",
      accountType: "LOCAL",
      payoutCurrency: "krw",
      supportedCurrencies: ["krw"],
      accountBelongsToPartner: true,
      status: "REJECTED",
    },
  });

  const data = await getAdminPartnerListData(
    parseAdminPartnerListQuery({ status: "suspended", payoutSetup: "restricted" }),
  );
  const matchingRows = data.rows as Array<{ id: string; payoutSetup?: string }>;
  assert.equal(matchingRows.some((row) => row.id === partner.id), true);
  assert.equal(matchingRows.find((row) => row.id === partner.id)?.payoutSetup, "restricted");
});

test("admin partner list metrics are all-time and stable across PostgreSQL session timezones", async () => {
  const { partner, user } = await createPartnerFixture({ label: "timezone-admin" });
  const referred = await db.userProfile.create({
    data: {
      clerkUserId: `timezone-referred-${suffix()}`,
      email: `timezone-referred-${suffix()}@example.test`,
      displayName: "Timezone Referred",
      role: "buyer",
    },
  });
  const attribution = await db.referralAttribution.create({
    data: {
      referredUserId: referred.id,
      partnerProfileId: partner.id,
      referralCode: partner.referralCode,
      status: "LOCKED",
      lockedAt: new Date("2026-01-01T00:30:00.000Z"),
    },
  });
  await db.referralClickDailyVisitor.create({
    data: {
      partnerProfileId: partner.id,
      visitorHash: `timezone-visitor-${partner.id}`,
      day: new Date("2026-01-01T00:00:00.000Z"),
      clickCount: 2,
    },
  });
  await db.referralConversion.create({
    data: {
      partnerProfileId: partner.id,
      referralAttributionId: attribution.id,
      subjectType: "BUYER",
      convertedAt: new Date("2026-01-01T00:30:00.000Z"),
    },
  });

  const query = parseAdminPartnerListQuery({ search: user.email });
  await db.$executeRawUnsafe(`SET TIME ZONE 'UTC'`);
  const utc = await getAdminPartnerListData(query);
  await db.$executeRawUnsafe(`SET TIME ZONE 'America/Los_Angeles'`);
  const losAngeles = await getAdminPartnerListData(query);
  await db.$executeRawUnsafe(`SET TIME ZONE 'UTC'`);

  const utcRow = utc.rows.find((row: { id: string }) => row.id === partner.id);
  const laRow = losAngeles.rows.find((row: { id: string }) => row.id === partner.id);
  assert.ok(utcRow);
  assert.ok(laRow);
  assert.deepEqual(
    {
      linkVisits: laRow.linkVisits,
      uniqueVisitors: laRow.uniqueVisitors,
      attributedSignups: laRow.attributedSignups,
      sellerRegistrations: laRow.sellerRegistrations,
      buyerRegistrations: laRow.buyerRegistrations,
    },
    {
      linkVisits: utcRow.linkVisits,
      uniqueVisitors: utcRow.uniqueVisitors,
      attributedSignups: utcRow.attributedSignups,
      sellerRegistrations: utcRow.sellerRegistrations,
      buyerRegistrations: utcRow.buyerRegistrations,
    },
  );
  assert.equal(utcRow.linkVisits, 2);
  assert.equal(utcRow.attributedSignups, 1);
  assert.equal(utcRow.buyerRegistrations, 1);
});

test("invalid admin partner list page has a distinct state", async () => {
  const { user } = await createPartnerFixture({ label: "invalid-page-admin" });
  const data = await getAdminPartnerListData(
    parseAdminPartnerListQuery({ search: user.email, page: "999" }),
  );
  assert.equal(data.total, 1);
  assert.equal(data.rows.length, 0);
  assert.equal(data.invalidPage, true);
});

test("admin partner detail supports active and suspended partners but excludes deleted or missing profiles", async () => {
  const active = await createPartnerFixture({ label: "active-detail-admin" });
  const suspended = await createPartnerFixture({
    label: "suspended-detail-admin",
    status: "SUSPENDED",
  });
  const deleted = await createPartnerFixture({
    label: "deleted-detail-admin",
    deletedAt: new Date(),
  });

  const activeData = await getAdminPartnerDashboardData({
    partnerProfileId: active.partner.id,
  });
  const suspendedData = await getAdminPartnerDashboardData({
    partnerProfileId: suspended.partner.id,
  });
  const deletedData = await getAdminPartnerDashboardData({
    partnerProfileId: deleted.partner.id,
  });
  const missingData = await getAdminPartnerDashboardData({
    partnerProfileId: `missing-${suffix()}`,
  });

  assert.equal(activeData?.partner.status, "ACTIVE");
  assert.equal(suspendedData?.partner.status, "SUSPENDED");
  assert.equal(deletedData, null);
  assert.equal(missingData, null);
});

test("admin partner detail isolates partner analytics and anonymizes referred members", async () => {
  const partnerA = await createPartnerFixture({ label: "detail-a-admin" });
  const partnerB = await createPartnerFixture({ label: "detail-b-admin" });
  const referredA = await db.userProfile.create({
    data: {
      clerkUserId: `detail-a-referred-${suffix()}`,
      email: `detail-a-referred-${suffix()}@example.test`,
      displayName: "Sensitive Person",
      role: "seller",
    },
  });
  const attributionA = await db.referralAttribution.create({
    data: {
      referredUserId: referredA.id,
      partnerProfileId: partnerA.partner.id,
      referralCode: partnerA.partner.referralCode,
      status: "LOCKED",
      lockedAt: new Date("2026-07-21T12:00:00.000Z"),
    },
  });
  await db.referralClickDailyVisitor.create({
    data: {
      partnerProfileId: partnerA.partner.id,
      visitorHash: `visitor-a-${suffix()}`,
      day: new Date("2026-07-21T00:00:00.000Z"),
      clickCount: 1,
    },
  });
  await db.referralClickDailyVisitor.create({
    data: {
      partnerProfileId: partnerB.partner.id,
      visitorHash: `visitor-b-${suffix()}`,
      day: new Date("2026-07-21T00:00:00.000Z"),
      clickCount: 9,
    },
  });
  await db.referralConversion.create({
    data: {
      partnerProfileId: partnerA.partner.id,
      referralAttributionId: attributionA.id,
      subjectType: "SELLER",
      convertedAt: new Date("2026-07-21T12:00:00.000Z"),
    },
  });
  await db.referralClaimToken.create({
    data: {
      tokenHash: `secret-token-hash-${suffix()}`,
      partnerProfileId: partnerA.partner.id,
      expiresAt: new Date("2026-08-21T00:00:00.000Z"),
    },
  });

  const data = await getAdminPartnerDashboardData({
    partnerProfileId: partnerA.partner.id,
    analyticsRange: "all",
  });
  assert.ok(data);
  assert.equal(data.analytics.totals.totalClicks, 1);
  assert.equal(data.analytics.totals.sellerRegistrations, 1);
  assert.equal(data.referredMembers[0]?.name, "S.");
  assert.equal(data.referredMembers[0]?.name.includes("Sensitive Person"), false);

  const serialized = JSON.stringify(data);
  assert.equal(serialized.includes("visitor-a-"), false);
  assert.equal(serialized.includes(partnerA.user.clerkUserId), false);
  assert.equal(serialized.includes(referredA.clerkUserId), false);
  assert.equal(serialized.includes("secret-token-hash"), false);
  assert.equal(/sk_live|rk_live|stripe_secret/i.test(serialized), false);
});

test("admin partner detail is read-only for referral and financial tables", async () => {
  const { partner, user } = await createPartnerFixture({ label: "readonly-admin" });
  const before = {
    clicks: await db.referralClickDailyVisitor.count(),
    claims: await db.referralClaimToken.count(),
    attributions: await db.referralAttribution.count(),
    conversions: await db.referralConversion.count(),
    settlements: await db.settlement.count(),
    settlementLegs: await db.settlementLeg.count(),
    partner: await db.partnerProfile.findUnique({ where: { id: partner.id } }),
    user: await db.userProfile.findUnique({ where: { id: user.id } }),
  };

  const data = await getAdminPartnerDashboardData({
    partnerProfileId: partner.id,
    analyticsRange: "all",
  });
  assert.ok(data);

  const after = {
    clicks: await db.referralClickDailyVisitor.count(),
    claims: await db.referralClaimToken.count(),
    attributions: await db.referralAttribution.count(),
    conversions: await db.referralConversion.count(),
    settlements: await db.settlement.count(),
    settlementLegs: await db.settlementLeg.count(),
    partner: await db.partnerProfile.findUnique({ where: { id: partner.id } }),
    user: await db.userProfile.findUnique({ where: { id: user.id } }),
  };

  assert.deepEqual(
    {
      clicks: after.clicks,
      claims: after.claims,
      attributions: after.attributions,
      conversions: after.conversions,
      settlements: after.settlements,
      settlementLegs: after.settlementLegs,
      partner: after.partner,
      user: after.user,
    },
    before,
  );
});
