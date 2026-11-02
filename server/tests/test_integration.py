import io
import pytest
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app import config, db


@pytest.fixture(scope="module")
def client():
    # Run lifespan context to initialize db
    with TestClient(app) as test_client:
        yield test_client


def _make_dummy_image(format="PNG", width=200, height=200):
    img = Image.new("RGB", (width, height), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format=format)
    buf.seek(0)
    return buf.getvalue()


def test_01_health_and_meta(client):
    r1 = client.get("/api/health")
    assert r1.status_code == 200
    assert r1.json()["mongodb"] == "connected"

    r2 = client.get("/api/v1/health")
    assert r2.status_code == 200
    assert r2.json()["status"] == "ok"

    m1 = client.get("/api/meta")
    assert m1.status_code == 200
    assert "station_diameter_mm" in m1.json()["parameter_limits"]

    m2 = client.get("/api/v1/meta")
    assert m2.status_code == 200


def test_02_dashboard_stats(client):
    r = client.get("/api/v1/dashboard/stats")
    assert r.status_code == 200
    d = r.json()
    assert "total_patients" in d
    assert "total_scans" in d
    assert "total_predictions" in d
    assert "total_casts" in d


def test_03_openapi_routes(client):
    routes = app.openapi()["paths"]
    # Check key endpoints exist under both /api and /api/v1
    assert "/api/patients" in routes
    assert "/api/v1/patients" in routes
    assert "/api/v1/patients/{patient_id}/scans" in routes
    assert "/api/v1/patients/{patient_id}/predictions" in routes
    assert "/api/v1/patients/{patient_id}/casts" in routes
    assert "/api/v1/patients/{patient_id}/pipeline" in routes
    assert "/api/v1/validation" in routes
    assert "/api/v1/audit" in routes


def test_04_patient_crud_workflow(client):
    # Create patient
    payload = {
        "name": "Integration Test Patient",
        "age": 34,
        "gender": "F",
        "injury_region": "wrist",
        "swelling_stage": "acute",
        "notes": "Automated regression verification",
    }
    r = client.post("/api/v1/patients", json=payload)
    assert r.status_code == 201
    patient = r.json()
    patient_id = patient["id"]
    assert patient["name"] == "Integration Test Patient"

    # Detail
    detail_res = client.get(f"/api/v1/patients/{patient_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["patient"]["id"] == patient_id

    # List with search
    list_res = client.get("/api/v1/patients?search=Integration")
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # Patch
    patch_res = client.patch(
        f"/api/v1/patients/{patient_id}",
        json={"notes": "Updated clinical observation"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["notes"] == "Updated clinical observation"

    assert patient_id is not None


def test_05_scan_upload_and_angle(client):
    # Setup patient
    p_res = client.post("/api/v1/patients", json={
        "name": "Scan Test Patient",
        "age": 28,
        "gender": "M",
        "injury_region": "wrist",
    })
    p_id = p_res.json()["id"]

    # Invalid image rejected
    bad_res = client.post(
        f"/api/v1/patients/{p_id}/scans",
        files={"file": ("test.txt", b"plain text", "text/plain")},
    )
    assert bad_res.status_code == 415

    # Valid PNG with angle='side'
    img_data = _make_dummy_image("PNG", 200, 200)
    good_res = client.post(
        f"/api/v1/patients/{p_id}/scans",
        files={"file": ("photogrammetry_side.png", img_data, "image/png")},
        data={"angle": "side"},
    )
    assert good_res.status_code == 201
    scan = good_res.json()["scan"]
    assert scan["angle"] == "side"
    scan_id = scan["id"]
    stored_path = Path(scan["file_path"])
    assert stored_path.is_file()

    # List scans
    scans_list = client.get(f"/api/v1/patients/{p_id}/scans")
    assert scans_list.status_code == 200
    assert len(scans_list.json()["scans"]) >= 1

    # Delete scan and verify file unlinked
    del_res = client.delete(f"/api/v1/patients/{p_id}/scans/{scan_id}")
    assert del_res.status_code == 200
    assert not stored_path.exists()

    # Clean up patient
    client.delete(f"/api/v1/patients/{p_id}")


def test_06_end_to_end_clinical_pipeline(client):
    # 1. Create Patient
    p_res = client.post("/api/v1/patients", json={
        "name": "E2E Pipeline Patient",
        "age": 42,
        "gender": "M",
        "injury_region": "wrist",
        "swelling_stage": "acute",
    })
    assert p_res.status_code == 201
    p_id = p_res.json()["id"]

    # 2. Save Measurements (POST & PUT)
    meas_payload = {
        "wrist_width_mm": 68.0,
        "palm_length_mm": 92.0,
        "hand_length_mm": 185.0,
        "note": "Calibrated Calipers",
    }
    m_res = client.post(f"/api/v1/patients/{p_id}/measurements", json=meas_payload)
    assert m_res.status_code == 201
    meas_rec = m_res.json()
    assert meas_rec["data"]["wrist_width_mm"] == 68.0

    # PUT test
    m_put = client.put(f"/api/v1/patients/{p_id}/measurements", json={**meas_payload, "wrist_width_mm": 69.0})
    assert m_put.status_code == 201
    assert m_put.json()["data"]["wrist_width_mm"] == 69.0

    # 3. Prediction
    pred_res = client.post(f"/api/v1/patients/{p_id}/predictions")
    assert pred_res.status_code == 201
    pred_data = pred_res.json()
    pred_id = pred_data["prediction_id"]
    assert "station_diameters_mm" in pred_data["prediction"]
    assert len(pred_data["prediction"]["station_diameters_mm"]) == 3
    assert pred_data["prediction"]["clearance_mm"] > 0

    # 4. Cast Generation with overrides and nested params
    cast_payload = {
        "prediction_id": pred_id,
        "vent_enabled": True,
        "vent_pattern": "staggered",
        "vent_hole_mm": 6.0,
        "vent_spacing_mm": 18.0,
        "tab_count": 3,
    }
    cast_res = client.post(f"/api/v1/patients/{p_id}/casts", json=cast_payload)
    assert cast_res.status_code == 201
    cast_data = cast_res.json()
    cast_id = cast_data["cast_id"]
    assert cast_data["status"] == "completed"

    # 5. Cast Versioning
    ver_res = client.post(
        f"/api/v1/casts/{cast_id}/versions",
        json={"params": cast_data["params"], "label": "Initial Clinical Revision"},
    )
    assert ver_res.status_code == 201
    assert ver_res.json()["version"] == 1

    vers_list = client.get(f"/api/v1/casts/{cast_id}/versions")
    assert vers_list.status_code == 200
    assert len(vers_list.json()) >= 1

    # 6. Artifact Downloads
    # Test canonical artifact key
    stl_a = client.get(f"/api/v1/patients/{p_id}/casts/{cast_id}/files/half_a_stl")
    assert stl_a.status_code == 200
    assert len(stl_a.content) > 0

    # Test filename alias download route
    alias_res = client.get(f"/api/v1/casts/{cast_id}/download/cast_half_A.stl")
    assert alias_res.status_code == 200
    assert len(alias_res.content) > 0

    # 7. Pipeline Route
    pipe_res = client.post(f"/api/v1/patients/{p_id}/pipeline")
    assert pipe_res.status_code == 201
    pipe_data = pipe_res.json()
    assert pipe_data["status"] == "completed"
    job_id = pipe_data["job_id"]

    # Job status & events
    job_status = client.get(f"/api/v1/jobs/{job_id}")
    assert job_status.status_code == 200
    assert job_status.json()["status"] == "completed"

    job_events = client.get(f"/api/v1/jobs/{job_id}/events")
    assert job_events.status_code == 200
    assert len(job_events.json()["events"]) >= 4

    patient_jobs = client.get(f"/api/v1/patients/{p_id}/jobs")
    assert patient_jobs.status_code == 200
    assert len(patient_jobs.json()) >= 1

    # 8. Validation & QA Logging
    val_res = client.post(f"/api/v1/validation", json={
        "patient_id": p_id,
        "metric": "wrist_width_mm",
        "manual_value": 68.0,
        "system_value": 69.5,
        "note": "Caliper vs Photogrammetry QA check",
    })
    assert val_res.status_code == 201
    val_data = val_res.json()
    assert val_data["verdict"] in ("pass", "warning")
    assert val_data["delta_mm"] == 1.5

    val_report = client.get("/api/v1/validation/report")
    assert val_report.status_code == 200
    assert val_report.json()["total_checks"] >= 1

    # Audit Trail
    audit_res = client.get(f"/api/v1/audit?patient_id={p_id}")
    assert audit_res.status_code == 200
    assert len(audit_res.json()) >= 1

    # 9. Clean up patient and check cascading deletion
    del_p = client.delete(f"/api/v1/patients/{p_id}")
    assert del_p.status_code == 200

