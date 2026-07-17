import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createReferralClaimForCode } from "@/lib/partner-referrals";
import { getDb } from "@/lib/db";
import { attemptAnonymousReferralClaim } from "@/lib/referral-claim-request";
import { applyReferralClaimCookie } from "@/lib/referral-claim-response";
import { getAppUrl } from "@/lib/stripe";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ referralCode: string }> },
) {
  const destination = safeReferralRedirect(request);
  const { userId } = await auth();
  if (userId) {
    // Existing accounts cannot receive a late first-attribution. Clear any
    // stale evidence while we have a response that can mutate cookies.
    const response = NextResponse.redirect(destination, 302);
    applyReferralClaimCookie({ response, rawToken: null });
    return response;
  }

  const { rawToken } = await attemptAnonymousReferralClaim({
    request,
    referralCode: (await params).referralCode,
    createClaim: (referralCode) =>
      createReferralClaimForCode(getDb(), referralCode),
  });
  // Invalid, suspended, disabled, and rate-limited referrals must not leave
  // an older referral cookie attached to a future new-user signup.
  const response = NextResponse.redirect(destination, 302);
  applyReferralClaimCookie({ response, rawToken });
  return response;
}
