import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Ruler,
  BrainCircuit,
  Printer,
  ArrowRight,
  Users,
  Package,
  Clock,
  Target,
  Eye,
  ChevronRight,
} from 'lucide-react';

// ── Pipeline stages ────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  {
    id: 'capture',
    label: 'Image Capture',
    sublabel: 'Multi-angle photogrammetry',
    icon: Camera,
    color: 'bg-navy-50 text-navy-500',
    ring: 'ring-navy-200',
    active: true,
  },
  {
    id: 'measurement',
    label: 'Measurement Extraction',
    sublabel: 'AI landmark detection',
    icon: Ruler,
    color: 'bg-accent-50 text-accent-500',
    ring: 'ring-accent-200',
    active: true,
  },
  {
    id: 'prediction',
    label: 'AI Prediction',
    sublabel: 'Cast geometry modelling',
    icon: BrainCircuit,
    color: 'bg-teal-50 text-teal-500',
    ring: 'ring-teal-200',
    active: true,
  },
  {
    id: 'generation',
    label: '3D Cast Generation',
    sublabel: 'Slicer-ready STL export',
    icon: Printer,
    color: 'bg-teal-100 text-teal-700',
    ring: 'ring-teal-300',
    active: false,
  },
];

// ── Stat cards ─────────────────────────────────────────────────────────────
const STATS = [
  {
    id: 'total-patients',
    label: 'Total Patients',
    value: '24',
    unit: null,
    icon: Users,
    iconBg: 'bg-navy-50',
    iconColor: 'text-navy-500',
    delta: '+3 this week',
    deltaPos: true,
  },
  {
    id: 'casts-generated',
    label: 'Casts Generated',
    value: '31',
    unit: null,
    icon: Package,
    iconBg: 'bg-accent-50',
    iconColor: 'text-accent-500',
    delta: '+5 this month',
    deltaPos: true,
  },
  {
    id: 'avg-processing-time',
    label: 'Avg. Processing Time',
    value: '4.2',
    unit: 'min',
    icon: Clock,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    delta: '−0.3 vs last week',
    deltaPos: true,
  },
  {
    id: 'measurement-accuracy',
    label: 'Measurement Accuracy',
    value: '96.8',
    unit: '%',
    icon: Target,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-500',
    delta: '+1.2% vs baseline',
    deltaPos: true,
  },
];

// ── Recent patients ────────────────────────────────────────────────────────
const RECENT_PATIENTS = [
  { id: 'P-1041', name: 'Arjun Mehta',    date: '2026-08-17', castType: 'Wrist',  status: 'Complete'   },
  { id: 'P-1040', name: 'Priya Sharma',   date: '2026-08-16', castType: 'Ankle',  status: 'Processing' },
  { id: 'P-1039', name: 'Rahul Nair',     date: '2026-08-16', castType: 'Wrist',  status: 'Complete'   },
  { id: 'P-1038', name: 'Sunita Patel',   date: '2026-08-15', castType: 'Ankle',  status: 'Pending'    },
  { id: 'P-1037', name: 'Vikram Desai',   date: '2026-08-14', castType: 'Wrist',  status: 'Complete'   },
  { id: 'P-1036', name: 'Anjali Iyer',    date: '2026-08-13', castType: 'Wrist',  status: 'Pending'    },
  { id: 'P-1035', name: 'Ravi Krishnan',  date: '2026-08-12', castType: 'Ankle',  status: 'Complete'   },
];

// ── Status badge ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Complete:   { cls: 'badge-success',  dot: 'bg-green-500'  },
  Processing: { cls: 'badge-accent',   dot: 'bg-accent animate-pulse-soft' },
  Pending:    { cls: 'badge-warning',  dot: 'bg-amber-400'  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { cls: 'badge-muted', dot: 'bg-gray-400' };
  return (
    <span className={`badge ${cfg.cls} gap-1.5`}>
      <span className={`status-dot ${cfg.dot}`} />
      {status}
    </span>
  );
}

// ── Pipeline connector ─────────────────────────────────────────────────────
function PipelineArrow({ active }) {
  return (
    <div className="flex-1 flex items-center justify-center px-1 pt-0">
      <div className={`flex items-center gap-0 w-full`}>
        <div className={`h-[1.5px] flex-1 ${active ? 'bg-teal-300' : 'bg-clinical-border'}`} />
        <ArrowRight
          className={`w-4 h-4 flex-shrink-0 -ml-1 ${active ? 'text-teal-400' : 'text-clinical-border'}`}
          strokeWidth={2}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-clinical-text">Clinical Dashboard</h2>
          <p className="text-sm text-clinical-muted mt-0.5">
            AI-driven orthopedic cast production overview &mdash; Prototype Build v0.1
          </p>
        </div>
        <button
          id="btn-new-patient-scan"
          onClick={() => navigate('/new-patient')}
          className="btn-primary gap-2 shadow-sm"
        >
          <span className="text-lg leading-none">+</span>
          New Patient Scan
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          1. Pipeline diagram
      ════════════════════════════════════════════════════════════════════ */}
      <section
        id="pipeline-diagram"
        className="card p-6"
      >
        <p className="section-title mb-5">Processing Pipeline</p>

        <div className="flex items-start">
          {PIPELINE_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            const isLast = i === PIPELINE_STAGES.length - 1;
            return (
              <React.Fragment key={stage.id}>
                {/* Stage node */}
                <div className="flex flex-col items-center gap-2.5 min-w-0 w-32 flex-shrink-0">
                  {/* Icon circle */}
                  <div
                    className={`
                      w-14 h-14 rounded-full flex items-center justify-center
                      ring-2 ${stage.ring} ${stage.color}
                      transition-transform duration-200 hover:scale-105
                    `}
                  >
                    <Icon className="w-6 h-6" strokeWidth={1.75} />
                  </div>

                  {/* Stage number chip */}
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[10px] font-semibold text-clinical-muted uppercase tracking-widest mb-0.5">
                      Step {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-clinical-text leading-tight text-center">
                      {stage.label}
                    </span>
                    <span className="text-[11px] text-clinical-muted mt-1 leading-snug text-center px-1">
                      {stage.sublabel}
                    </span>
                  </div>
                </div>

                {/* Arrow connector */}
                {!isLast && (
                  <div className="flex-1 pt-7">
                    <PipelineArrow active={stage.active} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-6 pt-4 border-t border-clinical-border flex items-center gap-4">
          <span className="text-xs text-clinical-muted font-medium">Pipeline Completion</span>
          <div className="flex-1 h-1.5 bg-clinical-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-700"
              style={{ width: '75%' }}
            />
          </div>
          <span className="text-xs font-data text-teal-600 font-semibold">75%</span>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          2. Stat cards
      ════════════════════════════════════════════════════════════════════ */}
      <section id="stat-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.id} id={`stat-${s.id}`} className="card card-hover p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-md flex items-center justify-center ${s.iconBg}`}>
                  <Icon className={`w-4 h-4 ${s.iconColor}`} strokeWidth={1.75} />
                </div>
              </div>

              {/* Value */}
              <div className="flex items-baseline gap-1">
                <span className="font-data text-3xl font-semibold text-clinical-text tracking-tight">
                  {s.value}
                </span>
                {s.unit && (
                  <span className="font-data text-sm text-clinical-muted">{s.unit}</span>
                )}
              </div>

              <p className="text-xs font-medium text-clinical-secondary mt-0.5">{s.label}</p>

              {/* Delta */}
              <p className={`text-[11px] mt-2 ${s.deltaPos ? 'text-teal-600' : 'text-red-500'}`}>
                {s.delta}
              </p>
            </div>
          );
        })}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          3. Recent patients table
      ════════════════════════════════════════════════════════════════════ */}
      <section id="recent-patients" className="card overflow-hidden">

        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-clinical-border">
          <div>
            <p className="section-title">Recent Patients</p>
            <p className="text-xs text-clinical-muted mt-0.5">Last 7 scans — ordered by date</p>
          </div>
          <button
            id="btn-view-all-patients"
            onClick={() => navigate('/patients')}
            className="btn-ghost btn-sm"
          >
            View all
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="table-clinical">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Date</th>
                <th>Cast Type</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_PATIENTS.map((p) => (
                <tr key={p.id}>
                  {/* ID */}
                  <td>
                    <span className="font-data text-xs text-clinical-muted">{p.id}</span>
                  </td>

                  {/* Name */}
                  <td>
                    <div className="flex items-center gap-2.5">
                      {/* Avatar initials */}
                      <div className="w-7 h-7 rounded-full bg-clinical-subtle border border-clinical-border
                                      flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-semibold text-clinical-muted">
                          {p.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <span className="font-medium text-clinical-text">{p.name}</span>
                    </div>
                  </td>

                  {/* Date */}
                  <td>
                    <span className="font-data text-xs text-clinical-secondary">
                      {new Date(p.date).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </td>

                  {/* Cast type */}
                  <td>
                    <span className={`badge ${p.castType === 'Wrist' ? 'badge-navy' : 'badge-teal'}`}>
                      {p.castType}
                    </span>
                  </td>

                  {/* Status */}
                  <td>
                    <StatusBadge status={p.status} />
                  </td>

                  {/* Action */}
                  <td className="text-right">
                    <button
                      id={`btn-view-${p.id}`}
                      className="btn-outline btn-sm gap-1.5"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="px-5 py-3 border-t border-clinical-border flex items-center justify-between bg-clinical-subtle">
          <span className="text-xs text-clinical-muted font-data">
            Showing 7 of 24 patients
          </span>
          <button
            onClick={() => navigate('/new-patient')}
            className="btn-primary btn-sm"
          >
            + New Patient Scan
          </button>
        </div>
      </section>

    </div>
  );
}
