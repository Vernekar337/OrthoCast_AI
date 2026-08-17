import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/**
 * AppLayout — persistent shell for all authenticated/app views.
 *
 * ┌─────────────────────────────────────────────┐
 * │  Sidebar (240px fixed)  │  Topbar (h-14)    │
 * │                         ├───────────────────│
 * │                         │  <Outlet />       │
 * │                         │  (scrollable)     │
 * └─────────────────────────────────────────────┘
 */
export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-clinical-bg">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <Topbar />

        {/* Page content — scrollable */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 animate-fade-in"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
