# Deploy steps: Vercel (web) + Railway (API)

Short version of `deployment/deploy_guide.md` for this decision, including admin Google sign-in.
Names only below; values go in each host's settings page, never in git.
`<api-domain>` and `<web-domain>` are the addresses Railway and Vercel give you (or your own).

## Order

1. Supabase (database ready) → 2. Railway (API) → 3. Vercel (web) → 4. back to Railway (CORS)
→ 5. Supabase Auth URLs → 6. Google Cloud → 7. grant admins → 8. smoke test.

The two hosts need each other's address, which is why Railway is visited twice.

## 1. Supabase

- SQL editor: run `backend/database/schema.sql`, `rls_policies.sql`, `seed.sql`, in that order
  (skip if this project already has them).
- Storage: `report-photos` exists and shows **private**.
- Copy from Project Settings → API: project URL, `anon` key (public), `service_role` key (secret,
  Railway only).
- Decide on backups (Pro plan or your own `pg_dump`); see `DEPLOYMENT_AUDIT.md`.

## 2. Railway (API)

- New project from the GitHub repo. `railway.toml` builds the root `Dockerfile`; nothing else to set.
  - Build: `docker build` of `Dockerfile` (Python 3.12, `pip install -r backend/requirements.txt`).
  - Start: `uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1` (from the Dockerfile).
  - Health check: `/health`. Keep **one** replica (rate limits live in memory).
- Variables:

  | Name | Secret | Notes |
  |---|---|---|
  | `SUPABASE_URL` | no | |
  | `SUPABASE_SERVICE_ROLE_KEY` | **yes** | |
  | `SUPABASE_STORAGE_BUCKET` | no | `report-photos` |
  | `OWNER_HASH_SALT` | **yes** | random, set once, never change |
  | `ADMIN_TOKEN` | **yes** | random, or leave unset to retire the passcode |
  | `CORS_ORIGINS` | no | set in step 4 |
  | `TRUST_PROXY` | no | `1` |
  | `ANTHROPIC_API_KEY` | **yes** | optional |
  | `CLAUDE_MODEL`, `CHAT_GLOBAL_DAILY_LIMIT` | no | optional; defaults are fine |

  Random values: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- Settings → Networking → generate a domain. Check `https://<api-domain>/health` shows
  `"mode":"supabase"`.

## 3. Vercel (web)

- Import the repo. **Root Directory:** `app`. Keep "Include files outside of the Root Directory" on
  (the app imports `../shared`).
- `app/vercel.json` sets the rest:
  - Build: `npx expo export --platform web` (same as `npm run build:web`).
  - Output: `dist`; unknown paths go to `index.html`; security headers added.
- Environment variables (all public, compiled into the site; redeploy after any change):

  | Name | Notes |
  |---|---|
  | `EXPO_PUBLIC_API_URL` | `https://<api-domain>`, no trailing slash |
  | `EXPO_PUBLIC_SUPABASE_URL` | needed for sign-in, including admin Google sign-in |
  | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the `anon` key, never `service_role` |

- Deploy and note `https://<web-domain>`.

## 4. Railway again

- `CORS_ORIGINS` = `https://<web-domain>` exactly (no trailing slash; comma-separate a custom
  domain and the `*.vercel.app` one if you use both). Railway redeploys on save.

## 5. Supabase → Authentication → URL Configuration

- **Site URL:** `https://<web-domain>`
- **Redirect URLs:** add `https://<web-domain>/sign-in`. Remove `localhost` entries if this is a
  production-only project.
- Sign In / Providers → Google: enabled, with Client ID and secret.

## 6. Google Cloud Console

- APIs & Services → Credentials → your OAuth client:
  - **Authorized JavaScript origins:** add `https://<web-domain>`.
  - **Authorized redirect URIs:** keep `https://<project-ref>.supabase.co/auth/v1/callback`
    (unchanged; Google returns to Supabase, which returns to `/sign-in`).
- OAuth consent screen: set the publishing status to **In production**. In "Testing", only listed
  test users can sign in. Settings can take a few minutes to apply.

## 7. Grant admins

- Each admin signs in once with Google on the live site, then run the SQL in
  `ADMIN_PR_DESCRIPTION.md` (must say **1 row**). They sign out and back in.

## 8. Smoke test

- `deployment/deploy_guide.md` section 5, plus `ADMIN_BROWSER_TEST.md` sections 1 to 4 on the
  live domain.
- Signed out, file a report with a photo: it works with no account, and an admin can open the photo.
