import React from 'react';
import { Info } from 'lucide-react';

/**
 * Reusable Form Field with label, unit badge, tooltip, and error message
 */
export default function FormField({
  label,
  name,
  error = null,
  tooltip = null,
  unit = null,
  required = false,
  className = '',
  children,
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={name} className="label mb-0 flex items-center gap-1">
            <span>{label}</span>
            {required && <span className="text-rose-400">*</span>}
            {tooltip && (
              <span className="group relative inline-block cursor-help ml-1">
                <Info className="w-3 h-3 text-slate-500 hover:text-cyan-400" />
                <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 p-2 bg-slate-950 border border-slate-700 text-slate-200 text-[10px] rounded shadow-xl z-50 pointer-events-none">
                  {tooltip}
                </span>
              </span>
            )}
          </label>
          {unit && (
            <span className="text-[10px] font-mono text-slate-500 uppercase">
              {unit}
            </span>
          )}
        </div>
      )}

      <div className="relative">
        {children}
      </div>

      {error && (
        <p className="text-[11px] text-rose-400 font-mono mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
