import { AdminPayoutProfileManagement } from "@/components/admin-payout-profile-management";
import { requireAdmin } from "@/lib/authz";

export default async function AdminPayoutProfilesPage() { await requireAdmin(); return <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6"><header><h1 className="text-2xl font-semibold theme-foreground">Seller payout profiles</h1><p className="mt-2 text-sm theme-muted">Review the masked instructions before enabling payout preparation.</p></header><AdminPayoutProfileManagement /></main>; }
