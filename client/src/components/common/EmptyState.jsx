import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * Empty state component
 */
export default function EmptyState({
  title = 'No Records Found',
  subtitle = 'There are no active records in this clinical workspace.',
  icon: Icon = Inbox,
  action = null,
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-slate-800 bg-slate-900/20">
      <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
        {title}
      </h3>
      <p className="text-xs text-slate-400 mt-1 max-w-sm">
        {subtitle}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
