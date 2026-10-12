"""A polite HTTP client shared by every scraper script.

What "polite" means here:
  * robots.txt is fetched once per host and obeyed for every request;
  * requests to the same host are spaced out (default one second apart);
  * the User-Agent says who we are and why, and never imitates a browser;
  * failed requests are retried a few times with a growing pause;
  * responses are cached on disk, so re-running a script does not hit the site again;
  * every request is logged to scraper/logs/scraper.log.

Usage:
    from polite import PoliteClient
    client = PoliteClient()
    html = client.get_text("https://www.fremont.gov/residents")
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import requests

SCRAPER_DIR = Path(__file__).resolve().parent
CACHE_DIR = SCRAPER_DIR / "data" / "cache"
LOG_DIR = SCRAPER_DIR / "logs"

# Honest identification. fremont.gov's firewall rejects "name/1.0"-style strings with a 403.
USER_AGENT = "ReSource civic research project (student budget archive; contact via project README)"
DEFAULT_DELAY_SECONDS = 1.0
DEFAULT_RETRIES = 3
CACHE_MAX_AGE_SECONDS = 7 * 24 * 3600


class RobotsDisallowed(Exception):
    """The site's robots.txt does not allow this URL for our user agent."""


def get_logger() -> logging.Logger:
    logger = logging.getLogger("resource.scraper")
    if not logger.handlers:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
        for handler in (logging.FileHandler(LOG_DIR / "scraper.log", encoding="utf-8"), logging.StreamHandler()):
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


class PoliteClient:
    def __init__(
        self,
        delay_seconds: float = DEFAULT_DELAY_SECONDS,
        retries: int = DEFAULT_RETRIES,
        cache: bool = True,
        session: requests.Session | None = None,
    ) -> None:
        self.delay_seconds = delay_seconds
        self.retries = retries
        self.cache = cache
        self.session = session or requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.log = get_logger()
        self._robots: dict[str, RobotFileParser] = {}
        self._last_request: dict[str, float] = {}

    # ---- robots.txt -------------------------------------------------------------------------
    def _robots_for(self, url: str) -> RobotFileParser:
        parsed = urlparse(url)
        host = f"{parsed.scheme}://{parsed.netloc}"
        if host not in self._robots:
            parser = RobotFileParser()
            try:
                response = self.session.get(f"{host}/robots.txt", timeout=20)
                parser.parse(response.text.splitlines() if response.ok else [])
            except requests.RequestException:
                parser.parse([])  # unreachable robots.txt: nothing is disallowed
            self._robots[host] = parser
            self._last_request[parsed.netloc] = time.monotonic()
        return self._robots[host]

    def allowed(self, url: str) -> bool:
        return self._robots_for(url).can_fetch(USER_AGENT, url)

    # ---- cache ------------------------------------------------------------------------------
    @staticmethod
    def _cache_path(url: str) -> Path:
        return CACHE_DIR / "http" / (hashlib.sha256(url.encode("utf-8")).hexdigest()[:32] + ".json")

    def _read_cache(self, url: str) -> bytes | None:
        path = self._cache_path(url)
        if not self.cache or not path.exists() or time.time() - path.stat().st_mtime > CACHE_MAX_AGE_SECONDS:
            return None
        try:
            return bytes.fromhex(json.loads(path.read_text(encoding="utf-8"))["body_hex"])
        except (ValueError, KeyError):
            return None

    def _write_cache(self, url: str, body: bytes) -> None:
        if not self.cache:
            return
        path = self._cache_path(url)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"url": url, "fetched_at": time.time(), "body_hex": body.hex()}), encoding="utf-8")

    # ---- requests ---------------------------------------------------------------------------
    def _wait_turn(self, host: str) -> None:
        elapsed = time.monotonic() - self._last_request.get(host, 0.0)
        if elapsed < self.delay_seconds:
            time.sleep(self.delay_seconds - elapsed)
        self._last_request[host] = time.monotonic()

    def get_bytes(self, url: str, timeout: float = 30.0, max_bytes: int | None = None, validate=None) -> bytes:
        """Fetch `url`, obeying robots.txt, the per-host delay, retries and the cache.

        `validate(body)` may raise ValueError to reject a response that came back with HTTP 200
        but is not what was asked for (a firewall's "Request Rejected" page, for example).
        Rejected responses are never cached.
        """
        cached = self._read_cache(url)
        if cached is not None:
            self.log.info("cache hit %s", url)
            return cached
        if not self.allowed(url):
            self.log.warning("robots.txt disallows %s", url)
            raise RobotsDisallowed(url)

        host = urlparse(url).netloc
        last_error: Exception | None = None
        for attempt in range(1, self.retries + 1):
            self._wait_turn(host)
            try:
                response = self.session.get(url, timeout=timeout)
                if response.status_code in (429, 500, 502, 503, 504):
                    raise requests.HTTPError(f"HTTP {response.status_code}", response=response)
                response.raise_for_status()
                body = response.content
                if max_bytes is not None and len(body) > max_bytes:
                    raise ValueError(f"{url} is larger than {max_bytes} bytes")
                if validate is not None:
                    validate(body)
                self.log.info("fetched %s (%d bytes, attempt %d)", url, len(body), attempt)
                self._write_cache(url, body)
                return body
            except (requests.RequestException, ValueError) as exc:
                last_error = exc
                status = getattr(getattr(exc, "response", None), "status_code", None)
                self.log.warning("attempt %d failed for %s: %s", attempt, url, exc)
                # A 4xx other than 429 will not get better by asking again.
                if isinstance(exc, ValueError) or (status is not None and 400 <= status < 500 and status != 429):
                    break
                time.sleep(self.delay_seconds * (2 ** attempt))
        assert last_error is not None
        raise last_error

    def get_text(self, url: str, timeout: float = 30.0) -> str:
        return self.get_bytes(url, timeout=timeout).decode("utf-8", errors="replace")

    def get_json(self, url: str, timeout: float = 30.0):
        def must_be_json(body: bytes) -> None:
            json.loads(body.decode("utf-8", errors="replace"))  # raises ValueError if it is not JSON

        return json.loads(self.get_bytes(url, timeout=timeout, validate=must_be_json).decode("utf-8", errors="replace"))
