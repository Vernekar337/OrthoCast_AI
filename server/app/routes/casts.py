from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app import config, db
from app.errors import ApiError
from app.services.cast_generator import generate_cast_artifacts

router = APIRouter(tags=["Casts"])


class CastCreate(BaseModel):
    prediction_id: Optional[str] = None
    params: Optional[dict] = None
    vent_enabled: bool = True
    vent_pattern: str = Field(default="staggered", pattern="^(grid|staggered)$")
    vent_hole_mm: float = Field(default=6.0, ge=3.0, le=16.0)
    vent_spacing_mm: float = Field(default=18.0, ge=8.0, le=50.0)
    seam_angle_deg: float = Field(default=0.0, ge=0.0, le=180.0)
    tab_count: int = Field(default=3, ge=0, le=6)
    # Optional overrides allow editing dimensions before regeneration.
    station_diameters_mm: Optional[list[float]] = None
    total_length_mm: Optional[float] = None
    wall_thickness_mm: Optional[float] = None


class CastVersionIn(BaseModel):
    params: dict
    label: Optional[str] = Field(default=None, max_length=60)


def _require_patient(patient_id: str):
    patient = db.get("patients", patient_id)
    if not patient:
        raise ApiError(404, "patient_not_found", "Patient not found.")
    return patient


ARTIFACT_ALIASES = {
    "cast_half_A.stl": "half_a_stl",
    "cast_half_B.stl": "half_b_stl",
    "cast_half_a.stl": "half_a_stl",
    "cast_half_b.stl": "half_b_stl",
    "summary.json": "summary_json",
    "generation_report.json": "generation_report_json",
    "generation_report.pdf": "report_pdf",
    "report.pdf": "report_pdf",
}


def _artifact_path(cast: dict, artifact: str) -> Path:
    canonical_artifact = ARTIFACT_ALIASES.get(artifact, artifact)
    allowed = {
        "half_a_stl",
        "half_b_stl",
        "report_pdf",
        "summary_json",
        "generation_report_json",
    }
    if canonical_artifact not in allowed:
        raise ApiError(404, "artifact_not_found", f"Unknown cast artifact: {artifact}")

    output_files = cast.get("output_files") or {}
    raw_path = output_files.get(canonical_artifact)
    if not raw_path:
        raise ApiError(404, "artifact_not_found", "Artifact is unavailable.")

    path = Path(raw_path).resolve()
    casts_root = config.CASTS.resolve()

    if not path.is_relative_to(casts_root) or not path.is_file():
        raise ApiError(404, "artifact_not_found", "Artifact file not found on disk.")

    return path


@router.post("/api/v1/patients/{patient_id}/casts", status_code=201)
@router.post("/api/patients/{patient_id}/casts", status_code=201)
@router.post("/api/v1/patients/{patient_id}/cast/generate", status_code=201)
@router.post("/api/patients/{patient_id}/cast/generate", status_code=201)
def create_cast(patient_id: str, payload: CastCreate):
    patient = _require_patient(patient_id)

    prediction_id = payload.prediction_id
    if not prediction_id:
        # Fallback to patient's latest prediction
        latest_preds = db.find(
            "predictions",
            {"patient_id": patient_id},
            sort=[("created_at", -1)],
            limit=1,
        )
        if latest_preds:
            prediction_id = latest_preds[0].get("id") or latest_preds[0].get("_id")

    if not prediction_id:
        raise ApiError(
            422,
            "prediction_required",
            "Generate or save an AI prediction before creating a 3D cast.",
            "Run predictions first through the Processing cockpit.",
        )

    prediction = db.get("predictions", prediction_id)
    if not prediction:
        prediction = db.find_one("predictions", {"id": prediction_id})

    if not prediction:
        raise ApiError(
            404,
            "prediction_not_found",
            f"Prediction ID '{prediction_id}' was not found in MongoDB.",
        )

    if prediction.get("patient_id") != patient_id:
        raise ApiError(
            422,
            "prediction_patient_mismatch",
            "This prediction belongs to a different patient.",
        )

    result = prediction.get("data") or prediction.get("prediction")
    if not isinstance(result, dict):
        raise ApiError(
            422,
            "invalid_prediction",
            "Saved prediction has no usable dimensions.",
        )

    # Extract dimensions from payload (supporting nested params if supplied)
    nested = payload.params or {}
    diameters = (
        payload.station_diameters_mm
        or nested.get("station_diameters_mm")
        or result.get("station_diameters_mm")
    )
    length = (
        payload.total_length_mm
        or nested.get("total_length_mm")
        or result.get("total_length_mm")
    )
    wall = (
        payload.wall_thickness_mm
        or nested.get("wall_thickness_mm")
        or result.get("wall_thickness_mm")
    )

    nested_vent = nested.get("vent", {}) if isinstance(nested.get("vent"), dict) else {}
    vent_enabled = nested_vent.get("enabled", payload.vent_enabled)
    vent_pattern = nested_vent.get("pattern", payload.vent_pattern)
    vent_hole = float(nested_vent.get("hole_mm", payload.vent_hole_mm))
    vent_spacing = float(nested_vent.get("spacing_mm", payload.vent_spacing_mm))

    nested_tabs = nested.get("tabs", {}) if isinstance(nested.get("tabs"), dict) else {}
    tab_count = int(nested_tabs.get("count", payload.tab_count))
    seam_angle = float(nested.get("seam_angle_deg", payload.seam_angle_deg))

    if not diameters or len(diameters) < 3 or length is None or wall is None:
        raise ApiError(
            422,
            "incomplete_prediction",
            "Prediction or parameters are missing cast geometry dimensions.",
        )

    if any(not 20 <= float(d) <= 220 for d in diameters):
        raise ApiError(
            422,
            "invalid_diameters",
            "Each station diameter must be between 20 and 220 mm.",
        )

    if not 60 <= float(length) <= 600 or not 2 <= float(wall) <= 10:
        raise ApiError(
            422,
            "invalid_geometry",
            "Length or wall thickness is outside the allowed range.",
        )

    params = {
        "region": result.get("region", prediction.get("region", patient.get("injury_region", "wrist"))),
        "station_diameters_mm": [float(d) for d in diameters],
        "total_length_mm": float(length),
        "wall_thickness_mm": float(wall),
        "vent": {
            "enabled": vent_enabled,
            "pattern": vent_pattern,
            "hole_mm": vent_hole,
            "spacing_mm": vent_spacing,
        },
        "seam_angle_deg": seam_angle,
        "tabs": {"count": tab_count},
    }

    try:
        generated = generate_cast_artifacts(params)
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(
            500,
            "cast_generation_failed",
            f"The cast generator could not create the artifacts: {exc}",
        ) from exc

    output_files = generated.get("output_files", {})
    if not output_files:
        raise ApiError(
            500,
            "missing_artifacts",
            "The cast generator returned no output file paths.",
        )

    cast = db.insert(
        "casts",
        {
            "patient_id": patient_id,
            "prediction_id": prediction_id,
            "region": params["region"],
            "params": params,
            "output_files": output_files,
            "generation_result": generated,
            "status": "completed",
            "created_at": db.now(),
        },
    )

    db.audit(
        patient_id,
        "cast.generated",
        {
            "cast_id": cast["id"],
            "prediction_id": prediction_id,
        },
    )

    return {
        "id": cast["id"],
        "cast_id": cast["id"],
        "patient_id": patient_id,
        "prediction_id": prediction_id,
        "status": "completed",
        "params": params,
        "summary": generated.get("generation_summary", {}),
        "output_files": {
            key: f"/api/v1/patients/{patient_id}/casts/{cast['id']}/files/{key}"
            for key in output_files
        },
        "generation_result": generated,
        "notice": (
            "Prototype geometry only. The ML model and resulting cast "
            "are not clinically validated; qualified professional review "
            "is required before any real-world use."
        ),
    }


@router.get("/api/v1/patients/{patient_id}/casts")
@router.get("/api/patients/{patient_id}/casts")
def list_casts(
    patient_id: str,
    limit: int = Query(default=20, ge=1, le=100),
):
    _require_patient(patient_id)

    casts = db.find(
        "casts",
        {"patient_id": patient_id},
        sort=[("created_at", -1)],
        limit=limit,
    )
    return {"patient_id": patient_id, "casts": casts}


@router.get("/api/v1/patients/{patient_id}/casts/{cast_id}/files/{artifact}")
@router.get("/api/patients/{patient_id}/casts/{cast_id}/files/{artifact}")
@router.get("/api/v1/casts/{cast_id}/download/{artifact}")
@router.get("/api/casts/{cast_id}/download/{artifact}")
def download_cast_file(
    cast_id: str,
    artifact: str,
    patient_id: Optional[str] = None,
):
    cast = db.get("casts", cast_id)
    if not cast:
        cast = db.find_one("casts", {"id": cast_id})

    if not cast:
        raise ApiError(404, "cast_not_found", f"Cast '{cast_id}' was not found.")

    if patient_id and cast.get("patient_id") != patient_id:
        raise ApiError(404, "cast_not_found", "Cast not found for this patient.")

    path = _artifact_path(cast, artifact)
    return FileResponse(path=path, filename=path.name)


@router.get("/api/v1/casts/{cast_id}/versions")
@router.get("/api/casts/{cast_id}/versions")
@router.get("/api/v1/patients/{patient_id}/casts/{cast_id}/versions")
@router.get("/api/patients/{patient_id}/casts/{cast_id}/versions")
def get_cast_versions(cast_id: str, patient_id: Optional[str] = None):
    versions = db.find(
        "cast_versions",
        {"cast_id": cast_id},
        sort=[("version", 1)],
    )
    return versions


@router.post("/api/v1/casts/{cast_id}/versions", status_code=201)
@router.post("/api/casts/{cast_id}/versions", status_code=201)
@router.post("/api/v1/patients/{patient_id}/casts/{cast_id}/versions", status_code=201)
@router.post("/api/patients/{patient_id}/casts/{cast_id}/versions", status_code=201)
def save_cast_version(cast_id: str, payload: CastVersionIn, patient_id: Optional[str] = None):
    doc = {
        "params": payload.params,
        "label": payload.label,
        "patient_id": patient_id,
        "created_at": db.now(),
    }
    created = db.insert_version(cast_id, doc)
    return created
