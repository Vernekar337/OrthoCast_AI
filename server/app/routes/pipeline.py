from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app import db
from app.errors import ApiError
from app.services.predictor import predictor
from app.services.cast_generator import generate_cast_artifacts

router = APIRouter(tags=["Pipeline"])


class PipelineRequest(BaseModel):
    measurement_id: Optional[str] = None
    vent_enabled: bool = True
    tab_count: int = Field(default=3, ge=0, le=6)
    mode: Optional[str] = "measurements"
    marker_mm: Optional[float] = 50.0
    total_length_mm: Optional[float] = None


def _event(job_id: str, seq: int, stage: str, status: str,
           message: str, progress: int, data: dict | None = None):
    db.insert(
        "job_events",
        {
            "job_id": job_id,
            "seq": seq,
            "ts": db.now(),
            "stage": stage,
            "status": status,
            "message": message,
            "progress": progress,
            "data": data or {},
        },
    )


@router.post("/api/v1/patients/{patient_id}/pipeline", status_code=201)
@router.post("/api/patients/{patient_id}/pipeline", status_code=201)
@router.post("/api/v1/patients/{patient_id}/pipeline/start", status_code=201)
@router.post("/api/patients/{patient_id}/pipeline/start", status_code=201)
def run_pipeline(patient_id: str, payload: Optional[PipelineRequest] = None):
    payload = payload or PipelineRequest()
    patient = db.get("patients", patient_id)
    if not patient:
        raise ApiError(404, "patient_not_found", "Patient not found.")

    region = patient.get("injury_region")
    if region not in ("wrist", "ankle"):
        raise ApiError(422, "invalid_region", "Invalid injury region.")

    if payload.measurement_id:
        measurement = db.get("measurements", payload.measurement_id)
        if not measurement or measurement.get("patient_id") != patient_id:
            raise ApiError(
                404, "measurement_not_found",
                "Measurement not found for this patient.",
            )
    else:
        items = db.find(
            "measurements",
            {"patient_id": patient_id},
            sort=[("created_at", -1)],
            limit=1,
        )
        measurement = items[0] if items else None

    if not measurement:
        raise ApiError(
            422, "measurement_required",
            "Save measurements before starting the pipeline.",
        )

    values = measurement.get("data") or measurement.get("measurements") or measurement

    job = db.insert(
        "jobs",
        {
            "patient_id": patient_id,
            "mode": payload.mode or "measurements",
            "status": "running",
            "stage": "prediction",
            "progress": 0,
            "created_at": db.now(),
        },
    )
    job_id = job["id"]

    try:
        _event(job_id, 1, "prediction", "running",
               "Generating ML prediction", 20)

        result = predictor.predict(
            region=region,
            age=int(patient["age"]),
            gender=patient["gender"],
            swelling=patient["swelling_stage"],
            m=values,
        )

        prediction = db.insert(
            "predictions",
            {
                "patient_id": patient_id,
                "measurement_id": measurement.get("id"),
                "region": region,
                "data": result,
                "created_at": db.now(),
            },
        )

        _event(
            job_id, 2, "prediction", "completed",
            "Prediction saved", 50,
            {"prediction_id": prediction["id"]},
        )

        diameters = result["station_diameters_mm"]
        length = payload.total_length_mm or result["total_length_mm"]
        wall = result["wall_thickness_mm"]

        warnings = result.get("warnings", [])
        if warnings or result.get("clearance_mm", 0) <= 0:
            raise ApiError(
                422,
                "prediction_review_required",
                "Prediction has warnings or non-positive clearance. Review measurements and prediction before generating a cast.",
                "Use the prediction endpoint to inspect the warnings. This prototype is not clinically validated.",
            )

        _event(job_id, 3, "cast_generation", "running",
               "Generating STL and PDF artifacts", 70)

        artifacts = generate_cast_artifacts(
            {
                "region": region,
                "station_diameters_mm": diameters,
                "total_length_mm": length,
                "wall_thickness_mm": wall,
                "vent": {"enabled": payload.vent_enabled},
                "tabs": {"count": payload.tab_count},
            }
        )

        cast = db.insert(
            "casts",
            {
                "patient_id": patient_id,
                "prediction_id": prediction["id"],
                "region": region,
                "params": {
                    "station_diameters_mm": diameters,
                    "total_length_mm": length,
                    "wall_thickness_mm": wall,
                    "vent_enabled": payload.vent_enabled,
                    "tab_count": payload.tab_count,
                },
                "output_files": artifacts.get("output_files", {}),
                "generation_result": artifacts,
                "status": "completed",
                "created_at": db.now(),
            },
        )

        _event(
            job_id, 4, "completed", "completed",
            "Pipeline completed successfully", 100,
            {"prediction_id": prediction["id"], "cast_id": cast["id"]},
        )

        db.update(
            "jobs", job_id,
            {
                "status": "completed",
                "stage": "completed",
                "progress": 100,
                "result": {
                    "prediction_id": prediction["id"],
                    "cast_id": cast["id"],
                },
                "finished_at": db.now(),
            },
        )

        db.audit(
            patient_id, "pipeline.completed",
            {"job_id": job_id, "cast_id": cast["id"]},
        )

        return {
            "id": job_id,
            "job_id": job_id,
            "status": "completed",
            "prediction_id": prediction["id"],
            "cast_id": cast["id"],
            "artifacts": artifacts.get("output_files", {}),
            "notice": "Prototype output only; not clinically validated.",
        }

    except Exception as exc:
        db.update(
            "jobs", job_id,
            {
                "status": "failed",
                "stage": "failed",
                "error": str(exc),
                "finished_at": db.now(),
            },
        )
        _event(
            job_id, 99, "failed", "failed",
            str(exc), 100,
        )
        raise
