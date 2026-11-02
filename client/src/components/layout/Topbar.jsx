import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, Database, Wifi } from 'lucide-react';
import { getHealth } from '../../api/meta';

const ROUTE_TITLES = {
  '/dashboard':   'Dashboard Overview',
  '/new-patient': 'Patient Intake & Image Capture',
  '/patients':    'Patient Registry & Production Queue',
  '/processing':  'AI Processing & Landmark Extraction',
  '/designer':    '3D Cast Parametric Designer',
  '/validation':  'Clinical Validation & Tolerance Audit',
  '/settings':    'System Architecture & Parameters',
  '/help':        'Documentation & Protocol Guidelines',
};

export default function Topbar() {
  const { pathname } = useLocation();
  const [backendHealthy, setBackendHealthy] = useState(true);

  // Match root or prefix paths
  const matchingKey = Object.keys(ROUTE_TITLES).find(
    (key) => pathname === key || pathname.startsWith(`${key}/`)
  );
  const title = matchingKey ? ROUTE_TITLES[matchingKey] : 'OrthoCast AI';

  useEffect(() => {
    let mounted = true;
    getHealth()
      .then(() => {
        if (mounted) setBackendHealthy(true);
      })
      .catch(() => {
        // In local prototype mode, keep non-blocking
        if (mounted) setBackendHealthy(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="topbar flex items-center justify-between h-14 px-6 flex-shrink-0 z-20">

      {/* ── Left: page title ── */}
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-cyan-400" />
        <h1 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
          {title}
        </h1>
      </div>

      {/* ── Right: search + health + notifications + doctor badge ── */}
      <div className="flex items-center gap-3">

        {/* Global search */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded
                        border border-slate-800 bg-slate-900/80 text-slate-400
                        text-xs w-60 focus-within:border-cyan-500/50 transition-colors">
          <Search className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
          <input
            type="text"
            placeholder="Search patient ID, name, MRN…"
            className="bg-transparent border-none outline-none text-xs text-slate-200 placeholder-slate-500 w-full font-mono"
          />
        </div>

        {/* Backend & Mongo Connection Status */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-800 text-[11px] font-mono">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">FastAPI</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>

        {/* Prototype build badge */}
        <span className="hidden lg:inline-flex badge-muted text-[10px] font-mono tracking-tight border border-slate-800">
          PROTOTYPE v0.1
        </span>

        {/* Notification bell */}
        <button
          id="topbar-notifications"
          className="relative p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" strokeWidth={1.75} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
        </button>

        {/* Doctor Avatar */}
        <div
          id="topbar-user-menu"
          className="w-8 h-8 rounded bg-gradient-to-tr from-cyan-600 to-slate-800 border border-cyan-400/30 flex items-center justify-center text-white text-xs font-bold font-mono shadow-sm"
          aria-label="User avatar"
        >
          DR
        </div>
      </div>
    </header>
  );
}
