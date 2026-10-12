"""Step 1 of 3: find Fremont budget pages and download the budget PDFs they link to.

Crawls https://www.fremont.gov starting from the home page, keeps every page whose text
mentions "budget", "fiscal", "cuts" or "reduction", and downloads the PDFs those pages link to.

Outputs (under scraper/data/):
    found_pages.json   every matching page: url, title, which keywords matched, its PDF links
    pdfs/              the downloaded PDFs, read next by parse_budget.py

Run:
    python scraper/scrape_budget.py
    python scraper/scrape_budget.py --max-pages 150 --max-pdfs 40

The crawl is polite on purpose: it obeys robots.txt, stays on fremont.gov, waits between
requests, and stops at --max-pages.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import deque
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.fremont.gov/"
ALLOWED_HOSTS = {"fremont.gov", "www.fremont.gov"}
DATA_DIR = Path(__file__).resolve().parent / "data"
PDF_DIR = DATA_DIR / "pdfs"
FOUND_PAGES_PATH = DATA_DIR / "found_pages.json"

# Identifies the scraper honestly. The site's firewall rejects "name/1.0"-style strings (403).
USER_AGENT = "ReSource civic research project (budget page archive)"
KEYWORDS = ("budget", "fiscal", "cuts", "reduction")
KEYWORD_RE = re.compile(r"\b(budget|fiscal|cuts|reduction)s?\b", re.I)
REQUEST_DELAY_SECONDS = 0.5
DEFAULT_MAX_PDF_MB = 40
# Skip links that are never HTML pages or budget documents.
DOCUMENT_RE = re.compile(r"/home/show(?:published)?document(?:/|\?id=)(\d+)", re.I)
SKIP_EXTENSIONS = re.compile(r"\.(jpe?g|png|gif|svg|webp|ico|css|js|zip|mp4|mp3|docx?|xlsx?|pptx?)$", re.I)


def clean_url(url: str) -> str:
    """Drop the #fragment so the same page is not visited twice."""
    return urldefrag(url)[0]


def on_site(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in ("http", "https") and parsed.netloc.lower() in ALLOWED_HOSTS


def document_id(url: str) -> str | None:
    """fremont.gov serves most files as /home/showpublisheddocument/<id> with no .pdf in the URL."""
    match = DOCUMENT_RE.search(url)
    return match.group(1) if match else None


def is_document(url: str) -> bool:
    return urlparse(url).path.lower().endswith(".pdf") or document_id(url) is not None


def matched_keywords(text: str) -> list[str]:
    found = {match.group(1).lower() for match in KEYWORD_RE.finditer(text)}
    return [word for word in KEYWORDS if word in found]


def pdf_file_name(url: str, label: str) -> str:
    doc_id = document_id(url)
    if doc_id:  # name the file after its link text, e.g. FY_2026_27_Adopted_Operating_Budget_21162.pdf
        slug = re.sub(r"[^A-Za-z0-9]+", "_", label).strip("_")[:80] or "document"
        return f"{slug}_{doc_id}.pdf"
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", urlparse(url).path.strip("/"))[-120:]
    return name if name.lower().endswith(".pdf") else f"{name or 'document'}.pdf"


def load_robots(session: requests.Session) -> RobotFileParser:
    robots = RobotFileParser()
    try:
        response = session.get(urljoin(BASE_URL, "/robots.txt"), timeout=20)
        robots.parse(response.text.splitlines() if response.ok else [])
    except requests.RequestException:
        robots.parse([])  # robots.txt unreachable: nothing is disallowed
    return robots


def download_pdf(session: requests.Session, url: str, label: str, max_mb: int) -> bool:
    target = PDF_DIR / pdf_file_name(url, label)
    if target.exists():
        return True
    try:
        with session.get(url, timeout=60, stream=True) as response:
            response.raise_for_status()
            if int(response.headers.get("content-length") or 0) > max_mb * 1024 * 1024:
                print(f"  skipped (larger than {max_mb} MB, raise --max-pdf-mb to include): {label or url}")
                return False
            content = response.content
            if not content.startswith(b"%PDF"):
                return False  # a Word/Excel file or an HTML page behind a document link
            target.write_bytes(content)
    except requests.RequestException as exc:
        print(f"  could not download {url}: {exc}")
        return False
    print(f"  saved PDF: {target.name}")
    return True


def crawl(max_pages: int, max_pdfs: int, max_pdf_mb: int = DEFAULT_MAX_PDF_MB) -> list[dict]:
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    robots = load_robots(session)

    queue: deque[str] = deque([BASE_URL])
    visited: set[str] = set()
    downloaded: set[str] = set()
    found_pages: list[dict] = []

    while queue and len(visited) < max_pages:
        url = queue.popleft()
        if url in visited or not robots.can_fetch(USER_AGENT, url):
            continue
        visited.add(url)
        try:
            response = session.get(url, timeout=20)
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"could not fetch {url}: {exc}")
            continue
        time.sleep(REQUEST_DELAY_SECONDS)
        if "html" not in response.headers.get("content-type", "").lower():
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        title = soup.title.get_text(strip=True) if soup.title else ""
        # Judge relevance on the main content when the page marks it, so a "Budget" link in
        # the site-wide navigation menu does not make every page look relevant.
        body = soup.find("main") or soup.find(id="main-content") or soup.body or soup
        keywords = matched_keywords(f"{url} {title} {body.get_text(' ', strip=True)}")

        pdf_links: dict[str, str] = {}  # url -> link text
        for link in soup.select("a[href]"):
            target = clean_url(urljoin(url, link["href"]))
            label = link.get_text(" ", strip=True)
            if not on_site(target) or SKIP_EXTENSIONS.search(urlparse(target).path):
                continue
            link_is_relevant = bool(KEYWORD_RE.search(f"{target} {label}"))
            if is_document(target):
                # Only documents whose own link text or URL mentions a keyword, so a budget
                # page full of unrelated reports does not pull all of them down.
                if link_is_relevant:
                    pdf_links.setdefault(target, label)
            elif target not in visited:
                # Follow budget-looking links first so the page limit is spent where it matters.
                if link_is_relevant:
                    queue.appendleft(target)
                else:
                    queue.append(target)

        if not keywords:
            continue
        print(f"found: {url}  [{', '.join(keywords)}]")
        found_pages.append({"url": url, "title": title, "keywords": keywords, "pdf_links": list(pdf_links)})
        for pdf_url, label in pdf_links.items():
            key = document_id(pdf_url) or pdf_url  # the same document is often linked twice
            if key in downloaded or len(downloaded) >= max_pdfs:
                continue
            if robots.can_fetch(USER_AGENT, pdf_url) and download_pdf(session, pdf_url, label, max_pdf_mb):
                downloaded.add(key)
            time.sleep(REQUEST_DELAY_SECONDS)

    print(f"\nVisited {len(visited)} pages, found {len(found_pages)} budget-related pages, "
          f"downloaded {len(downloaded)} PDFs.")
    return found_pages


def main() -> int:
    parser = argparse.ArgumentParser(description="Find Fremont budget pages and download linked PDFs.")
    parser.add_argument("--max-pages", type=int, default=80, help="stop after visiting this many pages (default 80)")
    parser.add_argument("--max-pdfs", type=int, default=25, help="download at most this many PDFs (default 25)")
    parser.add_argument("--max-pdf-mb", type=int, default=DEFAULT_MAX_PDF_MB,
                        help=f"skip PDFs larger than this many MB (default {DEFAULT_MAX_PDF_MB})")
    args = parser.parse_args()

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    found_pages = crawl(args.max_pages, args.max_pdfs, args.max_pdf_mb)
    FOUND_PAGES_PATH.write_text(json.dumps(found_pages, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {FOUND_PAGES_PATH}")
    print("Next: python scraper/parse_budget.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
