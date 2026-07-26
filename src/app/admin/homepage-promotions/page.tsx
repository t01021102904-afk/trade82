import { AdminHomepagePromotions } from "@/components/admin-homepage-promotions";
import { requireAdmin } from "@/lib/require-auth";

export default async function AdminHomepagePromotionsPage() {
  await requireAdmin("/admin/homepage-promotions");
  return <AdminHomepagePromotions locale="en" />;
}
