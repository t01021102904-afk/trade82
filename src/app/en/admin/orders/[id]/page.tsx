import { AdminOrderDetailPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function EnglishAdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  return <AdminOrderDetailPageContent locale="en" id={(await params).id} />;
}
