"use client";

import { Badge } from "@/components/badge";
import { useI18n } from "@/components/i18n-provider";
import type { AccountRole } from "@/lib/types";

export function RoleBadge({ role }: { role: AccountRole }) {
  const { t } = useI18n();
  const labels: Record<AccountRole, string> = {
    user: t("roles.generalUser"),
    seller: t("roles.koreanSeller"),
    buyer: t("roles.globalBuyer"),
    both: t("roles.both"),
    admin: t("roles.admin"),
  };

  return (
    <Badge tone={role === "admin" ? "red" : role === "user" ? "gray" : "blue"}>
      {labels[role]}
    </Badge>
  );
}
