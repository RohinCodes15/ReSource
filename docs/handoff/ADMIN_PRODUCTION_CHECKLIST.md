# Admin sign-in: left to do before production

Nothing here is implemented yet. "You" is the person who runs the ReSource deployment.

| # | Task | Owner | Done when |
|---|---|---|---|
| 1 | **Set a fixed `OWNER_HASH_SALT`** in the production API environment: a long random value (for example `openssl rand -hex 32`), stored only in the host's secret settings. Without it the API generates its own, and if that changes, existing owner hashes (receipts, deletion requests, rate limits) stop matching. Never change it after launch. | You | The live API's environment has it set, and it is in no file in git |
| 2 | **Decide whether to retire the shared admin passcode** (`ADMIN_TOKEN`). Google admin accounts are tied to one person and can be revoked one at a time; a shared passcode cannot. Either keep it as a break-glass option with a long random value, or leave `ADMIN_TOKEN` empty in production so only admin accounts work. | You decide; Claude removes the passcode form from `app/` only if you choose to retire it | A written decision, and `ADMIN_TOKEN` set or empty to match |
| 3 | **Google and Supabase settings for the live domain.** Google Cloud Console → OAuth client: add the live site to *Authorized JavaScript origins*; the *Authorized redirect URI* stays the Supabase callback (`https://<project-ref>.supabase.co/auth/v1/callback`). Supabase → Authentication → URL Configuration: set *Site URL* to the live domain and add `https://<live-domain>/sign-in` to *Redirect URLs*. Also add the live domain to the API's `CORS_ORIGINS`. | You | Google sign-in works on the live site and returns to `/sign-in` |
| 4 | **Move `docs/handoff/test_admin_role.py` into `backend/tests/`**, as `CODEX_ADMIN_ROLE_TEST.md` describes, then delete it from `docs/handoff/`. | Codex | The test runs in the normal backend test suite and passes |
| 5 | **Grant the admin role** to each real admin with the SQL in `ADMIN_PR_DESCRIPTION.md` (1 row updated each), and only to people who should see residents' reports and photos. | You | Each admin sees "Open admin tools" after signing in again |
