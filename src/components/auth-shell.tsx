import { SignIn, SignUp } from "@clerk/nextjs";

import { getDictionary, type Locale } from "@/lib/i18n";
import { redirectSignedInUserFromSignup } from "@/lib/require-auth";
import { safeInternalPath } from "@/lib/url-security";

export async function AuthShell({
  locale,
  mode,
  basePath,
  redirectUrl,
}: {
  locale: Locale;
  mode: "login" | "signup";
  basePath: "" | "/en" | "/ko";
  redirectUrl?: string;
}) {
  const messages = getDictionary(locale);
  const isLogin = mode === "login";
  const rolePath = `${basePath}/onboarding/role`;
  const dashboardPath = `${basePath}/dashboard`;
  const loginRedirectPath = safeInternalPath(redirectUrl, dashboardPath);
  const signupRedirectPath = safeInternalPath(redirectUrl, rolePath);

  if (!isLogin) {
    await redirectSignedInUserFromSignup(basePath, signupRedirectPath);
  }

  return (
    <div className="bg-zinc-50">
      <div className="mx-auto grid min-h-[720px] max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <section>
          <p className="text-sm font-medium text-blue-700">
            {isLogin ? messages.auth.login : messages.auth.signup}
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-zinc-950">
            {isLogin ? messages.auth.loginTitle : messages.auth.signupTitle}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">
            {isLogin ? messages.auth.loginText : messages.auth.signupText}
          </p>
        </section>
        <section className="flex justify-center">
          {isLogin ? (
            <SignIn
              routing="path"
              path={`${basePath}/login`}
              signUpUrl={`${basePath}/signup`}
              forceRedirectUrl={loginRedirectPath}
              fallbackRedirectUrl={dashboardPath}
              signUpForceRedirectUrl={rolePath}
              signUpFallbackRedirectUrl={rolePath}
            />
          ) : (
            <SignUp
              routing="path"
              path={`${basePath}/signup`}
              signInUrl={`${basePath}/login`}
              forceRedirectUrl={signupRedirectPath}
              fallbackRedirectUrl={rolePath}
            />
          )}
        </section>
      </div>
    </div>
  );
}
