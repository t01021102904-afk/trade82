import { AdminHomepagePromotions } from "@/components/admin-homepage-promotions";
import { requireAdmin } from "@/lib/require-auth";

export default async function KoreanAdminHomepagePromotionsPage() {
  await requireAdmin("/ko/admin/homepage-promotions");
  return <AdminHomepagePromotions locale="ko" />;
}
