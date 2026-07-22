import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import type { PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration suite.");
  const url = new URL(value);
  assert.ok(["127.0.0.1", "localhost", "::1"].includes(url.hostname));
  assert.match(url.pathname.slice(1), /^trade82_order_payout_test_[a-z0-9_-]+$/i);
  assert.doesNotMatch(url.hostname, /supabase|neon|aws|vercel|render|railway|fly/i);
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "4";
process.env.PARTNER_PROGRAM_MODE = "on";

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const { markAccountDeletionPending, cleanupTrade82AccountData } = await import(
  new URL("../src/lib/account-deletion.ts", import.meta.url).href,
);
const { getPartnerReferralAnalytics } = await import(
  new URL("../src/lib/partner-referral-analytics.ts", import.meta.url).href,
);
const { recordReferralConversionForCompany } = await import(
  new URL("../src/lib/partner-referral-conversions.ts", import.meta.url).href,
);
const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

test("account deletion tombstones referred company while retaining conversion analytics", async () => {
  const id = suffix();
  let partnerUserId: string | undefined;
  let partnerId: string | undefined;
  let referredUserId: string | undefined;
  let attributionId: string | undefined;
  let companyId: string | undefined;
  try {
    const partnerUser = await db.userProfile.create({
      data: {
        clerkUserId: `retention-partner-${id}`,
        email: `retention-partner-${id}@example.test`,
        displayName: "Retention Partner",
        role: "user",
      },
    });
    partnerUserId = partnerUser.id;
    const partner = await db.partnerProfile.create({
      data: {
        userId: partnerUser.id,
        referralCode: `T82-${id.toUpperCase()}`,
        status: "ACTIVE",
      },
    });
    partnerId = partner.id;
    const referredUser = await db.userProfile.create({
      data: {
        clerkUserId: `retention-referred-${id}`,
        email: `retention-referred-${id}@example.test`,
        displayName: "Retention Referred User",
        role: "user",
      },
    });
    referredUserId = referredUser.id;
    const attribution = await db.referralAttribution.create({
      data: {
        referredUserId: referredUser.id,
        partnerProfileId: partner.id,
        referralCode: partner.referralCode,
        status: "LOCKED",
      },
    });
    attributionId = attribution.id;
    const company = await db.company.create({
      data: {
        ownerUserId: referredUser.id,
        companyRole: "seller",
        legalName: `Private Company ${id}`,
        country: "KR",
        businessAddress: "Private Address",
      },
    });
    companyId = company.id;
    await recordReferralConversionForCompany(db, {
      ownerUserId: referredUser.id,
      companyRole: "seller",
      companyCreatedAt: company.createdAt,
    });
    assert.equal(
      await db.referralConversion.count({ where: { referralAttributionId: attribution.id } }),
      1,
    );

    await markAccountDeletionPending(referredUser.id);
    const cleanup = await cleanupTrade82AccountData({
      userProfileId: referredUser.id,
      clerkUserId: referredUser.clerkUserId,
    });
    assert.equal(cleanup.deletionStatus, "DELETED");

    const [deletedUser, deletedCompany, retainedConversion, analytics] = await Promise.all([
      db.userProfile.findUnique({ where: { id: referredUser.id } }),
      db.company.findUnique({ where: { id: company.id } }),
      db.referralConversion.findUnique({
        where: {
          referralAttributionId_subjectType: {
            referralAttributionId: attribution.id,
            subjectType: "SELLER",
          },
        },
      }),
      getPartnerReferralAnalytics({
        db,
        partnerProfileId: partner.id,
        range: "all",
        now: new Date(),
      }),
    ]);
    assert.equal(deletedUser?.email, `deleted-${referredUser.id}@deleted.trade82.local`);
    assert.notEqual(deletedUser?.displayName, "Retention Referred User");
    assert.equal(deletedCompany?.deletedAt !== null, true);
    assert.equal(deletedCompany?.verificationStatus, "rejected");
    assert.equal(deletedCompany?.legalName, "Deleted company");
    assert.ok(retainedConversion);
    assert.equal(analytics.totals.sellerRegistrations, 1);
    assert.doesNotMatch(JSON.stringify(analytics), /Retention|Private|example\.test/);
  } finally {
    if (partnerId) {
      await db.referralConversion.deleteMany({ where: { partnerProfileId: partnerId } });
    }
    if (attributionId) {
      await db.referralAttribution.deleteMany({ where: { id: attributionId } });
    }
    if (companyId) {
      await db.sellerProfile.deleteMany({ where: { companyId } });
      await db.buyerProfile.deleteMany({ where: { companyId } });
      await db.company.deleteMany({ where: { id: companyId } });
    }
    if (referredUserId) {
      await db.userProfile.deleteMany({ where: { id: referredUserId } });
    }
    if (partnerId) {
      await db.partnerProfile.deleteMany({ where: { id: partnerId } });
    }
    if (partnerUserId) {
      await db.userProfile.deleteMany({ where: { id: partnerUserId } });
    }
  }
});
