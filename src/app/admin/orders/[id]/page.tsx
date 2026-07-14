import { AdminOrderManagement } from "@/components/admin-order-management";
import { requireAdmin } from "@/lib/authz";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) { await requireAdmin(); return <main className="mx-auto grid max-w-[1600px] gap-5 px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold theme-foreground">Order review</h1><AdminOrderManagement selectedId={(await params).id} /></main>; }
