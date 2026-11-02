
from fastapi import APIRouter, Query, status

from app import db
from app.errors import ApiError
from app.schemas import PatientIn, PatientPatch, MeasurementIn


router = APIRouter(prefix="/api/v1/patients", tags=["Patients"])


def _require_patient(patient_id: str) -> dict:
    patient = db.get("patients", patient_id)
    if not patient:
        raise ApiError(
            404,
            "patient_not_found",
            f"Patient '{patient_id}' was not found.",
        )
    return patient


@router.post("", status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientIn):
    data = payload.model_dump()
    data["name"] = data["name"].strip()

    if not data["name"]:
        raise ApiError(422, "invalid_name", "Patient name cannot be empty.")

    patient = db.insert(
        "patients",
        {
            **data,
            "updated_at": db.now(),
        },
    )

    db.audit(patient["id"], "patient_created")
    return {"success": True, "patient": patient}


@router.get("")
def list_patients(
    search: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    filters = {}

    if search and search.strip():
        filters["name"] = {
            "$regex": search.strip(),
            "$options": "i",
        }

    patients = db.find(
        "patients",
        filters,
        sort=[("created_at", -1)],
        limit=limit,
        skip=skip,
    )

    return {
        "success": True,
        "count": len(patients),
        "patients": patients,
    }


@router.get("/{patient_id}")
def get_patient(patient_id: str):
    patient = _require_patient(patient_id)

    measurements = db.find(
        "measurements",
        {"patient_id": patient_id},
        sort=[("created_at", -1)],
        limit=20,
    )

    return {
        "success": True,
        "patient": patient,
        "measurements": measurements,
    }


@router.patch("/{patient_id}")
def update_patient(patient_id: str, payload: PatientPatch):
    _require_patient(patient_id)

    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        raise ApiError(
            422,
            "empty_update",
            "Provide at least one field to update.",
        )

    if "name" in updates:
        updates["name"] = updates["name"].strip()
        if not updates["name"]:
            raise ApiError(422, "invalid_name", "Patient name cannot be empty.")

    updates["updated_at"] = db.now()

    db.update("patients", patient_id, updates)
    patient = _require_patient(patient_id)

    db.audit(patient_id, "patient_updated", {"fields": list(updates.keys())})

    return {"success": True, "patient": patient}


@router.post(
    "/{patient_id}/measurements",
    status_code=status.HTTP_201_CREATED,
)
def create_measurement(patient_id: str, payload: MeasurementIn):
    patient = _require_patient(patient_id)
    data = payload.model_dump()

    supplied = {
        key: value
        for key, value in data.items()
        if key != "note" and value is not None
    }

    if not supplied:
        raise ApiError(
            422,
            "empty_measurement",
            "Provide at least one measurement.",
        )

    region = patient["injury_region"]

    if region == "wrist":
        required = ("wrist_width_mm", "palm_length_mm", "hand_length_mm")
    else:
        required = ("foot_length_mm", "ankle_circumference_mm")

    missing = [field for field in required if data.get(field) is None]

    if missing:
        raise ApiError(
            422,
            "missing_measurements",
            f"Missing measurements for {region}: {', '.join(missing)}.",
            hint="Submit all required measurements for the patient's injury region.",
        )

    measurement = db.insert(
        "measurements",
        {
            **data,
            "patient_id": patient_id,
            "region": region,
            "source": "manual",
        },
    )

    db.audit(
        patient_id,
        "measurement_created",
        {"measurement_id": measurement["id"], "region": region},
    )

    return {
        "success": True,
        "measurement": measurement,
    }


@router.get("/{patient_id}/measurements")
def list_measurements(
    patient_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    _require_patient(patient_id)

    measurements = db.find(
        "measurements",
        {"patient_id": patient_id},
        sort=[("created_at", -1)],
        limit=limit,
        skip=skip,
    )

    return {
        "success": True,
        "count": len(measurements),
        "measurements": measurements,
    }
