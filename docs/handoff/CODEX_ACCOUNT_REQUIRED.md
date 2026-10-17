# Handoff to Codex: account required (backend, database, constants)

Paste-ready. Background and reasoning: `ACCOUNT_REQUIRED_PLAN.md` (same folder).
Branch `admin-google-signin`. The app side is being built by Claude behind
`EXPO_PUBLIC_ACCOUNT_REQUIRED` (off by default).

## Owner decisions this implements

- Every user must sign in (Supabase Auth: Google, or email magic link; no passwords).
- **Nothing a user sends is linked to their account.** Reports, photos, posts, votes, flags,
  subscriptions and consent records keep `owner_hash = HMAC(salt, "install:<token>")`, as for
  anonymous use today. The account only proves "a real, signed-in person" and feeds rate limits.
  (Exception only if abuse control needs it later: owner decides then, not now.)
- Under-13s cannot create an account (the app blocks it; the API cannot know age).
- Everything below sits behind a new setting **`ACCOUNT_REQUIRED`** (default **off**). With it
  off, behavior must be exactly as today, and all existing tests must pass unchanged.

## Changes

1. **`backend/settings.py`:** add `account_required: bool` from env `ACCOUNT_REQUIRED`
   (`1`/`true` = on; default off). Add it to `.env.example` and `deployment/ENV.md` with a comment
   "keep off until launch".

2. **`backend/security.py`:**
   - `require_user(request)`: when `account_required` is on, return the Supabase user or raise
     `401 {"detail": "sign_in_required"}`; when off, return the user or `None` without raising.
   - **Owner no longer comes from the account.** `owner_from()` must return the install hash
     even when a bearer is present (today it prefers `HMAC("user:<id>")`). Do this only when
     `account_required` is on, so current behavior is untouched while it is off.
   - `owners_from()` keeps returning both hashes, so export/delete still find anything filed
     under the old account-derived hash before the switch.
   - Rate limits: in `rate_limit(...)`, when a user is signed in, also charge an in-memory bucket
     keyed on `HMAC("user:<id>")`. Never write this value to any table.
   - Update the module docstring's privacy design to say this.

3. **Enforce sign-in** (only when `account_required` is on) with `Depends(require_user)` on:
   `POST /reports`, report photo upload, posts (create/delete), votes, flags, subscriptions
   (get/put/delete), email alert sign-up, chat, `GET /me/export`, `DELETE /me`, and the new routes
   below. **Leave open:** `/health`, `/config`, the public read routes (services, resources,
   alerts, approved posts), the email unsubscribe link, and all `/admin/*` routes (they keep
   `require_admin`: passcode or `app_metadata.role = "admin"`).
   The app gates reading too; the API keeps reads open so the legal pages and offline errors work.

4. **`DELETE /me/account`** (new, rate-limited like `DELETE /me`, requires sign-in): run the
   existing `DELETE /me` logic for all `owners_from()` hashes, then delete the Supabase user with
   the service-role client (`auth.admin.delete_user(user_id)`). Return
   `{"receipt_id", "completed_at", "deleted", "account_deleted": true}`. If deleting the auth user
   fails, return 502 `account_delete_failed` after the data deletion, and log no email.
   Reports filed on another device cannot be found (by design); the response's `note` should say
   "Reports are not linked to your account; delete them from the device that sent them."

5. **`GET /me/export`:** when signed in, add an `account` object: `email`, `provider`
   (`google`/`email`), `created_at`, and `name` / `avatar_url` **if Supabase holds them** (Google
   users), since that is data we hold about the person. Update the `note` text: it currently says
   we do not store your name, which is untrue for Google sign-ins.

6. **`POST /me/consent`** (new, requires sign-in): body `{"kind": "account", "policy_version"}`;
   rejects a version that is not the current `POLICY_VERSION` (409 `policy_outdated`). Writes one
   `consent_records` row under the **install** hash. The app calls it once after first sign-in.

7. **`/config`:** add `"account_required": <bool>`.

8. **Database, `backend/database/schema.sql`:** add `'account'` to the `consent_records.kind`
   check constraint. Ship a migration for existing projects, e.g.
   `backend/database/migrations/2026-10-account-consent.sql`:
   ```sql
   alter table public.consent_records drop constraint if exists consent_records_kind_check;
   alter table public.consent_records add constraint consent_records_kind_check
     check (kind in ('report', 'post', 'email_alerts', 'account'));
   ```
   No new columns, no RLS changes: reports and private tables stay server-only.

9. **Policy version:** bump `POLICY_VERSION` and `POLICY_EFFECTIVE_DATE` in
   `shared/constants.ts` and `POLICY_VERSION` in `backend/settings.py` together, to the launch
   date. **Do this only when the owner confirms the date** (Claude has updated the text in
   `app/src/legal/content.ts`; it describes the account-required build).

10. **Start command:** add `--no-access-log` to uvicorn in the `Dockerfile` (the policy says we do
    not keep IP addresses; host access logs would contradict it).

11. **Tests** (`backend/tests/`), all with `ACCOUNT_REQUIRED` on unless stated:
    - each route in item 3 → 401 `sign_in_required` without a bearer, success with one;
    - with it **off**, the same routes work without a bearer (today's behavior);
    - a report, post and vote created with a bearer store the **install** hash, not the user hash;
    - per-account rate limit trips across two install tokens of the same user;
    - `DELETE /me/account` deletes rows and calls `auth.admin.delete_user` (mock it);
    - `/me/export` includes the `account` object; `POST /me/consent` rejects an old version;
    - admin role test: move `docs/handoff/test_admin_role.py` into `backend/tests/` (pending
      from `CODEX_ADMIN_ROLE_TEST.md`).

## Supabase settings (owner, dashboard; not code)

Google provider on; Email provider on with "Confirm email"; custom SMTP; Redirect URLs include
`https://<web-domain>/sign-in`. Details in `ACCOUNT_REQUIRED_PLAN.md` §1.
