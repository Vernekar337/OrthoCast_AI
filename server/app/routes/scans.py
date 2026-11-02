import uuid
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app import config, db
from app.errors import ApiError
from fastapi.responses import FileResponse


router = APIRouter(tags=["Scans"])

MAX_IMAGE_BYTES = 15 * 1024 * 1024

ALLOWED_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


def _require_patient(patient_id: str) -> dict:
    patient = db.get("patients", patient_id)
    if not patient:
        raise ApiError(
            404,
            "patient_not_found",
            f"Patient '{patient_id}' was not found.",
        )
    return patient


@router.post(
    "/api/v1/patients/{patient_id}/scans",
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/api/patients/{patient_id}/scans",
    status_code=status.HTTP_201_CREATED,
)
async def upload_scan(
    patient_id: str,
    file: UploadFile = File(...),
    angle: str = Form(default="top"),
):
    patient = _require_patient(patient_id)

    if file.content_type not in {
        "image/jpeg",
        "image/png",
        "image/webp",
    }:
        raise ApiError(
            415,
            "unsupported_image_type",
            "Upload a JPEG, PNG, or WebP image.",
        )

    content = await file.read(MAX_IMAGE_BYTES + 1)

    if not content:
        raise ApiError(422, "empty_file", "The uploaded image is empty.")

    if len(content) > MAX_IMAGE_BYTES:
        raise ApiError(
            413,
            "image_too_large",
            "Image size must not exceed 15 MB.",
        )

    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()

        with Image.open(BytesIO(content)) as image:
            image_format = image.format
            width, height = image.size

    except (UnidentifiedImageError, OSError, ValueError):
        raise ApiError(
            422,
            "invalid_image",
            "The uploaded file is not a valid supported image.",
        )

    if image_format not in ALLOWED_FORMATS:
        raise ApiError(
            415,
            "unsupported_image_type",
            "Upload a valid JPEG, PNG, or WebP image.",
        )

    if width < 100 or height < 100:
        raise ApiError(
            422,
            "image_resolution_too_low",
            "Image width and height must each be at least 100 pixels.",
        )

    config.ensure_dirs()

    scan_id = db.new_id("scan")
    extension = ALLOWED_FORMATS[image_format]
    filename = f"{scan_id}{extension}"
    destination = (config.UPLOADS / filename).resolve()

    # Ensure the generated destination remains inside the uploads directory.
    if destination.parent != config.UPLOADS.resolve():
        raise ApiError(400, "invalid_path", "Invalid upload destination.")

    normalized_angle = "side" if str(angle).lower().strip() == "side" else "top"

    try:
        destination.write_bytes(content)

        scan = db.insert(
            "scans",
            {
                "id": scan_id,
                "patient_id": patient_id,
                "region": patient["injury_region"],
                "angle": normalized_angle,
                "original_filename": Path(file.filename or "scan").name,
                "stored_filename": filename,
                "file_path": str(destination),
                "content_type": f"image/{image_format.lower()}",
                "format": image_format,
                "size_bytes": len(content),
                "width_px": width,
                "height_px": height,
                "status": "uploaded",
                "measurements": None,
                "annotated_path": None,
            },
        )

        db.audit(
            patient_id,
            "scan_uploaded",
            {"scan_id": scan_id, "format": image_format, "angle": normalized_angle},
        )

    except Exception:
        destination.unlink(missing_ok=True)
        raise

    finally:
        await file.close()

    return {
        "success": True,
        "message": "Scan uploaded successfully.",
        "scan": scan,
    }


@router.get("/api/v1/patients/{patient_id}/scans")
@router.get("/api/patients/{patient_id}/scans")
def list_scans(patient_id: str):
    _require_patient(patient_id)

    scans = db.find(
        "scans",
        {"patient_id": patient_id},
        sort=[("created_at", -1)],
        limit=100,
    )

    return {
        "success": True,
        "count": len(scans),
        "scans": scans,
    }


@router.get("/api/v1/patients/{patient_id}/scans/{scan_id}/preview")
@router.get("/api/patients/{patient_id}/scans/{scan_id}/preview")
def get_annotated_scan_preview(patient_id: str, scan_id: str):
    _require_patient(patient_id)

    scan = db.get("scans", scan_id)

    if not scan or scan.get("patient_id") != patient_id:
        raise ApiError(404, "scan_not_found", "Scan not found.")

    annotated_path = scan.get("annotated_path")

    if not annotated_path:
        raise ApiError(
            404,
            "preview_not_available",
            "No annotated preview exists for this scan. Measure the scan first.",
        )

    preview_path = Path(annotated_path).resolve()
    annotated_dir = config.ANNOTATED.resolve()

    # Prevent paths outside the annotated-image directory from being served.
    if (
        not preview_path.is_relative_to(annotated_dir)
        or not preview_path.is_file()
    ):
        raise ApiError(
            404,
            "preview_not_available",
            "The annotated preview file is unavailable.",
        )

    return FileResponse(
        path=preview_path,
        media_type="image/jpeg",
        filename=preview_path.name,
    )



@router.post(
    "/api/v1/patients/{patient_id}/scans/{scan_id}/measure",
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/api/patients/{patient_id}/scans/{scan_id}/measure",
    status_code=status.HTTP_201_CREATED,
)
def measure_uploaded_scan(patient_id: str, scan_id: str):
    patient = _require_patient(patient_id)

    scan = db.get("scans", scan_id)
    if not scan or scan.get("patient_id") != patient_id:
        raise ApiError(404, "scan_not_found", "Scan not found.")

    file_path = scan.get("file_path")
    if not file_path:
        raise ApiError(422, "scan_file_missing", "Scan file path is missing.")

    image_path = Path(file_path).resolve()
    uploads_dir = config.UPLOADS.resolve()

    if (
        not image_path.is_relative_to(uploads_dir)
        or not image_path.is_file()
    ):
        raise ApiError(422, "scan_file_missing", "Uploaded scan file is unavailable.")

    if scan.get("region") != patient.get("injury_region"):
        raise ApiError(422, "scan_region_mismatch", "Scan region does not match patient.")

    config.ensure_dirs()
    annotated_path = config.ANNOTATED / f"{scan_id}_annotated.jpg"

    try:
        # Import lazily so CV dependencies are loaded only when needed.
        if patient["injury_region"] == "wrist":
            from app.measurement.hand_measure import measure_hand

            result = measure_hand(
                image_path=str(image_path),
                marker_mm=config.DEFAULT_MARKER_MM,
                output_path=str(annotated_path),
            )
        else:
            if scan.get("angle") != "top":
                raise ApiError(
                    422,
                    "unsupported_scan_angle",
                    "Foot measurement requires a top-down scan.",
                )

            from app.measurement.foot_measure import measure_foot

            result = measure_foot(
                image_path=str(image_path),
                marker_mm=config.DEFAULT_MARKER_MM,
                output_path=str(annotated_path),
            )

    except ApiError:
        raise
    except (ValueError, RuntimeError, OSError) as exc:
        raise ApiError(
            422,
            "measurement_failed",
            str(exc),
        ) from exc

    measurement_data = result.get("measurements") or {}
    if not measurement_data:
        raise ApiError(
            422,
            "measurement_empty",
            "CV did not return any measurements.",
        )

    calibration_mode = result.get("calibration_mode", "unknown")
    demo_only = calibration_mode != "aruco_calibrated"

    record = db.insert(
        "measurements",
        {
            "patient_id": patient_id,
            "scan_id": scan_id,
            "source": "computer_vision",
            "data": measurement_data,
            "calibration_mode": calibration_mode,
            "demo_only": demo_only,
            "warnings": result.get("warnings", []),
        },
    )

    db.update(
        "scans",
        scan_id,
        {
            "status": "measured",
            "measurements": measurement_data,
            "measurement_id": record["id"],
            "calibration_mode": calibration_mode,
            "demo_only": demo_only,
            "annotated_path": (
                str(annotated_path.resolve())
                if result.get("annotated_image")
                else None
            ),
        },
    )

    db.audit(
        patient_id,
        "scan_measured",
        {
            "scan_id": scan_id,
            "measurement_id": record["id"],
            "calibration_mode": calibration_mode,
            "demo_only": demo_only,
        },
    )

    return {
        "success": True,
        "scan_id": scan_id,
        "measurement": record,
        "calibration_mode": calibration_mode,
        "demo_only": demo_only,
        "annotated_path": (
            str(annotated_path.resolve())
            if result.get("annotated_image")
            else None
        ),
        "warnings": result.get("warnings", []),
    }



@router.delete("/api/v1/patients/{patient_id}/scans/{scan_id}")
@router.delete("/api/patients/{patient_id}/scans/{scan_id}")
def delete_scan(patient_id: str, scan_id: str):
    _require_patient(patient_id)

    scan = db.get("scans", scan_id)
    if not scan or scan.get("patient_id") != patient_id:
        raise ApiError(404, "scan_not_found", "Scan not found.")

    # Remove file on disk safely
    file_path = scan.get("file_path")
    if file_path:
        p = Path(file_path).resolve()
        if p.is_relative_to(config.UPLOADS.resolve()) and p.is_file():
            p.unlink(missing_ok=True)

    db.delete("scans", {"_id": scan_id})
    db.audit(patient_id, "scan_deleted", {"scan_id": scan_id})

    return {"success": True, "message": "Scan deleted successfully"}
