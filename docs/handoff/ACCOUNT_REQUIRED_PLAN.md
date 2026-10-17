# Plan: an account is required to use ReSource

Status: **plan only, nothing built.** Branch `admin-google-signin` (local, not pushed).
Written 2026-10-16 from the code as it stands. "You" = the project owner.

## 0. What the code does today (facts the plan builds on)

- **Sign-in exists already, and it is optional.** `app/src/app/(tabs)/sign-in.tsx` offers an
  **email magic link** (`signInWithOtp`) and **Google** (`signInWithOAuth`). Both are web-only
  (`signInAvailable` in `app/src/lib/supabase.ts`), because there is no deep link back into the
  native app yet.
- **Sessions are memory-only** (`persistSession: false`): closing the tab signs you out.
- **Signed-in requests are already linked to the account.** `app/src/lib/api.ts` sends
  `Authorization: Bearer …` on *every* call when signed in, and `owner_from()` in
  `backend/security.py` then uses `HMAC(salt, "user:<id>")` instead of the install token. So
  today, a report filed while signed in is stored under an account-derived `owner_hash`. Making
  sign-in mandatory would make that true for **every** report unless we choose otherwise (§3).
- `GET /me/export` and `DELETE /me` already accept both the account and the install hash
  (`owners_from`), so "delete my data" already covers both.
- **Under-13 gate:** people who say they are under 13 get a browse-only app with sign-in turned
  off. A mandatory account collides with this (decision D4).
- **Legal text:** the full Privacy Policy and Terms (`app/src/legal/content.ts`) are **English
  only**. The other four languages have only the short summary (`legal.privacySummary`) and UI
  strings. The full text promises "You can use ReSource without an account".
- `POLICY_VERSION` = `2026-10-12` in `shared/constants.ts` and `backend/settings.py` (Codex).

## 1. Sign-in options

| | A. Google only | B. Google + email (recommended form: magic link, not passwords) |
|---|---|---|
| Who is left out | Anyone without (or unwilling to use) a Google account: many older residents, some immigrant families, people avoiding Google | Nobody with an email address |
| Supabase dashboard | Authentication → Providers: Google on (done). **Turn Email provider off** or keep it on only for admins. URL Configuration as in `DEPLOY_STEPS.md` §5 | Google as in A. Email provider **on**, "Confirm email" **on**. **Custom SMTP required**: Supabase's built-in mailer is limited to a few emails an hour and is for testing only |
| Other setup | Google consent screen "In production" (`DEPLOY_STEPS.md` §6) | Same, plus an SMTP sender (Resend, Postmark, SES, or Brevo; free tiers fit) with a domain you own; SPF/DKIM DNS records for that domain; Auth → Rate Limits: raise "emails per hour"; edit the Magic Link email template (subject/body, ideally in plain words) |
| What we store | Email, name, avatar URL (Google sends them; Supabase keeps them in `auth.users`) | Same for Google users; email only for email users |
| Phones | Needs a deep link back into the app either way (see §2) | Same |

**Email + password** (instead of magic link) adds: password reset flow, a reset email template,
leaked-password and strength settings, and a password field to secure. It buys nothing for a
civic app used occasionally. **Not recommended.**

**Recommendation: B, Google + email magic link.** It is mostly built already, and Google-only
would shut out exactly the residents the app is for. Cost: one SMTP account and DNS records.

What you would do in the dashboard for B:
1. Pick an SMTP provider, verify your sending domain (add the DNS records it gives you).
2. Supabase → Project Settings → Authentication → SMTP: enter host, port, user, password, sender
   (`no-reply@<your-domain>`, name "ReSource").
3. Authentication → Providers → Email: enabled, "Confirm email" on, "Secure email change" on.
4. Authentication → Rate Limits: emails per hour to something like 30.
5. Authentication → Email Templates → Magic Link: plain-language text (we can draft it).
6. URL Configuration and Google, as in `DEPLOY_STEPS.md` §5–6.

## 2. App flow (all in `app/`, Claude)

**Gate.** A root-level gate in `app/src/app/_layout.tsx`: until the session is known, show a
loading screen; with no session, render a new `welcome` screen instead of the tabs. Allowed
without an account: welcome, sign-in, privacy, terms, cookies, credits (people must be able to
read the policy *before* agreeing) and `/admin` (passcode path). Everything else redirects to
welcome. The gate is UI only; the API must also refuse anonymous writes (§4).

**Screens.**
- `welcome`: what ReSource is, one line on why an account is needed, age question (13+), the
  consent checkbox (existing text, updated), **Continue with Google**, **Continue with email**.
- `sign-in` (existing, reworked): email field → "Check your inbox" state with **Resend** (after
  60 s) and **Use a different email**; returns here from the link and Google.
- Settings → **Account**: email, Sign out, Delete my account (§3).

**Session persistence.** Switch to `persistSession: true`. On web Supabase uses `localStorage`
(key `sb-<ref>-auth-token`); on native, `AsyncStorage` via the `auth.storage` option. This adds a
stored identifier, so: declare it in `lib/storage.ts` as **essential** (so `check:storage`
passes), list it in the cookie/storage notice, and reset it in the existing "clear everything"
path. Admin role stays read from `app_metadata` on each session refresh.

**Sign-out.** `supabase.auth.signOut()` → clear `authToken/Email/Role` stores → back to welcome.
Also clear `adminTokenStore` so a passcode unlock does not survive.

**Loading and errors** (all five languages): session restoring; magic link sent / expired /
already used; Google cancelled; Supabase not configured (show a clear "sign-in is not set up on
this server" instead of a broken gate); offline (allow cached browsing? decision D5); API returns
401 `sign_in_required` → sign out locally and go to welcome.

**Phones (native).** Today sign-in is web-only. A required account means the native apps cannot
be used at all until deep links work: `scheme: "resource"` exists in `app.json`; add
`resource://sign-in` to Supabase Redirect URLs, use `expo-auth-session`/`expo-web-browser` for
Google and `Linking` for the magic link. **Proposed: ship web first, native as a follow-up.**

**Signed-in vs admin.** Unchanged principle: every user is now signed in, and admin is still
only `app_metadata.role === "admin"`, rechecked by the API on every admin call. The admin tab
stays hidden unless that role is present; the passcode path stays as decided in
`ADMIN_PRODUCTION_CHECKLIST.md` #2.

## 3. The key decision: are reports linked to the account?

### Design 1, "Linked" (what the code does today when signed in)
- **Backend:** no change. `owner_hash = HMAC(salt, "user:<id>")` for everything.
- **Database:** no schema change. Every report, post, vote, subscription and consent record
  carries the account-derived hash. Anyone with the database **and** `OWNER_HASH_SALT` can
  compute which account filed which report (hash every `auth.users.id` and compare).
- **RLS:** unchanged (reports are server-only). Optionally a "My reports" screen via the API.
- **Delete my data:** simple and complete; works from any device once signed in. Account
  deletion = `DELETE /me` + delete the `auth.users` row.
- **Privacy policy:** must say plainly: "Reports are tied to your account so you can see and
  delete them. Moderators see the report, not your name or email." The "stored without your
  name" line stays literally true but is no longer the whole truth.
- **Gains:** abuse control (ban an account), "my reports" across devices, simpler code.

### Design 2, "Unlinked" (recommended)
- **Backend:** report routes (`POST /reports`, photo upload) ignore the bearer for the owner and
  use the **install token** hash, as before. The bearer is still **required** (401 without it),
  only to prove a real account and for rate limits keyed on the account. Posts/votes may stay
  linked (D3).
- **Database:** no new column. Reports keep `owner_hash = HMAC("install:<token>")`. No table ever
  holds anything derivable from the account for a report.
- **RLS:** unchanged.
- **Delete my data:** report deletion works from the device that filed it (as today); deleting
  the account deletes the account and linked items but **cannot** find reports filed on another
  device. The policy must say so, and the receipt ID remains the way to ask for one by email.
- **Privacy policy:** "Your account is used to let you in. Reports are not linked to it: not
  even we can tell which account filed a report."
- **Gains:** keeps the original promise for the most sensitive thing residents send (complaints
  about city services, with photos). **Costs:** no cross-device "my reports"; a banned account
  can still have filed reports we cannot trace (rate limits still apply).

**Recommendation: Design 2.** Requiring an account is already a big change in trust; keeping
reports unlinkable limits what a breach or a subpoena could reveal, and the backend change is
small. If you value abuse control more, Design 1 is fine as long as the policy says it plainly.

## 4. Hand-off list for Codex (paste as is)

> Context: ReSource now requires every user to be signed in (Supabase Auth: Google + email
> magic link). Branch `admin-google-signin`. The app adds a gate; the API must enforce it.
>
> 1. **`backend/security.py`:** add `require_user(request)` → returns the Supabase user or raises
>    `401 {"detail": "sign_in_required"}`. Keep `require_admin` as is (passcode or role).
> 2. **Apply `require_user`** to every write and personal route: `POST /reports`, photo upload,
>    posts, votes, flags, subscriptions, email alerts, chat, `/me/export`, `DELETE /me`. Public
>    reads (services, resources, alerts, approved posts, `/config`, `/health`) stay open, or
>    also require sign-in: **owner decides (D2)**; default open.
> 3. **Reports owner (Design 2 if chosen):** in report creation and photo upload, compute
>    `owner_hash` from the install token only (`HMAC("install:<token>")`), even when signed in.
>    Require the install token (400 `missing_client_token` as now). Add a test that a report
>    created with a bearer has the install hash, not the user hash.
>    (Design 1: no change here.)
> 4. **Rate limits:** add a per-account bucket (`HMAC("user:<id>")`) next to the IP bucket on
>    write routes (in memory, same limiter). For Design 2 this bucket must not be stored with
>    the report.
> 5. **Account deletion:** new `DELETE /me/account`: run the existing `DELETE /me` logic for both
>    owners, then delete the Supabase user with the service-role client
>    (`auth.admin.delete_user(id)`). Rate-limited like `DELETE /me`. Return a receipt.
> 6. **Export:** include the account's email and sign-in provider from `auth.users` in
>    `/me/export` (it is data we hold about them), and update its `note` (it says we do not store
>    your name; with Google, Supabase does).
> 7. **`/config`:** add `"account_required": true` so the app can tell an old API from a new one.
> 8. **`shared/constants.ts` and `backend/settings.py`:** bump `POLICY_VERSION` and
>    `POLICY_EFFECTIVE_DATE` to the launch date (both must match; Claude will tell you the date
>    once the text is approved).
> 9. **`consent_records.kind`:** add `'account'` to the check constraint in `schema.sql`, plus a
>    migration for existing projects (`alter table … drop constraint …, add constraint …`). The
>    API writes one consent record at first sign-in (`POST /me/consent`, new).
> 10. **Logs:** start uvicorn with `--no-access-log` (the policy will say we do not keep IPs).
> 11. Tests for 1–9; move `docs/handoff/test_admin_role.py` into `backend/tests/` (pending).
>
> No change to RLS is needed: all tables stay server-only for reports and private data.

## 5. Privacy and legal text (Claude, `app/`)

Must say, honestly:
- **An account is required.** What we receive: **email address** (all users); with Google, also
  **name and profile picture**, which Google sends and our sign-in provider (Supabase) stores in
  its user table. We do not show or use name and picture (consider hiding them: D6).
- Google is a service that handles your information when you choose it (link its policy).
- The sign-in session is **stored on your device** until you sign out (essential storage).
- Whether reports are linked to the account (Design 1 or 2 wording from §3).
- How long: the account lives until you delete it; deletion removes the account and linked data
  within N days; Supabase backups may hold it up to their retention.
- How to delete the account (Settings → Account → Delete), and what it cannot reach (Design 2).
- Under 13: per D4.
- Email for sign-in links only; never marketing.

Files: `app/src/legal/content.ts` (full Privacy + Terms: "The short version", "What we collect",
"Who else handles", "How long", "Your choices", "Children", Terms "Ending use"); locale strings
for welcome/sign-in/account/errors and `legal.privacySummary` in **en, es, fa, vi, zh**; cookie
notice (session storage). **Translations:** I can draft es/fa/vi/zh, but the legal summary should
be checked by a fluent reader before launch. The full policy stays English-only unless you want
it translated (D7). The text must still be read by an adult/attorney (`docs/HUMAN_TODO.md`).

## 6. Build order, tests, risks

**Order**
1. You decide D1–D7 (below).
2. Codex: §4 items 1–4, 7, 9 behind a setting `ACCOUNT_REQUIRED` (default off) so main keeps
   working; tests.
3. Claude: session persistence + storage declaration; gate + welcome; sign-in rework; Settings →
   Account; 401 handling; strings in five languages. `npm run check` green.
4. Claude: privacy/terms text; Codex: policy version bump on the same date.
5. Codex: account deletion (5), export (6), logs (10). Claude: wire Delete account.
6. You: SMTP + Supabase email settings (§1), redirect URLs.
7. Joint browser test (below), then switch `ACCOUNT_REQUIRED=1`.
8. Later: native deep-link sign-in.

**Test plan**
- Unit (app): gate routing for no-session / session / loading; storage check sees the session key.
- Backend: every write route → 401 without bearer, 200 with; admin routes unchanged (role test);
  Design 2: report `owner_hash` equals install hash even with bearer; account deletion removes
  rows and the auth user; consent record written once.
- Browser checklist (new `ACCOUNT_REQUIRED_BROWSER_TEST.md`): first launch shows welcome; policy
  readable without account; Google sign-in; email link (fresh, expired, reused); reload keeps the
  session; sign-out returns to welcome; deep link to `/report` while signed out redirects;
  admin and non-admin as in `ADMIN_BROWSER_TEST.md`; delete account then sign in again = new
  empty account; all five languages; under-13 path per D4.

**Risks**
- **Under-13 users** (COPPA): forcing an account while letting under-13s in means collecting
  their email. Simplest honest option: under-13 cannot create an account and sees only a
  "ReSource is for 13 and older" page (or a public read-only page). Needs your decision.
- **Fewer reports**: an account wall will cut casual reporting; residents wary of government
  may not sign up at all. Design 2 softens this only if the welcome screen explains it.
- **Native apps unusable** until deep-link sign-in ships.
- **Email deliverability**: without custom SMTP and DNS, magic links land in spam or are capped.
- **Old receipts / install-token data**: reports made before the change stay under install hashes;
  delete still works from that device (owners_from covers both).
- **Privacy claims drifting** from code: `check:claims` must be updated for the new wording.
- **Supabase free tier pausing** now blocks *all* use, not just reports (sign-in fails).
- **Persisted session = token in localStorage**: XSS would expose it; the CSP tightening in
  `DEPLOYMENT_AUDIT.md` becomes a must-fix.

## Decisions needed from you

| # | Question | My default |
|---|---|---|
| D1 | Google only, or Google + email magic link (or passwords)? | Google + magic link |
| D2 | Must people sign in just to **read** services/resources/map, or only to send things? | Owner asked for "before using it": gate everything in the UI; API keeps public reads open |
| D3 | Reports linked to the account (Design 1) or unlinked (Design 2)? Posts/votes? | Reports unlinked; posts/votes linked |
| D4 | Under 13: blocked entirely, or a public read-only page with no account? | Read-only page, no account |
| D5 | Offline: allow cached browsing while signed out of the network? | Yes, if a session was ever restored |
| D6 | Keep Google's name/avatar, or ask Supabase for email scope only? | Request email scope only where possible; disclose regardless |
| D7 | Translate the full policy, or keep full text English with translated summary? | Translated summary, checked by a fluent reader |
