import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Camera,
  Activity,
  Layers,
  Box,
  ArrowLeft,
  Edit2,
  Trash2,
  Play,
  Download,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  Shield,
  Clock,
  Sparkles,
  Info,
  Maximize2,
  History,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  StatusBadge,
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  ModalDialog,
  FormField,
} from '../components/common';
import { getPatient, updatePatient, deletePatient } from '../api/patients';
import { getScans } from '../api/scans';
import { getMeasurements } from '../api/measurements';
import { getPrediction } from '../api/predictions';
import { getCast, getCastDownloadUrl } from '../api/casts';

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Loaded sub-entities
  const [patient, setPatient] = useState(null);
  const [scans, setScans] = useState([]);
  const [measurements, setMeasurements] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [cast, setCast] = useState(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    age: '',
    gender: 'M',
    height_cm: '',
    injury_region: 'wrist',
    swelling_stage: 'acute',
    notes: '',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState(null);

  // Delete Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Primary fetch handler
  const loadPatientData = useCallback(async () => {
    if (!patientId) {
      setError({ message: 'Patient identifier is missing from route.' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch core patient
      const p = await getPatient(patientId);
      if (!p) {
        throw { message: `Patient with ID "${patientId}" was not found in the registry.` };
      }
      setPatient(p);
      setEditFormData({
        name: p.name || '',
        age: p.age || '',
        gender: p.gender || 'M',
        height_cm: p.height_cm || '',
        injury_region: p.injury_region || 'wrist',
        swelling_stage: p.swelling_stage || 'acute',
        notes: p.notes || '',
      });

      // 2. Fetch related sub-records in parallel
      const [scansRes, measRes, predRes, castRes] = await Promise.allSettled([
        getScans(patientId),
        getMeasurements(patientId),
        getPrediction(patientId),
        getCast(patientId),
      ]);

      if (scansRes.status === 'fulfilled' && scansRes.value) {
        setScans(Array.isArray(scansRes.value) ? scansRes.value : scansRes.value.scans || []);
      }
      if (measRes.status === 'fulfilled' && measRes.value) {
        const measurementRecords = Array.isArray(measRes.value)
          ? measRes.value
          : [];

        setMeasurements(
          measurementRecords[0]?.data ?? measurementRecords[0] ?? null
        );;
      }
      if (predRes.status === 'fulfilled' && predRes.value) {
        setPrediction(predRes.value);
      }
      if (castRes.status === 'fulfilled' && castRes.value) {
        setCast(castRes.value);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  // Handle Edit Submit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      const patchData = {
        name: editFormData.name.trim(),
        age: parseInt(editFormData.age, 10),
        gender: editFormData.gender,
        height_cm: editFormData.height_cm ? parseFloat(editFormData.height_cm) : null,
        injury_region: editFormData.injury_region,
        swelling_stage: editFormData.swelling_stage,
        notes: editFormData.notes ? editFormData.notes.trim() : null,
      };

      await updatePatient(patientId, patchData);
      setIsEditOpen(false);
      await loadPatientData();
    } catch (err) {
      setEditError(err);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePatient(patientId);
      navigate('/patients');
    } catch (err) {
      setError(err);
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <LoadingState
          title={`Retrieving Clinical Dossier: ${patientId}`}
          subtitle="Loading patient record, photogrammetric scans, measurements, and CAD data from FastAPI/MongoDB."
        />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-4">
        <ErrorState
          error={error}
          title="Patient Dossier Unavailable"
          onRetry={loadPatientData}
        />
        <div className="text-center">
          <Button
            variant="outline"
            icon={ArrowLeft}
            onClick={() => navigate('/patients')}
          >
            Back to Patient Registry
          </Button>
        </div>
      </div>
    );
  }

  const createdDate = patient.created_at
    ? new Date(patient.created_at * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    : 'Not Recorded';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Page Header & Quick Nav ── */}
      <PageHeader
        breadcrumbs={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/patients')}
              className="hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Patients
            </button>
            <span>/</span>
            <span className="text-cyan-400 font-bold">{patientId}</span>
          </div>
        }
        title={patient.name || 'Patient Dossier'}
        subtitle={`Clinical MRN ID: ${patientId} • Intake recorded on ${createdDate}`}
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge status={patient.injury_region} />
            <StatusBadge status={patient.swelling_stage} />
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={Edit2}
              onClick={() => setIsEditOpen(true)}
            >
              Edit Intake
            </Button>
            <Button
              variant="teal"
              size="sm"
              icon={Play}
              onClick={() => navigate(`/processing/${patientId}`)}
            >
              Run AI Pipeline
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={History}
              onClick={() => navigate(`/patients/${patientId}/history`)}
            >
              Audit History
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Box}
              onClick={() => navigate(`/designer/${patientId}`)}
            >
              3D Cast Designer
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => setIsDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        }
      />

      {/* ── Grid Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Demographics & Clinical Intake (1 col) */}
        <div className="space-y-6">
          <Card title="Demographics & Intake" icon={User} reticle={true}>
            <div className="space-y-3.5 text-xs font-mono">
              <div className="flex justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Patient Identifier:</span>
                <span className="text-cyan-400 font-bold">{patientId}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Full Name:</span>
                <span className="text-slate-100 font-sans font-medium">{patient.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Age:</span>
                <span className="text-slate-200">{patient.age ? `${patient.age} years` : 'N/A'}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Biological Gender:</span>
                <span className="text-slate-200">{patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender || 'N/A'}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Height:</span>
                <span className="text-slate-200">{patient.height_cm ? `${patient.height_cm} cm` : 'Not recorded'}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Injury Region:</span>
                <StatusBadge status={patient.injury_region} />
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Edema / Swelling:</span>
                <StatusBadge status={patient.swelling_stage} />
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Clinical Notes:</span>
                <div className="p-3 rounded bg-slate-900 border border-slate-800/80 font-sans text-slate-300 leading-relaxed text-xs">
                  {patient.notes || 'No clinical notes entered for this patient.'}
                </div>
              </div>
            </div>
          </Card>

          {/* Calibrated Anatomical Measurements */}
          <Card title="Calibrated Anatomical Metrics" icon={Activity}>
            {measurements ? (
              <div className="space-y-2.5 text-xs font-mono">
                {Object.entries(measurements)
                  .filter(([k]) => !['id', '_id', 'patient_id', 'created_at'].includes(k))
                  .map(([key, val]) => (
                    <div key={key} className="flex justify-between p-2 rounded bg-slate-900 border border-slate-800/60">
                      <span className="text-slate-400 uppercase text-[10px]">{key.replace('_', ' ')}:</span>
                      <span className="text-cyan-300 font-bold">{val} mm</span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center p-4 space-y-2">
                <p className="text-xs text-slate-400">
                  No landmark measurements extracted yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/processing/${patientId}`)}
                >
                  Run Landmark Detection
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Right Columns: Scans, ML Predictions, and 3D Casts (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photogrammetric Scan Images */}
          <Card
            title="Photogrammetric Scan Captures"
            subtitle="Dual-angle photos with 50mm reference calibration marker"
            icon={Camera}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/new-patient')}
              >
                Upload Additional Scan
              </Button>
            }
          >
            {scans.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {scans.map((s, idx) => (
                  <div key={idx} className="p-3 rounded bg-slate-900 border border-slate-800 text-xs font-mono space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-cyan-400 font-bold uppercase">{s.angle || 'Scan'} View</span>
                      <span className="text-slate-500 text-[10px]">
                        {s.created_at ? new Date(s.created_at * 1000).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    {s.file_url || s.url ? (
                      <img
                        src={s.file_url || s.url}
                        alt="Scan preview"
                        className="w-full h-40 object-cover rounded border border-slate-800"
                      />
                    ) : (
                      <div className="w-full h-40 rounded bg-slate-950/80 border border-slate-800 flex flex-col items-center justify-center text-slate-500">
                        <Camera className="w-8 h-8 mb-1" />
                        <span className="text-[10px]">Image stored in storage/uploads</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center space-y-3 bg-slate-900/30 rounded border border-dashed border-slate-800">
                <Camera className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">
                  No photographic scans uploaded for this patient yet.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/new-patient')}
                >
                  Upload Scans
                </Button>
              </div>
            )}
          </Card>

          {/* AI Regression Predictions */}
          <Card
            title="XGBoost Anatomical Geometry Predictions"
            subtitle="Model output station diameters and confidence intervals"
            icon={Layers}
            reticle={true}
          >
            {prediction ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {prediction.station_diameters_mm?.map((d, i) => (
                    <div key={i} className="p-3 rounded bg-slate-900 border border-slate-800 text-center font-mono">
                      <div className="text-[10px] uppercase text-slate-400">
                        Station {i + 1} ({i === 0 ? 'Distal' : i === 1 ? 'Mid' : 'Proximal'})
                      </div>
                      <div className="text-xl font-bold text-cyan-400 mt-1">{d} mm</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Wall Thickness</span>
                    <span className="text-white font-bold">{prediction.wall_thickness_mm} mm</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Total Length</span>
                    <span className="text-white font-bold">{prediction.total_length_mm} mm</span>
                  </div>
                  <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Clearance Buffer</span>
                    <span className="text-emerald-400 font-bold">+{prediction.clearance_mm} mm</span>
                  </div>
                </div>

                {prediction.warnings?.length > 0 && (
                  <div className="p-3 rounded bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      Model Boundary Notice
                    </div>
                    {prediction.warnings.map((w, idx) => (
                      <p key={idx} className="text-[11px] text-amber-200/90 pl-5">• {w}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center space-y-3 bg-slate-900/30 rounded border border-dashed border-slate-800">
                <Layers className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">
                  AI model prediction has not been executed yet for this patient.
                </p>
                <Button
                  variant="teal"
                  size="sm"
                  onClick={() => navigate(`/processing/${patientId}`)}
                >
                  Generate Predictions
                </Button>
              </div>
            )}
          </Card>

          {/* 3D CAD Production & Fabrication */}
          <Card
            title="3D Cast Fabrication & STL Export"
            subtitle="CAD loft output files and 3D printing parameters"
            icon={Box}
            action={
              <Button
                variant="primary"
                size="sm"
                icon={Box}
                onClick={() => navigate(`/designer/${patientId}`)}
              >
                Open Designer
              </Button>
            }
          >
            {cast ? (
              <div className="space-y-4 text-xs font-mono">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded bg-slate-900 border border-slate-800 text-center">
                    <span className="text-slate-400 text-[10px] block">Watertight Shell</span>
                    <span className="text-emerald-400 font-bold">
                      {cast.summary?.half_a_watertight && cast.summary?.half_b_watertight ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <div className="p-3 rounded bg-slate-900 border border-slate-800 text-center">
                    <span className="text-slate-400 text-[10px] block">Material (PLA)</span>
                    <span className="text-cyan-400 font-bold">
                      {cast.summary?.estimated_material_grams ? `${cast.summary.estimated_material_grams} g` : '--'}
                    </span>
                  </div>
                  <div className="p-3 rounded bg-slate-900 border border-slate-800 text-center">
                    <span className="text-slate-400 text-[10px] block">Est. Print Time</span>
                    <span className="text-teal-400 font-bold">
                      {cast.summary?.estimated_print_time_minutes ? `${cast.summary.estimated_print_time_minutes} min` : '--'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                    Generated Dual-Shell STLs
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">cast_half_A.stl (Anterior Shell)</span>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Download}
                      onClick={() => alert(`Downloading cast_half_A.stl for ${patientId}`)}
                    >
                      Download Half A
                    </Button>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-200">cast_half_B.stl (Posterior Shell)</span>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Download}
                      onClick={() => alert(`Downloading cast_half_B.stl for ${patientId}`)}
                    >
                      Download Half B
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-3 bg-slate-900/30 rounded border border-dashed border-slate-800">
                <Box className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">
                  No 3D cast has been lofted or exported for this patient yet.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/designer/${patientId}`)}
                >
                  Configure 3D Cast
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Edit Modal ── */}
      <ModalDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Intake Record: ${patientId}`}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} disabled={isSubmittingEdit}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} isLoading={isSubmittingEdit}>
              Save Changes
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editError && <ErrorState error={editError} compact={true} />}

          <FormField label="Full Name" required={true}>
            <input
              type="text"
              required
              maxLength={80}
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              className="input text-xs"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Age" unit="years" required={true}>
              <input
                type="number"
                required
                min={1}
                max={110}
                value={editFormData.age}
                onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                className="input text-xs font-mono"
              />
            </FormField>

            <FormField label="Biological Gender" required={true}>
              <select
                value={editFormData.gender}
                onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                className="select text-xs font-mono"
              >
                <option value="M">Male (M)</option>
                <option value="F">Female (F)</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Height" unit="cm">
              <input
                type="number"
                min={50}
                max={230}
                value={editFormData.height_cm}
                onChange={(e) => setEditFormData({ ...editFormData, height_cm: e.target.value })}
                className="input text-xs font-mono"
              />
            </FormField>

            <FormField label="Anatomical Region" required={true}>
              <select
                value={editFormData.injury_region}
                onChange={(e) => setEditFormData({ ...editFormData, injury_region: e.target.value })}
                className="select text-xs font-mono"
              >
                <option value="wrist">Wrist / Forearm</option>
                <option value="ankle">Ankle / Foot</option>
              </select>
            </FormField>
          </div>

          <FormField label="Swelling Stage" required={true}>
            <select
              value={editFormData.swelling_stage}
              onChange={(e) => setEditFormData({ ...editFormData, swelling_stage: e.target.value })}
              className="select text-xs font-mono"
            >
              <option value="acute">Acute</option>
              <option value="subacute">Subacute</option>
              <option value="none">Normal / None</option>
            </select>
          </FormField>

          <FormField label="Clinical Notes">
            <textarea
              maxLength={500}
              rows={3}
              value={editFormData.notes}
              onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
              className="input text-xs"
            />
          </FormField>
        </form>
      </ModalDialog>

      {/* ── Confirm Delete Modal ── */}
      <ModalDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Patient Record"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} isLoading={isDeleting}>
              Delete Record
            </Button>
          </div>
        }
      >
        <div className="p-3 rounded bg-rose-950/20 border border-rose-800/40 text-xs text-rose-300">
          <p className="font-bold">Permanent Deletion Confirmation</p>
          <p className="mt-1 text-slate-300">
            Are you sure you want to permanently delete patient <code className="text-cyan-300 font-mono">{patientId}</code> ({patient.name})? This action cannot be undone.
          </p>
        </div>
      </ModalDialog>
    </div>
  );
}
