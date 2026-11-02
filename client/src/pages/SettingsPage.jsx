import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Database,
  Server,
  Sliders,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Cpu,
  Shield,
  Layers,
  Code2,
  Activity,
  HardDrive,
  Info,
} from 'lucide-react';
import { PageHeader, Card, Button, StatusBadge, LoadingState, ErrorState } from '../components/common';
import { getMetaLimits, getHealth, DEFAULT_PARAM_LIMITS } from '../api/meta';
import { API_BASE_URL } from '../api/client';

export default function SettingsPage() {
  const [limits, setLimits] = useState(DEFAULT_PARAM_LIMITS);
  const [health, setHealth] = useState(null);
  const [pingLatency, setPingLatency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const checkTelemetry = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const t0 = performance.now();
    try {
      const [healthRes, limitsRes] = await Promise.allSettled([
        getHealth(),
        getMetaLimits(),
      ]);

      const t1 = performance.now();
      setPingLatency(Math.round(t1 - t0));

      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setHealth(healthRes.value);
      } else {
        setHealth({ status: 'offline', note: 'FastAPI / MongoDB ping timed out or offline' });
      }

      if (limitsRes.status === 'fulfilled' && limitsRes.value) {
        setLimits(limitsRes.value);
      }
    } catch (err) {
      setError(err);
      setHealth({ status: 'offline' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkTelemetry();
  }, [checkTelemetry]);

  const isConnected = health && health.status !== 'offline';

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in font-mono text-xs">
      {/* ── Page Header ── */}
      <PageHeader
        title="System Infrastructure & Telemetry"
        subtitle="Operational status of the FastAPI services, MongoDB connection pools, ML model weights, and parametric limits."
        badge={
          <div className="flex items-center gap-2">
            <span className={`badge ${isConnected ? 'badge-success' : 'badge-danger'} text-[10px]`}>
              {isConnected ? 'FastAPI Connected' : 'Backend Disconnected'}
            </span>
            {pingLatency !== null && (
              <span className="badge badge-muted text-[10px]">
                {pingLatency} ms ping
              </span>
            )}
          </div>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            isLoading={refreshing}
            onClick={() => checkTelemetry(true)}
          >
            Ping Systems
          </Button>
        }
      />

      {/* ── Subsystem Architecture Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backend & Database Telemetry */}
        <Card title="FastAPI & MongoDB Architecture" icon={Server} reticle={true}>
          <div className="space-y-3.5">
            <div>
              <span className="text-slate-400 block mb-1">Target API Base URL:</span>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-cyan-400 font-bold truncate">
                {API_BASE_URL}
              </div>
            </div>

            <div className="p-3 rounded bg-slate-950/60 border border-slate-800 space-y-2 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">FastAPI HTTP API:</span>
                <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {isConnected ? 'Active & Responding' : 'Offline / Standalone Mode'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Database Engine:</span>
                <span className="text-slate-200">MongoDB (NoSQL Document Store)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Connection Policy:</span>
                <span className="text-slate-200">Exclusive FastAPI Proxy (Zero Client DB Exposure)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Streaming Protocols:</span>
                <span className="text-cyan-300">Server-Sent Events (SSE) /jobs/:id/events</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              MongoDB credentials and backend secrets are retained exclusively in server environment configurations. React communicates exclusively through authenticated HTTP and EventSource endpoints.
            </p>
          </div>
        </Card>

        {/* CAD & ML Subsystem Status */}
        <Card title="Algorithm & Modeling Subsystems" icon={Cpu} reticle={true}>
          <div className="space-y-3 font-mono">
            {[
              {
                name: 'XGBoost Geometric Regressor',
                desc: 'Wrist & Ankle multi-station diameter inference',
                sub: 'server/app/ml/artifacts (meta.json + models)',
                status: 'Available',
              },
              {
                name: 'Trimesh CSG Loft Engine',
                desc: 'Lofted bi-valved shell & CSG perforation',
                sub: 'server/Cast_logic/generate_cast.py',
                status: 'Available',
              },
              {
                name: 'OpenCV Computer Vision Pipeline',
                desc: '50mm marker scale & contour landmark extraction',
                sub: 'cv2 / mediapipe photogrammetry',
                status: 'Available',
              },
              {
                name: 'Three.js WebGL 3D Renderer',
                desc: 'Client-side OrbitControls, exploded views & STLLoader',
                sub: 'Three.js r174 WebGL Engine',
                status: 'Hardware Accelerated',
              },
            ].map((sub, idx) => (
              <div key={idx} className="p-2.5 rounded bg-slate-950 border border-slate-800/80 space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-100">{sub.name}</span>
                  <span className="badge badge-teal text-[9px]">{sub.status}</span>
                </div>
                <p className="text-[10px] text-slate-400">{sub.desc}</p>
                <p className="text-[9px] text-slate-600 font-mono">{sub.sub}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Active Server Parametric Boundaries (GET /api/meta) ── */}
      <Card
        title="Server Parametric Boundaries (GET /api/meta)"
        subtitle="Constrains all client UI slider inputs conforming to FastAPI Pydantic CastParams schema."
        icon={Sliders}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(limits).map(([key, val]) => (
            <div key={key} className="p-3 rounded bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase text-slate-400 block truncate">{key}</span>
              <span className="text-cyan-300 font-bold text-xs mt-1 block">
                {typeof val === 'object' && val !== null && !Array.isArray(val)
                  ? `${val.min} – ${val.max} ${val.step ? `(step ${val.step})` : ''}`
                  : Array.isArray(val)
                  ? val.join(', ')
                  : String(val)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Environment & Application Runtime ── */}
      <Card title="Application Runtime Environment" icon={HardDrive}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-500 uppercase text-[10px] block">Frontend Client</span>
            <span className="text-slate-200 font-bold block mt-0.5">React 19 + Vite 7 (ES Modules)</span>
          </div>
          <div className="p-3 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-500 uppercase text-[10px] block">Build Environment</span>
            <span className="text-slate-200 font-bold block mt-0.5">{import.meta.env.MODE || 'production'}</span>
          </div>
          <div className="p-3 rounded bg-slate-950 border border-slate-800">
            <span className="text-slate-500 uppercase text-[10px] block">Prototype Version</span>
            <span className="text-cyan-300 font-bold block mt-0.5">OrthoCast AI v0.1</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
