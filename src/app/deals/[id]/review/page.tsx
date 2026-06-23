import { DealReviewForm } from "@/components/deal-review-form";
import { requireAuth } from "@/lib/require-auth";

export default async function DealReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAuth(`/deals/${id}/review`);

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <DealReviewForm dealId={id} />
      </div>
    </div>
  );
}
