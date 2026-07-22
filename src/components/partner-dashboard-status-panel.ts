import { createElement, type ReactElement } from "react";

type PartnerDashboardStatus = "pendingReview" | "suspended" | "rejected";

type PayoutSummary = {
  title: string;
  bankNameLabel: string;
  bankName: string;
  accountNumberLabel: string;
  accountNumberMasked: string;
  statusLabel: string;
  status: string;
};

export function PartnerDashboardStatusPanel({
  status,
  statusTitle,
  statusDescription,
  payout,
}: {
  status: PartnerDashboardStatus;
  statusTitle: string;
  statusDescription: string;
  payout?: PayoutSummary;
}): ReactElement {
  const statusSection = createElement(
    "section",
    { className: "border-l-2 border-amber-500 pl-4", role: "status" },
    createElement("p", { className: "font-semibold theme-foreground" }, statusTitle),
    createElement(
      "p",
      { className: "mt-1 text-sm leading-6 theme-muted" },
      statusDescription,
    ),
  );

  const payoutSection = payout
    ? createElement(
        "section",
        {
          className: "border p-5 theme-border theme-surface-elevated",
          "aria-labelledby": "partner-payout-review",
        },
        createElement(
          "h2",
          {
            id: "partner-payout-review",
            className: "text-base font-semibold theme-foreground",
          },
          payout.title,
        ),
        createElement(
          "dl",
          { className: "mt-4 grid gap-2 text-sm" },
          createElement(
            "div",
            null,
            createElement("dt", { className: "text-xs theme-muted" }, payout.bankNameLabel),
            createElement("dd", { className: "mt-1 theme-foreground" }, payout.bankName),
          ),
          createElement(
            "div",
            null,
            createElement(
              "dt",
              { className: "text-xs theme-muted" },
              payout.accountNumberLabel,
            ),
            createElement(
              "dd",
              { className: "mt-1 font-mono theme-foreground" },
              payout.accountNumberMasked,
            ),
          ),
          createElement(
            "div",
            null,
            createElement("dt", { className: "text-xs theme-muted" }, payout.statusLabel),
            createElement("dd", { className: "mt-1 theme-foreground" }, payout.status),
          ),
        ),
      )
    : null;

  return createElement(
    "div",
    { "data-partner-dashboard-status": status },
    statusSection,
    payoutSection,
  );
}
