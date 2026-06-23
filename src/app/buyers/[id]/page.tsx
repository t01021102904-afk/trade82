import {
  BuyerDetailPageContent,
} from "@/components/buyer-detail-page";

export const dynamic = "force-dynamic";

export default async function BuyerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BuyerDetailPageContent id={id} locale="en" />;
}
