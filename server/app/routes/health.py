from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import config, db

router = APIRouter(tags=["System"])


@router.get("/api/health")
@router.get("/api/v1/health")
def health():
    mongo_ok = db.ping()

    return JSONResponse(
        status_code=200 if mongo_ok else 503,
        content={
            "status": "ok" if mongo_ok else "degraded",
            "service": "OrthoCast AI",
            "mongodb": "connected" if mongo_ok else "disconnected",
            "storage": "available" if config.STORAGE.exists() else "missing",
        },
    )
