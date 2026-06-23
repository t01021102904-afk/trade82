"use client";

import { Badge } from "@/components/badge";
import { useI18n } from "@/components/i18n-provider";
import type { VerificationStatus } from "@/lib/types";

export function VerificationBadge({
  status,
  subject,
}: {
  status: VerificationStatus;
  subject: "seller" | "buyer";
}) {
  const { t } = useI18n();

  if (status === "verified") {
    return (
      <Badge tone="green">
        {subject === "seller"
          ? t("roles.verifiedSeller")
          : t("roles.verifiedBuyer")}
      </Badge>
    );
  }

  if (status === "pending_review") {
    return <Badge tone="amber">{t("roles.pendingReview")}</Badge>;
  }

  if (status === "needs_reverification") {
    return <Badge tone="amber">{t("roles.needsReverification")}</Badge>;
  }

  if (status === "rejected") {
    return <Badge tone="red">{t("roles.rejected")}</Badge>;
  }

  if (status === "email_verified") {
    return <Badge tone="blue">{t("roles.emailVerified")}</Badge>;
  }

  return (
    <Badge>
      {subject === "seller"
        ? t("roles.unverifiedSeller")
        : t("roles.unverifiedBuyer")}
    </Badge>
  );
}
