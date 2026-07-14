import { AdminPayoutDetailPageContent } from "@/components/admin-trade-operations-pages";
import { requireAdmin } from "@/lib/authz";

export default async function KoreanAdminPayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  return <AdminPayoutDetailPageContent locale="ko" id={(await params).id} />;
}
