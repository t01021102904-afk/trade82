import "server-only";

import { timingSafeEqual } from "node:crypto";

function matchesCronSecret(value: string | null, expected: string | undefined) {
  if (!expected || !value) return false;

  const provided = Buffer.from(value);
  const configured = Buffer.from(`Bearer ${expected}`);
  return provided.length === configured.length && timingSafeEqual(provided, configured);
}

export function isAuthorizedSettlementReleaseCronRequest(request: Request) {
  return matchesCronSecret(request.headers.get("authorization"), process.env.CRON_SECRET);
}
