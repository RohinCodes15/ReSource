# ReSource: first-deployment audit

Read-only review of the repo on 2026-10-16 (`main` plus the `admin-google-signin` PR). Nothing was
changed or deployed. Prices are rough, from memory, and change often: check each pricing page.

## 1. Config and secrets

### API (`backend/.env` locally; the host's secret settings in production)

| Variable | Secret? | Production value | Default today / risk |
|---|---|---|---|
| `SUPABASE_URL` | No | `https://<ref>.supabase.co` | Empty means local mode: data in a container file that is lost on redeploy |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes, the most sensitive** | From Supabase → API keys | Server only. Bypasses RLS |
| `SUPABASE_STORAGE_BUCKET` | No | `report-photos` | OK |
| `ADMIN_TOKEN` | **Yes** | Long random value, or empty if you retire the passcode | **Empty in your `.env`.** Safe (empty means no passcode access, not open access), but decide on purpose |
| `OWNER_HASH_SALT` | **Yes** | Long random value, never changed after launch | **Empty.** In Supabase mode it falls back to a hash of the service-role key, so **rotating that key would silently change every owner hash** (receipts, "delete my data", rate limits stop matching) |
| `CORS_ORIGINS` | No | Exactly `https://<web-domain>` | **Defaults to three `localhost` origins.** Not dangerous (credentials are off and `*` logs a warning), but the live site will fail until it is set |
| `TRUST_PROXY` | No | `1` behind Railway / Render / Fly | Default `0`: behind a proxy, every visitor would share one IP rate-limit bucket |
| `ANTHROPIC_API_KEY` | **Yes** | Optional | Empty means basic search mode, no cost |
| `CLAUDE_MODEL`, `CHAT_GLOBAL_DAILY_LIMIT` | No | Defaults are fine | The daily limit caps AI spend |
| `SMTP_*`, `EMAIL_FROM`, `PUBLIC_API_URL`, `CONTACT_EMAIL` | `SMTP_PASSWORD` is | Only if email alerts are wanted | Off unless all are set |

### Web app (build-time; the static host's environment settings)

| Variable | Secret? | Note |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | No | `https://<api-domain>`. Baked in at build time; changing it needs a rebuild |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | No (public by design) | **Needed for sign-in, including admin Google sign-in**, but missing from "Minimum for a public deployment" in `deployment/ENV.md` |

Everything `EXPO_PUBLIC_*` ends up in the JavaScript bundle. Never put a server secret there.

## 2. Hosting

**Web app.** `npm run build:web` (`expo export --platform web`) writes a static single-page site
to `app/dist`. Any static host works if unknown paths fall back to `index.html`.
`app/vercel.json` already sets this up, plus security headers. `deployment/web.Dockerfile` serves
it with `serve` for container hosts.

| Option | Rough cost | Notes |
|---|---|---|
| Vercel | Free (Hobby, non-commercial use); Pro about $20/month | Already configured (`app/vercel.json`) |
| Netlify | Free tier; Pro about $19/month | Needs a SPA redirect rule and the headers copied over |
| Cloudflare Pages | Free | Same: SPA fallback and headers need adding |

**API.** Python 3.12 (`Dockerfile`), FastAPI on uvicorn, port `$PORT` (default 8000), health check
`/health`. **One process, one instance:** rate limits, the chat cap and chat sessions live in
memory, so a second instance would double the limits, and a restart resets them. HTTPS comes from
the host's proxy (then set `TRUST_PROXY=1`). No separate process manager is needed: the host
restarts the container.

| Option | Rough cost | Notes |
|---|---|---|
| Railway | About $5/month (usage-based) | Already configured (`railway.toml`) |
| Render | Free tier sleeps after idle (cold start about 30 to 60 s, and limits reset); about $7/month always-on | Builds the Dockerfile directly |
| Fly.io | A few dollars a month for one small machine | Builds the Dockerfile directly; needs a `fly.toml` |

**Database.** Supabase (below). Free tier, or Pro at about $25/month.

## 3. Supabase readiness

- **RLS:** enabled on every table in `schema.sql` (checked: no table is missing). `anon` and
  `authenticated` lose all table rights first, then get back only reads on services, resources,
  alerts and approved posts. Reports and the private tables are admin-only or server-only.
- **Storage:** `report-photos` is created with `public = false`, JPEG only, 5 MB limit. The only
  read policy is admin-only. **Check in the dashboard** that it still shows as private, since a
  dashboard toggle overrides the SQL.
- **Run the SQL in production too:** `schema.sql`, `rls_policies.sql` and `seed.sql`, in order.
- **For the live domain, add:**
  - Supabase → Authentication → URL Configuration: Site URL = `https://<web-domain>`, and add
    `https://<web-domain>/sign-in` to Redirect URLs. Remove the `localhost` entries from the
    production project.
  - Google Cloud Console → OAuth client: add `https://<web-domain>` to Authorized JavaScript
    origins. The redirect URI stays the Supabase callback. Publish the OAuth consent screen
    ("In production"); in "Testing" only listed test users can sign in.
- **Free-tier limits that matter here:**
  - **Pausing:** a free project pauses after about a week without activity. A paused project means
    the API falls back to errors until someone restores it. A civic app with low traffic can hit
    this. Pro does not pause.
  - **Backups:** the free tier has no downloadable or point-in-time backups. Resident reports would
    have no restore path. Either use Pro (daily backups) or schedule your own `pg_dump`.
  - Size limits (about 500 MB database, 1 GB storage) are far above what this app will use.

## 4. Security and privacy

- **Rate limiting:** good. Every write route has per-IP and per-install limits (reports 5/hour,
  photos 10/hour, chat 12/min and 150/day, plus a global daily chat cap). Two gaps:
  - **The admin routes have no rate limit**, so the passcode can be guessed without slowing down.
    A long random `ADMIN_TOKEN` makes guessing impractical, but a per-IP limit on failed admin
    checks would be better (backend, Codex).
  - Limits are in memory, so they reset on every deploy or restart.
- **Photo location data:** good. `routers/contribute.py` decodes the image, applies the rotation,
  converts to RGB and re-saves as JPEG with no metadata, so GPS EXIF is dropped. A pixel limit
  guards against decompression bombs.
- **PII in logs:** the app's own log lines carry no emails, tokens, report text or IPs. But
  **uvicorn's access log is on**, so the host keeps a line per request with the client IP and
  path. The privacy notice says "We do not write IP addresses to our database", which is true, but
  host logs still hold IPs. Turn the access log off (`--no-access-log`) or describe host logs in
  the notice.
- **Admin passcode:** compared in constant time; held in memory in the app only. Weak points: it is
  shared, so it cannot be revoked per person, and actions are not attributed to anyone. Google
  admin accounts fix both (decision listed in `ADMIN_PRODUCTION_CHECKLIST.md`).
- **Web headers:** `app/vercel.json` sets a CSP, HSTS, `X-Frame-Options` and others. The CSP still
  allows `http://localhost:8000` and any `https:` origin in `connect-src`; tighten that to the
  API and Supabase domains.
- **Legal text no longer matching the code** (`app/src/legal/content.ts`):
  - Sign-in is described as "your email address, handled by our sign-in provider". With Google
    sign-in, **Google** is also involved and Supabase stores the name and profile picture Google
    sends. Google sign-in is not listed among the services.
  - "Nothing that identifies you is stored" while browsing: true for the database, not for the
    host's access logs (see above).
  - Who can see a report: the text says a moderator reviews reports; it does not say moderators
    can see the optional photo. Worth one sentence.

## 5. Priorities

**Must fix before launch**
1. Set `OWNER_HASH_SALT` to a fixed random value (you).
2. Set `CORS_ORIGINS` to the live web origin and `TRUST_PROXY=1` (you).
3. Make a decision on `ADMIN_TOKEN`: long random value, or empty to retire the passcode (you).
4. Supabase redirect URLs and Google origins for the live domain; publish the Google consent screen (you).
5. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` on the web build, or admin sign-in will not appear (you).
6. Update the privacy notice for Google sign-in (Claude, in `app/`).
7. A backup plan for resident data: Supabase Pro, or a scheduled `pg_dump` (you).

**Should fix**
1. Rate-limit failed admin checks (Codex, backend).
2. Turn off the uvicorn access log, or disclose host logs (Codex for the start command; Claude for the notice).
3. Tighten the CSP `connect-src` to the real API and Supabase origins (Claude, `app/vercel.json`).
4. Handle free-tier pausing: Pro, or a scheduled health check that touches the database (you).
5. Add `EXPO_PUBLIC_SUPABASE_*` to "Minimum for a public deployment" in `deployment/ENV.md` (Claude).
6. Move `test_admin_role.py` into `backend/tests/` (Codex).

**Nice to have**
1. Mention in the privacy notice that moderators can see report photos.
2. Record which admin changed a report's status (needs a column; Codex).
3. Shared storage for rate limits if you ever need more than one API instance.
