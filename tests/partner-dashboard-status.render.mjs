import reactDomServer from "react-dom/server";
import { createElement } from "react";

import { PartnerDashboardStatusPanel } from "../src/components/partner-dashboard-status-panel.ts";

const { renderToStaticMarkup } = reactDomServer;
const pending = renderToStaticMarkup(
  createElement(PartnerDashboardStatusPanel, {
    status: "pendingReview",
    statusTitle: "Application under review",
    statusDescription: "We are reviewing your application.",
    payout: {
      title: "Payout information",
      bankNameLabel: "Bank name",
      bankName: "Test Bank",
      accountNumberLabel: "Account number",
      accountNumberMasked: "•••• 7890",
      statusLabel: "Status",
      status: "Pending verification",
    },
  }),
);
const rejected = renderToStaticMarkup(
  createElement(PartnerDashboardStatusPanel, {
    status: "rejected",
    statusTitle: "Application not approved",
    statusDescription: "Contact support to learn more.",
  }),
);

process.stdout.write(JSON.stringify({ pending, rejected }));
