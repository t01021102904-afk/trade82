import { redirect } from "next/navigation";

import { SellerStripeMerchantAccountPanel } from "@/components/seller-stripe-merchant-account-panel";
import { requireAppProfile } from "@/lib/require-auth";

export default async function SellerStripeMerchantSettingsPage() {
  const { role } = await requireAppProfile("/settings/stripe-merchant");
  if (role !== "seller" && role !== "both") redirect("/dashboard");
  return <SellerStripeMerchantAccountPanel />;
}
