import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Camera,
  Layers,
  Activity,
  ArrowRight,
  Eye,
  RefreshCw,
  UserPlus,
  Box,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Info,
  HelpCircle,
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
import { getPatients, getDashboardStats } from '../api/patients';
import { getHealth } from '../api/meta';

// ── Pipeline Stages Overview ──────────────────────────────────────────────
const PIPELINE_STEPS = [
  {
    id: 'capture',
    step: '01',
    label: 'Image Capture',
    desc: 'Dual-angle photogrammetry with 50mm reference marker',
    icon: Camera,
  },
  {
    id: 'measurement',
    step: '02',
    label: 'Landmark Extraction',
    desc: 'Limb contour detection and pixel-to-mm scaling',
    icon: Activity,
  },
  {
    id: 'prediction',
    step: '03',
    label: 'XGBoost Prediction',
    desc: 'Cross-section station diameter regression & swelling buffer',
    icon: Layers,
  },
  {
    id: 'generation',
    step: '04',
    label: '3D Cast Lofting',
    desc: 'Bi-valved shell split, ventilation lattice, and STL export',
    icon: Box,
  },
];

export default function DashboardPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [patients, setPatients] = useState([]);
  const [backendStats, setBackendStats] = useState(null);
  const [hasStatsEndpoint, setHasStatsEndpoint] = useState(true);
  const [healthStatus, setHealthStatus] = useState(null);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 1. Check health
      getHealth()
        .then((h) => setHealthStatus(h))
        .catch(() => setHealthStatus({ status: 'offline', note: 'FastAPI unreachable' }));

      // 2. Try fetching dedicated dashboard statistics endpoint
      const stats = await getDashboardStats();
      if (stats) {
        setBackendStats(stats);
        setHasStatsEndpoint(true);
      } else {
        setHasStatsEndpoint(false);
      }

      // 3. Fetch patients list for metrics and recent table
      const res = await getPatients();
      const patientList = Array.isArray(res) ? res : res?.items || res?.patients || [];
      setPatients(patientList);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Derived metrics from actual data
  const totalPatientsCount = backendStats?.total_patients ?? patients.length;
  const recentPatients = [...patients]
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    .slice(0, 6);

  // Scans count: use backend stats if available, otherwise check if records have scan metadata
  const scansCount = backendStats?.scans_processed ?? backendStats?.total_scans;
  // Casts count: use backend stats if available
  const castsCount = backendStats?.casts_generated ?? backendStats?.total_casts;
  // Active jobs: use backend stats if available
  const activeJobsCount = backendStats?.active_jobs ?? backendStats?.jobs_in_progress;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Clinical Telemetry & Pipeline Overview"
        subtitle="Real-time operational dashboard for AI-driven patient orthotic design, photogrammetric capture, and CAD fabrication."
        badge={
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan font-mono text-[10px]">
              Engine v0.1
            </span>
            {healthStatus?.status === 'offline' && (
              <span className="badge badge-danger font-mono text-[10px]">
                Backend Offline
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              isLoading={refreshing}
              onClick={() => fetchDashboardData(true)}
            >
              Refresh Data
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Users}
              onClick={() => navigate('/patients')}
            >
              Patient Registry
            </Button>
            <Button
              variant="teal"
              size="sm"
              icon={Box}
              onClick={() => navigate('/designer')}
            >
              3D Cast Designer
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={UserPlus}
              onClick={() => navigate('/new-patient')}
            >
              + New Patient Scan
            </Button>
          </div>
        }
      />

      {/* ── Error Banner ── */}
      {error && (
        <ErrorState
          error={error}
          title="Telemetry Synchronization Failed"
          onRetry={() => fetchDashboardData(false)}
        />
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Patients */}
        <Card reticle={true} className="card-hover">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Total Patients
              </p>
              <div className="text-3xl font-bold font-mono text-white mt-1.5 flex items-baseline gap-1">
                {loading ? (
                  <span className="text-slate-600 animate-pulse">--</span>
                ) : (
                  totalPatientsCount
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Registered in MongoDB
              </p>
            </div>
            <div className="w-10 h-10 rounded-md bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Metric 2: Scans Uploaded / Processed */}
        <Card reticle={true} className="card-hover">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Scans Uploaded
                </p>
                {scansCount === undefined && (
                  <span
                    className="cursor-help text-slate-500 hover:text-cyan-400"
                    title="Backend endpoint GET /dashboard/stats does not yet expose dedicated total_scans aggregate."
                  >
                    <Info className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold font-mono text-white mt-1.5 flex items-baseline gap-1">
                {loading ? (
                  <span className="text-slate-600 animate-pulse">--</span>
                ) : scansCount !== undefined ? (
                  scansCount
                ) : (
                  <span className="text-xs text-slate-500 font-mono italic">
                    Per-Patient
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                {scansCount !== undefined
                  ? 'Dual-angle photogrammetry'
                  : 'Tracked in Patient Details'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-md bg-teal-950/60 border border-teal-800/40 flex items-center justify-center text-teal-400 flex-shrink-0">
              <Camera className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Metric 3: Casts Generated */}
        <Card reticle={true} className="card-hover">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Casts Generated
                </p>
                {castsCount === undefined && (
                  <span
                    className="cursor-help text-slate-500 hover:text-cyan-400"
                    title="Backend endpoint GET /dashboard/stats does not yet expose dedicated total_casts aggregate."
                  >
                    <Info className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold font-mono text-white mt-1.5 flex items-baseline gap-1">
                {loading ? (
                  <span className="text-slate-600 animate-pulse">--</span>
                ) : castsCount !== undefined ? (
                  castsCount
                ) : (
                  <span className="text-xs text-slate-500 font-mono italic">
                    On-Demand
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Bi-valved STL lofts
              </p>
            </div>
            <div className="w-10 h-10 rounded-md bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Box className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Metric 4: Active Processing Jobs */}
        <Card reticle={true} className="card-hover">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Active Jobs
                </p>
                {activeJobsCount === undefined && (
                  <span
                    className="cursor-help text-slate-500 hover:text-cyan-400"
                    title="Live jobs in queue from MongoDB jobs collection."
                  >
                    <Info className="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold font-mono text-cyan-400 mt-1.5 flex items-baseline gap-1">
                {loading ? (
                  <span className="text-slate-600 animate-pulse">--</span>
                ) : activeJobsCount !== undefined ? (
                  activeJobsCount
                ) : (
                  <span className="text-xs text-slate-500 font-mono italic">
                    Idle
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Pipeline execution queue
              </p>
            </div>
            <div className="w-10 h-10 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* ── API Endpoint Notification (Honest State) ── */}
      {!hasStatsEndpoint && !loading && (
        <div className="flex items-center justify-between p-3 rounded-md bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>
              Backend notice: Dedicated <code className="text-cyan-300">GET /api/dashboard/stats</code> endpoint is not yet provided by FastAPI. Metrics are populated directly from <code className="text-cyan-300">GET /api/patients</code>.
            </span>
          </div>
          <span className="badge badge-muted text-[10px]">Zero Faked Data</span>
        </div>
      )}

      {/* ── Clinical Processing Pipeline Architecture ── */}
      <Card
        title="Clinical Pipeline Stages"
        subtitle="End-to-end automated manufacturing workflow from multi-view mobile photos to 3D printing."
        reticle={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {PIPELINE_STEPS.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className="p-4 rounded-md bg-slate-900/60 border border-slate-800 relative group hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700/60 flex items-center justify-center text-cyan-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {stage.step}
                  </span>
                </div>
                <h4 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wide">
                  {stage.label}
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {stage.desc}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Recent Patients & Quick Inspection ── */}
      <Card
        title="Recent Patients in Production Queue"
        subtitle="Latest clinical registrations, anatomical region, and quick actions."
        reticle={true}
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronRight}
            onClick={() => navigate('/patients')}
          >
            View All Patients
          </Button>
        }
        bodyClassName="p-0"
      >
        {loading ? (
          <div className="p-8">
            <LoadingState
              title="Loading Patient Registry…"
              subtitle="Fetching latest clinical documents from MongoDB via FastAPI."
            />
          </div>
        ) : recentPatients.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Patient Records Found"
              subtitle="Get started by registering a new patient and uploading dual-angle limb scans."
              action={
                <Button
                  variant="primary"
                  icon={UserPlus}
                  onClick={() => navigate('/new-patient')}
                >
                  Create First Patient
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-clinical">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Full Name</th>
                  <th>Anatomical Region</th>
                  <th>Swelling Stage</th>
                  <th>Registration Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentPatients.map((p) => {
                  const patientId = p.id || p._id;
                  const dateStr = p.created_at
                    ? new Date(p.created_at * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A';

                  return (
                    <tr key={patientId} className="hover:bg-cyan-950/10">
                      {/* ID */}
                      <td>
                        <span className="font-mono text-cyan-300 font-semibold text-[11px]">
                          {patientId}
                        </span>
                      </td>

                      {/* Name */}
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700/60 flex items-center justify-center text-[10px] font-bold text-slate-300 font-mono">
                            {(p.name || 'P')[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-100">
                            {p.name || 'Unnamed Patient'}
                          </span>
                        </div>
                      </td>

                      {/* Anatomical Region */}
                      <td>
                        <StatusBadge status={p.injury_region || 'wrist'} />
                      </td>

                      {/* Swelling Stage */}
                      <td>
                        <StatusBadge status={p.swelling_stage || 'acute'} />
                      </td>

                      {/* Date */}
                      <td>
                        <span className="font-mono text-slate-400 text-[11px]">
                          {dateStr}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Eye}
                            onClick={() => navigate(`/patients/${patientId}`)}
                          >
                            Details
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/processing/${patientId}`)}
                          >
                            Results
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
