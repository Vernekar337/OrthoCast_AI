import React from 'react';
import { ClipboardCheck } from 'lucide-react';

export default function ValidationReportPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-clinical-text">Validation Report</h2>
          <p className="text-sm text-clinical-muted mt-0.5">
            AI model accuracy metrics, dimensional tolerances, and audit trail.
          </p>
        </div>
        <button className="btn-outline btn-sm">
          Download PDF
        </button>
      </div>

      {/* ── Placeholder card ── */}
      <div className="card p-10 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-teal-500" />
        </div>
        <div>
          <p className="font-medium text-clinical-text">Validation Report page</p>
          <p className="text-sm text-clinical-muted mt-1">
            AI confidence scores, dimensional tolerance charts, and QA audit logs will be built here.
          </p>
        </div>
        <span className="badge-muted font-mono text-[10px]">PLACEHOLDER · v0.1</span>
      </div>

    </div>
  );
}
