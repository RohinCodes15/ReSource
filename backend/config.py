import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")
    if o.strip()
]

# Shared mock data lives one level up so the app and the API read the same files.
SHARED_DATA_DIR = Path(os.getenv("SHARED_DATA_DIR", Path(__file__).parent.parent / "shared" / "data"))

# Fremont City Hall
FREMONT_CENTER = (37.5485, -121.9886)
