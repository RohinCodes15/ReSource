# Environment variables

Every variable the project reads, in one place. All are optional: with none set, the API runs in local mode on the bundled data and the app talks to `http://localhost:8000`.

## API (`backend/.env`, or the host's settings page)

| Variable | Default | What it does | Secret? |
| --- | --- | --- | --- |
| `SUPABASE_URL` | empty | Project address. With `SUPABASE_SERVICE_ROLE_KEY`, switches the API from local files to Supabase. If set but unusable, the API refuses to start rather than fall back. | No |
| `SUPABASE_SERVICE_ROLE_KEY` | empty | Key that can read and write every table. Server only. | **Yes** |
| `SUPABASE_STORAGE_BUCKET` | `report-photos` | Private bucket for report photos | No |
| `ANTHROPIC_API_KEY` | empty | Anthropic API key (from console.anthropic.com). Turns on the general-purpose Claude assistant in chat. Without it chat uses basic search, a keyword lookup of the app's data. | **Yes** |
| `CLAUDE_MODEL` | `claude-sonnet-5` | Claude model used for chat. Any current Claude model ID works. | No |
| `CHAT_GLOBAL_DAILY_LIMIT` | `2000` | Most chat requests the API will serve in any 24 hours, across everyone. Must be a positive whole number. | No |
| `CHAT_DAILY_TOKEN_BUDGET` | `400000` | Most tokens (input plus output) Claude may use in any 24 hours, across everyone. When it is spent, chat answers in basic search mode until older usage ages out. 400,000 is about 300 answers, roughly $3 a day at Sonnet 5 prices. Must be a positive whole number. | No |
| `ADMIN_TOKEN` | empty | Passcode for Admin Tools and the CSV export. Empty means nobody can moderate. Use 32 or more random characters. | **Yes** |
| `OWNER_HASH_SALT` | derived | Secret used to hash install tokens. Set it once and never change it: changing it cuts every resident off from their own data. | **Yes** |
| `CORS_ORIGINS` | `http://localhost:8081,http://localhost:19006,http://localhost:3000` | Web addresses allowed to call the API, comma separated. Set to the deployed site's address. | No |
| `TRUST_PROXY` | `0` | Set to `1` only behind a proxy you control, so rate limits see the visitor's address. | No |
| `RATE_LIMIT_ENABLED` | `1` | `0` turns rate limits off. For tests only. | No |
| `LOCAL_STATE_DIR` | `backend/.local_state` | Where local mode keeps submissions | No |
| `DATA_DIR` | `shared/data` | Where local mode reads the bundled data | No |
| `PUBLIC_API_URL` | empty | The API's own public address, used to build unsubscribe links | No |
| `CONTACT_EMAIL` | empty | Contact address the API may show | No |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | empty (`587` for the port) | Reserved for email alerts. Email sign-up is switched off in the code, so these currently have no effect. | `SMTP_PASSWORD`: **Yes** |

The API also reads a `.env` file at the repository root, so `ANTHROPIC_API_KEY` and `ADMIN_TOKEN` may live there instead (this is what `docker-compose.yml` uses).

## App (`app/.env`, or the build host's settings)

Everything named `EXPO_PUBLIC_*` is compiled into the app and is visible to anyone. Never put a secret in one.

| Variable | Default | What it does |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` | Address of the API. On a phone, use the computer's network address or the deployed API. |
| `EXPO_PUBLIC_SUPABASE_URL` | empty | With the anon key, turns on optional sign-in (web only) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | empty | Supabase public key. Safe to ship: row-level security limits what it can read. |
| `EXPO_PUBLIC_MAP_TILE_URL` | OpenStreetMap's tile server | Tile address for the web map. Set to a hosted provider for real traffic. |
| `GOOGLE_MAPS_ANDROID_KEY` | empty | Build time only. Google Maps key for Android builds, restricted to the package `org.resource.fremont`. Without it an Android build shows the service list instead of the map. Keep it out of the repository; set it as an EAS secret. |

## Tests

| Variable | Used by | What it does |
| --- | --- | --- |
| `PYTHON` | `app/playwright.config.ts` | Python used to start the API for end-to-end tests. Defaults to `backend/.venv/bin/python`. |

## Minimum for a public deployment

API: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`, `OWNER_HASH_SALT`, `CORS_ORIGINS`, and `TRUST_PROXY=1` if the host puts a proxy in front. Add `ANTHROPIC_API_KEY` for Claude answers in chat, and set `CHAT_DAILY_TOKEN_BUDGET` to the most you are willing to spend a day.

App: `EXPO_PUBLIC_API_URL`.

Generate the two random secrets with:

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```
