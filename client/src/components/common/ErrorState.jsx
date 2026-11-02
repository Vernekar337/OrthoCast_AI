import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff, HelpCircle } from 'lucide-react';

/**
 * Diagnostic error display for clinical engineering failures
 */
export default function ErrorState({
  error,
  title = 'System Error',
  onRetry = null,
  compact = false,
}) {
  const isOffline = error?.code === 'offline' || (typeof window !== 'undefined' && !window.navigator.onLine);
  const message = error?.message || (typeof error === 'string' ? error : 'An unexpected error occurred.');
  const code = error?.code || 'UNKNOWN_ERROR';
  const hint = error?.hint || null;

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-rose-950/30 border border-rose-800/40 text-xs">
        <div className="flex items-center gap-2 text-rose-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span className="truncate">{message}</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-outline btn-sm text-[10px] text-rose-300 border-rose-700/50 hover:bg-rose-900/30 flex-shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 rounded-lg bg-rose-950/20 border border-rose-800/40 text-center max-w-lg mx-auto">
      <div className="w-12 h-12 rounded-full bg-rose-900/30 border border-rose-700/50 flex items-center justify-center mx-auto mb-3 text-rose-400">
        {isOffline ? <WifiOff className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
      </div>

      <div className="inline-block px-2 py-0.5 rounded bg-rose-900/40 text-[10px] font-mono uppercase tracking-wider text-rose-300 mb-2 border border-rose-700/30">
        Diagnostic Code: {code}
      </div>

      <h3 className="text-sm font-semibold text-rose-200 uppercase tracking-wide">
        {title}
      </h3>

      <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">
        {message}
      </p>

      {hint && (
        <div className="mt-3 p-2.5 rounded bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2 text-left">
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-cyan-300">Remediation: </span>
            {hint}
          </div>
        </div>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 btn btn-outline btn-sm text-rose-300 border-rose-800 hover:border-rose-600 gap-1.5"
        >
          <RefreshCw className="w-3 h-3" />
          Retry Operation
        </button>
      )}
    </div>
  );
}
