# Trade82 Backup and Recovery Runbook

This runbook is for Trade82 local QA and production operations. It is intentionally conservative: do not deploy, delete data, run destructive database commands, or change production settings directly from this document.

Never commit database dumps, private user data, Supabase private files, `.env`, `.env.local`, `.env.production`, `.env.development`, or any file containing real secrets.

## Automatic Supabase DB Backups

Trade82 uses Supabase Postgres. Automatic backup status cannot be verified from this repository alone; confirm it manually in the Supabase dashboard before production launch.

Production checklist:

1. Open the Supabase project dashboard.
2. Go to the database backup area for the production project.
3. Confirm automatic database backups are available on the current Supabase plan.
4. Confirm the latest successful backup timestamp is recent.
5. Confirm the retention period and backup frequency match business needs.
6. If point-in-time recovery is available on the plan, confirm the recovery window and the exact restore workflow.
7. Record who is allowed to perform restores. At minimum, restrict this to the project owner or a designated production admin.

Recommended backup posture:

- Daily automatic backups for production at minimum.
- Point-in-time recovery when the Supabase plan supports it.
- A manual backup before risky migrations, bulk imports, admin data repair, or high-risk deployment windows.
- Restore drills to a staging project before launch and periodically after launch.

Before any risky migration:

1. Confirm `npx prisma migrate status` is clean locally.
2. Confirm the migration has been reviewed and committed.
3. Confirm a recent automatic backup exists in Supabase.
4. Create a manual backup if the change could affect important records.
5. Apply to staging first.
6. Verify app flows against staging.
7. Only then apply to production with `npx prisma migrate deploy`.

## Manual DB Backup Templates

Use placeholders only. Do not paste or commit real database URLs.

Plain SQL backup:

```bash
pg_dump "<database-url>" --file "<backup-file>-<timestamp>.sql" --no-owner --no-privileges
```

Custom-format backup:

```bash
pg_dump "<database-url>" --format=custom --file "<backup-file>-<timestamp>.dump" --no-owner --no-privileges
```

Restore a plain SQL backup to a staging database:

```bash
psql "<staging-database-url>" --file "<backup-file>.sql"
```

Restore a custom-format backup to a staging database:

```bash
pg_restore --dbname "<staging-database-url>" --clean --if-exists "<backup-file>.dump"
```

Supabase CLI note: if using Supabase CLI for backups, use provider documentation and placeholders only. Do not store generated dump files in Git.

Backup artifact rules:

- Store local backup files outside the repository when possible.
- If a local backup folder is temporarily needed, use `backups/` or `db_backups/`; both are ignored by Git.
- Never commit `*.dump`, `*.sql`, `*.backup`, `*.bak`, `*.tar`, `*.gz`, or `*.zip`.
- Prisma migration SQL files are the exception: `prisma/migrations/**/migration.sql` must stay tracked.

## Prisma Migration History

Current repository status:

- `prisma/migrations/` exists.
- Migration folders exist with `migration.sql` files.
- Migration history should stay in Git.
- Generated Prisma client files under `src/generated/prisma/` should not be manually edited.

Migration rules:

- Check status:

```bash
npx prisma migrate status
```

- Apply committed migrations to production or staging:

```bash
npx prisma migrate deploy
```

- Create and apply local development migrations:

```bash
npx prisma migrate dev
```

- Do not edit an old migration after it has been applied to a shared database.
- Create a new migration for future schema changes.
- Do not use `prisma migrate reset` on production or shared data.
- Do not use `prisma db push` against production unless there is a reviewed emergency procedure.

## Accidental Deletion Recovery

Use this sequence for accidental user, company, product, inquiry, message, deal, review, submitted document, contract file, migration, deployment, or admin-action issues.

1. Stop writes if data loss is suspected.
2. Identify the incident time and affected records.
3. Preserve current logs and notes without printing secrets or signed URLs.
4. Check the latest Supabase automatic backup.
5. Restore to staging first when possible.
6. Compare restored staging data with current production data.
7. Selectively restore missing records when safe and practical.
8. Restore production only if selective repair is unsafe or insufficient.
9. Verify affected app flows after repair.
10. Record incident notes: what happened, who acted, when, records affected, restore source, and follow-up prevention.

Do not run destructive restore commands automatically from local QA. Any production restore should be approved by the project owner or designated production admin.

### Common Incidents

Accidental user, company, or product deletion:

- Treat as high risk because cascading relations can remove dependent rows.
- Restore to staging first.
- Compare `UserProfile`, `Company`, `Product`, `ProductImage`, `Inquiry`, `Message`, `Deal`, `Review`, `CompanyReview`, `SavedItem`, and `VerificationRequest` data.
- Prefer selective record repair if only a small set of rows is affected.

Accidental private document or contract deletion:

- Check whether the database record still has `documentPath` or `contractFilePath`.
- Do not expose private files through public buckets.
- Recover through Supabase Storage/provider backup procedures.
- Regenerate signed URLs only through authorized admin or participant flows.

Accidental migration mistake:

- Stop writes.
- Do not edit the already-applied migration.
- Restore to staging and inspect the data impact.
- Create a corrective migration or restore production from backup if data loss cannot be repaired safely.

Accidental bad deployment:

- Roll back the deployment at the hosting provider if available.
- Keep the database unchanged unless the deployment also applied a bad migration.
- If a migration was involved, follow the migration mistake procedure.

Accidental wrong admin action:

- Identify the company, review, or request affected.
- Prefer setting status back to the intended safe state over deleting data.
- Use database repair only after confirming the exact previous value.

## Soft Delete and Hard Delete Audit

Current model behavior from `prisma/schema.prisma` and API usage:

| Area | Current behavior | Notes |
| --- | --- | --- |
| `UserProfile` | Hard delete if removed directly; cascades to owned companies and saved items | No user deletion API was identified, but direct DB deletion is high risk. |
| `Company` | Status-based public visibility through `verificationStatus`; hard delete if removed directly | Company relations include cascades to seller/buyer profiles, products, submitted document records, saved items, reviews, and company reviews. |
| `Product` | Status hide/inactive is supported; product management delete currently hard-deletes | Safer production behavior would prefer `status = inactive` or a future `deletedAt`. |
| `ProductImage` | Hard delete through product/image replacement flows | Storage cleanup must be handled carefully if added. |
| `Inquiry` | Status-based state (`sent`, `replied`, `closed`); no soft delete field | Preserve inquiries for audit/history. |
| `Message` | Hard delete if parent inquiry is deleted; no soft delete field | Preserve messages for trade history. |
| `Deal` | Status-based state including `cancelled` and `disputed`; no soft delete field | Prefer status transitions over deletion. |
| `Review` | Public/admin visibility fields (`isPublic`, `adminApproved`); hard delete if parent deal is deleted | Deal-review duplicate protection exists through a unique constraint. |
| `CompanyReview` | Soft delete via `deletedAt` and `isPublic = false` | This is the safest current deletion pattern. |
| `VerificationRequest` / submitted document records | Status-based review record; hard delete if company is deleted | Private file paths are stored here and should not be exposed. |
| `SavedItem` | Hard delete on unsave | Acceptable for user preference data, but not for audit-critical records. |

Recommendation:

- Do not convert every model automatically during QA.
- Before production, consider `deletedAt` fields for `UserProfile`, `Company`, `Product`, `Inquiry`, `Message`, `Deal`, `Review`, and `VerificationRequest`.
- Prefer hide/status changes for admin tools: `inactive`, `private`, `cancelled`, `disputed`, `isPublic = false`, or listing status changes.
- Keep hard delete only for low-risk preference records such as saved-item toggles.

## Environment and Secret Recovery

`.env`, `.env.local`, `.env.production`, `.env.development`, and any file containing real secrets must never be backed up into Git, GitHub, ChatGPT, Codex, Google Drive, public storage, or shared folders.

Current expected setup:

- `.gitignore` ignores `.env*`.
- `.env.example` contains placeholder names only.
- Backup folders and common dump archives are ignored.

If environment secrets are lost:

1. Do not recover them from old unsafe copies.
2. Rotate or regenerate keys from the provider dashboard.
3. Update local `.env.local` manually.
4. Update deployment provider environment variables manually.
5. Restart affected services.

Providers to check:

- Clerk
- Supabase
- Resend
- Sentry, if configured

If secrets are leaked:

1. Revoke or rotate them immediately.
2. Remove unsafe copies from storage.
3. Audit access logs if the provider supports it.
4. Record incident notes.

## Supabase Storage Backup Plan

Trade82 storage policy:

- Public bucket: company logos, product images, profile avatars if used.
- Private bucket: submitted company documents and contract files.

Recovery guidance:

- Public assets can often be reuploaded or regenerated from source files.
- Private submitted documents and contracts require stricter handling.
- Do not export private storage into public buckets.
- Do not commit private storage exports to Git.
- Do not send private files through public links or chat tools.
- Use Supabase/provider storage backup and recovery procedures.
- Keep private file access through short-lived signed URLs only.

## Admin Action Safety

Current safer patterns:

- Company listing state can be changed through status values rather than deleting a company.
- Company reviews can be hidden with `deletedAt` and `isPublic = false`.
- Product listings support inactive/draft states.

Recommendations before production:

- Add confirmation prompts for destructive or high-impact admin actions.
- Prefer Hide, Inactive, Private, Listing Paused, or Updates Needed over Delete.
- Add an admin audit log before wider admin use.

Suggested audit log fields:

- Admin user ID and email
- Target type and ID
- Action name
- Before status/value
- After status/value
- Timestamp
- Optional safe note

Do not log secrets, signed private file URLs, auth tokens, or private document contents.
