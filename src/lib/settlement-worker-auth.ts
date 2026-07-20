import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

function constantTimeEquals(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function hasSettlementWorkerAuthorization(request: Request) {
  const expected = process.env.SETTLEMENT_WORKER_SECRET;
  if (!expected) return false;
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  const received = authorization.slice("Bearer ".length).trim();
  return received.length > 0 && constantTimeEquals(received, expected);
}
