import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PartnerPayoutProfileStatus,
  PartnerPayoutStatus,
  PartnerProfileStatus,
} from "../src/generated/prisma/client.ts";
import { partnerPayoutStatusForLeg } from "../src/lib/partner-payouts.ts";

const partnerPayoutSource = await readFile(new URL("../src/lib/partner-payouts.ts", import.meta.url), "utf8");
const adminPayoutRouteSource = await readFile(new URL("../src/app/api/admin/payouts/route.ts", import.meta.url), "utf8");
const adminPayoutActionRouteSource = await readFile(new URL("../src/app/api/admin/partner-payouts/[id]/route.ts", import.meta.url), "utf8");

const base = {
  now: new Date("2026-07-23T00:00:00.000Z"),
  leg: {
    holdUntil: new Date("2026-07-22T00:00:00.000Z"),
    status: "READY",
    manualReviewRequired: false,
  },
  settlement: {
    status: "READY",
    approvedAt: new Date("2026-07-21T00:00:00.000Z"),
    paymentRequest: {
      status: "PAID",
      requiresManualReconciliation: false,
      refundAmount: 0,
      disputes: [],
    },
  },
  payoutProfileStatus: PartnerPayoutProfileStatus.VERIFIED,
  partnerStatus: PartnerProfileStatus.ACTIVE,
  finalPayoutAmount: 1_000,
};

function status(overrides: Record<string, unknown> = {}) {
  return partnerPayoutStatusForLeg({
    ...base,
    ...overrides,
    leg: { ...base.leg, ...(overrides.leg as object | undefined) },
    settlement: { ...base.settlement, ...(overrides.settlement as object | undefined) },
  } as never);
}

test("verified active partner with an approved expired hold is ready", () => assert.equal(status(), PartnerPayoutStatus.READY));
test("zero final amount is cancelled", () => assert.equal(status({ finalPayoutAmount: 0 }), PartnerPayoutStatus.CANCELLED));
test("negative final amount is cancelled", () => assert.equal(status({ finalPayoutAmount: -1 }), PartnerPayoutStatus.CANCELLED));
test("cancelled settlement is cancelled", () => assert.equal(status({ settlement: { status: "CANCELLED" } }), PartnerPayoutStatus.CANCELLED));
test("cancelled leg is cancelled", () => assert.equal(status({ leg: { status: "CANCELLED" } }), PartnerPayoutStatus.CANCELLED));
test("inactive partner is not ready", () => assert.equal(status({ partnerStatus: PartnerProfileStatus.SUSPENDED }), PartnerPayoutStatus.NOT_READY));
test("rejected partner is not ready", () => assert.equal(status({ partnerStatus: PartnerProfileStatus.REJECTED }), PartnerPayoutStatus.NOT_READY));
test("pending partner review is not ready", () => assert.equal(status({ partnerStatus: PartnerProfileStatus.PENDING_REVIEW }), PartnerPayoutStatus.NOT_READY));
test("draft payout profile is not ready", () => assert.equal(status({ payoutProfileStatus: PartnerPayoutProfileStatus.DRAFT }), PartnerPayoutStatus.NOT_READY));
test("pending payout profile is not ready", () => assert.equal(status({ payoutProfileStatus: PartnerPayoutProfileStatus.PENDING_VERIFICATION }), PartnerPayoutStatus.NOT_READY));
test("rejected payout profile is not ready", () => assert.equal(status({ payoutProfileStatus: PartnerPayoutProfileStatus.REJECTED }), PartnerPayoutStatus.NOT_READY));
test("disabled payout profile is not ready", () => assert.equal(status({ payoutProfileStatus: PartnerPayoutProfileStatus.DISABLED }), PartnerPayoutStatus.NOT_READY));
test("unpaid payment is held", () => assert.equal(status({ settlement: { paymentRequest: { status: "PENDING" } } }), PartnerPayoutStatus.HOLD));
test("manual reconciliation is held", () => assert.equal(status({ settlement: { paymentRequest: { requiresManualReconciliation: true } } }), PartnerPayoutStatus.HOLD));
test("active dispute is held", () => assert.equal(status({ settlement: { paymentRequest: { disputes: [{ status: "needs_response" }] } } }), PartnerPayoutStatus.HOLD));
test("manual review is held", () => assert.equal(status({ leg: { manualReviewRequired: true } }), PartnerPayoutStatus.HOLD));
test("unapproved settlement is held", () => assert.equal(status({ settlement: { approvedAt: null } }), PartnerPayoutStatus.HOLD));
test("held settlement is held", () => assert.equal(status({ settlement: { status: "HOLD" } }), PartnerPayoutStatus.HOLD));
test("future hold is held", () => assert.equal(status({ leg: { holdUntil: new Date("2026-07-24T00:00:00.000Z") } }), PartnerPayoutStatus.HOLD));
test("held leg is held", () => assert.equal(status({ leg: { status: "HOLD" } }), PartnerPayoutStatus.HOLD));
test("fully eligible partner payout remains ready after reconciliation amount changes", () => assert.equal(status({ finalPayoutAmount: 1 }), PartnerPayoutStatus.READY));
test("admin listing has no partner payout preparation call", () => assert.doesNotMatch(adminPayoutRouteSource, /ensurePartnerPayoutsForAdminReview/));
test("admin listing is explicitly no-store", () => assert.match(adminPayoutRouteSource, /Cache-Control.*no-store/));
test("partner payout snapshots have a capture timestamp", () => assert.match(partnerPayoutSource, /snapshotCapturedAt/));
test("partner payout snapshots are captured only from verified profiles", () => assert.match(partnerPayoutSource, /status === PartnerPayoutProfileStatus\.VERIFIED/));
test("partner payout sent records preserve their existing status", () => assert.match(partnerPayoutSource, /PartnerPayoutStatus\.SENT/));
test("partner payout events support idempotency keys", () => assert.match(partnerPayoutSource, /idempotencyKey/));
test("direct charge partner legs are rejected", () => assert.match(partnerPayoutSource, /DIRECT_CHARGE/));
test("reconciliation locks settlement rows", () => assert.match(partnerPayoutSource, /FROM \"Settlement\"[\s\S]*FOR UPDATE/));
test("reconciliation locks settlement legs", () => assert.match(partnerPayoutSource, /FROM \"SettlementLeg\"[\s\S]*FOR UPDATE/));
test("reconciliation locks partner profiles", () => assert.match(partnerPayoutSource, /FROM \"PartnerProfile\"[\s\S]*FOR UPDATE/));
test("reconciliation accounts for settlement reversals", () => assert.match(partnerPayoutSource, /reversalAdjustmentAmount/));
test("reconciliation flags active disputes", () => assert.match(partnerPayoutSource, /ACTIVE_DISPUTE_STATUSES/));
test("processing validates payout eligibility", () => assert.match(partnerPayoutSource, /assertPartnerPayoutEligibleForProcessing/));
test("sent timestamps are server generated", () => assert.match(partnerPayoutSource, /const sentAt = new Date\(\)/));
test("partner admin action rejects arbitrary fields", () => assert.match(adminPayoutActionRouteSource, /rejectUnexpectedFields/));
test("partner admin action does not accept client sentAt", () => assert.doesNotMatch(adminPayoutActionRouteSource, /sentAt.*body|body.*sentAt/));
test("partner admin action requires same origin", () => assert.match(adminPayoutActionRouteSource, /assertSameOrigin/));
test("partner admin action requires rate limiting", () => assert.match(adminPayoutActionRouteSource, /rateLimitOrResponse/));
test("partner admin action requires administrator authorization", () => assert.match(adminPayoutActionRouteSource, /requireAdmin/));
