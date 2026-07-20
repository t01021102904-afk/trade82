import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import type { PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration suite.");
  const url = new URL(value);
  assert.ok(
    ["127.0.0.1", "localhost", "::1"].includes(url.hostname),
    "The integration database must be localhost only.",
  );
  assert.match(
    url.pathname.slice(1),
    /^trade82_order_payout_test_[a-z0-9_-]+$/i,
    "The integration database name is not disposable.",
  );
  assert.doesNotMatch(
    url.hostname,
    /supabase|neon|aws|vercel|render|railway|fly/i,
    "A remote database is never valid for this suite.",
  );
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "4";

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const { markAccountDeletionPending, cleanupTrade82AccountData } = await import(
  new URL("../src/lib/account-deletion.ts", import.meta.url).href,
);
const { createFreshUserProfile } = await import(
  new URL("../src/lib/fresh-user-profile.ts", import.meta.url).href,
);
const { getOnboardingCompanyState } = await import(
  new URL("../src/lib/onboarding-status.ts", import.meta.url).href,
);

const db = getDb() as PrismaClient;

after(async () => {
  await db.$disconnect();
});

function suffix() {
  return randomBytes(8).toString("hex");
}

test("deleting an account creates a fresh same-email identity with no old state", async () => {
  const id = suffix();
  const email = `fresh-onboarding-${id}@example.test`;
  let oldUserId: string | undefined;
  let freshUserId: string | undefined;
  let companyId: string | undefined;

  try {
    const oldUser = await db.userProfile.create({
      data: {
        clerkUserId: `deleted-user-${id}`,
        email,
        displayName: "Deleted seller",
        country: "KR",
        role: "seller",
      },
    });
    oldUserId = oldUser.id;

    const company = await db.company.create({
      data: {
        ownerUserId: oldUser.id,
        companyRole: "seller",
        legalName: `Deleted Seller ${id}`,
        country: "KR",
        city: "Seoul",
        businessAddress: "Seoul",
      },
    });
    companyId = company.id;
    const product = await db.product.create({
      data: {
        sellerCompanyId: company.id,
        name: "Historical product",
        slug: `historical-product-${id}`,
        category: "beauty_personal_care",
        shortDescription: "Historical product",
        detailedDescription: "Historical product details",
        moq: "10 units",
        leadTime: "14 days",
        ingredientsOrMaterials: "Water",
        packaging: "Box",
        status: "active",
      },
    });
    const partner = await db.partnerProfile.create({
      data: {
        userId: oldUser.id,
        referralCode: `DELETED${id.toUpperCase()}`,
      },
    });
    await db.referralAttribution.create({
      data: {
        referredUserId: oldUser.id,
        partnerProfileId: partner.id,
        referralCode: partner.referralCode,
      },
    });
    await db.sellerPayoutProfile.create({
      data: {
        companyId: company.id,
        country: "KR",
        bankName: "Test Bank",
        accountHolder: "Deleted Seller",
        accountBelongsToCompany: true,
        payoutCurrency: "krw",
      },
    });
    await db.stripeConnectedAccount.create({
      data: {
        companyId: company.id,
        stripeAccountId: `acct_deleted_${id}`,
      },
    });
    await db.savedItem.create({
      data: {
        userId: oldUser.id,
        productId: product.id,
        type: "product",
      },
    });

    await markAccountDeletionPending(oldUser.id);
    const cleanup = await cleanupTrade82AccountData({
      userProfileId: oldUser.id,
      clerkUserId: oldUser.clerkUserId,
    });
    assert.equal(cleanup.deletionStatus, "DELETED");

    const retryCleanup = await cleanupTrade82AccountData({
      userProfileId: oldUser.id,
      clerkUserId: oldUser.clerkUserId,
    });
    assert.equal(retryCleanup.deletionStatus, "DELETED");
    assert.equal(retryCleanup.companyCount, 0);
    assert.equal(retryCleanup.productCount, 0);

    const deletedState = await db.userProfile.findUnique({
      where: { id: oldUser.id },
      include: { companies: { include: { products: true, sellerPayoutProfile: true } }, partnerProfile: true },
    });
    assert.equal(deletedState?.deletionStatus, "DELETED");
    assert.ok(deletedState?.deletedAt);
    assert.equal(deletedState?.email, `deleted-${oldUser.id}@deleted.trade82.local`);
    assert.equal(deletedState?.companies[0]?.deletedAt !== null, true);
    assert.equal(deletedState?.companies[0]?.products[0]?.deletedAt !== null, true);
    assert.equal(deletedState?.companies[0]?.sellerPayoutProfile?.status, "DISABLED");
    assert.equal(deletedState?.partnerProfile?.deletedAt !== null, true);
    assert.equal(
      await db.savedItem.count({ where: { userId: oldUser.id } }),
      0,
    );

    const freshUser = await createFreshUserProfile(db, {
      clerkUserId: `fresh-user-${id}`,
      email,
      displayName: "Fresh seller",
      role: "user",
      preferredLanguage: "en",
      referralClaimToken: undefined,
    });
    assert.ok(freshUser);
    freshUserId = freshUser?.id;
    assert.notEqual(freshUser?.id, oldUser.id);
    assert.equal(freshUser?.email, email);
    assert.equal(freshUser?.role, "user");
    assert.equal(freshUser?.deletionStatus, "ACTIVE");
    assert.equal(freshUser?.deletedAt, null);

    const [state, activeCompanies, activePartners, activeProducts, payoutProfiles, connectedAccounts, attributions, savedItems] = await Promise.all([
      getOnboardingCompanyState(freshUser!.id),
      db.company.count({ where: { ownerUserId: freshUser!.id, deletedAt: null } }),
      db.partnerProfile.count({ where: { userId: freshUser!.id, deletedAt: null } }),
      db.product.count({ where: { sellerCompany: { ownerUserId: freshUser!.id, deletedAt: null }, deletedAt: null } }),
      db.sellerPayoutProfile.count({ where: { company: { ownerUserId: freshUser!.id, deletedAt: null } } }),
      db.stripeConnectedAccount.count({ where: { company: { ownerUserId: freshUser!.id, deletedAt: null } } }),
      db.referralAttribution.count({ where: { referredUserId: freshUser!.id } }),
      db.savedItem.count({ where: { userId: freshUser!.id } }),
    ]);
    assert.deepEqual(state, {
      hasBuyerCompany: false,
      hasSellerCompany: false,
      hasSellerPayoutProfile: false,
    });
    assert.equal(activeCompanies, 0);
    assert.equal(activePartners, 0);
    assert.equal(activeProducts, 0);
    assert.equal(payoutProfiles, 0);
    assert.equal(connectedAccounts, 0);
    assert.equal(attributions, 0);
    assert.equal(savedItems, 0);
  } finally {
    if (freshUserId) {
      await cleanupTrade82AccountData({ userProfileId: freshUserId });
    }
    if (oldUserId) {
      await db.referralAttribution.deleteMany({
        where: { referredUserId: oldUserId },
      });
      await db.partnerProfile.deleteMany({
        where: { userId: oldUserId },
      });
      if (companyId) {
        await db.stripeConnectedAccount.deleteMany({
          where: { companyId },
        });
        await db.sellerPayoutProfile.deleteMany({
          where: { companyId },
        });
        await db.product.deleteMany({
          where: { sellerCompanyId: companyId },
        });
        await db.company.deleteMany({
          where: { id: companyId },
        });
      }
      await db.userProfile.deleteMany({
        where: { id: oldUserId },
      });
    }
  }
});
