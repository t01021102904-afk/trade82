# Trade82 Email Authentication and Branding

This document explains how Trade82 transactional emails should be branded and what DNS/authentication work is required for reliable delivery and Gmail brand indicators.

Do not paste real API keys, private DKIM keys, database URLs, or production secrets into this file.

## Current App Status

- `RESEND_API_KEY` and `EMAIL_FROM` placeholders exist in `.env.example`.
- The repository now includes reusable branded template helpers in `src/lib/email-templates.ts`.
- The app does not currently send emails through Resend or another provider.
- No Gmail sender logo, BIMI logo, VMC, CMC, or Gmail checkmark can be enabled by app code alone.

## Sender Identity

Expected production sender display after the sending domain is configured:

- English product emails: `Trade82 <noreply@trade82.com>`
- English team/admin emails: `Trade82 Team <noreply@trade82.com>`
- Korean team/admin emails: `Trade82 운영팀 <noreply@trade82.com>`

Environment placeholders:

```env
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM="Trade82 <noreply@trade82.com>"
```

Use `EMAIL_FROM` only after `trade82.com` is owned, configured in the email provider, and DNS authentication has passed. For local QA, do not edit `.env` or `.env.local` with real values unless you are intentionally testing email sending.

## Branded Templates

Templates are plain TypeScript helpers and return:

- `subject`
- `html`
- `text`

Current helpers:

- `verificationCodeEmail`
- `securityNoticeEmail`
- `platformNoticeEmail`
- `dealCompletionRequestEmail`
- `reviewRequestEmail`
- `inquiryNotificationEmail`

Template safety rules:

- User-generated text is escaped before HTML rendering.
- Plain-text fallback is included.
- No fake Gmail badges or fake checkmarks are included.
- No private document URLs are included.
- No signed private file URLs are included.
- CTA paths are limited to safe internal routes such as `/messages` and `/ko/messages`.
- Templates are designed to work even when images are blocked.

## Email Provider Setup

If Resend is used:

1. Create or connect a Resend account.
2. Add `trade82.com` as a sending domain.
3. Add the provider-supplied DNS records at the DNS host.
4. Wait for domain verification to pass.
5. Add `RESEND_API_KEY` to the deployment provider as a server-only environment variable.
6. Set `EMAIL_FROM` to the approved sender string.
7. Send only low-volume test emails first.

Do not commit provider API keys. Do not log API keys. Do not print full verification codes in production logs.

## DNS Records for Deliverability

Exact values must come from the email provider and DNS host. Use placeholders in documentation.

SPF TXT placeholder:

```text
Name: @
Type: TXT
Value: v=spf1 include:<email-provider-spf-include> ~all
```

DKIM TXT or CNAME placeholders:

```text
Name: <dkim-selector>._domainkey
Type: TXT or CNAME
Value: <provider-supplied-dkim-value>
```

DMARC TXT placeholder for initial monitoring:

```text
Name: _dmarc
Type: TXT
Value: v=DMARC1; p=none; rua=mailto:<dmarc-report-mailbox>; adkim=s; aspf=s
```

DMARC TXT placeholder for stronger enforcement:

```text
Name: _dmarc
Type: TXT
Value: v=DMARC1; p=quarantine; pct=100; rua=mailto:<dmarc-report-mailbox>; adkim=s; aspf=s
```

Move from `p=none` to `p=quarantine` or `p=reject` only after confirming legitimate Trade82 mail passes SPF/DKIM alignment.

## Gmail Logo and Checkmark

Gmail sender logo/checkmark cannot be faked by app code. It requires domain-level authentication and brand indicator setup.

For a Gmail brand logo, prepare:

1. SPF passing and aligned.
2. DKIM passing and aligned.
3. DMARC at `p=quarantine` or `p=reject` with `pct=100`.
4. BIMI DNS record.
5. BIMI-compatible SVG logo.
6. VMC or CMC certificate when required by the mailbox provider.

BIMI TXT placeholder:

```text
Name: default._bimi
Type: TXT
Value: v=BIMI1; l=https://<brand-domain>/<bimi-logo>.svg; a=https://<brand-domain>/<certificate>.pem
```

Gmail verified checkmark:

- Normally requires a VMC or provider-supported certificate path.
- Must be configured with the domain, certificate authority, DNS host, and mailbox provider requirements.
- Do not claim the Gmail verified checkmark is enabled until it is actually visible and confirmed in Gmail.

## BIMI Logo Guidance

The normal app email template can use the `Trade82` wordmark text. BIMI should use a simple icon-only mark.

Recommended logo characteristics:

- Square canvas.
- Simple vector mark.
- SVG Tiny PS compatible when using BIMI.
- No raster-only PNG for BIMI.
- No fake verified icon, checkmark, or mailbox-provider badge inside the logo.
- Hosted over HTTPS on a stable brand domain.

## Production Safety Checklist

Before turning on transactional email:

1. Buy or confirm control of `trade82.com`.
2. Configure the sending domain in the email provider.
3. Add SPF, DKIM, and DMARC DNS records.
4. Confirm DNS authentication in the provider dashboard.
5. Add `RESEND_API_KEY` and `EMAIL_FROM` in deployment environment variables.
6. Add rate limiting to any API endpoint that triggers email sends, or confirm existing endpoint rate limiting applies.
7. Send test emails to Gmail, Outlook, and Apple Mail.
8. Confirm no private document URLs or signed storage URLs appear in email content.
9. Add BIMI/VMC later only after DMARC enforcement is stable.
