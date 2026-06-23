# BridgeMarket

BridgeMarket is a Next.js B2B marketplace MVP that connects Korean sellers with American buyers. It includes Clerk authentication, Google Sign-In support, English/Korean URL routing, local mock marketplace data, and localStorage-based prototype inquiries.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Clerk for authentication
- Custom dictionary-based i18n
- localStorage for prototype saved products, companies, messages, and onboarding forms

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Then add your Clerk keys:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding/buyer
```

Do not commit `.env.local`.

## Clerk Setup With Google Sign-In

1. Create a Clerk account at `https://clerk.com`.
2. Create a new Clerk application.
3. In Clerk Dashboard, open **Configure > SSO Connections** or **User & Authentication > Social Connections**.
4. Enable **Google**.
5. Use Clerk-managed Google OAuth for the fastest launch, or add your own Google OAuth credentials if you need a branded OAuth consent screen.
6. Copy the Clerk publishable key and secret key into `.env.local`.
7. Confirm these URLs are configured in Clerk and your app env:
   - Sign-in URL: `/login`
   - Sign-up URL: `/signup`
   - After sign-in URL: `/dashboard`
   - After sign-up URL: `/onboarding/buyer`
8. Run the app and test:
   - Sign in with Google
   - Log out from the user menu
   - Confirm protected routes redirect when signed out

## Local Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Public auth pages:

- `/login`
- `/signup`
- `/en/login`
- `/en/signup`
- `/ko/login`
- `/ko/signup`

Protected platform pages:

- `/`
- `/marketplace`
- `/products/[id]`
- `/sellers`
- `/companies/[id]`
- `/buyers`
- `/buyers/[id]`
- `/dashboard`
- `/messages`
- `/onboarding/buyer`
- `/onboarding/seller`
- The same pages under `/en` and `/ko`

## Internationalization

The app uses URL-based language routing:

- English: `/en`
- Korean: `/ko`
- Default English routes also work without a locale prefix.

Translation files live in:

- `messages/en.json`
- `messages/ko.json`

The language switcher in the navbar keeps the user on the equivalent route when possible.

## Production Build

Run:

```bash
npm run lint
npm run build
```

Both commands should pass before deployment.

## Deploy To Vercel

1. Push the project to GitHub.
2. Create a new Vercel project from the repository.
3. Add the Clerk environment variables in **Vercel Project Settings > Environment Variables**.
4. Add the same variables for Production, Preview, and Development as needed.
5. Deploy.
6. In Clerk Dashboard, add the Vercel production domain to allowed origins/redirects if Clerk asks for it.
7. Test Google login, logout, and protected route redirects on the deployed URL.

## Production-Ready In This MVP

- Real Clerk authentication integration
- Google Sign-In support through Clerk configuration
- Protected routes via Clerk middleware
- Public login/signup pages
- English and Korean URL routing
- Dictionary-based UI translations
- Responsive marketplace UI
- Static mock data pages that build cleanly on Vercel

## Prototype-Only

- Marketplace products, sellers, and buyers are mock data.
- Inquiries, replies, saved products, saved companies, and onboarding submissions are stored in localStorage.
- No real email sending yet.
- No real-time chat yet.
- No payments.
- No server database yet.
- Verification badges and trade documents are demo data, not verified business records.

## Recommended Next Steps

1. Add Supabase or PostgreSQL for users, companies, products, saved items, and inquiries.
2. Store Clerk user IDs with buyer/seller profiles.
3. Replace localStorage messages with database-backed inquiry threads.
4. Add role-based onboarding for buyer vs seller accounts.
5. Add admin review tools for company verification.
6. Add real document uploads and audit trails.
