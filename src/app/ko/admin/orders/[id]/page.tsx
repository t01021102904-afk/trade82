import { AdminOrderDetailPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function KoreanAdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  return <AdminOrderDetailPageContent locale="ko" id={(await params).id} />;
}
