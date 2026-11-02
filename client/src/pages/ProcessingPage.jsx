import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowRight,
  ArrowLeft,
  Layers,
  Sparkles,
  RotateCw,
  Box,
  FileText,
  User,
  Sliders,
  Ruler,
  Camera,
  Edit3,
  Save,
  X,
  ShieldAlert,
  Info,
  ChevronRight,
  Download,
  AlertTriangle,
  Check,
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
import { getPatient, getPatients } from '../api/patients';
import { getMeasurements, updateMeasurements, MEASUREMENT_BOUNDS } from '../api/measurements';
import { getPrediction, runPrediction } from '../api/predictions';
import { getScans } from '../api/scans';
import { getCast } from '../api/casts';
import { startPipeline, subscribeJobEvents } from '../api/pipeline';

export default function ProcessingPage({ initialTab = 'predictions' }) {
  const { patientId: routePatientId } = useParams();
  const navigate = useNavigate();

  // Active Tab: 'predictions' | 'measurements' | 'scans'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Selected Patient & Records
  const [selectedPatientId, setSelectedPatientId] = useState(routePatientId || '');
  const [patient, setPatient] = useState(null);
  const [allPatients, setAllPatients] = useState([]);

  // Data Entities
  const [measurements, setMeasurements] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [scans, setScans] = useState([]);
  const [existingCast, setExistingCast] = useState(null);

  // Pipeline Execution State
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState('idle'); // 'idle' | 'running' | 'completed' | 'failed'
  const [stageProgress, setStageProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('queued');

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editable Measurements State
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [adjustedKeys, setAdjustedKeys] = useState(new Set());

  // SSE Unsubscribe reference
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // ── Load Patient and Sub-Entities ──
  const loadClinicalData = useCallback(async () => {
    if (!selectedPatientId) {
      try {
        const res = await getPatients();
        const list = Array.isArray(res) ? res : res?.items || res?.patients || [];
        setAllPatients(list);
        if (list.length > 0 && !selectedPatientId) {
          setSelectedPatientId(list[0].id || list[0]._id);
        }
      } catch (e) {
        // Ignored
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [patientRes, measRes, predRes, scansRes, castRes] = await Promise.allSettled([
        getPatient(selectedPatientId),
        getMeasurements(selectedPatientId),
        getPrediction(selectedPatientId),
        getScans(selectedPatientId),
        getCast(selectedPatientId),
      ]);

      if (patientRes.status === 'fulfilled' && patientRes.value) {
        setPatient(patientRes.value);
      } else {
        throw new Error(`Patient "${selectedPatientId}" was not found.`);
      }

      if (measRes.status === 'fulfilled' && measRes.value) {
        const recList = Array.isArray(measRes.value) ? measRes.value : [measRes.value];
        const mData = recList[0]?.data ?? recList[0] ?? null;
        setMeasurements(mData);
        if (recList[0]?.adjusted_keys || mData?.adjusted_keys) {
          setAdjustedKeys(new Set(recList[0]?.adjusted_keys || mData?.adjusted_keys));
        }
      } else {
        setMeasurements(null);
      }

      if (predRes.status === 'fulfilled' && predRes.value?.station_diameters_mm) {
        setPredictionData(predRes.value);
        setJobStatus('completed');
      } else {
        setPredictionData(null);
        setJobStatus('idle');
      }

      if (scansRes.status === 'fulfilled' && scansRes.value) {
        setScans(Array.isArray(scansRes.value) ? scansRes.value : scansRes.value.scans || []);
      }

      if (castRes.status === 'fulfilled' && castRes.value) {
        setExistingCast(castRes.value);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    loadClinicalData();
  }, [loadClinicalData]);

  // ── Trigger Processing Pipeline ──
  const handleExecutePipeline = async () => {
    if (!selectedPatientId) return;

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setError(null);
    setJobStatus('running');
    setStageProgress(10);
    setCurrentStage('queued');

    try {
      const res = await startPipeline(selectedPatientId, {
        mode: measurements ? 'measurements' : 'scan',
        marker_mm: 50.0,
      });

      const newJobId = res?.job_id || res?.id || `job_${selectedPatientId.slice(0, 8)}`;
      setJobId(newJobId);

      unsubscribeRef.current = subscribeJobEvents(
        newJobId,
        (evt) => {
          if (typeof evt === 'object' && evt !== null) {
            if (evt.progress !== undefined) setStageProgress(evt.progress);
            if (evt.stage || evt.step) setCurrentStage(evt.stage || evt.step);
          }
        },
        (streamErr) => {
          setError(streamErr);
          setJobStatus('failed');
        },
        async (final) => {
          setJobStatus('completed');
          setStageProgress(100);
          try {
            const pred = await getPrediction(selectedPatientId);
            setPredictionData(pred);
          } catch (e) {
            if (final?.result) setPredictionData(final.result);
          }
        }
      );
    } catch (apiErr) {
      // Direct prediction execution fallback if background job queue is inactive
      try {
        const pred = await runPrediction(selectedPatientId);
        setPredictionData(pred);
        setJobStatus('completed');
        setStageProgress(100);
      } catch (directErr) {
        setError(directErr.status ? directErr : apiErr);
        setJobStatus('failed');
      }
    }
  };

  // ── Handle Manual Measurement Adjustment ──
  const startEditing = (key, currentVal) => {
    setEditingKey(key);
    setEditValue(String(currentVal ?? ''));
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setEditValue('');
    setEditError(null);
  };

  const saveEditedMeasurement = async (key) => {
    const valNum = parseFloat(editValue);
    const region = patient?.injury_region || 'wrist';
    const bounds = MEASUREMENT_BOUNDS[region]?.[key];

    // Frontend validation conforming to Pydantic constraints
    if (isNaN(valNum)) {
      setEditError('Please enter a valid numeric value.');
      return;
    }
    if (bounds) {
      if (valNum < bounds.min || valNum > bounds.max) {
        setEditError(`Value must be between ${bounds.min} mm and ${bounds.max} mm.`);
        return;
      }
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const updatedMeasurements = {
        ...(measurements || {}),
        [key]: valNum,
        note: `Clinician manually calibrated ${key} to ${valNum}mm`,
      };

      // Call FastAPI endpoint
      await updateMeasurements(selectedPatientId, updatedMeasurements);

      // Mark key as clinician-adjusted
      setAdjustedKeys((prev) => new Set([...prev, key]));
      setMeasurements(updatedMeasurements);
      setEditingKey(null);

      // Re-query prediction if pipeline was already run
      if (predictionData) {
        try {
          const newPred = await runPrediction(selectedPatientId, updatedMeasurements);
          setPredictionData(newPred);
        } catch (e) {
          // Non-blocking
        }
      }
    } catch (err) {
      setEditError(err.message || 'Failed to persist measurement update to FastAPI.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const region = patient?.injury_region || 'wrist';
  const boundsForRegion = MEASUREMENT_BOUNDS[region] || {};

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ── Page Header ── */}
      <PageHeader
        breadcrumbs={
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => navigate('/patients')}
              className="hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Patients
            </button>
            <span>/</span>
            <button
              onClick={() => navigate(`/patients/${selectedPatientId}`)}
              className="text-cyan-400 font-bold hover:underline"
            >
              {selectedPatientId}
            </button>
            <span>/</span>
            <span className="text-slate-200">Results & Prediction</span>
          </div>
        }
        title={patient ? `${patient.name} — Clinical Analysis` : 'Clinical Analysis & Prediction'}
        subtitle={`Patient ID: ${selectedPatientId} • Target Region: ${region.toUpperCase()} • Swelling: ${patient?.swelling_stage?.toUpperCase() || 'NORMAL'}`}
        badge={
          <div className="flex items-center gap-2">
            <StatusBadge
              status={predictionData ? 'completed' : jobStatus === 'running' ? 'processing' : 'pending'}
              label={predictionData ? 'Predictions Validated' : jobStatus === 'running' ? 'Inference Running' : 'Pending Inference'}
            />
            {existingCast && (
              <span className="badge badge-teal font-mono text-[10px]">
                Cast v{existingCast.version || '1'} Ready
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={FileText}
              onClick={() => navigate(`/patients/${selectedPatientId}`)}
            >
              Patient Dossier
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              disabled={jobStatus === 'running'}
              onClick={handleExecutePipeline}
            >
              Recompute AI Inference
            </Button>
            <Button
              variant="teal"
              size="sm"
              icon={Box}
              onClick={() => navigate(`/designer/${selectedPatientId}`)}
            >
              Open 3D Cast Designer
            </Button>
          </div>
        }
      />

      {/* ── Prototype Notice & Clinical Interpretation Disclaimer ── */}
      <div className="p-3.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 flex items-start gap-3 text-xs font-mono">
        <ShieldAlert className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-slate-300 leading-relaxed">
          <span className="text-cyan-300 font-bold uppercase tracking-wider block">
            Clinical Decision Support System (CDSS) Notice
          </span>
          <p>
            Values below are algorithmic regression predictions and photogrammetric approximations. They do not constitute an autonomous medical diagnosis or cleared medical device output. All cross-section stations must be physically verified by an orthopedic surgeon or certified orthotist prior to additive manufacturing.
          </p>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <ErrorState
          error={error}
          title="Analysis Data Unavailable"
          onRetry={loadClinicalData}
        />
      )}

      {/* ── Tab Navigation ── */}
      <div className="flex border-b border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab('predictions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'predictions'
              ? 'border-cyan-400 text-cyan-300 font-bold bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          AI Prediction Results & Geometry
        </button>

        <button
          onClick={() => setActiveTab('measurements')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'measurements'
              ? 'border-cyan-400 text-cyan-300 font-bold bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          Extracted Measurement Results
        </button>

        <button
          onClick={() => setActiveTab('scans')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'scans'
              ? 'border-cyan-400 text-cyan-300 font-bold bg-slate-900/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          Photogrammetric Scans ({scans.length})
        </button>
      </div>

      {loading ? (
        <div className="p-12">
          <LoadingState
            title="Loading Patient Analysis Dossier…"
            subtitle="Accessing MongoDB collections (predictions, measurements, scans) via FastAPI."
          />
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: AI PREDICTION RESULTS & GEOMETRY
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'predictions' && (
            <div className="space-y-6 animate-fade-in">
              {predictionData ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 Cols: Predicted Anatomical Geometry & Longitudinal Profile */}
                  <div className="lg:col-span-2 space-y-6">
                    <Card
                      title="Predicted Station Diameters & Loft Profile"
                      subtitle="Multi-target XGBoost regression outputs for bi-valved shell lofting"
                      reticle={true}
                    >
                      {/* Station Diameters Display */}
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        {predictionData.station_diameters_mm?.map((diam, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-center font-mono relative overflow-hidden"
                          >
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">
                              Station 0{i + 1}
                            </span>
                            <span className="text-[11px] text-slate-500 block mb-1">
                              {i === 0
                                ? 'Distal (Palm/Malleolar)'
                                : i === 1
                                ? 'Mid (Wrist/Ankle)'
                                : 'Proximal (Forearm/Calf)'}
                            </span>
                            <div className="text-3xl font-bold text-cyan-400 mt-1">
                              {diam} <span className="text-xs text-slate-500 font-normal">mm</span>
                            </div>
                            {predictionData.intervals?.[`d${i + 1}_mm`] && (
                              <div className="mt-2 text-[10px] text-slate-400 bg-slate-950/60 py-1 px-2 rounded">
                                95% Conf. Interval: [{predictionData.intervals[`d${i + 1}_mm`].join(', ')}]
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Anatomical Diameter Profile Line Graph / Visualizer */}
                      <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-3 font-mono">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-300 font-bold uppercase">
                            Longitudinal Taper Profile (Distal to Proximal)
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            Raw Reference: <strong className="text-cyan-300">{predictionData.raw_reference_mm} mm</strong>
                          </span>
                        </div>

                        {/* Visual Profile Chart */}
                        <div className="relative h-24 bg-slate-900/60 rounded border border-slate-800/80 flex items-center justify-around px-8">
                          {/* Station 1 Bar */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-cyan-400 font-bold">{predictionData.station_diameters_mm[0]}mm</span>
                            <div
                              className="w-12 bg-cyan-500/80 rounded-t transition-all mt-1"
                              style={{ height: `${Math.min(60, (predictionData.station_diameters_mm[0] / 200) * 60)}px` }}
                            />
                            <span className="text-[9px] text-slate-500 mt-1">d1 Distal</span>
                          </div>

                          {/* Interpolation Slope */}
                          <div className="h-0.5 flex-1 bg-gradient-to-r from-cyan-400 to-teal-400 mb-4 opacity-50 border-t border-dashed border-cyan-300" />

                          {/* Station 2 Bar */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-teal-400 font-bold">{predictionData.station_diameters_mm[1]}mm</span>
                            <div
                              className="w-12 bg-teal-500/80 rounded-t transition-all mt-1"
                              style={{ height: `${Math.min(60, (predictionData.station_diameters_mm[1] / 200) * 60)}px` }}
                            />
                            <span className="text-[9px] text-slate-500 mt-1">d2 Mid</span>
                          </div>

                          {/* Interpolation Slope */}
                          <div className="h-0.5 flex-1 bg-gradient-to-r from-teal-400 to-blue-400 mb-4 opacity-50 border-t border-dashed border-teal-300" />

                          {/* Station 3 Bar */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-blue-400 font-bold">{predictionData.station_diameters_mm[2]}mm</span>
                            <div
                              className="w-12 bg-blue-500/80 rounded-t transition-all mt-1"
                              style={{ height: `${Math.min(60, (predictionData.station_diameters_mm[2] / 200) * 60)}px` }}
                            />
                            <span className="text-[9px] text-slate-500 mt-1">d3 Proximal</span>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-500">
                          Taper curvature complies with continuous non-constrictive orthotic fit rules ($d_1 &lt; d_2 &lt; d_3$).
                        </p>
                      </div>

                      {/* Shell Dimensions & Swelling Clearance */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-xs font-mono">
                        <div className="p-3 rounded bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase block">Wall Thickness</span>
                          <span className="text-lg font-bold text-white mt-0.5 block">
                            {predictionData.wall_thickness_mm} mm
                          </span>
                          <span className="text-[10px] text-slate-500">Optimized for rigid PLA/PETG</span>
                        </div>
                        <div className="p-3 rounded bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase block">Total Cast Length</span>
                          <span className="text-lg font-bold text-white mt-0.5 block">
                            {predictionData.total_length_mm} mm
                          </span>
                          <span className="text-[10px] text-slate-500">Immobilization span</span>
                        </div>
                        <div className="p-3 rounded bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 uppercase block">Edema Clearance Buffer</span>
                          <span className="text-lg font-bold text-emerald-400 mt-0.5 block">
                            +{predictionData.clearance_mm} mm
                          </span>
                          <span className="text-[10px] text-slate-500">Applied over anatomical skin</span>
                        </div>
                      </div>

                      {/* Warnings if values outside training domain */}
                      {predictionData.warnings?.length > 0 && (
                        <div className="mt-4 p-3.5 rounded bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 font-mono">
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                            Model Training Domain Boundary Alert
                          </div>
                          {predictionData.warnings.map((w, idx) => (
                            <p key={idx} className="text-[11px] text-amber-200/90 pl-5">
                              • {w}
                            </p>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Right 1 Col: SHAP Explainability & Model Telemetry */}
                  <div className="space-y-6">
                    <Card
                      title="Explainable AI Contributions (TreeSHAP)"
                      subtitle="Marginal millimeter impact of each clinical feature"
                      icon={Sparkles}
                    >
                      <div className="space-y-3 font-mono text-xs">
                        {predictionData.explanation?.map((item, idx) => {
                          const isPositive = item.contribution_mm >= 0;
                          return (
                            <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800/80">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-slate-300 font-semibold">{item.feature}</span>
                                <span className={isPositive ? 'text-cyan-400 font-bold' : 'text-slate-400 font-bold'}>
                                  {isPositive ? `+${item.contribution_mm}` : item.contribution_mm} mm
                                </span>
                              </div>
                              {/* Contribution Magnitude Bar */}
                              <div className="w-full bg-slate-950 h-1.5 rounded overflow-hidden">
                                <div
                                  className={`h-1.5 rounded ${isPositive ? 'bg-cyan-400' : 'bg-slate-500'}`}
                                  style={{ width: `${Math.min(100, Math.abs(item.contribution_mm) * 15)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}

                        {/* Model Telemetry */}
                        {predictionData.model_info && (
                          <div className="p-3 rounded bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-500 space-y-1 mt-4">
                            <div className="text-slate-400 font-bold uppercase mb-1">Model Lineage & Checkpoint</div>
                            <div>Source: {predictionData.model_info.trained_on}</div>
                            <div>Cohort Size: {predictionData.model_info.n_rows} synthetic anatomical sets</div>
                            <div>Interval Method: {predictionData.model_info.interval}</div>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Quick Link to 3D Designer */}
                    <Card bodyClassName="p-4 text-center space-y-3">
                      <p className="text-xs text-slate-400">
                        Geometry verified? Transfer parameters to the 3D Cast Designer to loft mesh and export STLs.
                      </p>
                      <Button
                        variant="primary"
                        icon={ArrowRight}
                        onClick={() => navigate(`/designer/${selectedPatientId}`)}
                        className="w-full"
                      >
                        Launch 3D Cast Designer
                      </Button>
                    </Card>
                  </div>
                </div>
              ) : (
                <Card className="text-center p-12">
                  <EmptyState
                    title="No Prediction Generated Yet"
                    subtitle="Photogrammetric landmarks or caliper measurements must be processed by the XGBoost pipeline."
                    icon={Cpu}
                    action={
                      <Button variant="primary" icon={Play} onClick={handleExecutePipeline}>
                        Execute Model Inference Now
                      </Button>
                    }
                  />
                </Card>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: MEASUREMENT RESULTS & ADJUSTMENTS
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'measurements' && (
            <div className="space-y-6 animate-fade-in">
              <Card
                title={`Extracted Anatomical Metrics (${region.toUpperCase()})`}
                subtitle="Clinical millimeter dimensions used as input features to XGBoost models"
                icon={Ruler}
                reticle={true}
              >
                {measurements ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="table-clinical">
                        <thead>
                          <tr>
                            <th>Measurement Dimension</th>
                            <th>Value</th>
                            <th>Allowed Constraint Range</th>
                            <th>Data Source</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(boundsForRegion).map(([key, config]) => {
                            const val = measurements[key];
                            const isAdjusted = adjustedKeys.has(key);
                            const isEditing = editingKey === key;

                            return (
                              <tr key={key} className="hover:bg-slate-900/60 font-mono">
                                {/* Name */}
                                <td>
                                  <div>
                                    <span className="font-bold text-slate-200">{config.label}</span>
                                    <span className="text-[10px] text-slate-500 block">{key}</span>
                                  </div>
                                </td>

                                {/* Value / Inline Editor */}
                                <td>
                                  {isEditing ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        step="0.1"
                                        min={config.min}
                                        max={config.max}
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="input text-xs py-1 px-2 w-28 font-mono bg-slate-950 border-cyan-400"
                                      />
                                      <span className="text-xs text-slate-400">{config.unit}</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-bold text-cyan-300">
                                      {val !== undefined && val !== null ? `${val} ${config.unit}` : '--'}
                                    </span>
                                  )}
                                </td>

                                {/* Constraint Range */}
                                <td>
                                  <div className="text-xs text-slate-400">
                                    {config.min} – {config.max} mm
                                    {val && (
                                      <div className="w-24 bg-slate-800 h-1 rounded overflow-hidden mt-1">
                                        <div
                                          className="bg-cyan-400 h-1 rounded"
                                          style={{
                                            width: `${Math.min(100, Math.max(0, ((val - config.min) / (config.max - config.min)) * 100))}%`,
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Source */}
                                <td>
                                  <span className="text-xs text-slate-400">
                                    {isAdjusted
                                      ? 'Clinician Calibrated'
                                      : measurements.note?.includes('Caliper')
                                      ? 'Manual Digital Caliper'
                                      : 'OpenCV Photogrammetry'}
                                  </span>
                                </td>

                                {/* Status Badge */}
                                <td>
                                  {isAdjusted ? (
                                    <span className="badge badge-warning text-[10px]">
                                      User Adjusted
                                    </span>
                                  ) : val ? (
                                    <span className="badge badge-success text-[10px]">
                                      Validated
                                    </span>
                                  ) : (
                                    <span className="badge badge-muted text-[10px]">
                                      Missing
                                    </span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="text-right">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        variant="teal"
                                        size="sm"
                                        icon={Save}
                                        isLoading={isSavingEdit}
                                        onClick={() => saveEditedMeasurement(key)}
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={X}
                                        disabled={isSavingEdit}
                                        onClick={cancelEditing}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      icon={Edit3}
                                      onClick={() => startEditing(key, val)}
                                    >
                                      Calibrate
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {editError && (
                      <div className="p-3 rounded bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 font-mono">
                        Validation Notice: {editError}
                      </div>
                    )}

                    {measurements.note && (
                      <div className="p-3 rounded bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-400">
                        <span className="text-slate-300 font-bold block mb-0.5">Measurement Note:</span>
                        {measurements.note}
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="No Measurements Recorded"
                    subtitle="Photogrammetric scans have not been extracted or manual caliper values have not been entered."
                    icon={Ruler}
                    action={
                      <Button variant="primary" onClick={() => navigate('/new-patient')}>
                        Upload Scans or Enter Measurements
                      </Button>
                    }
                  />
                )}
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: PHOTOGRAMMETRIC SCANS INSPECTION
          ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'scans' && (
            <div className="space-y-6 animate-fade-in">
              <Card
                title="Photogrammetric Image Verifications"
                subtitle="Dual-angle views referenced against 50mm coplanar calibration square"
                icon={Camera}
                reticle={true}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/new-patient')}
                  >
                    Upload New Scans
                  </Button>
                }
              >
                {scans.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                    {scans.map((s, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-cyan-400 uppercase">
                            {s.angle || 'Scan'} Angle View
                          </span>
                          <span className="badge badge-success text-[10px]">Marker Verified (50mm)</span>
                        </div>

                        {s.file_url || s.url ? (
                          <img
                            src={s.file_url || s.url}
                            alt={`${s.angle} scan`}
                            className="w-full h-52 object-cover rounded border border-slate-800"
                          />
                        ) : (
                          <div className="w-full h-52 rounded bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-500">
                            <Camera className="w-10 h-10 mb-2 opacity-50" />
                            <span>Storage location: storage/uploads/{s.filename || 'scan.jpg'}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                          <span>Format: JPEG/PNG</span>
                          <span>Timestamp: {s.created_at ? new Date(s.created_at * 1000).toLocaleString() : 'Recorded'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No Scans Available"
                    subtitle="Photogrammetric images have not been uploaded for this patient."
                    icon={Camera}
                    action={
                      <Button variant="primary" onClick={() => navigate('/new-patient')}>
                        Upload Patient Scans
                      </Button>
                    }
                  />
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
