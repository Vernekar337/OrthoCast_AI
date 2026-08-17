import React from 'react';
import { Users } from 'lucide-react';

export default function PatientsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-clinical-text">Patient Registry</h2>
          <p className="text-sm text-clinical-muted mt-0.5">
            All registered patients, scan status, and cast production tracking.
          </p>
        </div>
        <button className="btn-outline btn-sm">
          Export CSV
        </button>
      </div>

      {/* ── Placeholder card ── */}
      <div className="card p-10 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-navy-50 flex items-center justify-center">
          <Users className="w-5 h-5 text-navy" />
        </div>
        <div>
          <p className="font-medium text-clinical-text">Patients page</p>
          <p className="text-sm text-clinical-muted mt-1">
            Filterable patient table with status badges, scan timestamps, and cast dimensions will appear here.
          </p>
        </div>
        <span className="badge-muted font-mono text-[10px]">PLACEHOLDER · v0.1</span>
      </div>

    </div>
  );
}
