import React from 'react';

/**
 * Clinical engineering card component with optional reticles and header
 */
export default function Card({
  title,
  subtitle,
  icon: Icon = null,
  action = null,
  reticle = false,
  className = '',
  bodyClassName = 'p-5',
  children,
}) {
  return (
    <div className={`card ${reticle ? 'hud-reticle' : ''} ${className}`}>
      {(title || Icon || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="w-7 h-7 rounded bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center flex-shrink-0 text-cyan-400">
                <Icon className="w-3.5 h-3.5" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-slate-200 tracking-wide uppercase truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="flex-shrink-0 ml-3">{action}</div>}
        </div>
      )}

      <div className={bodyClassName}>
        {children}
      </div>
    </div>
  );
}
