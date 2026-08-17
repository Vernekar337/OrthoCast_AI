import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';

const ROUTE_TITLES = {
  '/dashboard':   'Dashboard',
  '/new-patient': 'New Patient',
  '/patients':    'Patients',
  '/validation':  'Validation Report',
  '/settings':    'Settings',
  '/help':        'Help',
};

export default function Topbar() {
  const { pathname } = useLocation();
  const title = ROUTE_TITLES[pathname] ?? 'OrthoCast AI';

  return (
    <header className="topbar flex items-center justify-between h-14 px-6 bg-white flex-shrink-0">

      {/* ── Left: page title ── */}
      <div className="flex items-center gap-3">
        <h1 className="page-title">{title}</h1>
      </div>

      {/* ── Right: search + badge + bell + avatar ── */}
      <div className="flex items-center gap-3">

        {/* Global search stub */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-input
                        border border-clinical-border bg-clinical-subtle text-clinical-muted
                        text-sm cursor-text hover:border-teal-300 transition-colors duration-150 w-52">
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">Search patients…</span>
        </div>

        {/* Prototype badge */}
        <span className="hidden md:inline-flex badge-muted text-[10px] font-mono tracking-tight border border-clinical-border">
          Prototype Build v0.1
        </span>

        {/* Notification bell */}
        <button
          id="topbar-notifications"
          className="relative p-2 rounded-md text-clinical-muted hover:text-clinical-text hover:bg-clinical-subtle transition-colors duration-150"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" strokeWidth={1.75} />
          {/* Unread dot */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent rounded-full" />
        </button>

        {/* Avatar */}
        <button
          id="topbar-user-menu"
          className="w-8 h-8 rounded-full bg-navy flex items-center justify-center
                     hover:ring-2 hover:ring-teal-300 transition-all duration-150"
          aria-label="User menu"
        >
          <span className="text-white text-xs font-semibold">DR</span>
        </button>
      </div>
    </header>
  );
}
