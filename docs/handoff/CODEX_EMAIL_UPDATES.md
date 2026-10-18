# Handoff to Codex: email updates (backend)

Written 2026-10-18. The app side is done; this is the backend half. Fixes `review/BUGS.md` B21
("Emails are collected but nothing sends an email").

## Decision

Residents get ReSource updates by email **without an account**. Google sign-in stays admin-only
(see the sign-in page, `app/src/app/(tabs)/sign-in.tsx`). Email updates must never require or
create an Auth account.

## What the app already does

- **Alerts screen** (`app/src/app/(tabs)/alerts.tsx`) shows the "Get updates by email" form only
  when `GET /config` returns `email_enabled: true`.
- It sends `POST /email/subscribe` with
  `{ email, categories: AlertCategory[], areas: AreaCode[], consent: true, age_confirmed: true, website: "" }`
  (the existing `EmailSubscribeIn` schema; `website` is the honeypot).
- It reads the response type `{ subscribed: boolean; pending_confirmation?: boolean }`.
  - `pending_confirmation: true` shows: "Almost done: check your inbox and click the link to confirm."
  - Otherwise it shows the older "You are signed up" text, so return `pending_confirmation: true`.
- **Landing messages.** The app shows a banner when it is opened at:
  - `/alerts?email=confirmed`: "Your email is confirmed…"
  - `/alerts?email=unsubscribed`: "You're unsubscribed. We've deleted your email address."
  - `/alerts?email=expired`: "That link has expired or was already used…"
- A 429 response shows the rate-limit message. Any other error shows the generic message.

## What the backend needs

### 1. Subscribe with double opt-in (`backend/routers/account.py`, `email_subscribe`)

Replace the current `raise HTTPException(503, "email_not_configured")` body:

- When `settings.email_enabled` is false, keep returning 503.
- Otherwise, upsert by email into `email_subscriptions` with `confirmed_at = null`, the chosen
  `categories`/`areas`, `policy_version`, and a consent record. Keep the existing
  `rate_limit("email", 3, 3600)`.
- Send **one** confirmation email with a signed link `GET {public_api_url}/email/confirm?token=...`
  (reuse `sign()`/`unsign()`). Give the token an expiry: 48 h is suggested.
- Return `201 { "subscribed": false, "pending_confirmation": true }`.
- **Do not reveal whether the address already exists.** Return the same response every time. If
  the address is already confirmed, send nothing (or a "you're already subscribed" note), so this
  endpoint cannot be used to spam someone.

### 2. Confirm

`GET /email/confirm?token=`:
- Valid token: set `confirmed_at = now()` and redirect 303 to `{public_app_url}/alerts?email=confirmed`.
- Invalid or expired token: redirect 303 to `{public_app_url}/alerts?email=expired`.
- Unconfirmed rows older than 7 days should be deleted, either in the send job or in a cleanup.

### 3. Unsubscribe (mostly exists)

- `GET /email/unsubscribe` (confirm page) and `POST /email/unsubscribe` (RFC 8058 one-click)
  already exist. Keep GET from changing state, because mail scanners follow links.
- After a successful POST from the confirm page, redirect 303 to
  `{public_app_url}/alerts?email=unsubscribed`. One-click POSTs from mail clients can keep
  returning JSON.
- Unsubscribing must **delete** the row. The app copy promises "We've deleted your email address".

### 4. Sending

- Add a small sender module, e.g. `backend/mailer.py`, using `smtplib` with the existing settings
  (`SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM`). Resend's SMTP or Gmail with an app password
  both work.
- Every email must have:
  - a plain-text body,
  - a visible unsubscribe link,
  - `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers,
  - the sender's identity (a CAN-SPAM requirement).
- When an alert is published (the admin publish path), email every **confirmed** subscriber whose
  categories and areas match. Use the same rule as the app's `matches()`: no topics or no areas
  chosen means all, and `citywide` matches every area.
- Send in a background task or job, never inside the admin request. Log only counts, never
  addresses.

### 5. Schema (`backend/database/schema.sql` plus a migration)

- Add `confirmed_at timestamptz` to `email_subscriptions`.
- Add `last_sent_alert_id text` only if needed for de-duplication.
- Keep RLS as it is: service role only.

### 6. Tests

Cover at least:
- subscribe returns `pending_confirmation`, and the same response for an existing address;
- confirm with a valid, expired or tampered token;
- unsubscribe deletes the row;
- only confirmed and matching subscribers are emailed (mock the SMTP client);
- 503 when email is not configured.

## Privacy and legal copy

`docs/PRIVACY.md` and `app/src/legal/content.ts` must say:
- email is stored only for updates, until the person unsubscribes;
- the sending provider receives the address.

Claude owns the app copy and will update it once the provider is chosen. Tell Claude which one.
