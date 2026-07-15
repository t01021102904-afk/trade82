import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getMessageTradeDealState,
  shouldShowMessageTradeActionBar,
} from "../src/lib/message-trade-ui.ts";

const buyer = {
  viewerCompanyId: "buyer-company",
  buyerCompanyId: "buyer-company",
  sellerCompanyId: "seller-company",
};

const seller = {
  viewerCompanyId: "seller-company",
  buyerCompanyId: "buyer-company",
  sellerCompanyId: "seller-company",
};

const messagesClientSource = readFileSync(
  new URL("../src/components/messages-client.tsx", import.meta.url),
  "utf8",
);

function getComponentSource(name: string, nextComponentName: string) {
  const start = messagesClientSource.indexOf(`function ${name}(`);
  const end = messagesClientSource.indexOf(`function ${nextComponentName}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  assert.notEqual(end, -1, `${nextComponentName} should exist`);
  return messagesClientSource.slice(start, end);
}

test("shows the completion action only to the counterparty who has not confirmed", () => {
  const sellerRequested = {
    dealStatus: "completion_requested" as const,
    confirmedByBuyer: false,
    confirmedBySeller: true,
  };

  assert.equal(getMessageTradeDealState(sellerRequested, buyer), "review_completion");
  assert.equal(shouldShowMessageTradeActionBar(sellerRequested, buyer), true);
  assert.equal(getMessageTradeDealState(sellerRequested, seller), "waiting_for_counterparty");
  assert.equal(shouldShowMessageTradeActionBar(sellerRequested, seller), false);
});

test("removes the action after a successful confirmation and retains it after a failed confirmation", () => {
  const common = { confirmedByBuyer: false, confirmedBySeller: false };
  const sellerRequested = {
    dealStatus: "completion_requested" as const,
    confirmedByBuyer: false,
    confirmedBySeller: true,
  };

  assert.equal(getMessageTradeDealState(null, buyer), "none");
  assert.equal(getMessageTradeDealState({ ...common, dealStatus: "in_progress" }, buyer), "none");
  assert.equal(getMessageTradeDealState({ ...common, dealStatus: "cancelled" }, buyer), "none");
  assert.equal(getMessageTradeDealState({ ...common, dealStatus: "disputed" }, buyer), "none");
  // A failed confirmation does not change the server-provided deal state.
  assert.equal(shouldShowMessageTradeActionBar(sellerRequested, buyer), true);
  const completedAfterSuccessfulConfirmation = { ...sellerRequested, dealStatus: "completed" as const };
  assert.equal(getMessageTradeDealState(completedAfterSuccessfulConfirmation, buyer), "completed");
  assert.equal(shouldShowMessageTradeActionBar(completedAfterSuccessfulConfirmation, buyer), false);
});

test("uses one completion-request CTA without inquiry or status badge copy", () => {
  const actionBar = getComponentSource("MessageTradeActionBar", "TradeDetailsPanel");

  assert.match(actionBar, /if \(state !== "review_completion"\) return null;/);
  assert.match(actionBar, /min-h-8/);
  assert.match(actionBar, /t\("deals\.otherRequestedCompletion"\)/);
  assert.match(actionBar, /t\("deals\.reviewCompletion"\)/);
  assert.doesNotMatch(actionBar, /messages\.productInquiry|deals\.completionRequested|compactCompletedDeal/);
  assert.doesNotMatch(actionBar, /min-w-\[/);
  assert.doesNotMatch(actionBar, /role="alert"/);
});

test("keeps a failed confirmation dialog open with its error state", () => {
  const dialog = getComponentSource("CompletionConfirmationDialog", "DialogMetric");

  assert.match(dialog, /const succeeded = await onConfirm\(\);/);
  assert.match(dialog, /if \(succeeded\) onClose\(\);/);
  assert.match(dialog, /error \? <p role="alert"/);
});

test("keeps payment events in the timeline without synthesizing deal events from thread updates", () => {
  const timeline = getComponentSource("MessageTimeline", "PaymentRequestTimelineEvent");

  assert.match(timeline, /paymentRequest\.events\.map/);
  assert.doesNotMatch(timeline, /dealTimelineEvent|DealTimelineEvent|deal-event|thread\.updatedAt/);
});
