from typing import Optional

from fastapi import APIRouter, Query, status

from app import db
from app.errors import ApiError
from app.services.predictor import predictor

router = APIRouter(tags=["Predictions"])


def _require_patient(patient_id: str) -> dict:
    patient = db.get("patients", patient_id)
    if not patient:
        raise ApiError(404, "patient_not_found", "Patient not found.")
    return patient


def _measurement_values(record: dict) -> dict:
    nested = record.get("data") or record.get("measurements")
    if isinstance(nested, dict):
        return nested
    return record


@router.post(
    "/api/v1/patients/{patient_id}/predictions",
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/api/patients/{patient_id}/predictions",
    status_code=status.HTTP_201_CREATED,
)
def create_prediction(
    patient_id: str,
    measurement_id: Optional[str] = Query(default=None),
):
    patient = _require_patient(patient_id)

    region = patient.get("injury_region")
    if region not in ("wrist", "ankle"):
        raise ApiError(
            422,
            "invalid_region",
            "Patient injury_region must be wrist or ankle.",
        )

    if measurement_id:
        measurement = db.find_one(
            "measurements",
            {"id": measurement_id, "patient_id": patient_id},
        )
        if not measurement:
            measurement = db.get("measurements", measurement_id)

        if not measurement or measurement.get("patient_id") != patient_id:
            raise ApiError(
                404,
                "measurement_not_found",
                "Measurement not found for this patient.",
            )
    else:
        records = db.find(
            "measurements",
            {"patient_id": patient_id},
            sort=[("created_at", -1)],
            limit=1,
        )
        measurement = records[0] if records else None

    if not measurement:
        raise ApiError(
            422,
            "measurement_required",
            "Add measurements before requesting a prediction.",
            "Submit measurements through the patient's measurements endpoint.",
        )

    values = _measurement_values(measurement)

    try:
        result = predictor.predict(
            region=region,
            age=int(patient["age"]),
            gender=patient["gender"],
            swelling=patient["swelling_stage"],
            m=values,
        )
    except ApiError:
        raise
    except (KeyError, TypeError, ValueError) as exc:
        raise ApiError(
            422,
            "invalid_prediction_input",
            "Patient details or measurement values are incomplete or invalid.",
        ) from exc

    prediction_doc = db.insert(
        "predictions",
        {
            "patient_id": patient_id,
            "measurement_id": measurement.get("id"),
            "region": region,
            "data": result,
            "created_at": db.now(),
        },
    )

    db.audit(
        patient_id,
        "prediction.created",
        {
            "prediction_id": prediction_doc["id"],
            "measurement_id": measurement.get("id"),
            "region": region,
        },
    )

    return {
        "id": prediction_doc["id"],
        "prediction_id": prediction_doc["id"],
        "patient_id": patient_id,
        "measurement_id": measurement.get("id"),
        "region": region,
        "data": result,
        "prediction": result,
        "created_at": prediction_doc.get("created_at"),
        "notice": (
            "Prototype estimate based on the current model. "
            "Not clinically validated; measurements and cast dimensions "
            "require qualified professional review."
        ),
    }


@router.get("/api/v1/patients/{patient_id}/predictions")
@router.get("/api/patients/{patient_id}/predictions")
def list_predictions(patient_id: str, limit: int = Query(default=20, ge=1, le=100)):
    _require_patient(patient_id)

    return {
        "patient_id": patient_id,
        "predictions": db.find(
            "predictions",
            {"patient_id": patient_id},
            sort=[("created_at", -1)],
            limit=limit,
        ),
    }


@router.get("/api/v1/patients/{patient_id}/predictions/{prediction_id}")
@router.get("/api/patients/{patient_id}/predictions/{prediction_id}")
def get_prediction(patient_id: str, prediction_id: str):
    _require_patient(patient_id)

    prediction = db.get("predictions", prediction_id)
    if not prediction or prediction.get("patient_id") != patient_id:
        raise ApiError(404, "prediction_not_found", "Prediction not found.")

    return prediction
