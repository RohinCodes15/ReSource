# ReSource

ReSource is an Expo app for helping Fremont residents navigate local services and community support. The service changes, alerts, posts, and council vote examples in this demo are illustrative and are not official city notices or vote records. Verify current service details with the listed organization or the City of Fremont before relying on them.

## Run the mobile app

```sh
cd app
npm install
npx expo start
```

For a physical phone, set `EXPO_PUBLIC_API_URL` to the development computer's LAN address, for example `http://192.168.1.20:8000`. Android emulators use `http://10.0.2.2:8000`; iOS simulators use `http://localhost:8000`.

## Run the API

```sh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API serves `/services`, `/services/{id}`, `/resources`, `/report`, `/chat`, and `/stats`. Copy the root `.env.example` to `.env` and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ANTHROPIC_API_KEY`. Apply `backend/database/schema.sql` and then `backend/database/seed.sql` in the Supabase SQL editor. Keep the service-role key on the server only. Claude chat uses the separate `ANTHROPIC_API_KEY`; `OPENAI_API_KEY` is included in the environment template as requested, but is not used by the Claude route. Copy `app/.env.example` to `app/.env` for Expo's public variables.

## AI chat

`POST /chat` lives in `backend/routers/chat.py`. Each request carries the conversation so far and the resident's language:

```json
{
  "messages": [{ "role": "user", "content": "¿Dónde puedo conseguir comida gratis?" }],
  "language": "es",
  "latitude": 37.55,
  "longitude": -121.98
}
```

- `messages` is the whole chat session, oldest first, ending with the new user message. This is how the assistant remembers earlier turns. The older `message` + `history` shape is still accepted.
- `language` is one of `en`, `es`, `fa` (Dari), `zh` (Mandarin), `vi`. The assistant replies in it.
- The system prompt is built from the `services` and `resources` tables in Supabase. Without Supabase it uses the sample files in `backend/data/` and tells the resident the data is a sample.
- The model is set by `CLAUDE_MODEL` (default `claude-opus-5-5`). Without `ANTHROPIC_API_KEY` the route returns 503.

## Languages

The app is available in English, Spanish, Dari, Mandarin and Vietnamese. Pick a language with the flag button in the Home header.

- Strings: `app/locales/en.json`, `es.json`, `fa.json`, `zh.json`, `vi.json` (same keys in each).
- Hook: `useTranslation()` from `app/lib/i18n.ts` returns `t('home.tagline')`, the current `language`, and `isRTL` (true for Dari).
- Translated so far: the tab bar, screen titles, Home, and AI Chat. The other screens still show English; their strings are already in the locale files under `report`, `resources`, `alerts`, `reps`, and `community`.
- The translations were machine-written. Have a native speaker review them, Dari especially, before release.

## Budget data scraper

Three scripts, run in order:

```sh
pip install -r scraper/requirements.txt
python scraper/scrape_budget.py             # 1. find budget pages, download budget PDFs
python scraper/parse_budget.py              # 2. extract cuts into CSV and JSON
python scraper/upload_to_supabase.py --dry-run   # 3. preview, then run without --dry-run
```

| Script | Reads | Writes |
| --- | --- | --- |
| `scrape_budget.py` | fremont.gov pages mentioning budget, fiscal, cuts, reduction | `scraper/data/found_pages.json`, `scraper/data/pdfs/` |
| `parse_budget.py` | `scraper/data/pdfs/*.pdf` | `scraper/data/budget_cuts.csv`, `scraper/data/budget_cuts.json` |
| `upload_to_supabase.py` | `scraper/data/budget_cuts.json` | rows in the Supabase `services` table |

- The crawler obeys `robots.txt`, waits between requests, and stops at `--max-pages` (default 80). PDFs over `--max-pdf-mb` (default 40) are skipped; the full adopted budget book is larger than that.
- The CSV columns are `service, department, original_budget, new_budget, cut_amount, cut_percent, effective_date, status`.
- The upload matches existing services by name: matches are updated, the rest inserted. It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- PDF extraction is a best guess. Check `budget_cuts.csv` against the source documents before uploading or publishing any figure. On the budget presentation and mid-year report the parser currently finds no itemised service cuts.
