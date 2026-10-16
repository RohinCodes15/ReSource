# Test run: account-required build (`EXPO_PUBLIC_ACCOUNT_REQUIRED=1`)

Run 2026-10-16 by Claude on branch `admin-google-signin`, web only (`expo start --web`), against
the local API on `localhost:8000` and the real Supabase project from `app/.env`.
Flag on: a second dev server on port 8082. Flag off: the existing dev server on port 8081.
Driven with Playwright at 1200×628.

**Read this first: real sign-in was not tested.** Finishing a Google or email-link sign-in
needs the owner's Google account or inbox. Rows marked *simulated* used a fake session written to
`resource.session` in the browser, which tests what the app does with a session but not Supabase
itself. The owner must repeat those rows with a real sign-in (see the end).

**Test setup:** the local API allows only the `localhost:8081` origin (CORS), so the app on 8082
first showed "offline". For the simulated rows, the test browser added CORS headers to API
responses. Nothing in the backend was changed.

| # | Check | Result | How |
|---|---|---|---|
| 1 | First launch shows the gate | **Pass** | `/` redirected to `/sign-in`: "Welcome to ReSource", why an account is needed, then the age question. |
| 2 | Legal pages readable signed out | **Pass** | `/privacy`, `/terms`, `/cookies`, `/credits`, `/data-request` opened with no gate. Privacy shows the new account summary ("You need an account…"). |
| 2b | Admin passcode page readable signed out | **Pass** | `/admin` shows "Staff only" and the passcode form. |
| 2c | Other pages blocked signed out | **Pass** | `/report` and `/settings` were covered by the gate (shown as "offline" because of the CORS setup above; the screen underneath is hidden). |
| 3 | Under-13 answer blocks account creation | **Pass** | "No, I am under 13" → "ReSource is for people 13 and older"; no email field and no Google button; `resource.age` = `"under13"` is kept, so a reload does not offer the form again. |
| 3b | 13+ answer shows sign-in | **Pass** | Email field, consent and age checkboxes, "Send link", "Continue with Google". |
| 4 | Sign-in works | **Not tested (needs owner)** | See above. |
| 5 | Session survives a reload | **Pass (simulated)** | With a session in `resource.session`, `/` loaded with no gate, and again after a reload. |
| 6 | Settings → Account | **Pass (simulated)** | "Signed in as simulated@example.com", Sign out button, account-deletion note. |
| 7 | Sign-out returns to the gate | **Pass (simulated)** | Sign out in Settings → `/sign-in`; `resource.session` removed. |
| 8 | Admin access still needs the admin role | **Pass (simulated, app side)** | Signed in without the role: `/admin` says "this account is not an admin" and offers only the passcode; no Admin tab. Backend role check: `CODEX_ADMIN_ROLE_TEST.md`. |
| 9 | Flag OFF behaves as before | **Pass** | On 8081: no gate on `/` or `/report`; Settings shows the old Account card ("optional"/"not turned on") and not the new one; Privacy says "No account is needed"; `/sign-in` is the old screen without the age gate; nothing stored under `resource.session`. |

## Problems found

1. **Blocker for turning the flag on: reports would be linked to the account.** Today
   `owner_from()` in `backend/security.py` uses `HMAC("user:<id>")` whenever a bearer is sent,
   and the app sends the bearer on every call. The welcome screen, the new privacy text and the
   summary all say reports, posts and votes are *not* linked. That is only true after Codex
   ships item 2 of `CODEX_ACCOUNT_REQUIRED.md` (install hash when `ACCOUNT_REQUIRED` is on).
   **Do not turn the app flag on before the backend flag.**
2. **The storage banner covers the age buttons** on first launch (1200×628): the "No, I am under
   13" button could not be clicked until the banner was answered. Minor, but it is the first
   thing a new person sees. Fix: leave room under the welcome card for the banner, or show the
   banner after the age answer.
3. **Offline wins over signed-out.** A signed-out person who is offline sees "You are offline"
   rather than the welcome screen. This is acceptable (sign-in needs a connection anyway), but
   the legal links are not on that screen; the footer still has them.
4. Gated screens stay mounted (hidden) under the gate, so they may still call public read
   routes while signed out. These are public anyway; no personal data is involved.

## What the owner still has to run (real sign-in)

With Supabase email and Google set up (`ACCOUNT_REQUIRED_PLAN.md` §1), the API allowing your
web origin, and the app built with `EXPO_PUBLIC_ACCOUNT_REQUIRED=1`:
- Google sign-in, then email link: fresh, expired, already used.
- Reload and close/reopen the tab: still signed in. Sign out: back to the welcome screen.
- An admin account (role set in `app_metadata`) sees the Admin tab; a normal one does not.
- Repeat in es, fa, vi, zh.
