import React, { useMemo } from 'react';
import {
  Sliders,
  Layers,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
  Lock,
} from 'lucide-react';
import { Card, FormField, Button } from '../common';
import { DEFAULT_PARAM_LIMITS } from '../../api/meta';

export default function ParameterControls({
  params,
  onChange,
  limits = DEFAULT_PARAM_LIMITS,
  savedParams = null,
  onResetToSaved = null,
  isDirty = false,
  disabled = false,
}) {
  // Validate vent constraint: hole_mm <= spacing_mm - 2
  const ventWarning = useMemo(() => {
    if (params.vent?.enabled) {
      if (params.vent.hole_mm > params.vent.spacing_mm - 2) {
        return 'Ventilation hole diameter must be at least 2 mm smaller than spacing.';
      }
    }
    return null;
  }, [params.vent]);

  const handleStationChange = (index, value) => {
    const updated = [...params.station_diameters_mm];
    updated[index] = parseFloat(value);
    onChange({ ...params, station_diameters_mm: updated });
  };

  return (
    <div className="space-y-4 text-xs font-mono">
      {/* Parameter State Bar */}
      <div className="flex items-center justify-between p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isDirty ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          <span className="text-slate-300">
            {isDirty ? 'Unsaved Parameter Modifications' : 'Parameters Synchronized with Active Version'}
          </span>
        </div>
        {isDirty && onResetToSaved && (
          <button
            onClick={onResetToSaved}
            className="text-cyan-400 hover:underline flex items-center gap-1"
            title="Reset parameters to active version values"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* ── Section 1: Station Diameters ── */}
      <Card title="Station Diameters (Loft Cross-Sections)" icon={Layers}>
        <div className="space-y-3.5">
          {params.station_diameters_mm?.map((diam, idx) => {
            const label =
              idx === 0
                ? 'Distal Station (Palm / Malleolar)'
                : idx === 1
                ? 'Mid-Point Station (Wrist / Ankle)'
                : 'Proximal Station (Forearm / Lower Leg)';

            return (
              <FormField key={idx} label={`d${idx + 1} — ${label}`} unit="mm">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    disabled={disabled}
                    min={limits.station_diameter_mm.min}
                    max={limits.station_diameter_mm.max}
                    step={0.5}
                    value={diam}
                    onChange={(e) => handleStationChange(idx, e.target.value)}
                    className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    disabled={disabled}
                    min={limits.station_diameter_mm.min}
                    max={limits.station_diameter_mm.max}
                    step={0.5}
                    value={diam}
                    onChange={(e) => handleStationChange(idx, e.target.value)}
                    className="input w-16 py-1 px-1.5 text-right font-mono text-xs bg-slate-950 border-slate-800 text-cyan-300 font-bold"
                  />
                </div>
              </FormField>
            );
          })}
        </div>
      </Card>

      {/* ── Section 2: Shell Dimensions & Thickness ── */}
      <Card title="Structural Shell Dimensions" icon={Sliders}>
        <div className="space-y-3.5">
          {/* Wall Thickness */}
          <FormField
            label="Wall Thickness"
            unit="mm"
            tooltip="Structural rigidity vs print weight. PLA optimum: 3.5 - 5.0 mm."
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                disabled={disabled}
                min={limits.wall_thickness_mm.min}
                max={limits.wall_thickness_mm.max}
                step={limits.wall_thickness_mm.step || 0.1}
                value={params.wall_thickness_mm}
                onChange={(e) => onChange({ ...params, wall_thickness_mm: parseFloat(e.target.value) })}
                className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="w-16 text-right font-bold text-cyan-300">
                {params.wall_thickness_mm} mm
              </span>
            </div>
          </FormField>

          {/* Total Length */}
          <FormField label="Total Cast Length" unit="mm" tooltip="Total longitudinal immobilization span.">
            <div className="flex items-center gap-3">
              <input
                type="range"
                disabled={disabled}
                min={limits.total_length_mm.min}
                max={limits.total_length_mm.max}
                step={1}
                value={params.total_length_mm}
                onChange={(e) => onChange({ ...params, total_length_mm: parseFloat(e.target.value) })}
                className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="w-16 text-right font-bold text-cyan-300">
                {params.total_length_mm} mm
              </span>
            </div>
          </FormField>

          {/* Seam Angle */}
          <FormField label="Bisection Seam Angle" unit="deg" tooltip="Rotates the parting line between Half A and Half B.">
            <div className="flex items-center gap-3">
              <input
                type="range"
                disabled={disabled}
                min={limits.seam_angle_deg.min}
                max={limits.seam_angle_deg.max}
                step={limits.seam_angle_deg.step || 5}
                value={params.seam_angle_deg}
                onChange={(e) => onChange({ ...params, seam_angle_deg: parseFloat(e.target.value) })}
                className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="w-16 text-right font-bold text-cyan-300">
                {params.seam_angle_deg}°
              </span>
            </div>
          </FormField>

          {/* Closure Tabs */}
          <FormField label="Interlocking Closure Tabs" unit="pins" tooltip="Snap-fit pins along the split edge.">
            <div className="flex items-center gap-3">
              <input
                type="range"
                disabled={disabled}
                min={limits.tab_count.min}
                max={limits.tab_count.max}
                step={1}
                value={params.tabs?.count ?? 3}
                onChange={(e) => onChange({ ...params, tabs: { count: parseInt(e.target.value, 10) } })}
                className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="w-16 text-right font-bold text-cyan-300">
                {params.tabs?.count ?? 3} pairs
              </span>
            </div>
          </FormField>
        </div>
      </Card>

      {/* ── Section 3: Ventilation Lattice ── */}
      <Card title="Breathable Ventilation Lattice" icon={Sliders}>
        <div className="space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-slate-200 uppercase font-bold">Cut Aeration Holes</span>
            <input
              type="checkbox"
              disabled={disabled}
              checked={params.vent?.enabled}
              onChange={(e) => onChange({ ...params, vent: { ...params.vent, enabled: e.target.checked } })}
              className="w-4 h-4 accent-cyan-400 cursor-pointer"
            />
          </div>

          {params.vent?.enabled && (
            <>
              {ventWarning && (
                <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-400" />
                  <span>{ventWarning}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Pattern">
                  <select
                    disabled={disabled}
                    value={params.vent?.pattern || 'staggered'}
                    onChange={(e) => onChange({ ...params, vent: { ...params.vent, pattern: e.target.value } })}
                    className="select text-xs font-mono py-1 px-2"
                  >
                    <option value="staggered">Staggered (Hex)</option>
                    <option value="grid">Orthogonal Grid</option>
                  </select>
                </FormField>

                <FormField label="Hole Size" unit="mm">
                  <input
                    type="number"
                    disabled={disabled}
                    step={0.5}
                    min={limits.vent_hole_mm.min}
                    max={limits.vent_hole_mm.max}
                    value={params.vent?.hole_mm}
                    onChange={(e) => onChange({ ...params, vent: { ...params.vent, hole_mm: parseFloat(e.target.value) } })}
                    className="input text-xs font-mono py-1 px-2 text-cyan-300"
                  />
                </FormField>
              </div>

              <FormField label="Lattice Spacing" unit="mm">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    disabled={disabled}
                    min={limits.vent_spacing_mm.min}
                    max={limits.vent_spacing_mm.max}
                    step={limits.vent_spacing_mm.step || 1}
                    value={params.vent?.spacing_mm}
                    onChange={(e) => onChange({ ...params, vent: { ...params.vent, spacing_mm: parseFloat(e.target.value) } })}
                    className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="w-16 text-right font-bold text-cyan-300">
                    {params.vent?.spacing_mm} mm
                  </span>
                </div>
              </FormField>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
