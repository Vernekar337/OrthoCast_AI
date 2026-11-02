import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  CheckCircle2,
  X,
  Info,
  Hand,
  Footprints,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Eye,
  Layers,
  ChevronRight,
  AlertCircle,
  Cpu,
  Ruler,
  Camera,
  FileText,
  User,
  Shield,
  Loader2,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  StatusBadge,
  Button,
  LoadingState,
  ErrorState,
  FormField,
} from '../components/common';
import { createPatient } from '../api/patients';

import {
  uploadScan,
  getScans,
  measureScan,
  getAnnotatedPreviewUrl,
} from '../api/scans';

import { saveMeasurements } from '../api/measurements';

// ── Hand & Foot SVG Illustrations ──────────────────────────────────────────
function HandIllustration({ angle }) {
  return (
    <svg viewBox="0 0 160 180" className="w-28 h-32 opacity-25" fill="none" xmlns="http://www.w3.org/2000/svg">
      {angle === 'top' ? (
        <g stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M55 100 Q50 130 55 150 Q80 165 105 150 Q110 130 105 100 Z" />
          <path d="M55 110 Q40 105 35 90 Q33 78 42 72 Q52 68 58 80 L60 100" />
          <path d="M65 100 L63 62 Q63 52 70 50 Q78 49 80 58 L80 100" />
          <path d="M80 100 L80 55 Q80 44 87 43 Q95 43 96 54 L95 100" />
          <path d="M95 100 L97 62 Q98 51 105 51 Q113 52 113 62 L110 100" />
          <path d="M110 100 L112 72 Q113 64 119 64 Q125 65 124 74 L120 100" />
          <line x1="65" y1="90" x2="115" y2="90" strokeDasharray="3 4" strokeWidth="1" opacity="0.6"/>
        </g>
      ) : (
        <g stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M40 140 Q40 160 80 162 Q120 160 120 140 L118 100 Q118 88 108 86 L75 85 Q62 86 60 100 Z" />
          <path d="M75 85 Q73 65 78 55 Q83 48 90 52 Q96 58 93 70 L88 86" />
          <path d="M88 85 Q87 60 93 50 Q99 43 106 47 Q112 54 109 68 L105 86" />
          <path d="M60 102 Q48 98 44 87 Q42 76 52 71 Q62 69 65 82 L66 100" />
        </g>
      )}
    </svg>
  );
}

function FootIllustration({ angle }) {
  return (
    <svg viewBox="0 0 160 180" className="w-28 h-32 opacity-25" fill="none" xmlns="http://www.w3.org/2000/svg">
      {angle === 'top' ? (
        <g stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50 160 Q45 130 48 100 Q52 70 65 55 Q80 45 95 55 Q108 65 110 90 Q112 115 108 145 Q104 162 80 165 Q58 164 50 160 Z" />
          <path d="M65 55 Q62 42 68 35 Q75 30 82 36 Q87 44 82 55" />
          <path d="M80 52 Q79 38 85 32 Q91 28 97 35 Q101 43 96 52" />
          <path d="M95 56 Q95 43 100 37 Q106 34 111 40 Q114 48 110 57" />
          <path d="M108 64 Q109 52 113 47 Q118 44 122 50 Q124 57 120 65" />
          <path d="M118 73 Q120 63 124 59 Q129 57 132 62 Q133 69 128 75" />
          <path d="M50 130 Q60 122 65 130" strokeDasharray="3 4" strokeWidth="1" opacity="0.6"/>
        </g>
      ) : (
        <g stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M30 145 Q30 158 55 162 Q90 165 120 155 Q135 148 138 138 Q138 128 130 124 L100 50 Q96 42 88 40 Q78 39 74 48 L68 65 Q60 80 55 105 Q48 125 35 140 Z" />
          <ellipse cx="38" cy="132" rx="10" ry="8" stroke="#2DD4BF" strokeWidth="1.5" opacity="0.6"/>
          <path d="M130 124 Q136 118 140 110 Q142 102 138 97 Q133 93 128 98 L120 115" />
        </g>
      )}
    </svg>
  );
}

// ── 50mm Calibration Marker Graphic ─────────────────────────────────────────
function CalibrationMarker() {
  return (
    <svg viewBox="0 0 40 40" className="w-7 h-7 text-cyan-400 flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="36" height="36" rx="3" stroke="currentColor" strokeWidth="2"/>
      <rect x="6" y="6" width="10" height="10" fill="currentColor" opacity="0.8"/>
      <rect x="24" y="6" width="10" height="10" fill="currentColor" opacity="0.8"/>
      <rect x="6" y="24" width="10" height="10" fill="currentColor" opacity="0.8"/>
      <rect x="16" y="16" width="8" height="8" fill="currentColor" opacity="0.4"/>
      <rect x="24" y="24" width="5" height="5" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export default function NewPatientPage() {
  const navigate = useNavigate();

  // Wizard Step: 1 = Demographics, 2 = Scans / Measurements
  const [currentStep, setCurrentStep] = useState(1);

  // ── Step 1: Patient Demographic Form (PatientIn) ──
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'M',
    height_cm: '',
    injury_region: 'wrist',
    swelling_stage: 'acute',
    notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmittingPatient, setIsSubmittingPatient] = useState(false);
  const [patientApiError, setPatientApiError] = useState(null);

  // Stored Patient state after successful creation in FastAPI/MongoDB
  const [createdPatient, setCreatedPatient] = useState(null);

  // ── Step 2: Intake Mode (Scan Upload vs Manual Measurements) ──
  const [intakeMode, setIntakeMode] = useState('scan'); // 'scan' | 'measurements'

  // Scan State
  const [topScan, setTopScan] = useState({ file: null, preview: null, progress: 0, uploaded: false, error: null });
  const [sideScan, setSideScan] = useState({ file: null, preview: null, progress: 0, uploaded: false, error: null });
  const [uploadingScans, setUploadingScans] = useState(false);

  // Manual Measurements State (MeasurementIn)
  const [measurements, setMeasurements] = useState({
    wrist_width_mm: '',
    palm_length_mm: '',
    hand_length_mm: '',
    foot_length_mm: '',
    foot_width_mm: '',
    ankle_circumference_mm: '',
    note: '',
  });
  const [measuringSubmitting, setMeasuringSubmitting] = useState(false);
  const [measuringError, setMeasuringError] = useState(null);

  const [scanResults, setScanResults] = useState([]);
  const [measuringScanId, setMeasuringScanId] = useState(null);
  const [scanMeasureError, setScanMeasureError] = useState(null);

  // Drag and drop state
  const [draggingTop, setDraggingTop] = useState(false);
  const [draggingSide, setDraggingSide] = useState(false);
  const topInputRef = useRef(null);
  const sideInputRef = useRef(null);

  // ── Validation for Step 1 ──
  const validateIntakeForm = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Patient name is required.';
    else if (formData.name.trim().length > 80) errs.name = 'Name must be 80 characters or fewer.';

    const ageNum = parseInt(formData.age, 10);
    if (!formData.age || isNaN(ageNum)) errs.age = 'Age is required.';
    else if (ageNum < 1 || ageNum > 110) errs.age = 'Age must be between 1 and 110.';

    if (!['M', 'F'].includes(formData.gender)) errs.gender = 'Gender must be M or F.';
    if (!['wrist', 'ankle'].includes(formData.injury_region)) errs.injury_region = 'Region must be wrist or ankle.';
    if (!['acute', 'subacute', 'none'].includes(formData.swelling_stage)) errs.swelling_stage = 'Invalid swelling stage.';

    if (formData.height_cm) {
      const hNum = parseFloat(formData.height_cm);
      if (isNaN(hNum) || hNum < 50 || hNum > 230) errs.height_cm = 'Height must be between 50 and 230 cm.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Handle Patient Creation (POST /api/patients) ──
  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (isSubmittingPatient) return;
    if (!validateIntakeForm()) return;

    setIsSubmittingPatient(true);
    setPatientApiError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        injury_region: formData.injury_region,
        swelling_stage: formData.swelling_stage,
        notes: formData.notes ? formData.notes.trim() : null,
      };

      const result = await createPatient(payload);
      // Use returned patient ID from FastAPI/MongoDB
      const patientRecord = result?.patient || result;
      setCreatedPatient(patientRecord);
      setCurrentStep(2);
    } catch (err) {
      setPatientApiError(err);
    } finally {
      setIsSubmittingPatient(false);
    }
  };

  // ── File Selection & Validation ──
  const handleSelectFile = (file, targetSetter) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      targetSetter((prev) => ({ ...prev, error: 'File must be an image (JPEG, PNG, or WebP).' }));
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      targetSetter((prev) => ({
        ...prev,
        error: `File size exceeds 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      }));
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    targetSetter({
      file,
      preview: previewUrl,
      progress: 0,
      uploaded: false,
      error: null,
    });
  };

  // ── Upload Scans (POST /api/patients/:id/scans) ──
  
const handleUploadScans = async () => {
  if (!createdPatient) return;

  const patientId = createdPatient.id || createdPatient._id;
  if (!patientId) {
    setScanMeasureError('Patient ID is missing.');
    return;
  }

  setUploadingScans(true);
  setScanMeasureError(null);
  setScanResults([]);

  let topOk = topScan.uploaded;
  let sideOk = sideScan.uploaded;

  try {
    if (topScan.file && !topScan.uploaded) {
      setTopScan((p) => ({ ...p, error: null }));

      await uploadScan(patientId, topScan.file, 'top', (pct) => {
        setTopScan((p) => ({ ...p, progress: pct }));
      });

      topOk = true;
      setTopScan((p) => ({
        ...p,
        uploaded: true,
        progress: 100,
      }));
    }

    if (sideScan.file && !sideScan.uploaded) {
      setSideScan((p) => ({ ...p, error: null }));

      await uploadScan(patientId, sideScan.file, 'side', (pct) => {
        setSideScan((p) => ({ ...p, progress: pct }));
      });

      sideOk = true;
      setSideScan((p) => ({
        ...p,
        uploaded: true,
        progress: 100,
      }));
    }

    if (!topOk || !sideOk) {
      throw new Error('Please upload both scan images.');
    }

    // Retrieve uploaded scans so we have their MongoDB IDs.
    const scans = await getScans(patientId);
    const scanList = Array.isArray(scans)
      ? scans
      : scans?.scans ?? [];

    // Only measure the top-down scan. The foot CV algorithm
    // requires a top-down image.
    const topScanRecord = scanList.find(
      (scan) => scan.angle === 'top'
    );

    if (!topScanRecord?.id) {
      throw new Error(
        'Top-down scan was uploaded, but its scan ID could not be found.'
      );
    }

    setMeasuringScanId(topScanRecord.id);

    const result = await measureScan(
      patientId,
      topScanRecord.id
    );

    setScanResults([
      {
        ...result,
        scanId: topScanRecord.id,
        previewUrl: getAnnotatedPreviewUrl(
          patientId,
          topScanRecord.id
        ),
      },
    ]);

  } catch (err) {
    setScanMeasureError(
      err?.response?.data?.detail?.message ||
      err?.response?.data?.detail ||
      err?.message ||
      'Scan upload or measurement failed.'
    );
  } finally {
    setUploadingScans(false);
    setMeasuringScanId(null);
  }
};


  // ── Save Manual Measurements (POST /api/patients/:id/measurements) ──
  const handleSaveMeasurements = async (e) => {
    e.preventDefault();
    if (!createdPatient) return;
    const patientId = createdPatient.id || createdPatient._id;
    setMeasuringSubmitting(true);
    setMeasuringError(null);

    try {
      const isWrist = createdPatient.injury_region === 'wrist';
      const payload = isWrist
        ? {
            wrist_width_mm: parseFloat(measurements.wrist_width_mm),
            palm_length_mm: parseFloat(measurements.palm_length_mm),
            hand_length_mm: parseFloat(measurements.hand_length_mm),
            note: measurements.note ? measurements.note.trim() : null,
          }
        : {
            foot_length_mm: parseFloat(measurements.foot_length_mm),
            foot_width_mm: parseFloat(measurements.foot_width_mm),
            ankle_circumference_mm: parseFloat(measurements.ankle_circumference_mm),
            note: measurements.note ? measurements.note.trim() : null,
          };

      await saveMeasurements(patientId, payload);
      // Navigate to Processing view
      navigate(`/processing/${patientId}`);
    } catch (err) {
      setMeasuringError(err);
    } finally {
      setMeasuringSubmitting(false);
    }
  };

  const isWrist = (createdPatient?.injury_region || formData.injury_region) === 'wrist';
  const Illustration = isWrist ? HandIllustration : FootIllustration;
  const bothScansReady = Boolean(topScan.file && sideScan.file);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* ── Page Header ── */}
      <PageHeader
        title="Patient Intake & Anatomical Capture"
        subtitle="Collect validated demographic boundaries and multi-angle photogrammetry calibrated for AI cast fabrication."
        breadcrumbs={
          <div className="flex items-center gap-2">
            <span className={currentStep === 1 ? 'text-cyan-400 font-bold' : 'text-slate-400'}>
              Step 1: Patient Intake
            </span>
            <span>&gt;</span>
            <span className={currentStep === 2 ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
              Step 2: Scans & Calibration
            </span>
            <span>&gt;</span>
            <span className="text-slate-600">Step 3: Processing & Results</span>
          </div>
        }
        badge={
          createdPatient && (
            <span className="badge badge-success font-mono text-[10px]">
              ID: {createdPatient.id || createdPatient._id}
            </span>
          )
        }
      />

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1: PATIENT CLINICAL INTAKE (PatientIn)
      ═══════════════════════════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <Card
          title="Step 1 — Clinical Demographics & Injury Classification"
          subtitle="All fields strictly adhere to the FastAPI PatientIn request model."
          icon={User}
          reticle={true}
        >
          <form onSubmit={handleCreatePatient} className="space-y-5">
            {patientApiError && (
              <ErrorState error={patientApiError} title="Patient Registration Failed" />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <FormField
                label="Patient Full Name"
                name="name"
                required={true}
                error={fieldErrors.name}
                tooltip="Patient full legal name or clinical trial identifier (1-80 chars)."
              >
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Elena Rostova"
                  className="input text-xs"
                />
              </FormField>

              {/* Age */}
              <FormField
                label="Age"
                name="age"
                unit="years"
                required={true}
                error={fieldErrors.age}
                tooltip="Must be between 1 and 110."
              >
                <input
                  type="number"
                  required
                  min={1}
                  max={110}
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  placeholder="e.g. 34"
                  className="input text-xs font-mono"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Biological Gender */}
              <FormField
                label="Biological Gender"
                name="gender"
                required={true}
                error={fieldErrors.gender}
              >
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="select text-xs font-mono"
                >
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                </select>
              </FormField>

              {/* Height */}
              <FormField
                label="Height (Optional)"
                name="height_cm"
                unit="cm"
                error={fieldErrors.height_cm}
                tooltip="Optional height for volumetric normalization (50-230 cm)."
              >
                <input
                  type="number"
                  min={50}
                  max={230}
                  value={formData.height_cm}
                  onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                  placeholder="e.g. 172"
                  className="input text-xs font-mono"
                />
              </FormField>

              {/* Anatomical Region */}
              <FormField
                label="Target Anatomical Region"
                name="injury_region"
                required={true}
                error={fieldErrors.injury_region}
              >
                <select
                  value={formData.injury_region}
                  onChange={(e) => setFormData({ ...formData, injury_region: e.target.value })}
                  className="select text-xs font-mono"
                >
                  <option value="wrist">Wrist / Forearm</option>
                  <option value="ankle">Ankle / Lower Leg</option>
                </select>
              </FormField>
            </div>

            {/* Swelling Stage */}
            <FormField
              label="Edema / Swelling Stage"
              name="swelling_stage"
              required={true}
              tooltip="Critical parameter: models adjust circumferential clearance margin based on swelling severity."
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'acute', label: 'Acute Swelling', desc: '+4.0mm expansion buffer for active inflammation' },
                  { id: 'subacute', label: 'Subacute Swelling', desc: '+2.0mm clearance for stabilizing edema' },
                  { id: 'none', label: 'Normal / None', desc: 'Anatomical flush fit with nominal padding' },
                ].map((s) => (
                  <label
                    key={s.id}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      formData.swelling_stage === s.id
                        ? 'border-cyan-400 bg-cyan-950/30'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="swelling_stage"
                        value={s.id}
                        checked={formData.swelling_stage === s.id}
                        onChange={(e) => setFormData({ ...formData, swelling_stage: e.target.value })}
                        className="accent-cyan-400"
                      />
                      <span className="text-xs font-bold font-mono text-slate-100">{s.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 pl-5">{s.desc}</p>
                  </label>
                ))}
              </div>
            </FormField>

            {/* Clinical Notes */}
            <FormField label="Clinical Notes & Diagnosis" name="notes">
              <textarea
                rows={3}
                maxLength={500}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Fracture classification (e.g. Colles, Smith), immobilization duration, skin sensitivities…"
                className="input text-xs"
              />
            </FormField>

            {/* Submit / Proceed */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => navigate('/patients')}
              >
                Cancel & Return
              </Button>
              <Button
                type="submit"
                variant="primary"
                icon={ArrowRight}
                isLoading={isSubmittingPatient}
              >
                Save Intake & Proceed to Capture
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2: SCAN UPLOAD & CALIBRATION / MANUAL ENTRY
      ═══════════════════════════════════════════════════════════════════════ */}
      {currentStep === 2 && createdPatient && (
        <div className="space-y-6">
          {/* Patient Header Card */}
          <div className="p-4 rounded-lg bg-slate-900/90 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 font-bold font-mono">
                {(createdPatient.name || 'P')[0]?.toUpperCase()}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  {createdPatient.name}
                  <span className="text-xs font-normal text-slate-400">
                    ({createdPatient.age}y / {createdPatient.gender})
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Assigned MongoDB ID: <span className="text-cyan-300 font-bold">{createdPatient.id || createdPatient._id}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={createdPatient.injury_region} />
              <StatusBadge status={createdPatient.swelling_stage} />
            </div>
          </div>

          {/* Mode Switch: Scans vs Manual */}
          <div className="flex rounded-md border border-slate-800 p-1 bg-slate-950/60 w-fit">
            <button
              onClick={() => setIntakeMode('scan')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-mono transition-all ${
                intakeMode === 'scan'
                  ? 'bg-cyan-500 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Dual-Angle Photogrammetry
            </button>
            <button
              onClick={() => setIntakeMode('measurements')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-mono transition-all ${
                intakeMode === 'measurements'
                  ? 'bg-cyan-500 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Ruler className="w-3.5 h-3.5" />
              Manual Caliper Measurements
            </button>
          </div>

          {/* ── Mode A: Scan Upload ── */}
          {intakeMode === 'scan' && (
            <div className="space-y-6">
              {/* Calibration Guide Callout */}
              <div className="p-4 rounded-lg bg-cyan-950/30 border border-cyan-700/50 flex items-start gap-3">
                <CalibrationMarker />
                <div className="text-xs leading-relaxed space-y-1">
                  <p className="font-bold text-cyan-300 uppercase tracking-wide font-mono">
                    Calibration Reference Protocol (50.0 mm Required)
                  </p>
                  <p className="text-slate-300">
                    Place a <strong>50 mm × 50 mm square reference marker</strong> directly coplanar with the limb in both images. The OpenCV pipeline relies on this marker to calculate the pixel-to-millimeter ratio. Without it, dimensional scaling cannot be validated.
                  </p>
                </div>
              </div>

              {/* Dual Upload Panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Panel 1: Top-Down Scan */}
                <Card
                  title={`Top-Down ${isWrist ? 'Dorsal' : 'Superior'} View`}
                  subtitle="Perpendicular 90° angle directly above limb"
                  icon={Camera}
                  reticle={true}
                >
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDraggingTop(true); }}
                    onDragLeave={() => setDraggingTop(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDraggingTop(false);
                      handleSelectFile(e.dataTransfer.files?.[0], setTopScan);
                    }}
                    onClick={() => !topScan.preview && topInputRef.current?.click()}
                    className={`relative h-56 rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-all cursor-pointer overflow-hidden ${
                      draggingTop
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : topScan.preview
                        ? 'border-cyan-500/40 bg-slate-900/60'
                        : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
                    }`}
                  >
                    {/* Illustration Background */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Illustration angle="top" />
                    </div>

                    {topScan.preview ? (
                      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                        <img
                          src={topScan.preview}
                          alt="Top scan preview"
                          className="max-h-36 object-contain rounded border border-slate-800 mb-2 shadow"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-300 truncate max-w-[180px]">
                            {topScan.file?.name}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTopScan({ file: null, preview: null, progress: 0, uploaded: false, error: null });
                            }}
                            className="p-1 rounded bg-rose-950/60 text-rose-400 hover:bg-rose-900"
                            title="Remove image"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-200">Drop Top-Down Image</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP up to 25MB</p>
                        </div>
                      </div>
                    )}

                    <input
                      ref={topInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleSelectFile(e.target.files?.[0], setTopScan)}
                    />
                  </div>

                  {topScan.progress > 0 && topScan.progress < 100 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] font-mono text-cyan-400 mb-1">
                        <span>Uploading…</span>
                        <span>{topScan.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                        <div className="bg-cyan-400 h-1" style={{ width: `${topScan.progress}%` }} />
                      </div>
                    </div>
                  )}

                  {topScan.uploaded && (
                    <div className="mt-2 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Uploaded to FastAPI server
                    </div>
                  )}

                  {topScan.error && (
                    <p className="mt-2 text-[11px] font-mono text-rose-400">{topScan.error}</p>
                  )}
                </Card>

                {/* Panel 2: Side-Angle Scan */}
                <Card
                  title={`Side-Angle ${isWrist ? 'Lateral' : 'Sagittal'} View`}
                  subtitle="Horizontal 90° lateral angle capture"
                  icon={Camera}
                  reticle={true}
                >
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDraggingSide(true); }}
                    onDragLeave={() => setDraggingSide(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDraggingSide(false);
                      handleSelectFile(e.dataTransfer.files?.[0], setSideScan);
                    }}
                    onClick={() => !sideScan.preview && sideInputRef.current?.click()}
                    className={`relative h-56 rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-all cursor-pointer overflow-hidden ${
                      draggingSide
                        ? 'border-cyan-400 bg-cyan-950/40'
                        : sideScan.preview
                        ? 'border-cyan-500/40 bg-slate-900/60'
                        : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
                    }`}
                  >
                    {/* Illustration Background */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Illustration angle="side" />
                    </div>

                    {sideScan.preview ? (
                      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                        <img
                          src={sideScan.preview}
                          alt="Side scan preview"
                          className="max-h-36 object-contain rounded border border-slate-800 mb-2 shadow"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-300 truncate max-w-[180px]">
                            {sideScan.file?.name}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSideScan({ file: null, preview: null, progress: 0, uploaded: false, error: null });
                            }}
                            className="p-1 rounded bg-rose-950/60 text-rose-400 hover:bg-rose-900"
                            title="Remove image"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-200">Drop Side-Angle Image</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP up to 25MB</p>
                        </div>
                      </div>
                    )}

                    <input
                      ref={sideInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleSelectFile(e.target.files?.[0], setSideScan)}
                    />
                  </div>

                  {sideScan.progress > 0 && sideScan.progress < 100 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] font-mono text-cyan-400 mb-1">
                        <span>Uploading…</span>
                        <span>{sideScan.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded overflow-hidden">
                        <div className="bg-cyan-400 h-1" style={{ width: `${sideScan.progress}%` }} />
                      </div>
                    </div>
                  )}

                  {sideScan.uploaded && (
                    <div className="mt-2 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Uploaded to FastAPI server
                    </div>
                  )}

                  {sideScan.error && (
                    <p className="mt-2 text-[11px] font-mono text-rose-400">{sideScan.error}</p>
                  )}
                </Card>
              </div>

              {/* Upload & Proceed Action Row */}
              <Card bodyClassName="p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className={topScan.file ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      Top Scan: {topScan.file ? 'Selected' : 'Pending'}
                    </span>
                    <span>•</span>
                    <span className={sideScan.file ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      Side Scan: {sideScan.file ? 'Selected' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      disabled={uploadingScans}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back to Intake
                    </Button>
                    <Button
                      variant="primary"
                      disabled={!bothScansReady || uploadingScans}
                      isLoading={uploadingScans}
                      onClick={handleUploadScans}
                      className="flex-1 sm:flex-initial"
                    >
                      
<Camera className="w-3.5 h-3.5" />
Upload Scans & Measure

                    </Button>
                  </div>
                </div>
              </Card>
              
{scanMeasureError && (
  <div className="p-4 rounded-lg border border-rose-500/40 bg-rose-950/20 text-rose-300 text-sm">
    <div className="font-bold mb-1">Scan processing failed</div>
    <p>{String(scanMeasureError)}</p>
  </div>
)}

{scanResults.map((item) => (
  <Card
    key={item.scanId}
    title="Computer Vision Measurement Result"
    subtitle="Review the output before continuing."
    icon={Ruler}
    reticle={true}
  >
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-emerald-400">
        <CheckCircle2 className="w-4 h-4" />
        Scan measurement completed
      </div>

      {item.previewUrl && (
        <div>
          <p className="text-xs text-slate-400 mb-2">
            Annotated scan preview
          </p>
          <img
            src={item.previewUrl}
            alt="Annotated scan showing detected landmarks"
            className="max-h-96 w-full object-contain rounded-lg border border-slate-700"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(
          item.measurement?.data ??
          item.measurement?.measurements ??
          {}
        ).map(([key, value]) => (
          <div
            key={key}
            className="p-3 rounded border border-slate-800 bg-slate-900/50"
          >
            <p className="text-xs text-slate-400">
              {key.replaceAll('_', ' ')}
            </p>
            <p className="text-sm font-mono text-white mt-1">
              {value == null ? 'Not available' : String(value)}
              {value != null ? ' mm' : ''}
            </p>
          </div>
        ))}
      </div>

      {item.demo_only && (
        <p className="text-xs text-amber-300">
          Demo-only measurements: calibration has not been validated.
          Do not use these measurements for clinical decisions or cast fabrication.
        </p>
      )}

      <Button
        variant="primary"
        icon={ArrowRight}
        onClick={() =>
          navigate(`/processing/${createdPatient.id || createdPatient._id}`)
        }
      >
        Continue to Processing
      </Button>
    </div>
  </Card>
))}

            </div>
          )}

          {/* ── Mode B: Manual Measurements Entry ── */}
          {intakeMode === 'measurements' && (
            <Card
              title={`Direct Caliper Landmark Entry (${isWrist ? 'Wrist' : 'Ankle'})`}
              subtitle="Conforms to MeasurementIn schema for cases without photogrammetric scans."
              icon={Ruler}
              reticle={true}
            >
              <form onSubmit={handleSaveMeasurements} className="space-y-4">
                {measuringError && (
                  <ErrorState error={measuringError} title="Measurement Entry Failed" />
                )}

                {isWrist ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Wrist Width (Caliper)" unit="mm" required={true}>
                      <input
                        type="number"
                        step="0.1"
                        min={20}
                        max={120}
                        required
                        value={measurements.wrist_width_mm}
                        onChange={(e) => setMeasurements({ ...measurements, wrist_width_mm: e.target.value })}
                        placeholder="e.g. 58.2"
                        className="input text-xs font-mono"
                      />
                    </FormField>

                    <FormField label="Palm Length" unit="mm" required={true}>
                      <input
                        type="number"
                        step="0.1"
                        min={40}
                        max={150}
                        required
                        value={measurements.palm_length_mm}
                        onChange={(e) => setMeasurements({ ...measurements, palm_length_mm: e.target.value })}
                        placeholder="e.g. 84.0"
                        className="input text-xs font-mono"
                      />
                    </FormField>

                    <FormField label="Total Hand Length" unit="mm" required={true}>
                      <input
                        type="number"
                        step="0.1"
                        min={80}
                        max={260}
                        required
                        value={measurements.hand_length_mm}
                        onChange={(e) => setMeasurements({ ...measurements, hand_length_mm: e.target.value })}
                        placeholder="e.g. 182.5"
                        className="input text-xs font-mono"
                      />
                    </FormField>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField label="Foot Length" unit="mm" required={true}>
                      <input
                        type="number"
                        step="0.1"
                        min={100}
                        max={340}
                        required
                        value={measurements.foot_length_mm}
                        onChange={(e) => setMeasurements({ ...measurements, foot_length_mm: e.target.value })}
                        placeholder="e.g. 245.0"
                        className="input text-xs font-mono"
                      />
                    </FormField>

                    <FormField label="Foot Width" unit="mm" required={true}>
                      <input
                        type="number"
                        step="0.1"
                        min={40}
                        max={140}
                        required
                        value={measurements.foot_width_mm}
                        onChange={(e) => setMeasurements({ ...measurements, foot_width_mm: e.target.value })}
                        placeholder="e.g. 88.0"
                        className="input text-xs font-mono"
                      />
                    </FormField>

                    <FormField label="Ankle Circumference" unit="mm" required={true}>
                      <input
                        type="number"
                        step="0.1"
                        min={100}
                        max={380}
                        required
                        value={measurements.ankle_circumference_mm}
                        onChange={(e) => setMeasurements({ ...measurements, ankle_circumference_mm: e.target.value })}
                        placeholder="e.g. 220.0"
                        className="input text-xs font-mono"
                      />
                    </FormField>
                  </div>
                )}

                <FormField label="Caliper Measurement Note">
                  <input
                    type="text"
                    maxLength={300}
                    value={measurements.note}
                    onChange={(e) => setMeasurements({ ...measurements, note: e.target.value })}
                    placeholder="e.g. Measured using Mitutoyo 150mm digital caliper"
                    className="input text-xs"
                  />
                </FormField>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Intake
                  </Button>
                  <Button
                    type="submit"
                    variant="teal"
                    icon={Cpu}
                    isLoading={measuringSubmitting}
                  >
                    Save Measurements & Start Pipeline
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
