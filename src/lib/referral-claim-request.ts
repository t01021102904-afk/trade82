import "server-only";

import { clientIp } from "@/lib/api-security";
import { checkRateLimit } from "@/lib/rate-limit";

export const PARTNER_REFERRAL_CLAIM_RATE_LIMIT = {
  limit: 20,
  windowMs: 60 * 60_000,
} as const;

type CreateClaim = (referralCode: string) => Promise<string | null>;
type RateLimitCheck = (
  key: string,
  limit: number,
  windowMs: number,
) => {
  allowed: boolean;
};

export async function attemptAnonymousReferralClaim({
  request,
  referralCode,
  createClaim,
  rateLimitCheck = checkRateLimit,
}: {
  request: Request;
  referralCode: string;
  createClaim: CreateClaim;
  rateLimitCheck?: RateLimitCheck;
}) {
  // The in-memory limiter receives only an ephemeral request key. Referral
  // codes, claim tokens, and hashes never become part of the key or a log.
  const rateLimit = rateLimitCheck(
    `partner-referral-claim:${clientIp(request)}`,
    PARTNER_REFERRAL_CLAIM_RATE_LIMIT.limit,
    PARTNER_REFERRAL_CLAIM_RATE_LIMIT.windowMs,
  );
  if (!rateLimit.allowed) return { rawToken: null, rateLimited: true } as const;

  return {
    rawToken: await createClaim(referralCode),
    rateLimited: false,
  } as const;
}
