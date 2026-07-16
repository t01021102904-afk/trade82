import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  createReferralClaimForCode,
  REFERRAL_CLAIM_COOKIE,
  REFERRAL_CLAIM_MAX_AGE_SECONDS,
} from "@/lib/partner-referrals";
import { getDb } from "@/lib/db";
import { getAppUrl } from "@/lib/stripe";

function safeReferralRedirect(request: Request) {
  // The destination is deliberately fixed. It never accepts a caller-provided
  // URL, so referral links cannot become an open redirect vector.
  const origin = new URL(getAppUrl()).origin;
  const destination = new URL("/signup", origin);
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.startsWith("/ko/")) destination.pathname = "/ko/signup";
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
    response.cookies.set({ name: REFERRAL_CLAIM_COOKIE, value: "", path: "/", maxAge: 0 });
    return response;
  }

  const rawToken = await createReferralClaimForCode(getDb(), (await params).referralCode);
  const response = NextResponse.redirect(destination, 302);
  if (rawToken) {
    response.cookies.set({
      name: REFERRAL_CLAIM_COOKIE,
      value: rawToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: REFERRAL_CLAIM_MAX_AGE_SECONDS,
    });
  }
  return response;
}
