import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ── Shared layout ─────────────────────────────────────────────────────────
import AppLayout from './components/layout/AppLayout';

// ── Pages ─────────────────────────────────────────────────────────────────
import DashboardPage        from './pages/DashboardPage';
import NewPatientPage       from './pages/NewPatientPage';
import PatientsPage         from './pages/PatientsPage';
import PatientDetailPage     from './pages/PatientDetailPage';
import PatientHistoryPage    from './pages/PatientHistoryPage';
import ProcessingPage       from './pages/ProcessingPage';
import CastDesignerPage     from './pages/CastDesignerPage';
import ValidationReportPage from './pages/ValidationReportPage';
import SettingsPage         from './pages/SettingsPage';
import HelpPage             from './pages/HelpPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root → dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* App shell — all clinical pages share sidebar + topbar */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard"                element={<DashboardPage />} />
          <Route path="/new-patient"              element={<NewPatientPage />} />
          <Route path="/patients"                 element={<PatientsPage />} />
          <Route path="/patients/:patientId"      element={<PatientDetailPage />} />
          <Route path="/patients/:patientId/history" element={<PatientHistoryPage />} />
          <Route path="/processing"               element={<ProcessingPage />} />
          <Route path="/processing/:patientId"    element={<ProcessingPage />} />
          <Route path="/measurements/:patientId"  element={<ProcessingPage initialTab="measurements" />} />
          <Route path="/designer"                 element={<CastDesignerPage />} />
          <Route path="/designer/:patientId"      element={<CastDesignerPage />} />
          <Route path="/validation"               element={<ValidationReportPage />} />
          <Route path="/settings"                 element={<SettingsPage />} />
          <Route path="/help"                     element={<HelpPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
