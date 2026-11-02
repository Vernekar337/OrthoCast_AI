from typing import Optional
from fastapi import APIRouter, Query, status

from app import db
from app.errors import ApiError
from app.schemas import ValidationLogIn

router = APIRouter(tags=["Validation & Audit"])


@router.get("/api/v1/validation")
@router.get("/api/validation")
def get_validation_logs(
    patient_id: Optional[str] = Query(default=None),
    metric: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
):
    filt = {}
    if patient_id:
        filt["patient_id"] = patient_id
    if metric:
        filt["metric"] = metric

    logs = db.find("validation_logs", filt, sort=[("created_at", -1)], limit=limit, skip=skip)
    return logs


@router.post("/api/v1/validation", status_code=status.HTTP_201_CREATED)
@router.post("/api/validation", status_code=status.HTTP_201_CREATED)
def log_validation(payload: ValidationLogIn):
    data = payload.model_dump(exclude_unset=True)
    # Calculate discrepancy percentage
    manual = float(data.get("manual_value", 0))
    system = float(data.get("system_value", 0))
    delta_mm = round(abs(system - manual), 2)
    pct_diff = round((delta_mm / manual * 100), 2) if manual > 0 else 0.0

    if pct_diff <= 5.0 and delta_mm <= 4.0:
        verdict = "pass"
    elif pct_diff <= 10.0 and delta_mm <= 8.0:
        verdict = "warning"
    else:
        verdict = "fail"

    record = {
        **data,
        "delta_mm": delta_mm,
        "error_percent": pct_diff,
        "verdict": verdict,
        "created_at": db.now(),
    }
    saved = db.insert("validation_logs", record)

    patient_id = data.get("patient_id")
    if patient_id:
        db.audit(patient_id, "validation_logged", {
            "metric": data.get("metric"),
            "delta_mm": delta_mm,
            "verdict": verdict,
        })

    return saved


@router.get("/api/v1/validation/report")
@router.get("/api/validation/report")
def get_validation_report():
    logs = db.find("validation_logs", sort=[("created_at", -1)], limit=200)
    total = len(logs)
    passed = sum(1 for log in logs if log.get("verdict") == "pass")
    warning = sum(1 for log in logs if log.get("verdict") == "warning")
    failed = sum(1 for log in logs if log.get("verdict") == "fail")

    return {
        "total_checks": total,
        "pass_count": passed,
        "warning_count": warning,
        "fail_count": failed,
        "pass_rate_pct": round((passed / total * 100), 1) if total > 0 else 100.0,
        "recent_logs": logs[:20],
    }


@router.get("/api/v1/audit")
@router.get("/api/audit")
def get_audit_trail(
    patient_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
):
    filt = {}
    if patient_id:
        filt["patient_id"] = patient_id

    records = db.find("audit", filt, sort=[("ts", -1)], limit=limit)
    return records


@router.get("/api/v1/audit/{patient_id}")
@router.get("/api/audit/{patient_id}")
def get_patient_audit(patient_id: str, limit: int = Query(default=100, ge=1, le=500)):
    records = db.find("audit", {"patient_id": patient_id}, sort=[("ts", -1)], limit=limit)
    return records
