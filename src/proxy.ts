import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getUnprefixedEnglishPath } from "@/lib/english-canonical-path";
import { safeInternalPath } from "@/lib/url-security";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/messages(.*)",
  "/onboarding(.*)",
  "/en/dashboard(.*)",
  "/en/messages(.*)",
  "/en/onboarding(.*)",
  "/ko/dashboard(.*)",
  "/ko/messages(.*)",
  "/ko/onboarding(.*)",
  "/seller(.*)",
  "/en/seller(.*)",
  "/ko/seller(.*)",
  "/admin(.*)",
  "/en/admin(.*)",
  "/ko/admin(.*)",
  "/deals(.*)",
  "/reviews(.*)",
  "/settings(.*)",
  "/en/settings(.*)",
  "/ko/settings(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const unprefixedEnglishPath = getUnprefixedEnglishPath(request.nextUrl.pathname);
  if (unprefixedEnglishPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = unprefixedEnglishPath;
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (isProtectedRoute(request)) {
    const pathname = request.nextUrl.pathname;
    const loginPath = pathname.startsWith("/ko")
      ? "/ko/login"
      : pathname.startsWith("/en")
        ? "/en/login"
        : "/login";
    const loginUrl = new URL(loginPath, request.url);

    loginUrl.searchParams.set(
      "redirect_url",
      safeInternalPath(`${pathname}${request.nextUrl.search}`, "/dashboard"),
    );

    await auth.protect({ unauthenticatedUrl: loginUrl.toString() });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-trade82-locale",
    request.nextUrl.pathname === "/ko" || request.nextUrl.pathname.startsWith("/ko/")
      ? "ko"
      : "en",
  );

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
