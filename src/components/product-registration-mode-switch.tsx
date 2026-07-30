"use client";

import { FileSpreadsheet, PackagePlus } from "lucide-react";
import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { withLocale } from "@/lib/i18n";

export function ProductRegistrationModeSwitch() {
  const { locale, t } = useI18n();

  return (
    <Card className="mx-auto w-full max-w-[1500px]">
      <CardContent className="grid gap-3 p-3 sm:grid-cols-2">
        <Button
          size="lg"
          className="h-auto justify-start gap-3 px-4 py-3 text-left"
          render={<Link href={withLocale("/sell", locale)} />}
          aria-current="page"
        >
          <PackagePlus className="size-5" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {t("bulkProducts.singleProduct")}
            </span>
            <span className="mt-0.5 block whitespace-normal text-xs font-normal opacity-80">
              {t("bulkProducts.singleDescription")}
            </span>
          </span>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-auto justify-start gap-3 px-4 py-3 text-left"
          render={
            <Link
              href={withLocale("/dashboard/seller/products/bulk", locale)}
            />
          }
        >
          <FileSpreadsheet className="size-5" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {t("bulkProducts.bulkRegistration")}
            </span>
            <span className="mt-0.5 block whitespace-normal text-xs font-normal text-muted-foreground">
              {t("bulkProducts.bulkDescription")}
            </span>
          </span>
        </Button>
      </CardContent>
    </Card>
  );
}
