"""S5/B19: reject oversized bodies and image dimensions before decoding."""
import inspect
import struct
import zlib

import pytest
from conftest import ALICE, report_body
from PIL import Image

from routers.contribute import attach_photo
from upload_limits import MAX_UPLOAD_BODY_BYTES, PhotoBodyLimit


def huge_png(width=9400, height=9400):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", b"") + chunk(b"IEND", b"")


@pytest.mark.parametrize("size", [(9400, 9400), (20000, 20000)])
def test_dimension_limit_before_decode(client, monkeypatch, size):
    report = client.post("/reports", json=report_body(), headers=ALICE).json()
    def forbidden(*args, **kwargs):
        pytest.fail("oversized image reached pixel decoding")
    monkeypatch.setattr(Image.Image, "load", forbidden)
    response = client.post(f"/reports/{report['id']}/photo", headers=ALICE,
                           files={"photo": ("huge.png", huge_png(*size), "image/png")})
    assert response.status_code == 413
    assert client.get("/reports/mine", headers=ALICE).json()[0]["has_photo"] is False


def test_declared_oversized_body_rejected(client):
    response = client.post("/reports/not-a-report/photo", headers={"Content-Length": str(MAX_UPLOAD_BODY_BYTES + 1)}, content=b"x")
    assert response.status_code == 413


def test_chunked_body_limited_without_content_length():
    import asyncio

    called = []
    sent = []
    messages = iter([{"type": "http.request", "body": b"x" * (3 * 1024 * 1024), "more_body": True}] * 3)
    async def downstream(*args):
        called.append(True)
    async def receive():
        return next(messages)
    async def send(message):
        sent.append(message)
    scope = {"type": "http", "method": "POST", "path": "/reports/x/photo", "headers": []}
    asyncio.run(PhotoBodyLimit(downstream)(scope, receive, send))
    assert not called
    assert sent[0]["status"] == 413


def test_upload_runs_in_worker_thread():
    assert not inspect.iscoroutinefunction(attach_photo)
