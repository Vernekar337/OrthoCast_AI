import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  ClipboardCheck,
  Activity,
  Settings,
  HelpCircle,
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
    label: 'Validation Report',
    icon: ClipboardCheck,
    to: '/validation',
  },
];

const BOTTOM_ITEMS = [
  { label: 'Settings', icon: Settings, to: '/settings' },
  { label: 'Help',     icon: HelpCircle, to: '/help' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar-gradient flex flex-col h-screen w-60 min-w-[240px] flex-shrink-0 select-none">

      {/* ── Logo / Wordmark ── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        {/* Teal cross icon mark */}
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-teal-500 flex-shrink-0">
          <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <p className="text-white font-semibold text-[15px] tracking-tight">OrthoCast</p>
          <p className="text-teal-300 text-[10px] font-medium tracking-widest uppercase">AI System</p>
        </div>
      </div>

      {/* ── Primary navigation ── */}
      <nav className="flex-1 px-3 pt-5 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-3 text-[10px] font-semibold text-navy-300 uppercase tracking-wider opacity-60">
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
            <Icon className="nav-icon w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom items ── */}
      <div className="px-3 pb-3 border-t border-white/10 pt-3 space-y-0.5">
        {BOTTOM_ITEMS.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className="nav-item-idle"
          >
            <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* User stub */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-2 border-t border-white/10 pt-3">
          <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">DR</span>
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-white text-xs font-medium truncate">Dr. Rajan</p>
            <p className="text-navy-300 text-[10px] opacity-70">Orthopedic Surgeon</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
