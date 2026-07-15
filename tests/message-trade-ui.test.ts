import assert from "node:assert/strict";
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

test("does not show the action for normal, cancelled, disputed, or completed deals", () => {
  const common = { confirmedByBuyer: false, confirmedBySeller: false };

  assert.equal(getMessageTradeDealState(null, buyer), "none");
  assert.equal(getMessageTradeDealState({ ...common, dealStatus: "in_progress" }, buyer), "none");
  assert.equal(getMessageTradeDealState({ ...common, dealStatus: "cancelled" }, buyer), "none");
  assert.equal(getMessageTradeDealState({ ...common, dealStatus: "disputed" }, buyer), "none");
  assert.equal(getMessageTradeDealState({ ...common, dealStatus: "completed" }, buyer), "completed");
  assert.equal(shouldShowMessageTradeActionBar({ ...common, dealStatus: "completed" }, buyer), false);
});
