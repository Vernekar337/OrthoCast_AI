import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ── Shared layout ─────────────────────────────────────────────────────────
import AppLayout from './components/layout/AppLayout';

// ── Pages ─────────────────────────────────────────────────────────────────
import DashboardPage        from './pages/DashboardPage';
import NewPatientPage       from './pages/NewPatientPage';
import PatientsPage         from './pages/PatientsPage';
import ValidationReportPage from './pages/ValidationReportPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root → dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* App shell — all clinical pages share sidebar + topbar */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard"   element={<DashboardPage />} />
          <Route path="/new-patient" element={<NewPatientPage />} />
          <Route path="/patients"    element={<PatientsPage />} />
          <Route path="/validation"  element={<ValidationReportPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
