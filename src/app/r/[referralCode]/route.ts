import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createReferralClaimForCode } from "@/lib/partner-referrals";
import { getDb } from "@/lib/db";
import {
  applyReferralVisitorCookie,
  isReferralPrefetchRequest,
  recordReferralClick,
} from "@/lib/partner-referral-analytics";
import type { PartnerAnalyticsDatabase } from "@/lib/partner-referral-analytics";
import { attemptAnonymousReferralClaim } from "@/lib/referral-claim-request";
import { applyReferralClaimCookie } from "@/lib/referral-claim-response";
import { getAppUrl } from "@/lib/stripe";

type ReferralRouteDependencies = {
  authenticate: () => Promise<{ userId: string | null }>;
  getDatabase: typeof getDb;
  attemptAnonymousClaim: typeof attemptAnonymousReferralClaim;
};

function safeReferralRedirect(request: Request) {
  // The destination is deliberately fixed. It never accepts a caller-provided
  // URL, so referral links cannot become an open redirect vector.
  const origin = new URL(getAppUrl()).origin;
  const destination = new URL("/signup", origin);
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.startsWith("/ko/"))
    destination.pathname = "/ko/signup";
  return destination;
}

export function createReferralRouteHandler(
  overrides: Partial<ReferralRouteDependencies> = {},
) {
  const authenticate = overrides.authenticate ?? (auth as ReferralRouteDependencies["authenticate"]);
  const getDatabase = overrides.getDatabase ?? getDb;
  const attemptAnonymousClaim =
    overrides.attemptAnonymousClaim ?? attemptAnonymousReferralClaim;

  return async function referralRouteGET(
    request: Request,
    { params }: { params: Promise<{ referralCode: string }> },
  ) {
    const destination = safeReferralRedirect(request);
    const { userId } = await authenticate();
    const db = getDatabase();
    const referralCode = (await params).referralCode;
    const prefetch = isReferralPrefetchRequest(request);
    const anonymousClaim =
      !userId && !prefetch
        ? await attemptAnonymousClaim({
            request,
            referralCode,
            createClaim: (referralCode) =>
              createReferralClaimForCode(db, referralCode),
          })
        : { rawToken: null, rateLimited: false };
    let visitorCookie: { value: string } | null = null;
    if (!anonymousClaim.rateLimited) {
      try {
        const profile = userId
          ? await db.userProfile.findUnique({
              where: { clerkUserId: userId },
              select: { id: true },
            })
          : null;
        visitorCookie = await recordReferralClick({
          db: db as unknown as PartnerAnalyticsDatabase,
          request,
          referralCode,
          authenticatedUserProfileId: profile?.id,
        });
      } catch {
        console.error("partner_referral_analytics_failed", {
          code: "click_capture_failed",
        });
      }
    }
    if (userId) {
      // Existing accounts cannot receive a late first-attribution. Clear any
      // stale evidence while we have a response that can mutate cookies.
      const response = NextResponse.redirect(destination, 302);
      applyReferralClaimCookie({ response, rawToken: null });
      applyReferralVisitorCookie(response, visitorCookie?.value ?? null);
      return response;
    }

    const { rawToken } = anonymousClaim;
    // Invalid, suspended, disabled, and rate-limited referrals must not leave
    // an older referral cookie attached to a future new-user signup.
    const response = NextResponse.redirect(destination, 302);
    applyReferralClaimCookie({ response, rawToken });
    applyReferralVisitorCookie(response, visitorCookie?.value ?? null);
    return response;
  };
}

export const GET = createReferralRouteHandler();

export async function HEAD(request: Request) {
  return NextResponse.redirect(safeReferralRedirect(request), 302);
}
