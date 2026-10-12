"""Step 2 of 3: turn the downloaded budget PDFs into structured budget-cut records.

Reads every PDF in scraper/data/pdfs/ (from scrape_budget.py), pulls out tables and text
lines that describe a cut, and cleans them with pandas.

Outputs (under scraper/data/):
    budget_cuts.csv    columns: service, department, original_budget, new_budget,
                       cut_amount, cut_percent, effective_date, status
    budget_cuts.json   the same cuts shaped as rows for the Supabase `services` table,
                       read next by upload_to_supabase.py

Run:
    python scraper/parse_budget.py

IMPORTANT: budget PDFs are laid out for people, not programs. This extraction is a best
guess. Read budget_cuts.csv against the source PDFs before publishing any number.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd
import pdfplumber

DATA_DIR = Path(__file__).resolve().parent / "data"
PDF_DIR = DATA_DIR / "pdfs"
CSV_PATH = DATA_DIR / "budget_cuts.csv"
JSON_PATH = DATA_DIR / "budget_cuts.json"

CSV_COLUMNS = ["service", "department", "original_budget", "new_budget",
               "cut_amount", "cut_percent", "effective_date", "status"]

# Budget documents rarely give a street address, so rows default to Fremont City Hall.
# Edit address/lat/lng in Supabase when a cut belongs to a specific facility.
DEFAULT_ADDRESS = "3300 Capitol Ave, Fremont, CA 94538"
DEFAULT_LAT, DEFAULT_LNG = 37.5485, -121.9886

# Which table column holds what, judged by its header text. First matching rule wins.
HEADER_RULES = [
    ("department", r"department|dept|division"),
    ("cut_amount", r"reduction|savings|cut\b|decrease|change|variance|difference"),
    ("new_budget", r"proposed|recommended|revised|new\b|adopted\s+fy|next year"),
    ("original_budget", r"adopted|current|original|prior|baseline|actual|estimated"),
    ("service", r"service|program|description|item|proposal|activity|title"),
]
ACTION_RE = re.compile(r"eliminat|reduc|suspend|clos(e|ed|ing|ure)|cut\b|cuts\b|defund|discontinu|cancel|freez", re.I)
# Lines about money coming in (taxes, fees, grants) are not service cuts.
REVENUE_RE = re.compile(r"revenue|\btax(es)?\b|\bfees?\b|overpayment|grant\b|reimburse|interest income", re.I)
CLOSED_RE = re.compile(r"eliminat|clos(e|ed|ing|ure)|discontinu|cancel|defund", re.I)
MONEY_RE = re.compile(r"\(?-?\$?\s?\d[\d,]*(?:\.\d+)?\)?\s*(?:million|thousand|[mk]\b)?", re.I)
DOLLAR_RE = re.compile(r"\(?-?\$\s?\d[\d,]*(?:\.\d+)?\)?\s*(?:million|thousand|[mk]\b)?", re.I)
MULTIPLIERS = {"million": 1_000_000, "m": 1_000_000, "thousand": 1_000, "k": 1_000}

# The Supabase `services.category` column only accepts these five values.
CATEGORY_RULES = [
    ("library", r"librar"),
    ("transit", r"transit|\bbus\b|shuttle|paratransit|transport"),
    ("health", r"health|clinic|senior|human services|homeless|mental|wellness"),
    ("education", r"school|education|youth|after.?school|child|tutor|literacy"),
    ("recreation", r"recreation|park|pool|aquatic|community center|sport|camp|playground"),
]
DEPARTMENT_RULES = [
    ("Library", r"librar"),
    ("Community Services", r"recreation|park|pool|aquatic|community center|camp"),
    ("Human Services", r"human services|senior|homeless|youth|family"),
    ("Public Works", r"public works|street|transit|transport|maintenance"),
    ("Police", r"police"),
    ("Fire", r"\bfire\b"),
]
MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], start=1)}


def clean_text(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip(" -:;•·")


def parse_money(value) -> float | None:
    """'$1,234', '(450,000)', '1.2 million', '-$3k' -> a positive number of dollars."""
    match = MONEY_RE.search(str(value or ""))
    if not match:
        return None
    raw = match.group(0).lower()
    digits = re.search(r"\d[\d,]*(?:\.\d+)?", raw)
    if not digits:
        return None
    amount = float(digits.group(0).replace(",", ""))
    unit = re.search(r"million|thousand|[mk]\b", raw)
    return abs(amount * MULTIPLIERS.get(unit.group(0), 1) if unit else amount)


def first_match(text: str, rules: list[tuple[str, str]], default: str = "") -> str:
    return next((name for name, pattern in rules if re.search(pattern, text, re.I)), default)


def find_effective_date(page_text: str) -> str:
    """ISO date from 'July 1, 2026', or July 1 of the first year in 'FY 2026-27'. '' if none."""
    match = re.search(r"\b([A-Z][a-z]+)\s+(\d{1,2}),\s*(20\d{2})\b", page_text)
    if match and match.group(1).lower() in MONTHS:
        return f"{match.group(3)}-{MONTHS[match.group(1).lower()]:02d}-{int(match.group(2)):02d}"
    match = re.search(r"\b(?:FY|fiscal year)\s*(20\d{2})\s*[-/–]\s*\d{2,4}", page_text, re.I)
    return f"{match.group(1)}-07-01" if match else ""


def rows_from_table(table: list[list], page_text: str, source: str) -> list[dict]:
    rows = [[clean_text(cell) for cell in row] for row in table if row]
    rows = [row for row in rows if any(row)]
    if len(rows) < 2:
        return []
    columns: dict[str, int] = {}
    for index, header in enumerate(rows[0]):
        field = first_match(header, HEADER_RULES)
        if field and field not in columns:
            columns[field] = index
    money_fields = [f for f in ("original_budget", "new_budget", "cut_amount") if f in columns]
    if "service" not in columns or not money_fields:
        return []  # not a table of services and dollar amounts

    def cell(row: list[str], field: str) -> str:
        index = columns.get(field)
        return row[index] if index is not None and index < len(row) else ""

    records = []
    for row in rows[1:]:
        service = cell(row, "service")
        if not service or re.fullmatch(r"(sub)?total.*", service, re.I):
            continue
        records.append({
            "service": service,
            "department": cell(row, "department"),
            "original_budget": parse_money(cell(row, "original_budget")),
            "new_budget": parse_money(cell(row, "new_budget")),
            "cut_amount": parse_money(cell(row, "cut_amount")),
            "effective_date": find_effective_date(page_text),
            "evidence": " | ".join(row),
            "source": source,
        })
    return records


def rows_from_text(page_text: str, source: str) -> list[dict]:
    """Fallback for pages with no usable table: lines that name a cut and a dollar amount."""
    records = []
    for line in page_text.splitlines():
        line = clean_text(line)
        amounts = [parse_money(m.group(0)) for m in DOLLAR_RE.finditer(line)]
        amounts = [a for a in amounts if a]
        if not amounts or not ACTION_RE.search(line) or REVENUE_RE.search(line):
            continue
        service = clean_text(DOLLAR_RE.split(line)[0])
        service = re.sub(r"\b(saving|savings|of|for|by|from|to|at|totaling)$", "", service, flags=re.I).strip(" ,-")
        if len(service) < 8:
            continue
        two = len(amounts) >= 2
        records.append({
            "service": service,
            "department": "",
            "original_budget": max(amounts[:2]) if two else None,
            "new_budget": min(amounts[:2]) if two else None,
            "cut_amount": None if two else amounts[0],
            "effective_date": find_effective_date(page_text),
            "evidence": line,
            "source": source,
        })
    return records


def extract_pdf(path: Path) -> list[dict]:
    records: list[dict] = []
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            source = f"{path.name} p.{page_number}"
            page_text = page.extract_text() or ""
            table_rows: list[dict] = []
            for table in page.extract_tables() or []:
                table_rows.extend(rows_from_table(table, page_text, source))
            records.extend(table_rows or rows_from_text(page_text, source))
    return records


def build_dataframe(records: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(records)
    for column in ("original_budget", "new_budget", "cut_amount"):
        df[column] = pd.to_numeric(df[column], errors="coerce")

    # Fill in whichever of the three dollar figures can be derived from the other two.
    df["cut_amount"] = df["cut_amount"].fillna(df["original_budget"] - df["new_budget"])
    df["new_budget"] = df["new_budget"].fillna(df["original_budget"] - df["cut_amount"])
    df["original_budget"] = df["original_budget"].fillna(df["new_budget"] + df["cut_amount"])
    df = df[df["cut_amount"].notna() & (df["cut_amount"] > 0)].copy()

    df["cut_percent"] = (df["cut_amount"] / df["original_budget"] * 100).where(df["original_budget"] > 0).round(1)
    df["department"] = df.apply(
        lambda r: r["department"] or first_match(f"{r['service']} {r['evidence']}", DEPARTMENT_RULES), axis=1)
    df["status"] = df.apply(
        lambda r: "closed" if (r["cut_percent"] >= 100 or CLOSED_RE.search(f"{r['service']} {r['evidence']}"))
        else "reduced", axis=1)
    df["service"] = df["service"].str.slice(0, 160)
    df = df.drop_duplicates(subset=["service", "cut_amount"]).sort_values("cut_amount", ascending=False)
    return df.reset_index(drop=True)


def to_supabase_rows(df: pd.DataFrame) -> tuple[list[dict], int]:
    """Rows for the `services` table. Returns (rows, number skipped for lack of a category)."""
    rows, skipped = [], 0
    for record in df.to_dict(orient="records"):
        category = first_match(f"{record['service']} {record['department']} {record['evidence']}", CATEGORY_RULES)
        if not category:
            skipped += 1  # the table only allows five categories; this cut fits none of them
            continue
        details = [f"Budget {record['status']}."]
        if record["department"]:
            details.append(f"Department: {record['department']}.")
        if pd.notna(record["original_budget"]) and pd.notna(record["new_budget"]):
            details.append(f"Budget ${record['original_budget']:,.0f} to ${record['new_budget']:,.0f}.")
        details.append(f"Extracted from {record['source']}; verify against the source document.")
        rows.append({
            "name": record["service"],
            "category": category,
            "status": record["status"],
            "address": DEFAULT_ADDRESS,
            "lat": DEFAULT_LAT,
            "lng": DEFAULT_LNG,
            "description": " ".join(details),
            "cut_amount": int(round(record["cut_amount"])),
            "effective_date": record["effective_date"] or None,
        })
    return rows, skipped


def main() -> int:
    pdfs = sorted(PDF_DIR.glob("*.pdf")) if PDF_DIR.exists() else []
    if not pdfs:
        print(f"No PDFs found in {PDF_DIR}. Run scraper/scrape_budget.py first.", file=sys.stderr)
        return 1

    records: list[dict] = []
    for pdf in pdfs:
        try:
            found = extract_pdf(pdf)
            print(f"{pdf.name}: {len(found)} candidate rows")
            records.extend(found)
        except Exception as exc:  # one unreadable PDF should not stop the rest
            print(f"skipped {pdf.name}: {exc}", file=sys.stderr)
    if not records:
        print("No budget cuts could be extracted from the PDFs.", file=sys.stderr)
        return 1

    df = build_dataframe(records)
    if df.empty:
        print("Rows were found but none had a usable cut amount.", file=sys.stderr)
        return 1

    df[CSV_COLUMNS].to_csv(CSV_PATH, index=False)
    rows, skipped = to_supabase_rows(df)
    JSON_PATH.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"\nWrote {len(df)} cuts to {CSV_PATH}")
    print(f"Wrote {len(rows)} Supabase rows to {JSON_PATH}"
          + (f" ({skipped} left out: no matching service category)" if skipped else ""))
    print("Review the CSV against the PDFs, then: python scraper/upload_to_supabase.py --dry-run")
    return 0


if __name__ == "__main__":
    sys.exit(main())
