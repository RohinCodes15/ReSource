# ReSource

ReSource is a free app that helps Fremont, California residents see which city services changed with the city budget, find other places to get help, report how a change affects them, and contact their council members. It runs on the web, iOS and Android from one Expo codebase, with a FastAPI backend.

ReSource is an independent student project. It is not an official City of Fremont service, and the City has not reviewed or endorsed it. Budget facts come from City of Fremont public documents and resource listings come from each organization's own website; every item in the app shows its source and the date it was last checked. Confirm details with the organization before relying on them.

## Run it

Nothing needs to be configured. With no environment files the API serves the data bundled in `shared/data/`, keeps anything people submit in `backend/.local_state/`, and answers chat questions with a direct lookup of that data.

```sh
# 1. API
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 2. App (in a second terminal)
cd app
npm install
npx expo start        # press w for the web, or scan the code with Expo Go
```

On a physical phone, copy `app/.env.example` to `app/.env` and set `EXPO_PUBLIC_API_URL` to your computer's address on the local network, for example `http://192.168.1.20:8000`.

## Optional settings

Every setting is optional. `backend/.env.example` and `app/.env.example` list them all with a comment on each.

| To get | Set |
| --- | --- |
| Admin tools (moderating reports and posts, the CSV export) | `ADMIN_TOKEN` in `backend/.env` |
| General-purpose Claude answers in chat (otherwise chat uses basic search of the app's data) | `ANTHROPIC_API_KEY` in `backend/.env` |
| A hosted database in place of local files | `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`, after applying `backend/database/schema.sql`, `rls_policies.sql` and `seed.sql` |
| Sign-in by email link (web only) | `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `app/.env` |
| The map in an Android build | `GOOGLE_MAPS_ANDROID_KEY` at build time; without it an Android build shows the service list |

The service-role key and the admin token belong on the server only. Nothing in `app/.env` is secret: every `EXPO_PUBLIC_*` value ships inside the app.

Without `ADMIN_TOKEN` nobody can moderate, so reports stay "Waiting for review"; the app says so on the Admin screen.

## What is in the app

- **Budget Impact Map and Service Status**: the city services ReSource tracks, each marked open, reduced or closed, with its source.
- **Resource Finder**: food, clinics, housing, legal help, libraries and referral lines, sorted by distance.
- **Budget Transparency**: the figures behind the reductions, each linked to the City document it was read from.
- **Report an Impact and Community Impact**: residents describe how a change affects them; totals of the reports a moderator has verified are public.
- **Rep Tracker**: the mayor and council members, with contact details and a letter draft.
- **Ask ReSource**: a general-purpose Claude chat assistant, with a reminder to check Fremont facts in the sourced Budget and Resources tabs. With no AI key it falls back to a keyword search of the app's data.
- **Alerts and Community Board**: updates by topic and area, and short tips from neighbors.

No account is needed. Location stays on the device. Reports and posts are stored without a name, and "Delete my data" in Settings removes them from the server.

## Languages

English, Spanish, Dari, Chinese and Vietnamese, chosen in Settings or from the language button on Home. All five have the same strings in `app/src/locales/`. The translations were written by an AI model and have not yet been reviewed by native speakers. Budget figures, service descriptions and the full legal text are shown in English.

## Checks

```sh
cd app
npm run check                          # typecheck, lint, translations, contrast, alt text, storage, claims, unit tests
npm run build:web && npm run e2e       # end-to-end tests against the exported web build

cd backend
pip install -r requirements-dev.txt
python -m pytest
```

## Budget data scraper

`scraper/` holds three scripts that look for budget documents on fremont.gov, pull candidate cuts out of the PDFs, and preview an upload:

```sh
pip install -r scraper/requirements.txt
python scraper/scrape_budget.py
python scraper/parse_budget.py
python scraper/upload_to_supabase.py --dry-run
```

PDF extraction is a best guess, and on the current documents the parser finds no itemised service cuts. The data in the app was entered by hand from the source documents. Check any parser output against the source before it is published.

## Layout

| Folder | Contents |
| --- | --- |
| `app/` | The Expo app: screens in `src/app/`, translations in `src/locales/`, end-to-end tests in `e2e/` |
| `backend/` | The FastAPI service, its tests and the database schema |
| `shared/` | Data files and types used by both |
| `scraper/` | The budget document scripts |

## License

MIT. See `LICENSE`.
