import { AdminPayoutManagement } from "@/components/admin-payout-management";
import { requireAdmin } from "@/lib/authz";

export default async function AdminPayoutDetailPage({ params }: { params: Promise<{ id: string }> }) { await requireAdmin(); return <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold theme-foreground">Payout review</h1><AdminPayoutManagement selectedId={(await params).id} /></main>; }
