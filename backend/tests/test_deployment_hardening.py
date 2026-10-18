"""Deployment security defaults."""
import importlib

from fastapi.testclient import TestClient

from settings import get_settings


def test_api_docs_are_disabled_in_production_and_restored_for_local(env):
    import main

    env.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    production = importlib.reload(main)
    try:
        with TestClient(production.app) as api:
            assert api.get("/docs").status_code == 404
            assert api.get("/redoc").status_code == 404
            assert api.get("/openapi.json").status_code == 404
    finally:
        env.setenv("APP_ENV", "local")
        get_settings.cache_clear()
        importlib.reload(main)
