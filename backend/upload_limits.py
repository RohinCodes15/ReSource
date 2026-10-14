"""Bound multipart photo bodies before Starlette parses or spools them."""
import tempfile

from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

MAX_UPLOAD_BODY_BYTES = 6 * 1024 * 1024  # 5 MiB image plus multipart fields and headers


class PhotoBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] != "http" or scope.get("method") != "POST" or not (path.startswith("/reports/") and path.endswith("/photo")):
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = -1
        if declared < 0 or declared > MAX_UPLOAD_BODY_BYTES:
            return await JSONResponse({"detail": "photo_too_large"}, status_code=413)(scope, receive, send)
        with tempfile.SpooledTemporaryFile(max_size=128 * 1024) as body:
            size = 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                size += len(chunk)
                if size > MAX_UPLOAD_BODY_BYTES:
                    return await JSONResponse({"detail": "photo_too_large"}, status_code=413)(scope, receive, send)
                await run_in_threadpool(body.write, chunk)
                if not message.get("more_body", False):
                    break
            await run_in_threadpool(body.seek, 0)
            remaining = size

            async def replay():
                nonlocal remaining
                chunk = await run_in_threadpool(body.read, 64 * 1024)
                remaining -= len(chunk)
                return {"type": "http.request", "body": chunk, "more_body": remaining > 0}

            await self.app(scope, replay, send)
