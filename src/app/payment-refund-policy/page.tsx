import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("en", "payment-refund-policy");

export default function PaymentRefundPolicyPage() {
  return <DocumentRoutePage locale="en" documentSlug="payment-refund-policy" />;
}
