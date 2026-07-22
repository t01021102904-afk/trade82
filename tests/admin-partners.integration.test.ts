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
const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
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
  await db.stripeConnectedAccount.create({
    data: {
      partnerProfileId: partner.id,
      stripeAccountId: `acct_filter_${id}`,
      status: "RESTRICTED",
      onboardingComplete: false,
    },
  });

  const data = await getAdminPartnerListData(
    parseAdminPartnerListQuery({ status: "suspended", payoutSetup: "restricted" }),
  );
  const matchingRows = data.rows as Array<{ id: string; payoutSetup?: string }>;
  assert.equal(matchingRows.some((row) => row.id === partner.id), true);
  assert.equal(matchingRows.find((row) => row.id === partner.id)?.payoutSetup, "restricted");
});
