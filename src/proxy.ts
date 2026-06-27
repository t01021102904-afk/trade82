import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
  "/admin(.*)",
  "/en/admin(.*)",
  "/ko/admin(.*)",
  "/deals(.*)",
  "/reviews(.*)",
  "/settings(.*)",
  "/en/settings(.*)",
  "/ko/settings(.*)",
  "/sell",
  "/sell/(.*)",
  "/en/sell",
  "/en/sell/(.*)",
  "/ko/sell",
  "/ko/sell/(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
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
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
