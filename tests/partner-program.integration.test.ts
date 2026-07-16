import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";

import { PrismaClient } from "../src/generated/prisma/client.ts";

function assertDisposableDatabase() {
  const value = process.env.DATABASE_URL;
  assert.ok(value, "DATABASE_URL is required for the disposable integration suite.");
  const url = new URL(value);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "The integration database must be localhost only.");
  assert.match(url.pathname.slice(1), /^trade82_order_payout_test_/, "The integration database name is not disposable.");
}

assertDisposableDatabase();
process.env.DATABASE_POOL_MAX = "4";
process.env.PARTNER_PROGRAM_MODE = "on";

const { getDb } = await import(new URL("../src/lib/db.ts", import.meta.url).href);
const referrals = await import(new URL("../src/lib/partner-referrals.ts", import.meta.url).href);
const db = getDb() as PrismaClient;

after(async () => { await db.$disconnect(); });

function suffix() { return randomBytes(8).toString("hex"); }

test("disposable PostgreSQL keeps raw referral secrets out of the database and enforces first attribution", async () => {
  const id = suffix();
  const partnerUser = await db.userProfile.create({ data: { clerkUserId: `partner-${id}`, email: `partner-${id}@example.test`, displayName: "Partner", role: "user" } });
  const referred = await db.userProfile.create({ data: { clerkUserId: `referred-${id}`, email: `referred-${id}@example.test`, displayName: "Referred", role: "buyer" } });
  const partner = await db.partnerProfile.create({ data: { userId: partnerUser.id, referralCode: `T82-${id.toUpperCase()}`, status: "ACTIVE" } });
  const rawToken = referrals.createReferralClaimSecret();
  const claim = await db.referralClaimToken.create({ data: { tokenHash: referrals.hashReferralClaimToken(rawToken), partnerProfileId: partner.id, expiresAt: new Date(Date.now() + 60_000) } });
  assert.notEqual(claim.tokenHash, rawToken);

  const result = (await db.$transaction((tx) => referrals.consumeReferralClaimForNewUser(tx, { rawToken, referredUserId: referred.id }))) as { consumed: boolean };
  assert.equal(result.consumed, true);
  const [storedClaim, attribution] = await Promise.all([
    db.referralClaimToken.findUniqueOrThrow({ where: { id: claim.id } }),
    db.referralAttribution.findUniqueOrThrow({ where: { referredUserId: referred.id } }),
  ]);
  assert.ok(storedClaim.consumedAt);
  assert.equal(storedClaim.consumedByUserId, referred.id);
  assert.equal(attribution.partnerProfileId, partner.id);
  await assert.rejects(() => db.referralAttribution.create({ data: { referredUserId: referred.id, partnerProfileId: partner.id, referralCode: partner.referralCode, status: "LOCKED", lockedAt: new Date() } }));
});

test("disposable PostgreSQL blocks claim references after partner deletion and keeps claim indexes available", async () => {
  const id = suffix();
  const user = await db.userProfile.create({ data: { clerkUserId: `partner-reference-${id}`, email: `partner-reference-${id}@example.test`, displayName: "Partner", role: "user" } });
  const partner = await db.partnerProfile.create({ data: { userId: user.id, referralCode: `T82-${id.toUpperCase()}`, status: "ACTIVE" } });
  await db.referralClaimToken.create({ data: { tokenHash: referrals.hashReferralClaimToken(referrals.createReferralClaimSecret()), partnerProfileId: partner.id, expiresAt: new Date(Date.now() + 60_000) } });
  await assert.rejects(() => db.partnerProfile.delete({ where: { id: partner.id } }));
  const indexes = await db.$queryRaw<Array<{ indexname: string }>>`SELECT indexname FROM pg_indexes WHERE tablename = 'ReferralClaimToken'`;
  assert.ok(indexes.some((entry) => entry.indexname.includes("partnerProfileId_expiresAt")));
});
