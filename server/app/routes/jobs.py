from typing import Optional
from fastapi import APIRouter
from app import db
from app.errors import ApiError

router = APIRouter(tags=["Jobs"])


@router.get("/api/v1/jobs/{job_id}")
@router.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    job = db.get("jobs", job_id)
    if not job:
        raise ApiError(404, "job_not_found", f"Job '{job_id}' was not found.")
    return job


@router.get("/api/v1/jobs/{job_id}/events")
@router.get("/api/jobs/{job_id}/events")
def get_job_events(job_id: str):
    job = db.get("jobs", job_id)
    if not job:
        raise ApiError(404, "job_not_found", f"Job '{job_id}' was not found.")

    events = db.find(
        "job_events",
        {"job_id": job_id},
        sort=[("seq", 1)],
    )
    return {"job_id": job_id, "events": events}


@router.get("/api/v1/patients/{patient_id}/jobs")
@router.get("/api/patients/{patient_id}/jobs")
def get_patient_jobs(patient_id: str):
    patient = db.get("patients", patient_id)
    if not patient:
        raise ApiError(404, "patient_not_found", "Patient not found.")

    jobs = db.find(
        "jobs",
        {"patient_id": patient_id},
        sort=[("created_at", -1)],
    )
    return jobs
