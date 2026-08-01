import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n";

export function SupplierApplicationsUnavailable({ locale }: { locale: Locale }) {
  const korean = locale === "ko";
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {korean ? "공급사 신청 준비 중" : "Supplier applications are coming soon"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {korean
              ? "안전한 검증과 단계적 출시를 완료한 뒤 신청을 열 예정입니다. 기존 검증 셀러의 대시보드와 운영 권한은 그대로 유지됩니다."
              : "Applications will open after staged verification is complete. Existing verified sellers keep their current dashboard and operating access."}
          </p>
          <Button
            variant="outline"
            render={<Link href={korean ? "/ko" : "/"} />}
          >
            {korean ? "홈으로 돌아가기" : "Return home"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
