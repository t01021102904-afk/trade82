import "server-only";

import {
  REFERRAL_CLAIM_COOKIE,
  REFERRAL_CLAIM_MAX_AGE_SECONDS,
} from "@/lib/partner-referrals";

type ClaimCookieResponse = {
  cookies: {
    set: (cookie: {
      name: string;
      value: string;
      httpOnly: boolean;
      sameSite: "lax";
      secure: boolean;
      path: string;
      maxAge: number;
    }) => void;
  };
};

export function getReferralClaimCookieOptions(
  nodeEnv = process.env.NODE_ENV,
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
  };
}

export function clearReferralClaimCookie(response: ClaimCookieResponse) {
  response.cookies.set({
    name: REFERRAL_CLAIM_COOKIE,
    value: "",
    ...getReferralClaimCookieOptions(),
    maxAge: 0,
  });
}

export function applyReferralClaimCookie({
  response,
  rawToken,
}: {
  response: ClaimCookieResponse;
  rawToken: string | null;
}) {
  if (rawToken) {
    response.cookies.set({
      name: REFERRAL_CLAIM_COOKIE,
      value: rawToken,
      ...getReferralClaimCookieOptions(),
      maxAge: REFERRAL_CLAIM_MAX_AGE_SECONDS,
    });
  } else {
    clearReferralClaimCookie(response);
  }
}
