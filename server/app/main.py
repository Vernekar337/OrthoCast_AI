from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config, db
from .errors import ApiError
from .schemas import PatientIn, PatientPatch, MeasurementIn
from app.routes.casts import router as casts_router
from app.routes.health import router as health_router
from app.routes.pipeline import router as pipeline_router
from app.routes.jobs import router as jobs_router
from app.routes.scans import router as scans_router
from app.routes.validation import router as validation_router



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Do not start serving requests unless MongoDB initializes successfully.
    db.init_db()

    try:
        yield
    finally:
        db.close_client()



app = FastAPI(
    title="OrthoCast AI API",
    description="Backend API for the OrthoCast AI clinical prototype.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register feature routers
app.include_router(health_router)
app.include_router(casts_router)
app.include_router(pipeline_router)
app.include_router(jobs_router)
app.include_router(scans_router)
app.include_router(validation_router)


@app.exception_handler(ApiError)
async def handle_api_error(request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status,
        content={
            "error": exc.code,
            "message": exc.message,
            "hint": exc.hint,
        },
    )


@app.get("/")
def root():
    return {
        "name": "OrthoCast AI API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/v1/meta")
@app.get("/api/meta")
def metadata():
    return {
        "name": "OrthoCast AI",
        "version": "0.1.0",
        "database": "MongoDB",
        "parameter_limits": {
            "station_diameter_mm": {"min": 20, "max": 220},
            "total_length_mm": {"min": 60, "max": 600},
            "wall_thickness_mm": {"min": 2.0, "max": 10.0},
            "vent_hole_mm": {"min": 3, "max": 16},
            "vent_spacing_mm": {"min": 8, "max": 50},
            "seam_angle_deg": {"min": 0, "max": 180},
            "tab_count": {"min": 0, "max": 6},
            "vent_patterns": ["grid", "staggered"],
        },
    }


@app.get("/api/v1/dashboard/stats")
@app.get("/api/dashboard/stats")
def dashboard_stats():
    return {
        "total_patients": db.count("patients"),
        "total_scans": db.count("scans"),
        "total_predictions": db.count("predictions"),
        "total_casts": db.count("casts"),
        "active_jobs": db.count(
            "jobs", {"status": {"$in": ["queued", "running", "processing"]}}
        ),
        "recent_patients": db.find(
            "patients", sort=[("created_at", -1)], limit=5
        ),
    }



@app.post("/api/v1/patients", status_code=201)
@app.post("/api/patients", status_code=201)
def create_patient(payload: PatientIn):
    data = payload.model_dump()
    data["name"] = data["name"].strip()

    if not data["name"]:
        raise HTTPException(
            status_code=422,
            detail="Patient name cannot be empty",
        )

    data["updated_at"] = db.now()

    patient = db.insert("patients", data)
    db.audit(patient["id"], "patient_created")

    # Keep the existing response format for frontend compatibility.
    return patient



@app.get("/api/v1/patients")
@app.get("/api/patients")
def list_patients(
    search: Optional[str] = Query(default=None, max_length=80),
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
):
    filters = {}
    if search and search.strip():
        filters["name"] = {"$regex": search.strip(), "$options": "i"}

    return {
        "items": db.find(
            "patients",
            filters,
            sort=[("created_at", -1)],
            limit=limit,
            skip=skip,
        ),
        "total": db.count("patients", filters),
        "limit": limit,
        "skip": skip,
    }


@app.get("/api/v1/patients/{patient_id}")
@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: str):
    patient = db.get("patients", patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "patient": patient,
        "scans": db.find(
            "scans", {"patient_id": patient_id},
            sort=[("created_at", -1)]
        ),
        "measurements": db.find(
            "measurements", {"patient_id": patient_id},
            sort=[("created_at", -1)]
        ),
        "predictions": db.find(
            "predictions", {"patient_id": patient_id},
            sort=[("created_at", -1)]
        ),
        "casts": db.find(
            "casts", {"patient_id": patient_id},
            sort=[("created_at", -1)]
        ),
    }


@app.patch("/api/v1/patients/{patient_id}")
@app.patch("/api/patients/{patient_id}")
def update_patient(patient_id: str, payload: PatientPatch):
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No fields supplied")

    if not db.update("patients", patient_id, changes):
        raise HTTPException(status_code=404, detail="Patient not found")

    updated = db.get("patients", patient_id)
    db.audit(patient_id, "patient_updated", {"fields": list(changes)})
    return updated


@app.delete("/api/v1/patients/{patient_id}")
@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: str):
    if not db.get("patients", patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")

    # Safely clean up associated scan files from disk (BUG-011)
    patient_scans = db.find("scans", {"patient_id": patient_id})
    for scan in patient_scans:
        file_path = scan.get("file_path")
        if file_path:
            p = Path(file_path).resolve()
            if p.is_relative_to(config.UPLOADS.resolve()) and p.is_file():
                p.unlink(missing_ok=True)

    # Remove related database records
    
# Get cast IDs before deleting cast records.
    patient_casts = db.find("casts", {"patient_id": patient_id})
    cast_ids = [cast["id"] for cast in patient_casts if cast.get("id")]

    # Get job IDs before deleting job records.
    patient_jobs = db.find("jobs", {"patient_id": patient_id})
    job_ids = [job["id"] for job in patient_jobs if job.get("id")]

    # Delete related records first.
    for collection in ("scans", "measurements", "predictions"):
        db.delete(collection, {"patient_id": patient_id})

    # Remove cast versions belonging to this patient's casts.
    for cast_id in cast_ids:
        db.delete("cast_versions", {"cast_id": cast_id})

    # Remove events belonging to this patient's jobs.
    for job_id in job_ids:
        db.delete("job_events", {"job_id": job_id})

    # Remove casts, jobs, audit records, and finally the patient.
    db.delete("casts", {"patient_id": patient_id})
    db.delete("jobs", {"patient_id": patient_id})
    db.delete("audit", {"patient_id": patient_id})
    db.delete("patients", {"_id": patient_id})




@app.post("/api/v1/patients/{patient_id}/measurements", status_code=201)
@app.post("/api/patients/{patient_id}/measurements", status_code=201)
def save_measurements(patient_id: str, payload: MeasurementIn):
    if not db.get("patients", patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")

    data = payload.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(
            status_code=422, detail="At least one measurement is required"
        )

    record = db.insert(
        "measurements",
        {
            "patient_id": patient_id,
            "source": "manual",
            "data": data,
        },
    )
    db.audit(patient_id, "measurements_saved", {"measurement_id": record["id"]})
    return record


@app.get("/api/v1/patients/{patient_id}/measurements")
@app.get("/api/patients/{patient_id}/measurements")
def get_measurements(patient_id: str):
    if not db.get("patients", patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")

    return db.find(
        "measurements",
        {"patient_id": patient_id},
        sort=[("created_at", -1)],
    )
