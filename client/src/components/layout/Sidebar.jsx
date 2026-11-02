import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Activity,
  Box,
  ClipboardCheck,
  Settings,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/dashboard',
  },
  {
    label: 'New Patient',
    icon: UserPlus,
    to: '/new-patient',
  },
  {
    label: 'Patients',
    icon: Users,
    to: '/patients',
  },
  {
    label: 'Processing & Results',
    icon: Activity,
    to: '/processing',
  },
  {
    label: '3D Cast Designer',
    icon: Box,
    to: '/designer',
  },
  {
    label: 'Validation Report',
    icon: ClipboardCheck,
    to: '/validation',
  },
];

const BOTTOM_ITEMS = [
  { label: 'Settings', icon: Settings, to: '/settings' },
  { label: 'Help & Docs', icon: HelpCircle, to: '/help' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar-gradient flex flex-col h-screen w-64 min-w-[256px] flex-shrink-0 select-none border-r border-slate-800">

      {/* ── Logo / Header ── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="relative flex items-center justify-center w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-teal-600 flex-shrink-0 shadow-lg shadow-cyan-950/50">
          <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-slate-950" />
        </div>
        <div className="leading-tight">
          <p className="text-white font-bold text-sm tracking-tight flex items-center gap-1.5 font-mono">
            OrthoCast <span className="text-[10px] px-1 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-semibold">AI</span>
          </p>
          <p className="text-slate-400 text-[10px] font-mono tracking-wider uppercase">
            Clinical Engine v0.1
          </p>
        </div>
      </div>

      {/* ── Primary navigation ── */}
      <nav className="flex-1 px-3 pt-5 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-mono">
          Clinical Workflow
        </p>
        {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? 'nav-item-active' : 'nav-item-idle'
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-cyan-400" strokeWidth={1.75} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── System Status & Bottom items ── */}
      <div className="px-3 pb-3 border-t border-slate-800 pt-3 space-y-1 bg-slate-950/30">
        {/* Backend connectivity indicator */}
        <div className="px-3 py-2 rounded bg-slate-900/80 border border-slate-800 mb-2 flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            FastAPI + Mongo
          </span>
          <span className="text-slate-500 text-[10px]">Active</span>
        </div>

        {BOTTOM_ITEMS.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? 'nav-item-active' : 'nav-item-idle'
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0 text-slate-400" strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* User profile */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-2 border-t border-slate-800 pt-3">
          <div className="w-7 h-7 rounded bg-slate-800 border border-cyan-800/40 flex items-center justify-center flex-shrink-0 text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-slate-200 text-xs font-semibold truncate">Dr. Rajan</p>
            <p className="text-slate-500 text-[10px] font-mono truncate">Orthopedic Surgeon</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
