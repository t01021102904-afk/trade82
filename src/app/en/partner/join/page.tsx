import { PartnerJoinPage } from "@/components/partner-join-page";

export const dynamic = "force-dynamic";

export default async function EnPartnerJoinRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <PartnerJoinPage locale="en" edit={params.edit === "1"} />;
}
