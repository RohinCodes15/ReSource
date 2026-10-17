"""FastAPI app for ReSource, a civic-information project about Fremont's budget reductions.

Run it with no configuration at all:

    uvicorn main:app --reload --port 8000

That starts "local" mode (bundled data, writes kept in backend/.local_state). Set SUPABASE_URL
and SUPABASE_SERVICE_ROLE_KEY for live mode. See deployment/ENV.md for every variable.

Uvicorn access logs replace visitor IP addresses and ports with [redacted]. Hosting-provider
and reverse-proxy logs are independent and must be configured separately.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from access_logging import configure_access_logging
from routers import account, admin, chat, contribute, public
from security import signed_in_user
from settings import get_settings
from store import StoreError, get_store
from upload_limits import PhotoBodyLimit

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
configure_access_logging()
logger = logging.getLogger("resource.api")

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("ReSource API ready: data mode=%s, assistant=%s", get_store().mode, "ai" if settings.ai_enabled else "basic")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="ReSource API",
    description="Fremont city service status, community resources, impact reports and a grounded assistant. "
                "An independent student project, not a City of Fremont service.",
    version="1.0.0",
)

app.add_middleware(PhotoBodyLimit)

ACCOUNT_EXEMPT_PATHS = frozenset({"/health", "/config", "/privacy", "/terms", "/cookies"})


@app.middleware("http")
async def account_gate(request: Request, call_next):
    if (
        get_settings().account_required
        and request.method != "OPTIONS"  # CORS preflight carries no sign-in token.
        and request.url.path.rstrip("/") not in ACCOUNT_EXEMPT_PATHS
        and not await run_in_threadpool(signed_in_user, request)
    ):
        return JSONResponse(status_code=401, content={"detail": "sign_in_required"},
                            headers={"WWW-Authenticate": "Bearer"})
    return await call_next(request)


if "*" in settings.cors_origins:
    logger.warning("CORS_ORIGINS contains '*'; set it to the web app's exact origin before going live")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization", "X-Client-Token", "X-Admin-Token"],
    expose_headers=["Retry-After", "Content-Disposition"],
    max_age=600,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(StoreError)
async def store_error(_: Request, exc: StoreError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": "database_unavailable"})


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Field-level errors the app can show next to each input, without echoing what was typed."""
    errors = []
    for error in exc.errors():
        message = str(error.get("msg", "invalid")).removeprefix("Value error, ")
        errors.append({"field": ".".join(str(part) for part in error.get("loc", ()) if part != "body"), "message": message})
    return JSONResponse(status_code=422, content={"detail": "validation_error", "errors": errors})


for module in (public, contribute, account, admin, chat):
    app.include_router(module.router)

