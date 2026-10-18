# Deploy guide

How to put ReSource on the internet: the API on Railway, the web app on Vercel, the database on Supabase, and phone builds through EAS. Each of those is a choice, not a requirement; the files in this repository also work with any host that runs a Docker container and any host that serves static files.

Read `deployment/ENV.md` alongside this page. It lists every variable.

## What was and was not tested

| Piece | Tested? |
| --- | --- |
| The production web build (`npx expo export --platform web`) | Yes. The 44 end-to-end tests run against it. |
| The security headers in `app/vercel.json` | Yes, locally: the built site was served with the same headers and eight end-to-end tests, including every route at phone width, passed with no console errors. |
| The API in local mode | Yes. 138 backend tests, and the end-to-end tests use it. |
| `Dockerfile`, `deployment/web.Dockerfile`, `docker-compose.yml` | **No.** Docker was not installed on the machine these were written on. Treat the first `docker compose up --build` as the test. |
| Railway, Vercel, Supabase, EAS | **No.** Nothing was deployed. No accounts were created. |
| iOS and Android builds | **No.** |

## 0. Try it on one machine first

```sh
docker compose up --build
```

Web app at http://localhost:8080, API at http://localhost:8000/health. No accounts, no keys. Stop with Ctrl+C. Submissions are kept in a Docker volume named `resource-state`.

Without Docker, follow "Run it" in the README.

## 1. Database: Supabase

1. Create a project at supabase.com. Choose a region in the United States.
2. In the SQL editor, run these three files from `backend/database/` in order: `schema.sql`, `rls_policies.sql`, `seed.sql`.
3. In Storage, confirm a private bucket named `report-photos` exists (`schema.sql` creates it; create it by hand if it is missing, and keep it private).
4. From Project Settings, API, copy the project URL and the `service_role` key. The service-role key is a secret: it goes into the API host's settings and nowhere else.
5. Optional, for sign-in on the web: also copy the `anon` key, and under Authentication, URL Configuration, set the Site URL to the web app's address.

## 2. API: Railway

1. Create a project from the GitHub repository. Railway reads `railway.toml` and builds the `Dockerfile` at the repository root.
2. Set these variables (generate the two random values with `python -c "import secrets; print(secrets.token_urlsafe(48))"`):

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `ADMIN_TOKEN` | a random value; keep it private |
   | `OWNER_HASH_SALT` | a random value; never change it afterwards |
   | `CORS_ORIGINS` | the web app's address from step 3, for example `https://resource-fremont.vercel.app` |
   | `TRUST_PROXY` | `1` (Railway puts a proxy in front; read S4 in `docs/SECURITY.md`) |
   | `ANTHROPIC_API_KEY` | optional: an Anthropic API key from console.anthropic.com, for the Claude assistant in chat |
   | `CHAT_DAILY_TOKEN_BUDGET` | optional: daily token cap for Claude (default `400000`, about $3 a day) |

3. Generate a public domain for the service. Open `https://<that domain>/health`; it should answer `{"status":"ok","mode":"supabase",...}`. If it says `"mode":"local"`, the Supabase variables are missing. If the service will not start, the Supabase values are wrong: the API refuses to fall back to local files when they are set.
4. Keep the service at one instance.

Any host that runs a container works the same way: build the `Dockerfile`, set the variables, expose port 8000 (or set `PORT`).

## 3. Web app: Vercel

1. Import the repository. Set **Root Directory** to `app`, and leave "Include files outside of the Root Directory" on (the app imports `../shared`).
2. Vercel reads `app/vercel.json`: it builds with `npx expo export --platform web`, serves `dist`, sends unknown paths to `index.html`, and adds the security headers.
3. Set the environment variable `EXPO_PUBLIC_API_URL` to the API's address from step 2, with no trailing slash. It is compiled into the site, so redeploy after changing it.
4. Optional, for sign-in: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
5. Deploy, then go back to Railway and set `CORS_ORIGINS` to the exact address Vercel gave the site.

The Content-Security-Policy in `vercel.json` allows map images from `tile.openstreetmap.org` only. If you set `EXPO_PUBLIC_MAP_TILE_URL` to another tile provider, add that host to `img-src`.

## 4. Phone builds: EAS (optional)

The web app is enough for the contest. For phone builds:

1. `npm install --global eas-cli`, then `eas login` and, in `app/`, `eas init`.
2. Android map: create a Google Maps SDK for Android key restricted to the package `org.resource.fremont`, and store it with `eas env:create` as `GOOGLE_MAPS_ANDROID_KEY`. Without it the Android build shows the service list instead of the map.
3. Set `EXPO_PUBLIC_API_URL` for the build the same way.
4. `eas build --profile preview --platform android` gives an APK to install directly. `--profile production` builds for the stores.
5. Sign-in by email link is web only; the phone apps say so.

The bundle identifiers are `org.resource.fremont` on both platforms. Change them in `app/app.json` before a store submission if you want your own.

## 5. Smoke test after deploying

Do these on the deployed site, on a phone and on a computer.

1. Home loads, shows "independent student project", and the four counts are numbers.
2. "See my summary": enter 94538, choose Parks and Kids, "Show what changed". A reduction appears with a source link that opens a fremont.gov page. "Print my impact card" opens the print dialog.
3. Map shows pins; switch to List; open a service; "Find Alternative" opens Resource Finder with chips selected.
4. Ask ReSource: tap "Where can I get free food?" and get an answer that names TCV Food Bank, with sources.
5. Report an Impact: file a report; see the receipt.
6. More, Admin Tools: enter `ADMIN_TOKEN`; the report is listed; Verify it; Community Impact shows 1 verified report.
7. Settings: Download my data gives a file; Delete my data shows a receipt; the report is gone from Admin.
8. Settings: switch to Spanish, then Dari (layout mirrors), then back.
9. Turn on airplane mode and reload: the offline banner appears and screens still show content.
10. Open `https://<api>/health` and confirm `"mode":"supabase"`.

## Costs to expect

All four services have free tiers at the time of writing; check each one's current pricing page. The only usage-priced part is the Claude model (`claude-sonnet-5` by default). `CHAT_DAILY_TOKEN_BUDGET` (default 400,000 tokens a day, roughly $3) caps what it can spend; after that chat switches to basic search until older usage ages out. `CHAT_GLOBAL_DAILY_LIMIT` (default 2,000 requests a day) and the per-visitor limits cap how often people can ask. Leaving `ANTHROPIC_API_KEY` empty costs nothing.

## Rolling back

Vercel and Railway both keep earlier deployments; promote the previous one. The database is not touched by a redeploy.
