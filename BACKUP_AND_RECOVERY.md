# Trade82 Backup and Recovery Overview

This document is safe for a public repository. It describes the expected backup
posture at a high level and intentionally omits private runbooks, restore
commands, provider-specific operational details, and environment values.

Never commit database dumps, private user data, Supabase private files, `.env`,
`.env.local`, deployment environment exports, or files containing real secrets.

## Data Stores

Trade82 uses:

- Supabase Postgres for application records.
- Supabase Storage for public marketplace images and private submitted files.
- Clerk for authentication records.
- Deployment provider environment variables for runtime configuration.

## Backup Expectations

Before production use, confirm that each managed provider has an appropriate
backup and recovery plan enabled for the selected plan.

Recommended public-safe expectations:

- Database backups are enabled and monitored in the database provider dashboard.
- Private files are covered by provider-managed recovery procedures.
- Environment variables are stored in a password manager or deployment
  provider, not in Git.
- Restore procedures are tested in a non-production environment before launch.
- Destructive migrations or bulk data operations are preceded by a fresh backup.

## Repository Rules

Keep these in Git:

- Prisma schema files.
- Reviewed Prisma migration files.
- Placeholder-only environment examples.
- Public documentation that does not include provider credentials or private
  operational procedures.

Do not keep these in Git:

- `.env`, `.env.local`, `.env.production`, or deployment environment exports.
- Database dumps or storage exports.
- Private company documents, contracts, or user-submitted files.
- Signed URLs, auth tokens, API keys, private keys, or webhook secrets.
- Internal incident notes containing customer data.

## Migration Safety

Prisma migration history should remain tracked in `prisma/migrations/`.

For production or shared environments:

- Review migrations before applying them.
- Apply committed migrations through the normal deployment workflow.
- Do not edit old migrations after they have been applied to shared databases.
- Avoid destructive schema changes without a reviewed backup and recovery plan.

## Incident Response Principles

If data loss, a bad migration, a storage issue, or a credential exposure is
suspected:

1. Stop or reduce writes if ongoing writes could make recovery harder.
2. Preserve relevant logs without exposing secrets or private files.
3. Determine the affected data and time window.
4. Restore or repair in a non-production environment first when possible.
5. Rotate exposed credentials immediately if a secret may have leaked.
6. Document the incident privately outside the public repository.

## Storage Recovery Principles

Public assets such as product images and company logos may be reuploaded when
appropriate. Private files require stricter handling and should never be copied
into public buckets, committed to Git, or shared through public links.

Private file access should continue to use authenticated server routes and
short-lived signed URLs.

## Log Hygiene

Application logs should not include:

- Secrets or API keys.
- Full auth tokens.
- Signed private file URLs.
- Private document contents.
- Full request bodies containing personal or business-sensitive data.

Use provider dashboards and private operational notes for detailed restore
procedures.
