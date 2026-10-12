"""Generate backend/database/seed.sql from the JSON in shared/data.

shared/data is the single source of truth for catalog data. Local mode reads it directly;
this script turns the same files into SQL for a Supabase project, so the two never drift.

Run from the repo root:
    python backend/scripts/build_seed.py            # rewrite seed.sql
    python backend/scripts/build_seed.py --check    # exit 1 if seed.sql is out of date (CI)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_DIR / "shared" / "data"
SEED_PATH = REPO_DIR / "backend" / "database" / "seed.sql"

# table -> columns, in the order they are written. Must match backend/database/schema.sql.
TABLES: dict[str, list[str]] = {
    "services": ["id", "name", "category", "status", "area", "address", "location_note", "lat", "lng", "coords",
                 "phone", "hours", "summary", "detail", "cut_amount", "cut_amount_note", "effective_date",
                 "updated_at", "action_label", "action_url", "alt_categories", "source_title", "source_url",
                 "retrieved", "verified"],
    "resources": ["id", "name", "category", "area", "address", "lat", "lng", "coords", "phone", "website", "hours",
                  "description", "languages", "language_note", "source_url", "retrieved", "verified"],
    "alerts": ["id", "title", "body", "category", "area", "severity", "published_at", "service_id", "source_title",
               "source_url", "retrieved", "verified"],
    "posts": ["id", "body", "area", "upvotes", "status", "is_sample", "created_at"],
}


def literal(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, list):
        if not value:
            return "'{}'::text[]"
        return "array[" + ", ".join(literal(item) for item in value) + "]::text[]"
    return "'" + str(value).replace("'", "''") + "'"


def build() -> str:
    out = [
        "-- GENERATED FILE. Do not edit by hand: change shared/data/*.json, then run",
        "--   python backend/scripts/build_seed.py",
        "-- Run after schema.sql and rls_policies.sql. Safe to run again (rows are upserted by id).",
        "",
    ]
    for table, columns in TABLES.items():
        rows = json.loads((DATA_DIR / f"{table}.json").read_text(encoding="utf-8"))
        out.append(f"insert into public.{table}\n  ({', '.join(columns)})\nvalues")
        out.append(",\n".join("  (" + ", ".join(literal(row.get(column)) for column in columns) + ")" for row in rows))
        updates = ", ".join(f"{column} = excluded.{column}" for column in columns if column != "id")
        out.append(f"on conflict (id) do update set\n  {updates};\n")
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate seed.sql from shared/data.")
    parser.add_argument("--check", action="store_true", help="fail if seed.sql does not match shared/data")
    args = parser.parse_args()
    sql = build()
    if args.check:
        if not SEED_PATH.exists() or SEED_PATH.read_text(encoding="utf-8") != sql:
            print("backend/database/seed.sql is out of date. Run: python backend/scripts/build_seed.py", file=sys.stderr)
            return 1
        print("seed.sql matches shared/data")
        return 0
    SEED_PATH.write_text(sql, encoding="utf-8")
    print(f"Wrote {SEED_PATH.relative_to(REPO_DIR)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
