import React from 'react';
import { Loader2, Activity } from 'lucide-react';

/**
 * Reusable clinical scanning / loading state
 */
export default function LoadingState({
  title = 'Processing Clinical Data…',
  subtitle = 'Please wait while algorithm computes parameters.',
  progress = null,
  step = null,
  inline = false,
}) {
  if (inline) {
    return (
      <div className="flex items-center gap-2 text-xs text-cyan-400 font-mono py-2">
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        <span>{title}</span>
        {progress !== null && <span className="text-slate-400 font-bold">({progress}%)</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-10 text-center rounded-lg border border-slate-800/80 bg-slate-900/40">
      <div className="relative mb-4">
        {/* Radar beam circle */}
        <div className="w-14 h-14 rounded-full border-2 border-cyan-500/20 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border border-cyan-500/40 animate-ping opacity-30" />
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin absolute" />
        </div>
      </div>

      <h3 className="text-sm font-semibold text-slate-100 tracking-wide uppercase font-mono">
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          {subtitle}
        </p>
      )}

      {step && (
        <div className="mt-3 px-3 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-[11px] font-mono text-cyan-300">
          Stage: {step}
        </div>
      )}

      {progress !== null && (
        <div className="w-48 mt-4">
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
            <span>Progress</span>
            <span className="text-cyan-400">{progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-teal-400 to-cyan-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
