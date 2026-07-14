import { AdminBankDirectory } from "@/components/admin-bank-directory";
import { requireAdmin } from "@/lib/authz";

export default async function AdminBanksPage() { await requireAdmin(); return <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6"><header><h1 className="text-2xl font-semibold theme-foreground">Bank directory</h1><p className="mt-2 text-sm theme-muted">Only add SWIFT/BIC and bank instructions after verifying an official source.</p></header><AdminBankDirectory /></main>; }
