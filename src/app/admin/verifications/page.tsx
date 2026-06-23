import { AdminVerifications } from "@/components/admin-verifications";
import { SectionHeader } from "@/components/section-header";
import { requireAdmin } from "@/lib/require-auth";

export default async function AdminVerificationsPage() {
  await requireAdmin("/admin/verifications");

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <SectionHeader
          label="Admin"
          title="Company verification review"
          description="Review pending Korean seller and American buyer company submissions. Private documents are used only for manual review."
        />
        <AdminVerifications />
      </div>
    </div>
  );
}
