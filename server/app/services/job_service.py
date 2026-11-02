from typing import Any, Optional

from pymongo import ReturnDocument

from app import db
from app.errors import ApiError


JOB_STATUSES = {"queued", "running", "completed", "failed", "cancelled"}


def _get_or_404(job_id: str) -> dict:
    job = db.get("jobs", job_id)
    if not job:
        raise ApiError(404, "job_not_found", f"Job '{job_id}' was not found.")
    return job


def _append_event(
    job_id: str,
    event_type: str,
    message: str,
    details: Optional[dict] = None,
) -> dict:
    """Atomically allocate an event sequence number and save the event."""
    updated_job = db.database()["jobs"].find_one_and_update(
        {"_id": job_id},
        {"$inc": {"event_seq": 1}},
        return_document=ReturnDocument.AFTER,
    )

    if not updated_job:
        raise ApiError(404, "job_not_found", f"Job '{job_id}' was not found.")

    return db.insert(
        "job_events",
        {
            "job_id": job_id,
            "seq": updated_job["event_seq"],
            "event_type": event_type,
            "message": message,
            "details": details or {},
            "ts": db.now(),
        },
    )


def create_job(
    job_type: str,
    patient_id: Optional[str] = None,
    input_data: Optional[dict] = None,
    metadata: Optional[dict] = None,
) -> dict:
    """Create a new queued job and record its creation event."""
    if not job_type or not job_type.strip():
        raise ApiError(422, "invalid_job_type", "Job type is required.")

    if patient_id and not db.get("patients", patient_id):
        raise ApiError(
            404,
            "patient_not_found",
            f"Patient '{patient_id}' was not found.",
        )

    job = db.insert(
        "jobs",
        {
            "id": db.new_id("job"),
            "job_type": job_type.strip(),
            "patient_id": patient_id,
            "status": "queued",
            "progress": 0,
            "current_stage": "queued",
            "input_data": input_data or {},
            "metadata": metadata or {},
            "result": None,
            "error": None,
            "event_seq": 0,
            "started_at": None,
            "completed_at": None,
            "updated_at": db.now(),
        },
    )

    _append_event(
        job["id"],
        "job_created",
        "Job created and waiting to start.",
        {"job_type": job_type.strip()},
    )

    return _get_or_404(job["id"])


def get_job(job_id: str) -> dict:
    """Retrieve a job by its ID."""
    return _get_or_404(job_id)


def list_jobs(
    patient_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
) -> list[dict]:
    """List recent jobs, optionally filtered by patient and status."""
    filters: dict[str, Any] = {}

    if patient_id:
        filters["patient_id"] = patient_id

    if status:
        if status not in JOB_STATUSES:
            raise ApiError(
                422,
                "invalid_job_status",
                f"Status must be one of: {', '.join(sorted(JOB_STATUSES))}.",
            )
        filters["status"] = status

    limit = max(1, min(int(limit), 100))
    skip = max(0, int(skip))

    return db.find(
        "jobs",
        filters,
        sort=[("created_at", -1)],
        limit=limit,
        skip=skip,
    )


def get_job_events(job_id: str, limit: int = 100) -> list[dict]:
    """Return a job's event history in chronological order."""
    _get_or_404(job_id)

    return db.find(
        "job_events",
        {"job_id": job_id},
        sort=[("seq", 1)],
        limit=max(1, min(int(limit), 500)),
    )


def _transition(
    job_id: str,
    allowed_from: list[str],
    new_status: str,
    fields: dict,
    event_type: str,
    message: str,
    details: Optional[dict] = None,
) -> dict:
    """Perform a status transition atomically."""
    now = db.now()
    fields = {**fields, "status": new_status, "updated_at": now}

    result = db.database()["jobs"].update_one(
        {
            "_id": job_id,
            "status": {"$in": allowed_from},
        },
        {"$set": db.clean(fields)},
    )

    if result.matched_count == 0:
        job = _get_or_404(job_id)
        raise ApiError(
            409,
            "invalid_job_transition",
            f"Cannot change job status from '{job['status']}' to "
            f"'{new_status}'.",
        )

    _append_event(job_id, event_type, message, details)
    return _get_or_404(job_id)


def start_job(job_id: str, stage: str = "processing") -> dict:
    """Move a queued job to running."""
    if not stage or not stage.strip():
        raise ApiError(422, "invalid_stage", "Stage cannot be empty.")

    return _transition(
        job_id=job_id,
        allowed_from=["queued"],
        new_status="running",
        fields={
            "started_at": db.now(),
            "current_stage": stage.strip(),
        },
        event_type="job_started",
        message=f"Job started: {stage.strip()}.",
        details={"stage": stage.strip()},
    )


def update_job_progress(
    job_id: str,
    progress: int,
    stage: Optional[str] = None,
    message: Optional[str] = None,
) -> dict:
    """Update progress for a running job; progress must be between 0 and 99."""
    if isinstance(progress, bool) or not isinstance(progress, int):
        raise ApiError(422, "invalid_progress", "Progress must be an integer.")

    if not 0 <= progress <= 99:
        raise ApiError(
            422,
            "invalid_progress",
            "Progress must be between 0 and 99 while the job is running.",
        )

    job = _get_or_404(job_id)

    if job["status"] != "running":
        raise ApiError(
            409,
            "job_not_running",
            "Progress can only be updated while a job is running.",
        )

    if progress < job.get("progress", 0):
        raise ApiError(
            409,
            "progress_regression",
            "Job progress cannot move backwards.",
        )

    fields: dict[str, Any] = {
        "progress": progress,
        "updated_at": db.now(),
    }

    if stage is not None:
        if not stage.strip():
            raise ApiError(422, "invalid_stage", "Stage cannot be empty.")
        fields["current_stage"] = stage.strip()

    result = db.database()["jobs"].update_one(
        {
            "_id": job_id,
            "status": "running",
            "progress": {"$lte": progress},
        },
        {"$set": db.clean(fields)},
    )

    if result.matched_count == 0:
        raise ApiError(
            409,
            "job_update_conflict",
            "The job changed concurrently. Fetch its latest status and retry.",
        )

    _append_event(
        job_id,
        "progress_updated",
        message or f"Progress updated to {progress}%.",
        {"progress": progress, "stage": stage},
    )

    return _get_or_404(job_id)


def complete_job(
    job_id: str,
    result: Optional[dict] = None,
) -> dict:
    """Mark a running job as completed and store its result."""
    return _transition(
        job_id=job_id,
        allowed_from=["running"],
        new_status="completed",
        fields={
            "progress": 100,
            "current_stage": "completed",
            "result": result or {},
            "error": None,
            "completed_at": db.now(),
        },
        event_type="job_completed",
        message="Job completed successfully.",
    )


def fail_job(
    job_id: str,
    error: str,
    error_code: str = "processing_failed",
) -> dict:
    """Mark a queued or running job as failed."""
    if not error or not error.strip():
        error = "An unspecified processing error occurred."

    error_data = {
        "code": error_code,
        "message": error.strip()[:2000],
    }

    return _transition(
        job_id=job_id,
        allowed_from=["queued", "running"],
        new_status="failed",
        fields={
            "current_stage": "failed",
            "error": error_data,
            "completed_at": db.now(),
        },
        event_type="job_failed",
        message="Job failed.",
        details=error_data,
    )


def cancel_job(job_id: str) -> dict:
    """Cancel a queued or running job."""
    return _transition(
        job_id=job_id,
        allowed_from=["queued", "running"],
        new_status="cancelled",
        fields={
            "current_stage": "cancelled",
            "completed_at": db.now(),
        },
        event_type="job_cancelled",
        message="Job cancelled.",
    )