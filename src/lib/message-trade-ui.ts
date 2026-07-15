export type MessageTradeDealState =
  | "none"
  | "review_completion"
  | "waiting_for_counterparty"
  | "completed";

type MessageTradeDealInput = {
  dealStatus: "proposed" | "in_progress" | "completion_requested" | "completed" | "cancelled" | "disputed";
  confirmedByBuyer: boolean;
  confirmedBySeller: boolean;
};

type MessageTradeViewerInput = {
  viewerCompanyId: string | null;
  buyerCompanyId: string;
  sellerCompanyId: string;
};

export function getMessageTradeDealState(
  deal: MessageTradeDealInput | null,
  viewer: MessageTradeViewerInput,
): MessageTradeDealState {
  if (!deal || deal.dealStatus === "cancelled" || deal.dealStatus === "disputed") {
    return "none";
  }

  if (deal.dealStatus === "completed") return "completed";
  if (deal.dealStatus !== "completion_requested") return "none";

  if (viewer.viewerCompanyId === viewer.buyerCompanyId) {
    if (deal.confirmedByBuyer) return "waiting_for_counterparty";
    return deal.confirmedBySeller ? "review_completion" : "none";
  }

  if (viewer.viewerCompanyId === viewer.sellerCompanyId) {
    if (deal.confirmedBySeller) return "waiting_for_counterparty";
    return deal.confirmedByBuyer ? "review_completion" : "none";
  }

  return "none";
}

export function shouldShowMessageTradeActionBar(
  deal: MessageTradeDealInput | null,
  viewer: MessageTradeViewerInput,
) {
  return getMessageTradeDealState(deal, viewer) === "review_completion";
}
