import time
import uuid
from typing import Any, Dict, List, Optional

import numpy as np
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import PyMongoError
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

from . import config

_client: Optional[MongoClient] = None



def client() -> MongoClient:
    global _client

    if _client is None:
        _client = MongoClient(
            config.MONGO_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            server_api=None,
        )

    return _client


def database():
    return client()[config.MONGO_DB]


def ping() -> bool:
    try:
        client().admin.command("ping")
        return True
    except PyMongoError:
        return False


def close_client() -> None:
    """Close the MongoDB client cleanly during application shutdown."""
    global _client

    if _client is not None:
        _client.close()
        _client = None


def init_db():
    """Validate MongoDB connectivity and initialize storage and indexes."""
    config.ensure_dirs()

    try:
        client().admin.command("ping")

        d = database()

        d.patients.create_index([("created_at", DESCENDING)])
        d.scans.create_index([("patient_id", ASCENDING)])
        d.measurements.create_index(
            [("patient_id", ASCENDING), ("created_at", DESCENDING)]
        )
        d.predictions.create_index(
            [("patient_id", ASCENDING), ("created_at", DESCENDING)]
        )
        d.casts.create_index([("patient_id", ASCENDING)])
        d.cast_versions.create_index(
            [("cast_id", ASCENDING), ("version", ASCENDING)],
            unique=True,
        )
        d.jobs.create_index(
            [("patient_id", ASCENDING), ("created_at", DESCENDING)]
        )
        d.job_events.create_index(
            [("job_id", ASCENDING), ("seq", ASCENDING)],
            unique=True,
        )
        d.validation_logs.create_index([("metric", ASCENDING)])
        d.audit.create_index(
            [("patient_id", ASCENDING), ("ts", DESCENDING)]
        )

    except PyMongoError as exc:
        close_client()
        raise RuntimeError(
            "MongoDB initialization failed. Check that MongoDB is running "
            "and ORTHOCAST_MONGO_URI and ORTHOCAST_DB are configured correctly."
        ) from exc


def drop_database():
    """Used by tests only."""
    client().drop_database(config.MONGO_DB)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def now() -> float:
    return time.time()


def clean(o: Any) -> Any:
    """Convert numpy types / NaN so documents are always BSON- and JSON-safe."""
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple, set)):
        return [clean(v) for v in o]
    if isinstance(o, np.ndarray):
        return clean(o.tolist())
    if isinstance(o, np.generic):
        return clean(o.item())
    if isinstance(o, float) and (o != o or o in (float("inf"), float("-inf"))):
        return None
    return o


def _out(d: Optional[dict]) -> Optional[dict]:
    if d is None:
        return None
    d = dict(d)
    d["id"] = d.pop("_id")
    return d


def insert(name: str, doc: Dict[str, Any]) -> dict:
    doc = clean(doc)
    doc["_id"] = doc.pop("id", None) or new_id(name[:3])
    doc.setdefault("created_at", now())
    database()[name].insert_one(doc)
    return _out(doc)


def get(name: str, _id: str) -> Optional[dict]:
    return _out(database()[name].find_one({"_id": _id}))


def find_one(name: str, filt: Optional[dict] = None, sort: Optional[list] = None) -> Optional[dict]:
    return _out(database()[name].find_one(filt or {}, sort=sort))


def find(name: str, filt: Optional[dict] = None, sort: Optional[list] = None,
         limit: int = 0, skip: int = 0) -> List[dict]:
    cur = database()[name].find(filt or {})
    if sort:
        cur = cur.sort(sort)
    if skip:
        cur = cur.skip(skip)
    if limit:
        cur = cur.limit(limit)
    return [_out(d) for d in cur]


def update(name: str, _id: str, fields: Dict[str, Any]) -> bool:
    r = database()[name].update_one({"_id": _id}, {"$set": clean(fields)})
    return r.matched_count > 0


def delete(name: str, filt: dict) -> int:
    return database()[name].delete_many(filt).deleted_count


def count(name: str, filt: Optional[dict] = None) -> int:
    return database()[name].count_documents(filt or {})


def insert_version(cast_id: str, doc: Dict[str, Any]) -> dict:
    """Insert the next cast version number atomically (unique index + retry)."""
    for _ in range(8):
        last = find_one("cast_versions", {"cast_id": cast_id}, sort=[("version", -1)])
        version = (last["version"] + 1) if last else 1
        try:
            return insert("cast_versions", {**doc, "cast_id": cast_id, "version": version})
        except DuplicateKeyError:
            continue
    raise RuntimeError("Could not allocate a cast version number")


def audit(patient_id: Optional[str], action: str, detail: Optional[dict] = None):
    insert("audit", {"ts": now(), "patient_id": patient_id, "action": action, "detail": detail or {}})