import React from 'react';

/**
 * Reusable clinical page header
 */
export default function PageHeader({
  title,
  subtitle,
  badge = null,
  actions = null,
  breadcrumbs = null,
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
      <div>
        {breadcrumbs && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 font-mono">
            {breadcrumbs}
          </div>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
