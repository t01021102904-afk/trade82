import { AdminOrderManagement } from "@/components/admin-order-management";
import { requireAdmin } from "@/lib/authz";

export default async function AdminOrdersPage() { await requireAdmin(); return <main className="mx-auto grid max-w-[1600px] gap-5 px-4 py-8 sm:px-6"><header><p className="text-xs font-semibold uppercase tracking-[.18em] theme-success-text">Admin</p><h1 className="mt-2 text-2xl font-semibold theme-foreground">Orders</h1><p className="mt-2 text-sm theme-muted">Payment, shipping, and manual payout review. Account numbers remain masked in this table.</p></header><AdminOrderManagement /></main>; }
