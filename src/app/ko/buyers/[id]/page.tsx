import {
  BuyerDetailPageContent,
} from "@/components/buyer-detail-page";

export const dynamic = "force-dynamic";

export default async function KoBuyerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BuyerDetailPageContent id={id} locale="ko" />;
}
