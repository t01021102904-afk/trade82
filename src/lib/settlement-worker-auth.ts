import "server-only";

import { timingSafeEqual } from "node:crypto";

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hasSettlementWorkerAuthorization(request: Request) {
  const expected = process.env.SETTLEMENT_WORKER_SECRET;
  if (!expected) return false;
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  const received = authorization.slice("Bearer ".length).trim();
  return received.length > 0 && constantTimeEquals(received, expected);
}
