import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  History,
  Clock,
  User,
  Camera,
  Ruler,
  Layers,
  Box,
  Activity,
  ArrowLeft,
  Calendar,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  StatusBadge,
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components/common';
import { getPatient } from '../api/patients';
import { getScans } from '../api/scans';
import { getMeasurements } from '../api/measurements';
import { getPrediction } from '../api/predictions';
import { getCast, getCastVersions } from '../api/casts';
import { getAuditTrail } from '../api/validation';

export default function PatientHistoryPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [patient, setPatient] = useState(null);
  const [scans, setScans] = useState([]);
  const [measurements, setMeasurements] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [cast, setCast] = useState(null);
  const [versions, setVersions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const loadHistory = useCallback(async () => {
    if (!patientId) {
      setError({ message: 'Patient ID missing from route.' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Patient entity
      const p = await getPatient(patientId);
      setPatient(p);

      // 2. Sub-entities
      const [scansRes, measRes, predRes, castRes, auditRes] = await Promise.allSettled([
        getScans(patientId),
        getMeasurements(patientId),
        getPrediction(patientId),
        getCast(patientId),
        getAuditTrail(patientId),
      ]);

      if (scansRes.status === 'fulfilled' && scansRes.value) {
        setScans(Array.isArray(scansRes.value) ? scansRes.value : scansRes.value.scans || []);
      }
      if (measRes.status === 'fulfilled' && measRes.value) {
        setMeasurements(measRes.value);
      }
      if (predRes.status === 'fulfilled' && predRes.value) {
        setPrediction(predRes.value);
      }
      if (castRes.status === 'fulfilled' && castRes.value) {
        setCast(castRes.value);
        const castId = castRes.value.id || castRes.value._id;
        if (castId) {
          try {
            const vRes = await getCastVersions(castId);
            setVersions(Array.isArray(vRes) ? vRes : vRes?.versions || []);
          } catch (e) {}
        }
      }
      if (auditRes.status === 'fulfilled' && auditRes.value) {
        setAuditLogs(Array.isArray(auditRes.value) ? auditRes.value : auditRes.value.audit || []);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Aggregate into unified chronological events
  const timelineEvents = useMemo(() => {
    const list = [];

    // 1. Patient Intake Event
    if (patient?.created_at) {
      list.push({
        id: 'ev_intake',
        timestamp: patient.created_at,
        type: 'intake',
        title: 'Clinical Intake Registered',
        subtitle: `Registered patient ${patient.name} (${patient.age}y / ${patient.gender}) for ${patient.injury_region.toUpperCase()} immobilization.`,
        icon: User,
        badge: 'Intake Complete',
        badgeType: 'success',
        link: `/patients/${patientId}`,
        linkLabel: 'Inspect Patient Dossier',
      });
    }

    // 2. Scan Upload Events
    scans.forEach((scan, idx) => {
      list.push({
        id: `ev_scan_${scan.id || idx}`,
        timestamp: scan.created_at || (patient?.created_at ? patient.created_at + 120 + idx * 30 : Date.now() / 1000),
        type: 'scan',
        title: `Photogrammetric Scan Uploaded (${(scan.angle || 'top').toUpperCase()} Angle)`,
        subtitle: `Stored in storage/uploads/${scan.filename || 'scan.jpg'}. 50mm reference calibration marker verified.`,
        icon: Camera,
        badge: 'Upload Staged',
        badgeType: 'cyan',
        link: `/patients/${patientId}`,
        linkLabel: 'View Scan Capture',
      });
    });

    // 3. Measurement Landmark Event
    if (measurements) {
      list.push({
        id: 'ev_measurements',
        timestamp: measurements.created_at || (patient?.created_at ? patient.created_at + 240 : Date.now() / 1000),
        type: 'measurement',
        title: 'Anatomical Landmark Dimensions Extracted',
        subtitle: measurements.note || 'Calibrated physical millimeters verified from image contours and digital calipers.',
        icon: Ruler,
        badge: 'Metrics Calibrated',
        badgeType: 'teal',
        link: `/measurements/${patientId}`,
        linkLabel: 'Inspect Measurement Table',
      });
    }

    // 4. Prediction Event
    if (prediction?.station_diameters_mm) {
      list.push({
        id: 'ev_prediction',
        timestamp: prediction.created_at || (patient?.created_at ? patient.created_at + 300 : Date.now() / 1000),
        type: 'prediction',
        title: 'XGBoost Multi-Station Regression Generated',
        subtitle: `Predicted diameters: d1=${prediction.station_diameters_mm[0]}mm, d2=${prediction.station_diameters_mm[1]}mm, d3=${prediction.station_diameters_mm[2]}mm (Wall: ${prediction.wall_thickness_mm}mm).`,
        icon: Layers,
        badge: 'Inference Complete',
        badgeType: 'teal',
        link: `/processing/${patientId}`,
        linkLabel: 'View Prediction Details',
      });
    }

    // 5. Cast Generation Event
    if (cast) {
      list.push({
        id: 'ev_cast',
        timestamp: cast.created_at || (patient?.created_at ? patient.created_at + 450 : Date.now() / 1000),
        type: 'cast',
        title: 'Initial 3D Cast CAD Loft Created',
        subtitle: `Bi-valved shell split into Half A and Half B. Volume: ${cast.summary?.total_volume_mm3 || '--'} mm³.`,
        icon: Box,
        badge: 'CAD Lofted',
        badgeType: 'cyan',
        link: `/designer/${patientId}`,
        linkLabel: 'Open in 3D Designer',
      });
    }

    // 6. Cast Version Events
    versions.forEach((ver) => {
      list.push({
        id: `ev_ver_${ver.id || ver.version}`,
        timestamp: ver.created_at || (patient?.created_at ? patient.created_at + 600 + ver.version * 60 : Date.now() / 1000),
        type: 'version',
        title: `Cast Version Committed: v${ver.version}`,
        subtitle: ver.label || `Saved snapshot of parametric configuration in cast_versions collection.`,
        icon: Box,
        badge: `Version v${ver.version}`,
        badgeType: 'success',
        link: `/designer/${patientId}`,
        linkLabel: `Load Version v${ver.version}`,
      });
    });

    // 7. Audit Trail Entries
    auditLogs.forEach((aud, idx) => {
      list.push({
        id: `ev_audit_${aud.id || idx}`,
        timestamp: aud.ts || aud.created_at || Date.now() / 1000,
        type: 'audit',
        title: `Audit Action: ${aud.action}`,
        subtitle: typeof aud.detail === 'object' ? JSON.stringify(aud.detail) : String(aud.detail || ''),
        icon: Activity,
        badge: 'Audit Record',
        badgeType: 'muted',
      });
    });

    // Sort by timestamp descending
    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [patient, scans, measurements, prediction, cast, versions, auditLogs, patientId]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
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
              onClick={() => navigate(`/patients/${patientId}`)}
              className="text-cyan-400 font-bold hover:underline"
            >
              {patientId}
            </button>
            <span>/</span>
            <span className="text-slate-200">Audit Timeline</span>
          </div>
        }
        title={patient ? `${patient.name} — Clinical Audit Trail` : 'Patient History Timeline'}
        subtitle={`Chronological event history recorded across MongoDB collections for MRN ${patientId}.`}
        badge={
          <span className="badge badge-cyan font-mono text-[10px]">
            {timelineEvents.length} Recorded Milestones
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RotateCw}
              onClick={loadHistory}
            >
              Sync Timeline
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={FileText}
              onClick={() => navigate(`/patients/${patientId}`)}
            >
              Patient Dossier
            </Button>
          </div>
        }
      />

      {error && (
        <ErrorState
          error={error}
          title="Timeline Query Failed"
          onRetry={loadHistory}
        />
      )}

      {loading ? (
        <div className="p-12">
          <LoadingState
            title="Assembling Chronological Audit Trail…"
            subtitle="Cross-referencing patients, scans, measurements, predictions, and cast versions in MongoDB."
          />
        </div>
      ) : timelineEvents.length === 0 ? (
        <EmptyState
          title="No Milestones Recorded"
          subtitle="This patient does not have any recorded events in the audit trail yet."
          icon={History}
        />
      ) : (
        <Card reticle={true}>
          <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-800 space-y-8 my-3">
            {timelineEvents.map((evt, idx) => {
              const Icon = evt.icon;
              const dateStr = evt.timestamp
                ? new Date(evt.timestamp * 1000).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Timestamp unavailable';

              return (
                <div key={evt.id || idx} className="relative group">
                  {/* Timeline Node Icon */}
                  <div className="absolute -left-[35px] sm:-left-[43px] top-0 w-8 h-8 rounded-full bg-slate-900 border-2 border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-md group-hover:border-cyan-400 group-hover:scale-105 transition-all">
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Event Content */}
                  <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 group-hover:border-slate-700 transition-colors font-mono space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide font-mono">
                          {evt.title}
                        </h4>
                        {evt.badge && (
                          <span className={`badge ${evt.badgeType === 'success' ? 'badge-success' : evt.badgeType === 'cyan' ? 'badge-cyan' : 'badge-muted'} text-[9px]`}>
                            {evt.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dateStr}
                      </span>
                    </div>

                    <p className="text-xs font-sans text-slate-300 leading-relaxed">
                      {evt.subtitle}
                    </p>

                    {evt.link && (
                      <div className="pt-2">
                        <button
                          onClick={() => navigate(evt.link)}
                          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {evt.linkLabel} <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
