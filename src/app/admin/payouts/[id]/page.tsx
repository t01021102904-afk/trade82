import { AdminPayoutDetailPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function AdminPayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  return <AdminPayoutDetailPageContent locale="en" id={(await params).id} />;
}
