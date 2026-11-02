import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORAGE = Path(os.environ.get("ORTHOCAST_STORAGE", str(ROOT / "storage"))).resolve()
UPLOADS = STORAGE / "uploads"
ANNOTATED = STORAGE / "annotated"
CASTS = STORAGE / "casts"
PREVIEWS = STORAGE / "previews"
MODELS_DIR = Path(
    os.environ.get("ORTHOCAST_MODELS", str(ROOT / "app" / "ml" / "artifacts"))
).resolve()

MONGO_URI = os.environ.get("ORTHOCAST_MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("ORTHOCAST_DB", "orthocast")

DEFAULT_MARKER_MM = 50.0
CORS_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000",
]


def ensure_dirs():
    for d in (STORAGE, UPLOADS, ANNOTATED, CASTS, PREVIEWS, MODELS_DIR):
        d.mkdir(parents=True, exist_ok=True)