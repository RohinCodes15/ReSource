"""Step 3 of 3: load the parsed budget cuts into the Supabase `services` table.

Reads scraper/data/budget_cuts.json (from parse_budget.py) and upserts each record:
a service whose name already exists is updated, any other is inserted.

Needs two environment variables (put them in the project's .env file):
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY   server-side key; never ship it in the mobile app

Run:
    python scraper/upload_to_supabase.py            # show what would change, write nothing
    python scraper/upload_to_supabase.py --write    # write, after you checked every row by hand

The parser's output is a best guess from PDF text, and its map position is a City Hall
placeholder. Nothing here may reach the public table until a person has checked each row
against the source document, which is why writing has to be asked for.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

SCRAPER_DIR = Path(__file__).resolve().parent
JSON_PATH = SCRAPER_DIR / "data" / "budget_cuts.json"
TABLE = "services"
REQUIRED_FIELDS = ("name", "category", "status", "address", "lat", "lng")

# Look for credentials in scraper/.env, then backend/.env, then the project root .env.
for env_file in (SCRAPER_DIR / ".env", SCRAPER_DIR.parent / "backend" / ".env", SCRAPER_DIR.parent / ".env"):
    load_dotenv(env_file)


def connect() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example) before uploading.")
    return create_client(url, key)


def load_records() -> list[dict]:
    if not JSON_PATH.exists():
        raise SystemExit(f"{JSON_PATH} not found. Run scraper/parse_budget.py first.")
    records = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    valid = [r for r in records if all(r.get(field) not in (None, "") for field in REQUIRED_FIELDS)]
    if len(valid) < len(records):
        print(f"Ignoring {len(records) - len(valid)} records with missing required fields.")
    return valid


def main() -> int:
    parser = argparse.ArgumentParser(description="Upsert parsed budget cuts into Supabase.")
    parser.add_argument("--write", action="store_true", help="write to Supabase (default: only report what would change)")
    parser.add_argument("--dry-run", action="store_true", help="the default; kept so older commands still work")
    args = parser.parse_args()
    args.dry_run = args.dry_run or not args.write

    records = load_records()
    if not records:
        print("Nothing to upload.")
        return 0
    db = connect()

    # `services.id` is a text key with no default. Existing rows are matched by name; a new row
    # gets an id made from its name.
    existing = db.table(TABLE).select("id,name").execute().data or []
    id_by_name = {row["name"].strip().lower(): row["id"] for row in existing}

    inserted = updated = failed = 0
    for record in records:
        row_id = id_by_name.get(record["name"].strip().lower())
        action = "update" if row_id else "insert"
        if args.dry_run:
            print(f"would {action}: {record['name']} (cut ${record.get('cut_amount', 0):,})")
        else:
            try:
                if row_id:
                    db.table(TABLE).update(record).eq("id", row_id).execute()
                else:
                    slug = re.sub(r"[^a-z0-9]+", "-", record["name"].lower()).strip("-")[:48]
                    db.table(TABLE).insert({"id": f"svc-{slug}", **record}).execute()
            except Exception as exc:
                failed += 1
                print(f"failed to {action} {record['name']}: {exc}", file=sys.stderr)
                continue
        inserted += action == "insert"
        updated += action == "update"

    verb = "Would insert" if args.dry_run else "Inserted"
    print(f"\n{verb} {inserted}, {'would update' if args.dry_run else 'updated'} {updated}, "
          f"failed {failed}, out of {len(records)} records in `{TABLE}`.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
