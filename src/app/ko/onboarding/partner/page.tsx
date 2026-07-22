import { PartnerJoinPage } from "@/components/partner-join-page";

export const dynamic = "force-dynamic";

export default async function KoPartnerOnboardingRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <PartnerJoinPage locale="ko" edit={params.edit === "1"} />;
}
