import type { Metadata } from "next";

import { DocumentRoutePage, documentRouteMetadata } from "@/components/document-route-page";

export const metadata: Metadata = documentRouteMetadata("ko", "payment-refund-policy");

export default function KoPaymentRefundPolicyPage() {
  return <DocumentRoutePage locale="ko" documentSlug="payment-refund-policy" />;
}
