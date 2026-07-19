import { redirect } from "next/navigation";

import { SellerStripeMerchantAccountPanel } from "@/components/seller-stripe-merchant-account-panel";
import { requireAppProfile } from "@/lib/require-auth";

export default async function KoSellerStripeMerchantSettingsPage() {
  const { role } = await requireAppProfile("/ko/settings/stripe-merchant");
  if (role !== "seller" && role !== "both") redirect("/ko/dashboard");
  return <SellerStripeMerchantAccountPanel />;
}
