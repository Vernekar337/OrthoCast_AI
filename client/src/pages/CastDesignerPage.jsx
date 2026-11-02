import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Layers,
  Sliders,
  Download,
  RotateCcw,
  Printer,
  History,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  ShieldAlert,
  Sparkles,
  ArrowLeft,
  Save,
  ChevronDown,
  Info,
  Maximize2,
  ExternalLink,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  StatusBadge,
  Button,
  LoadingState,
  ErrorState,
  ModalDialog,
  FormField,
} from '../components/common';
import CastViewport from '../components/designer/CastViewport';
import ParameterControls from '../components/designer/ParameterControls';
import { getPatient, getPatients } from '../api/patients';
import { getPrediction } from '../api/predictions';
import {
  generateCast,
  getCast,
  getCastVersions,
  saveCastVersion,
  getCastDownloadUrl,
} from '../api/casts';
import { getMetaLimits, DEFAULT_PARAM_LIMITS } from '../api/meta';

export default function CastDesignerPage() {
  const { patientId: routePatientId } = useParams();
  const navigate = useNavigate();

  // Patient Selection
  const [selectedPatientId, setSelectedPatientId] = useState(routePatientId || '');
  const [patient, setPatient] = useState(null);
  const [allPatients, setAllPatients] = useState([]);

  // Server Parametric Limits
  const [limits, setLimits] = useState(DEFAULT_PARAM_LIMITS);

  // Active Cast Entity & Versioning
  const [castRecord, setCastRecord] = useState(null);
  const [versions, setVersions] = useState([]);
  const [activeVersionNumber, setActiveVersionNumber] = useState(1);
  const [savedParams, setSavedParams] = useState(null);

  // Model & Telemetry State
  const [modelStatus, setModelStatus] = useState('preview'); // 'preview' | 'generated'
  const [summary, setSummary] = useState(null);
  const [stlUrls, setStlUrls] = useState(null);

  // Generation & API States
  const [predictionId, setPredictionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Save Version Modal State
  const [isSaveVersionOpen, setIsSaveVersionOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [isSavingVersion, setIsSavingVersion] = useState(false);

  // Working Parameters matching CastParams schema
  const [params, setParams] = useState({
    region: 'wrist',
    station_diameters_mm: [58.2, 71.4, 84.0],
    total_length_mm: 180,
    wall_thickness_mm: 4.2,
    vent: {
      enabled: true,
      pattern: 'staggered',
      hole_mm: 6.0,
      spacing_mm: 18.0,
    },
    seam_angle_deg: 0,
    tabs: {
      count: 3,
    },
  });

  // Check if current parameters differ from the active saved version
  const isDirty = useMemo(() => {
    if (!savedParams) return false;
    return JSON.stringify(params) !== JSON.stringify(savedParams);
  }, [params, savedParams]);

  // Load limits and initial data
  useEffect(() => {
    getMetaLimits().then((data) => {
      if (data) setLimits(data);
    });
  }, []);

  // Primary Data Loader
  const loadDesignerData = useCallback(async () => {
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
      // 1. Fetch Patient
      const p = await getPatient(selectedPatientId);
      setPatient(p);

      // Default region from patient
      const patientRegion = p.injury_region || 'wrist';

      // 2. Query Prediction (for initial anatomical station diameters)
      let initialParams = {
        region: patientRegion,
        station_diameters_mm: patientRegion === 'wrist' ? [58.2, 71.4, 84.0] : [72.0, 88.0, 104.0],
        total_length_mm: patientRegion === 'wrist' ? 180 : 240,
        wall_thickness_mm: 4.2,
        vent: { enabled: true, pattern: 'staggered', hole_mm: 6.0, spacing_mm: 18.0 },
        seam_angle_deg: 0,
        tabs: { count: 3 },
      };

      try {
        const pred = await getPrediction(selectedPatientId);
        const pId = pred?.id || pred?._id || pred?.prediction_id;
        if (pId) setPredictionId(pId);
        const predData = pred?.data || pred;
        if (predData?.station_diameters_mm) {
          initialParams = {
            ...initialParams,
            region: predData.region || pred?.region || patientRegion,
            station_diameters_mm: predData.station_diameters_mm,
            total_length_mm: predData.total_length_mm || initialParams.total_length_mm,
            wall_thickness_mm: predData.wall_thickness_mm || initialParams.wall_thickness_mm,
          };
        }
      } catch (e) {
        // No predictions yet - use defaults
      }

      // 3. Check if an existing Cast has been created for this patient
      try {
        const castDoc = await getCast(selectedPatientId);
        if (castDoc) {
          setCastRecord(castDoc);
          if (castDoc.params) {
            initialParams = castDoc.params;
          }
          if (castDoc.summary) {
            setSummary(castDoc.summary);
            setModelStatus('generated');
          }

          // Fetch version history
          const castId = castDoc.id || castDoc._id;
          if (castId) {
            try {
              const vers = await getCastVersions(castId);
              const verList = Array.isArray(vers) ? vers : vers?.versions || [];
              setVersions(verList);
              if (verList.length > 0) {
                const latest = verList[verList.length - 1];
                setActiveVersionNumber(latest.version || 1);
                if (latest.params) initialParams = latest.params;
              }
            } catch (verErr) {
              // Non-blocking
            }
          }
        }
      } catch (e) {
        // No cast document yet
        setModelStatus('preview');
      }

      setParams(initialParams);
      setSavedParams(initialParams);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    loadDesignerData();
  }, [loadDesignerData]);

  // ── Generate / Regenerate Cast (POST /api/patients/:id/cast/generate) ──
  const handleGenerateCast = async () => {
    if (!selectedPatientId) return;

    setError(null);
    setGenerating(true);

    try {
      // 1. Send exact CastCreate payload to FastAPI
      const payload = {
        prediction_id: predictionId,
        params,
        station_diameters_mm: params.station_diameters_mm,
        total_length_mm: params.total_length_mm,
        wall_thickness_mm: params.wall_thickness_mm,
        vent_enabled: params.vent?.enabled ?? true,
        vent_pattern: params.vent?.pattern ?? 'staggered',
        vent_hole_mm: params.vent?.hole_mm ?? 6.0,
        vent_spacing_mm: params.vent?.spacing_mm ?? 18.0,
        seam_angle_deg: params.seam_angle_deg ?? 0.0,
        tab_count: params.tabs?.count ?? 3,
      };
      const res = await generateCast(selectedPatientId, payload);

      // Backend returns summary matching summary.json schema
      const summaryData = res?.summary || res;
      setSummary(summaryData);
      setModelStatus('generated');

      // Update cast ID if returned
      const castId = res?.cast_id || castRecord?.id || castRecord?._id || `cas_${selectedPatientId.slice(0, 8)}`;

      // 2. Record new version atomically in MongoDB via insert_version
      try {
        const newVer = await saveCastVersion(castId, {
          params,
          label: `Version ${versions.length + 1}`,
        });
        const verNumber = newVer?.version || versions.length + 1;
        setActiveVersionNumber(verNumber);
        setVersions((prev) => [...prev, newVer || { version: verNumber, params }]);
      } catch (verErr) {
        // Non-blocking version save
      }

      setSavedParams(params);
    } catch (err) {
      setError(err);
    } finally {
      setGenerating(false);
    }
  };

  // ── Switch Active Version ──
  const handleSelectVersion = (versionObj) => {
    if (isDirty) {
      const confirmDiscard = window.confirm(
        'You have unsaved parameter modifications. Discard edits and load this version?'
      );
      if (!confirmDiscard) return;
    }

    if (versionObj?.params) {
      setParams(versionObj.params);
      setSavedParams(versionObj.params);
      setActiveVersionNumber(versionObj.version);
    }
  };

  // ── Save Named Version ──
  const handleSaveNamedVersion = async (e) => {
    e.preventDefault();
    const castId = castRecord?.id || castRecord?._id || `cas_${selectedPatientId.slice(0, 8)}`;
    setIsSavingVersion(true);

    try {
      const newVer = await saveCastVersion(castId, {
        params,
        label: versionLabel.trim() || `Version ${versions.length + 1}`,
      });
      const verNumber = newVer?.version || versions.length + 1;
      setActiveVersionNumber(verNumber);
      setVersions((prev) => [...prev, newVer || { version: verNumber, params, label: versionLabel }]);
      setSavedParams(params);
      setIsSaveVersionOpen(false);
      setVersionLabel('');
    } catch (err) {
      setError(err);
    } finally {
      setIsSavingVersion(false);
    }
  };

  // ── Export Downloads ──
  const handleDownloadFile = (type) => {
    const castId = castRecord?.id || castRecord?._id || 'cast';
    if (type === 'half_a') {
      const link = document.createElement('a');
      link.href = getCastDownloadUrl(castId, 'cast_half_A.stl');
      link.download = `${selectedPatientId}_cast_half_A.stl`;
      link.click();
    } else if (type === 'half_b') {
      const link = document.createElement('a');
      link.href = getCastDownloadUrl(castId, 'cast_half_B.stl');
      link.download = `${selectedPatientId}_cast_half_B.stl`;
      link.click();
    } else if (type === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(params, null, 2));
      const link = document.createElement('a');
      link.href = dataStr;
      link.download = `${selectedPatientId}_cast_parameters.json`;
      link.click();
    } else if (type === 'summary') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(summary, null, 2));
      const link = document.createElement('a');
      link.href = dataStr;
      link.download = `${selectedPatientId}_cad_summary.json`;
      link.click();
    }
  };

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
            <span className="text-slate-200">3D Cast Designer</span>
          </div>
        }
        title="Interactive 3D Cast Parametric Designer"
        subtitle="CAD modeling workspace for bi-valved orthotic shells with conformal ventilation lattices and interlocking closure tabs."
        badge={
          <div className="flex items-center gap-2">
            <span className={`badge ${modelStatus === 'generated' ? 'badge-success' : 'badge-cyan'} font-mono text-[10px]`}>
              {modelStatus === 'generated' ? 'STL Mesh Verified' : 'Parametric Live Preview'}
            </span>
            <span className="badge badge-muted font-mono text-[10px]">
              Active: v{activeVersionNumber}
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              disabled={!isDirty}
              onClick={() => setParams(savedParams)}
            >
              Discard Edits
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Save}
              onClick={() => setIsSaveVersionOpen(true)}
            >
              Save Version Tag
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Printer}
              isLoading={generating}
              onClick={handleGenerateCast}
            >
              {modelStatus === 'generated' ? 'Regenerate 3D Cast' : 'Generate 3D Cast'}
            </Button>
          </div>
        }
      />

      {/* ── Clinical Engineering Telemetry Bar ── */}
      <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-slate-500 uppercase">Patient:</span>{' '}
            <span className="text-slate-200 font-bold">{patient?.name || selectedPatientId}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase">Region:</span>{' '}
            <span className="text-cyan-300 font-bold">{String(params?.region || patient?.injury_region || 'wrist').toUpperCase()}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase">Parting Seam:</span>{' '}
            <span className="text-slate-300">{params.seam_angle_deg}°</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase">Watertight:</span>{' '}
            <span className={summary?.half_a_watertight ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {summary ? (summary.half_a_watertight ? 'Dual-Halves Pass' : 'Manifold Warning') : 'Pending Generation'}
            </span>
          </div>
        </div>

        {/* Version Switcher */}
        {versions.length > 0 && (
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">History:</span>
            <select
              value={activeVersionNumber}
              onChange={(e) => {
                const target = versions.find((v) => (v.version || 1) === parseInt(e.target.value, 10));
                if (target) handleSelectVersion(target);
              }}
              className="select text-xs py-1 px-2.5 font-mono bg-slate-950 border-slate-800 text-cyan-300"
            >
              {versions.map((v, idx) => (
                <option key={idx} value={v.version || idx + 1}>
                  v{v.version || idx + 1} {v.label ? `— ${v.label}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <ErrorState
          error={error}
          title="CAD Generation Interrupted"
          onRetry={handleGenerateCast}
        />
      )}

      {/* ── Main Workspace Grid (7 cols Viewport, 5 cols Parameters) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 3D Viewport & Export Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Main 3D Three.js Viewport */}
          <CastViewport
            params={params}
            stlUrls={stlUrls}
            isGenerating={generating}
            modelStatus={modelStatus}
            metadata={summary}
          />

          {/* Export & Production Control Strip */}
          <Card
            title="CAD Fabrication Exports (Additive Manufacturing)"
            subtitle="Slicer-ready dual STL meshes conforming to biocompatible polymer 3D printing"
            icon={Download}
          >
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Half A STL */}
                <div className="p-3 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">cast_half_A.stl</span>
                    <span className="text-[10px] text-slate-400">Anterior Shell with Pins</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Download}
                    onClick={() => handleDownloadFile('half_a')}
                  >
                    Export STL
                  </Button>
                </div>

                {/* Half B STL */}
                <div className="p-3 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">cast_half_B.stl</span>
                    <span className="text-[10px] text-slate-400">Posterior Shell with Slots</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Download}
                    onClick={() => handleDownloadFile('half_b')}
                  >
                    Export STL
                  </Button>
                </div>
              </div>

              {/* Parameters & Summary JSON */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 flex-wrap gap-2 text-[11px]">
                <button
                  onClick={() => handleDownloadFile('json')}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Export Parameters (.json)
                </button>

                <button
                  onClick={() => handleDownloadFile('summary')}
                  className="text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Production Summary (.json)
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Parameter Editor (5 cols) */}
        <div className="lg:col-span-5">
          <ParameterControls
            params={params}
            onChange={setParams}
            limits={limits}
            savedParams={savedParams}
            onResetToSaved={() => setParams(savedParams)}
            isDirty={isDirty}
            disabled={generating}
          />
        </div>
      </div>

      {/* ── Save Version Modal ── */}
      <ModalDialog
        isOpen={isSaveVersionOpen}
        onClose={() => setIsSaveVersionOpen(false)}
        title="Tag New Cast Version"
        subtitle="Saves a snapshot of current parameters into the MongoDB cast_versions collection."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsSaveVersionOpen(false)} disabled={isSavingVersion}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveNamedVersion} isLoading={isSavingVersion}>
              Commit Version
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveNamedVersion} className="space-y-4">
          <FormField label="Version Label" required={true}>
            <input
              type="text"
              required
              maxLength={60}
              placeholder="e.g. Swelling Reduced (3.5mm wall), Distal Widened"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              className="input text-xs"
            />
          </FormField>
          <div className="p-3 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400">
            Assigned Version: <strong className="text-cyan-300">v{versions.length + 1}</strong>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
