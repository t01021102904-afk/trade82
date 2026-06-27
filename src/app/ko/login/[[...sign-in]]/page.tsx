import { AuthShell } from "@/components/auth-shell";

export default async function KoLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirectUrl = Array.isArray(params.redirect_url)
    ? params.redirect_url[0]
    : params.redirect_url;

  return (
    <AuthShell
      locale="ko"
      mode="login"
      basePath="/ko"
      redirectUrl={redirectUrl}
    />
  );
}
