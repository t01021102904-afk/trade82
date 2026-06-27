# Trade82

Trade82 is a Next.js B2B marketplace MVP that connects Korean sellers with American buyers. It includes Clerk authentication, Google Sign-In support, English/Korean URL routing, Supabase Postgres marketplace data, and Supabase Storage file uploads.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Clerk for authentication
- Custom dictionary-based i18n
- Supabase Postgres for users, companies, products, saved items, inquiries, messages, deals, and reviews
- Supabase Storage for public listing images and private submitted documents

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Then add your Clerk keys:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk-publishable-key>
CLERK_SECRET_KEY=<clerk-secret-key>
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

## Backup and Recovery

Trade82 uses Supabase Postgres and Supabase Storage. Keep Prisma migration history in Git, but never commit database dumps, private user data, Supabase private files, or `.env.local`.

See [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) for the production backup checklist, manual backup command templates, migration rules, private storage recovery guidance, and incident recovery runbook.

## Transactional Email

Trade82 email templates and DNS authentication guidance live in [EMAIL_AUTHENTICATION.md](./EMAIL_AUTHENTICATION.md). Gmail logos and sender checkmarks require SPF, DKIM, DMARC, and later BIMI/VMC setup outside the app code.

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
- Public marketplace pages read from the database and show empty states when no records are listed

## Not Included In The MVP

- Payments, escrow, customs brokerage, tax services, or legal advice.
- File malware scanning beyond server-side file type, size, and access checks.
- Redis-backed production rate limiting; the local fallback is in-memory.
- Third-party error tracking until Sentry or another provider is configured.

## Recommended Next Steps

1. Confirm production Supabase backups and storage recovery procedures.
2. Replace in-memory rate limiting with Redis-backed rate limiting for multi-instance deployments.
3. Configure production email sending after DNS authentication is complete.
4. Add third-party error tracking and alerting.
5. Add malware scanning and formal audit logs for private files.
