import { AdminPayoutManagement } from "@/components/admin-payout-management";
import { requireAdmin } from "@/lib/authz";

export default async function AdminPayoutsPage() { await requireAdmin(); return <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6"><header><p className="text-xs font-semibold uppercase tracking-[.18em] theme-success-text">Admin</p><h1 className="mt-2 text-2xl font-semibold theme-foreground">Manual payouts</h1><p className="mt-2 text-sm theme-muted">Prepare instructions, make the transfer outside Trade82, then record its reference.</p></header><AdminPayoutManagement /></main>; }
