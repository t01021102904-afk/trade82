"use client";

import { useI18n } from "@/components/i18n-provider";
import { OrdersClient } from "@/components/orders-client";

export function SellerOrdersSection() {
  const { locale } = useI18n();

  return (
    <div className="[&>main]:mx-0 [&>main]:max-w-none [&>main]:px-0 [&>main]:py-0">
      <OrdersClient locale={locale} />
    </div>
  );
}
