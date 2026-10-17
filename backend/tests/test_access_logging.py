"""Application access logs retain request/status information without client addresses."""
import io
import logging

from uvicorn.logging import AccessFormatter


def test_uvicorn_access_log_redacts_ipv4_ipv6_and_drops_unknown_formats(client, monkeypatch):
    output = io.StringIO()
    handler = logging.StreamHandler(output)
    handler.setFormatter(AccessFormatter('%(client_addr)s - "%(request_line)s" %(status_code)s', use_colors=False))
    logger = logging.getLogger("uvicorn.access")
    monkeypatch.setattr(logger, "handlers", [handler])
    monkeypatch.setattr(logger, "level", logging.INFO)
    monkeypatch.setattr(logger, "disabled", False)
    monkeypatch.setattr(logger, "propagate", False)
    for address in ("203.0.113.42:54321", "[2001:db8::42]:54321"):
        logger.info('%s - "%s %s HTTP/%s" %d', address, "GET", "/health", "1.1", 200)
    logger.info("Unexpected client address: 203.0.113.99")
    rendered = output.getvalue()
    assert rendered.count('[redacted] - "GET /health HTTP/1.1" 200') == 2
    assert "203.0.113" not in rendered and "2001:db8" not in rendered
    assert "54321" not in rendered and "Unexpected" not in rendered
