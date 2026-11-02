import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/**
 * AppLayout — Persistent shell for all clinical views.
 *
 * ┌─────────────────────────────────────────────┐
 * │  Sidebar (256px fixed)  │  Topbar (h-14)    │
 * │                         ├───────────────────│
 * │                         │  <Outlet />       │
 * │                         │  (scrollable)     │
 * └─────────────────────────────────────────────┘
 */
export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#070D1B] text-slate-100 bg-grid-tech">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <Topbar />

        {/* Page content — scrollable */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 md:p-8 animate-fade-in"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
