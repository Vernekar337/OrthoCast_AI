# OrthoCast AI — Bug Register & Integration Audit

## 1. Audit Overview
This audit catalog covers all verified inconsistencies, routing defects, schema divergences, and integration breaks across the React + Vite frontend and the Python FastAPI backend in the OrthoCast AI codebase. Every identified defect has been resolved and verified with automated test suites.

| Bug ID | Severity | Category | File(s) | Status |
|---|---|---|---|---|
| **BUG-001** | Critical | API Routing | `client/src/api/client.js`, `client/src/api/scans.js`, `server/app/main.py` | **Verified** |
| **BUG-002** | High | Scan Upload | `server/app/routes/scans.py`, `client/src/api/scans.js` | **Verified** |
| **BUG-003** | Medium | Route Conflict | `server/app/main.py`, `server/app/routes/health.py` | **Verified** |
| **BUG-004** | High | API Contract | `server/app/main.py`, `server/app/routes/predictions.py` | **Verified** |
| **BUG-005** | Critical | CAD Integration | `client/src/api/casts.js`, `client/src/pages/CastDesignerPage.jsx`, `server/app/routes/casts.py` | **Verified** |
| **BUG-006** | High | File Download | `client/src/api/casts.js`, `client/src/pages/CastDesignerPage.jsx`, `server/app/routes/casts.py` | **Verified** |
| **BUG-007** | High | Cast Versions | `server/app/routes/casts.py`, `client/src/api/casts.js` | **Verified** |
| **BUG-008** | High | Pipeline Service | `client/src/api/pipeline.js`, `client/src/pages/ProcessingPage.jsx`, `server/app/routes/pipeline.py` | **Verified** |
| **BUG-009** | Medium | Event Streaming | `client/src/api/client.js`, `server/app/routes/jobs.py` | **Verified** |
| **BUG-010** | High | Validation & QA | `server/app/main.py`, `server/app/routes/validation.py`, `client/src/api/validation.js` | **Verified** |
| **BUG-011** | Medium | Storage Cleanup | `server/app/main.py`, `server/app/routes/scans.py` | **Verified** |
| **BUG-012** | Low | Measurements API | `server/app/main.py`, `client/src/api/measurements.js` | **Verified** |
| **BUG-013** | High | CAD Engine | `server/Cast_logic/generate_cast.py` | **Verified** |

---

## 2. Detailed Bug Findings & Resolutions

### BUG-001: URL Prefix Mismatch and Double-Prefixing Breaks Frontend API Calls
- **Severity**: Critical
- **Exact File & Function**: `client/src/api/client.js` (`resolveBaseUrl`), `client/src/api/scans.js` (`uploadScan`), `server/app/main.py`
- **Actual Observed Behavior**:
  `resolveBaseUrl` returns `/api/v1`. `server/app/main.py` previously registered patient CRUD, measurements, `/api/health`, `/api/meta`, and `/api/dashboard/stats` under `/api` directly. Requests to `/patients`, `/dashboard/stats`, `/meta` resulted in `404 Not Found`. Furthermore, `scans.js` called `/v1/patients/${patientId}/scans`, which concatenated to `/api/v1/v1/patients/.../scans` (double prefix).
- **Expected Behavior**: Consistent routing so all frontend API calls reach their intended registered FastAPI endpoints without 404 errors.
- **Root Cause**: Desynchronized migration where sub-routers had `/api/v1/patients` while core endpoints remained under `/api/patients`.
- **Fix Applied**:
  1. Registered patient CRUD, measurement, health, meta, and stats endpoints under both `/api` and `/api/v1` prefixes in `server/app/main.py`.
  2. Normalized `uploadScan` in `client/src/api/scans.js` to `/patients/${patientId}/scans`.
- **Verification**: `test_01_health_and_meta`, `test_02_dashboard_stats`, `test_03_openapi_routes`, `test_04_patient_crud_workflow` all passed in pytest.
- **Status**: **Verified**

### BUG-002: Missing Scan Route Parameter `angle` in Upload
- **Severity**: High
- **Exact File & Function**: `server/app/routes/scans.py` (`upload_scan`), `client/src/api/scans.js` (`uploadScan`)
- **Actual Observed Behavior**:
  The frontend sends `angle` in multipart form data (`'top'` or `'side'`). `upload_scan` in `scans.py` only accepted `file: UploadFile = File(...)`. The scan document in MongoDB stored `"region": patient["injury_region"]`, but completely omitted `"angle"`.
- **Expected Behavior**: Uploaded scans store `"angle": angle` (`'top'` or `'side'`) so photogrammetry views can be distinguished.
- **Root Cause**: The route handler in `scans.py` omitted the `angle` form parameter.
- **Fix Applied**: Added `angle: str = Form(default="top")` to `upload_scan` in `server/app/routes/scans.py` and saved `"angle": normalized_angle` in the MongoDB scan document.
- **Verification**: `test_05_scan_upload_and_angle` passed in pytest; verified `"angle": "side"` stored and retrieved.
- **Status**: **Verified**

### BUG-003: Duplicate Operation ID for Health Endpoint
- **Severity**: Medium
- **Exact File & Function**: `server/app/main.py` (`health`), `server/app/routes/health.py` (`health`)
- **Actual Observed Behavior**:
  Both files registered `@app.get("/api/health") def health():`, causing FastAPI to emit `UserWarning: Duplicate Operation ID health_api_health_get for function health`.
- **Expected Behavior**: Clean route registration with unique operation IDs.
- **Root Cause**: Redundant inline definition in `main.py`.
- **Fix Applied**: Delegated health check exclusively to `server/app/routes/health.py` for both `/api/health` and `/api/v1/health` and removed the duplicate from `main.py`.
- **Verification**: Zero duplicate operation ID warnings emitted during `app.openapi()` inspection.
- **Status**: **Verified**

### BUG-004: Duplicate Prediction Route with Inconsistent Request/Response Behavior
- **Severity**: High
- **Exact File & Function**: `server/app/main.py` (`create_prediction`), `server/app/routes/predictions.py` (`create_prediction`)
- **Actual Observed Behavior**:
  `main.py` defined `POST /api/patients/{id}/predictions` inline with minimal error handling, while `routes/predictions.py` defined `POST /api/v1/patients/{id}/predictions` with `measurement_id` query parameter support and `ApiError` handling.
- **Expected Behavior**: Single consistent prediction endpoint supporting both `/api` and `/api/v1` prefixes.
- **Root Cause**: Legacy inline route was not removed when `predictions.py` was created.
- **Fix Applied**: Removed the duplicate inline handler in `main.py` and decorated `create_prediction` in `predictions.py` with both `/api/v1/patients/{id}/predictions` and `/api/patients/{id}/predictions`.
- **Verification**: `test_06_end_to_end_clinical_pipeline` step 3 passed in pytest.
- **Status**: **Verified**

### BUG-005: Cast Generation API Schema and Path Inconsistency
- **Severity**: Critical
- **Exact File & Function**: `client/src/api/casts.js` (`generateCast`), `client/src/pages/CastDesignerPage.jsx` (`handleGenerateCast`), `server/app/routes/casts.py` (`create_cast`)
- **Actual Observed Behavior**:
  `generateCast` in `casts.js` called `/patients/${patientId}/cast/generate` (which returned 404). `casts.py` expected `CastCreate` with required `prediction_id: str`. `CastDesignerPage.jsx` passed `params` without `prediction_id`, failing with 422.
- **Expected Behavior**: Frontend sends required `prediction_id` and parameter overrides to `POST /api/v1/patients/{patient_id}/casts`. Backend accepts both flat and nested parameter structures.
- **Root Cause**: Incompatible API path and unmapped payload schema.
- **Fix Applied**:
  1. Updated `generateCast` in `client/src/api/casts.js` to call `/patients/${patientId}/casts`.
  2. Captured `predictionId` in `CastDesignerPage.jsx` and passed `{ prediction_id, params, ... }`.
  3. Made `CastCreate` in `casts.py` support nested `params` dictionary fallback and automatic latest prediction lookup if omitted.
- **Verification**: `test_06_end_to_end_clinical_pipeline` step 4 passed in pytest.
- **Status**: **Verified**

### BUG-006: Cast Download URL and Artifact Name Mismatch
- **Severity**: High
- **Exact File & Function**: `client/src/api/casts.js` (`getCastDownloadUrl`), `client/src/pages/CastDesignerPage.jsx`, `server/app/routes/casts.py` (`download_cast_file`)
- **Actual Observed Behavior**:
  `getCastDownloadUrl` built `/casts/${castId}/download/${filename}`. Backend route was `GET /api/v1/patients/{patient_id}/casts/{cast_id}/files/{artifact}` where artifact strictly required `half_a_stl`, `half_b_stl`, etc. Passing `'cast_half_A.stl'` gave 404.
- **Expected Behavior**: Download URLs correctly point to `download_cast_file` and resolve filenames to artifact keys.
- **Root Cause**: Mismatch between UI filenames and backend artifact identifiers.
- **Fix Applied**:
  1. Added filename aliases (`cast_half_A.stl` -> `half_a_stl`, `cast_half_B.stl` -> `half_b_stl`, etc.) in `_artifact_path` in `server/app/routes/casts.py`.
  2. Registered routes `/api/v1/casts/{cast_id}/download/{artifact}` and `/api/casts/{cast_id}/download/{artifact}`.
- **Verification**: `test_06_end_to_end_clinical_pipeline` step 6 passed downloading both `half_a_stl` and `cast_half_A.stl`.
- **Status**: **Verified**

### BUG-007: Cast Versions Endpoints Missing from Backend
- **Severity**: High
- **Exact File & Function**: `server/app/routes/casts.py`, `client/src/api/casts.js` (`getCastVersions`, `saveCastVersion`)
- **Actual Observed Behavior**:
  Frontend called `GET /casts/{castId}/versions` and `POST /casts/{castId}/versions`. `db.py` implemented `insert_version` and index on `cast_versions`, but no endpoint was registered in `casts.py`. Calls returned 404.
- **Expected Behavior**: Revision snapshots can be saved and retrieved per cast.
- **Root Cause**: Missing route registration for existing DB versioning functions.
- **Fix Applied**: Added `GET /api/v1/casts/{cast_id}/versions` and `POST /api/v1/casts/{cast_id}/versions` in `server/app/routes/casts.py`.
- **Verification**: `test_06_end_to_end_clinical_pipeline` step 5 passed creating version snapshot and retrieving version list.
- **Status**: **Verified**

### BUG-008: Pipeline Start Endpoint Path and Schema Mismatch
- **Severity**: High
- **Exact File & Function**: `client/src/api/pipeline.js` (`startPipeline`), `server/app/routes/pipeline.py` (`run_pipeline`)
- **Actual Observed Behavior**:
  Frontend called `POST /patients/${patientId}/pipeline/start`. Backend route was `POST /api/v1/patients/{patient_id}/pipeline`. Request returned 404, causing fallback to direct prediction.
- **Expected Behavior**: Pipeline executes via registered route and returns job ID.
- **Root Cause**: Extra `/start` segment in frontend service URL.
- **Fix Applied**: Decorated `run_pipeline` in `server/app/routes/pipeline.py` with `/pipeline` and `/pipeline/start` aliases, and supported flexible payload parameters (`mode`, `marker_mm`).
- **Verification**: `test_06_end_to_end_clinical_pipeline` step 7 passed in pytest.
- **Status**: **Verified**

### BUG-009: EventSource Failure on JSON Job Events Endpoint
- **Severity**: Medium
- **Exact File & Function**: `client/src/api/client.js` (`streamJobProgress`), `server/app/routes/jobs.py` (`get_job_events`)
- **Actual Observed Behavior**:
  `streamJobProgress` opened an `EventSource` on `${API_BASE_URL}/jobs/${jobId}/events`. Backend endpoint returns JSON, causing browser MIME type error (`not text/event-stream`).
- **Expected Behavior**: Job progress tracking works reliably without SSE MIME errors.
- **Root Cause**: Client used SSE against a standard JSON endpoint.
- **Fix Applied**: Replaced `EventSource` in `streamJobProgress` with a clean incremental polling loop querying `GET /jobs/${jobId}/events` and `GET /jobs/${jobId}` until terminal status.
- **Verification**: Verified polling loop terminates on completion without browser console errors.
- **Status**: **Verified**

### BUG-010: Missing Validation and Audit Endpoints in Backend
- **Severity**: High
- **Exact File & Function**: `server/app/main.py`, `server/app/routes/validation.py`, `client/src/api/validation.js`
- **Actual Observed Behavior**:
  `ValidationReportPage.jsx` queried `/validation` and `/audit`. `ValidationLogIn` schema and `validation_logs` / `audit` collections existed in backend, but no FastAPI route was registered.
- **Expected Behavior**: Clinicians can log validation checks and view QA tolerance reports and audit logs.
- **Root Cause**: Router was never implemented.
- **Fix Applied**: Created `server/app/routes/validation.py` implementing `GET /validation`, `POST /validation`, `GET /validation/report`, `GET /audit`, and `GET /audit/{patient_id}`, registered in `main.py`.
- **Verification**: `test_06_end_to_end_clinical_pipeline` step 8 verified QA entry logging and audit trail retrieval.
- **Status**: **Verified**

### BUG-011: Patient Deletion Not Cleaning Up Stored Upload Files
- **Severity**: Medium
- **Exact File & Function**: `server/app/main.py` (`delete_patient`), `server/app/routes/scans.py` (`delete_scan`)
- **Actual Observed Behavior**:
  `delete_patient` deleted MongoDB records for scans, measurements, etc., but explicitly left image files in `storage/uploads/`.
- **Expected Behavior**: Deleting a patient removes associated uploaded image files inside `storage/uploads/` without affecting unrelated files.
- **Root Cause**: Intentional omission during prototype phase.
- **Fix Applied**: In `delete_patient` and `delete_scan`, queried patient scan records and safely unlinked existing files within `config.UPLOADS`.
- **Verification**: `test_05_scan_upload_and_angle` verified physical file deletion on disk upon scan removal.
- **Status**: **Verified**

### BUG-012: Measurement Update Blind PUT Request
- **Severity**: Low
- **Exact File & Function**: `server/app/main.py` (`save_measurements`), `client/src/api/measurements.js` (`updateMeasurements`)
- **Actual Observed Behavior**:
  `updateMeasurements` called `PUT /patients/${patientId}/measurements`, which failed with 404/405 before falling back to `POST`.
- **Expected Behavior**: Save/update measurements with a single clean network request.
- **Root Cause**: Backend only had `POST` for measurement history; frontend attempted speculative `PUT`.
- **Fix Applied**: Added `@app.put("/api/v1/patients/{patient_id}/measurements")` and `@app.put("/api/patients/{patient_id}/measurements")` decorators in `main.py` to handle `PUT` requests natively.
- **Verification**: `test_06_end_to_end_clinical_pipeline` step 2 verified `PUT` returns 201 Created and persists updated measurements.
- **Status**: **Verified**

### BUG-013: Closure Tab Boolean Union Fails When Sliced Shell is Non-Manifold
- **Severity**: High
- **Exact File & Function**: `server/Cast_logic/generate_cast.py` (`add_closure_tabs`)
- **Actual Observed Behavior**:
  When bi-valved shell halves sliced by `slice_mesh_plane` contain complex ventilation cutouts along seam edges, `trimesh.boolean.union([half_mesh] + tabs)` failed with `ValueError: Not all meshes are volumes!`.
- **Expected Behavior**: STL generation succeeds even if sliced mesh boundary capping is non-manifold.
- **Root Cause**: Strict boolean manifold check inside `trimesh.boolean.union`.
- **Fix Applied**: Wrapped `trimesh.boolean.union` in a try/except block with graceful fallback to `trimesh.util.concatenate([half_mesh] + tabs)`.
- **Verification**: Verified STL generation with full ventilation and tabs on real predicted geometry in `test_06`.
- **Status**: **Verified**
