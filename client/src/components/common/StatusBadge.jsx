import React from 'react';

const STATUS_VARIANTS = {
  complete:   { cls: 'badge-success', dot: 'bg-emerald-400', label: 'Complete' },
  completed:  { cls: 'badge-success', dot: 'bg-emerald-400', label: 'Completed' },
  processing: { cls: 'badge-cyan',    dot: 'bg-cyan-400 animate-ping', label: 'Processing' },
  pending:    { cls: 'badge-warning', dot: 'bg-amber-400', label: 'Pending' },
  failed:     { cls: 'badge-danger',  dot: 'bg-rose-400', label: 'Failed' },
  error:      { cls: 'badge-danger',  dot: 'bg-rose-400', label: 'Error' },
  idle:       { cls: 'badge-muted',   dot: 'bg-slate-400', label: 'Idle' },
  acute:      { cls: 'badge-danger',  dot: 'bg-rose-400', label: 'Acute Swelling' },
  subacute:   { cls: 'badge-warning', dot: 'bg-amber-400', label: 'Subacute Swelling' },
  none:       { cls: 'badge-teal',    dot: 'bg-teal-400', label: 'Normal / No Swelling' },
  wrist:      { cls: 'badge-cyan',    dot: 'bg-cyan-400', label: 'Wrist' },
  ankle:      { cls: 'badge-navy',    dot: 'bg-blue-400', label: 'Ankle' },
};

/**
 * Standard status badge with pulsing dot
 */
export default function StatusBadge({ status, label = null, className = '' }) {
  if (!status) return null;
  const key = String(status).toLowerCase();
  const cfg = STATUS_VARIANTS[key] || {
    cls: 'badge-muted',
    dot: 'bg-slate-400',
    label: status,
  };

  return (
    <span className={`badge ${cfg.cls} gap-1.5 ${className}`}>
      <span className="relative flex h-2 w-2">
        {key === 'processing' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
      </span>
      <span>{label || cfg.label}</span>
    </span>
  );
}
