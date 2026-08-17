import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  CheckCircle2,
  X,
  Info,
  Hand,
  Footprints,
  ArrowRight,
  RotateCcw,
  Eye,
  Layers,
  ChevronRight,
  AlertCircle,
  Cpu,
} from 'lucide-react';

// ── Tooltip ────────────────────────────────────────────────────────────────
function Tooltip({ text }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        className="text-clinical-muted hover:text-accent transition-colors duration-150 ml-1"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        aria-label="More info"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {visible && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 bg-navy text-white
                     text-xs rounded-md px-3 py-2 shadow-lg z-50 leading-relaxed pointer-events-none"
          role="tooltip"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy" />
        </span>
      )}
    </span>
  );
}

// ── Hand SVG illustration ──────────────────────────────────────────────────
function HandIllustration({ angle }) {
  return (
    <svg viewBox="0 0 160 180" className="w-32 h-36 opacity-20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {angle === 'top' ? (
        /* Top-down hand outline */
        <g stroke="#0F6E6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Palm */}
          <path d="M55 100 Q50 130 55 150 Q80 165 105 150 Q110 130 105 100 Z" />
          {/* Thumb */}
          <path d="M55 110 Q40 105 35 90 Q33 78 42 72 Q52 68 58 80 L60 100" />
          {/* Index */}
          <path d="M65 100 L63 62 Q63 52 70 50 Q78 49 80 58 L80 100" />
          {/* Middle */}
          <path d="M80 100 L80 55 Q80 44 87 43 Q95 43 96 54 L95 100" />
          {/* Ring */}
          <path d="M95 100 L97 62 Q98 51 105 51 Q113 52 113 62 L110 100" />
          {/* Pinky */}
          <path d="M110 100 L112 72 Q113 64 119 64 Q125 65 124 74 L120 100" />
          {/* Knuckle lines */}
          <line x1="65" y1="90" x2="115" y2="90" strokeDasharray="3 4" strokeWidth="1" opacity="0.5"/>
        </g>
      ) : (
        /* Side-angle hand outline */
        <g stroke="#0F6E6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Wrist/palm side view */}
          <path d="M40 140 Q40 160 80 162 Q120 160 120 140 L118 100 Q118 88 108 86 L75 85 Q62 86 60 100 Z" />
          {/* Fingers curled side view */}
          <path d="M75 85 Q73 65 78 55 Q83 48 90 52 Q96 58 93 70 L88 86" />
          <path d="M88 85 Q87 60 93 50 Q99 43 106 47 Q112 54 109 68 L105 86" />
          {/* Thumb side */}
          <path d="M60 102 Q48 98 44 87 Q42 76 52 71 Q62 69 65 82 L66 100" />
        </g>
      )}
    </svg>
  );
}

// ── Foot SVG illustration ──────────────────────────────────────────────────
function FootIllustration({ angle }) {
  return (
    <svg viewBox="0 0 160 180" className="w-32 h-36 opacity-20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {angle === 'top' ? (
        /* Top-down foot outline */
        <g stroke="#0F6E6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Sole */}
          <path d="M50 160 Q45 130 48 100 Q52 70 65 55 Q80 45 95 55 Q108 65 110 90 Q112 115 108 145 Q104 162 80 165 Q58 164 50 160 Z" />
          {/* Big toe */}
          <path d="M65 55 Q62 42 68 35 Q75 30 82 36 Q87 44 82 55" />
          {/* Second toe */}
          <path d="M80 52 Q79 38 85 32 Q91 28 97 35 Q101 43 96 52" />
          {/* Third toe */}
          <path d="M95 56 Q95 43 100 37 Q106 34 111 40 Q114 48 110 57" />
          {/* Fourth toe */}
          <path d="M108 64 Q109 52 113 47 Q118 44 122 50 Q124 57 120 65" />
          {/* Little toe */}
          <path d="M118 73 Q120 63 124 59 Q129 57 132 62 Q133 69 128 75" />
          {/* Arch line */}
          <path d="M50 130 Q60 122 65 130" strokeDasharray="3 4" strokeWidth="1" opacity="0.5"/>
        </g>
      ) : (
        /* Side-angle foot outline */
        <g stroke="#0F6E6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Heel to toe side profile */}
          <path d="M30 145 Q30 158 55 162 Q90 165 120 155 Q135 148 138 138 Q138 128 130 124 L100 50 Q96 42 88 40 Q78 39 74 48 L68 65 Q60 80 55 105 Q48 125 35 140 Z" />
          {/* Ankle bump */}
          <ellipse cx="38" cy="132" rx="10" ry="8" stroke="#0F6E6B" strokeWidth="1.5" opacity="0.5"/>
          {/* Toe */}
          <path d="M130 124 Q136 118 140 110 Q142 102 138 97 Q133 93 128 98 L120 115" />
        </g>
      )}
    </svg>
  );
}

// ── Calibration marker SVG ──────────────────────────────────────────────────
function CalibrationMarker() {
  return (
    <svg viewBox="0 0 40 40" className="w-8 h-8 opacity-40 flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="38" height="38" rx="3" stroke="#1F3864" strokeWidth="2"/>
      <rect x="6" y="6" width="10" height="10" fill="#1F3864" opacity="0.7"/>
      <rect x="24" y="6" width="10" height="10" fill="#1F3864" opacity="0.7"/>
      <rect x="6" y="24" width="10" height="10" fill="#1F3864" opacity="0.7"/>
      <rect x="16" y="16" width="8" height="8" fill="#1F3864" opacity="0.3"/>
      <rect x="24" y="24" width="5" height="5" fill="#1F3864" opacity="0.5"/>
      <rect x="24" y="30" width="5" height="5" fill="#1F3864" opacity="0.5"/>
      <rect x="30" y="24" width="5" height="5" fill="#1F3864" opacity="0.5"/>
    </svg>
  );
}

// ── Upload panel ────────────────────────────────────────────────────────────
function UploadPanel({ id, title, icon: Icon, illustration: IllustrationComponent, state, onUpload, onClear }) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) onUpload(file);
  }, [onUpload]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  const triggerInput = () => fileInputRef.current?.click();

  return (
    <div className="card flex flex-col gap-0 overflow-hidden flex-1">

      {/* ── Panel header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-clinical-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-teal-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-teal-600" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-semibold text-sm text-clinical-text">{title}</p>
            <p className="text-[11px] text-clinical-muted">Upload scan image</p>
          </div>
        </div>

        {/* Angle toggle */}
        <div className="flex rounded-md border border-clinical-border overflow-hidden">
          <button
            id={`${id}-angle-top`}
            onClick={() => state.onAngleChange('top')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
              state.angle === 'top'
                ? 'bg-teal text-white'
                : 'bg-white text-clinical-muted hover:bg-clinical-subtle'
            }`}
          >
            <Layers className="w-3 h-3" />
            Top-down
          </button>
          <button
            id={`${id}-angle-side`}
            onClick={() => state.onAngleChange('side')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 border-l border-clinical-border ${
              state.angle === 'side'
                ? 'bg-teal text-white'
                : 'bg-white text-clinical-muted hover:bg-clinical-subtle'
            }`}
          >
            <Eye className="w-3 h-3" />
            Side-angle
          </button>
        </div>
      </div>

      {/* ── Drop zone ── */}
      <div className="p-5 flex-1">
        {state.preview ? (
          /* ── Uploaded preview ── */
          <div className="relative rounded-card overflow-hidden border border-clinical-border bg-clinical-subtle h-64">
            <img
              src={state.preview}
              alt="Uploaded scan"
              className="w-full h-full object-contain"
            />
            {/* Overlay: success badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm
                            border border-green-200 rounded-full px-3 py-1 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={2} />
              <span className="text-xs font-semibold text-green-700">Uploaded</span>
            </div>
            {/* Overlay: angle badge */}
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-navy/80 backdrop-blur-sm
                            rounded-full px-2.5 py-1">
              <span className="text-[10px] font-medium text-white uppercase tracking-wide">
                {state.angle === 'top' ? 'Top-down' : 'Side-angle'}
              </span>
            </div>
            {/* Clear button */}
            <button
              id={`${id}-clear`}
              onClick={onClear}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white border border-clinical-border
                         rounded-md px-2.5 py-1.5 text-xs font-medium text-clinical-muted
                         hover:text-red-600 hover:border-red-300 transition-colors duration-150 shadow-sm"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          </div>
        ) : (
          /* ── Empty drop zone ── */
          <div
            id={`${id}-dropzone`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={triggerInput}
            className={`
              relative h-64 rounded-card border-2 border-dashed cursor-pointer
              flex flex-col items-center justify-center gap-3
              transition-all duration-200
              ${dragging
                ? 'border-teal bg-teal-50 scale-[1.01]'
                : 'border-clinical-border bg-clinical-subtle hover:border-teal-300 hover:bg-teal-50/40'}
            `}
          >
            {/* Illustration overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <IllustrationComponent angle={state.angle} />
            </div>

            {/* Upload prompt (on top of illustration) */}
            <div className="relative z-10 flex flex-col items-center gap-2 text-center px-4">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2
                              transition-colors duration-200
                              ${dragging
                                ? 'border-teal bg-teal text-white'
                                : 'border-clinical-border bg-white text-clinical-muted'}`}>
                <Upload className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-medium text-clinical-text">
                  {dragging ? 'Drop to upload' : 'Drop image here'}
                </p>
                <p className="text-xs text-clinical-muted mt-0.5">or click to browse — JPG, PNG, HEIC</p>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              id={`${id}-file-input`}
            />
          </div>
        )}

        {/* ── Calibration marker note ── */}
        <div className="mt-4 flex items-start gap-3 px-3 py-2.5 bg-navy-50 rounded-md border border-navy-100">
          <CalibrationMarker />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs font-semibold text-navy-600">
                Place a 5 cm calibration marker in frame
              </span>
              <Tooltip
                text="A physical reference marker (e.g., a 5×5 cm square) allows the AI to convert pixel distances into real-world millimetre measurements. Without it, cast dimensions cannot be accurately calculated."
              />
            </div>
            <p className="text-[11px] text-navy-500 mt-0.5 leading-relaxed">
              Required for pixel-to-mm conversion during measurement extraction.
            </p>
          </div>
        </div>

        {/* ── Capture guide tips ── */}
        <div className="mt-3 space-y-1.5">
          {[
            state.angle === 'top'
              ? 'Camera positioned directly above, perpendicular to surface'
              : 'Camera at 90° to the side, full limb visible in frame',
            'Ensure uniform lighting — avoid shadows across the limb',
            'Keep calibration marker flat on the same plane as the limb',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-clinical-subtle border border-clinical-border
                               flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[9px] font-bold text-clinical-muted">{i + 1}</span>
              </span>
              <span className="text-[11px] text-clinical-muted leading-relaxed">{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Main page
// ══════════════════════════════════════════════════════════════════════════
export default function NewPatientPage() {
  const navigate = useNavigate();

  const [hand, setHand] = useState({ preview: null, file: null, angle: 'top' });
  const [foot, setFoot] = useState({ preview: null, file: null, angle: 'top' });

  const bothUploaded = hand.preview !== null && foot.preview !== null;

  const handleUpload = (setter) => (file) => {
    const url = URL.createObjectURL(file);
    setter((prev) => {
      if (prev.preview) URL.revokeObjectURL(prev.preview);
      return { ...prev, preview: url, file };
    });
  };

  const handleClear = (setter) => () => {
    setter((prev) => {
      if (prev.preview) URL.revokeObjectURL(prev.preview);
      return { ...prev, preview: null, file: null };
    });
  };

  const handleAngleChange = (setter) => (angle) => {
    setter((prev) => ({ ...prev, angle }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-clinical-text">Image Capture</h2>
          <p className="text-sm text-clinical-muted mt-0.5">
            Upload hand and foot scan images for AI measurement extraction.
          </p>
        </div>

        {/* Progress breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-clinical-muted">
          <span className="font-medium text-teal-600">Step 1 — Scan Upload</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Measurement Review</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Cast Generation</span>
        </div>
      </div>

      {/* ── Alert: both scans required ── */}
      {!bothUploaded && (
        <div className="flex items-start gap-3 px-4 py-3 bg-accent-50 border border-accent-200 rounded-card text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <span className="font-semibold text-accent-600">Both scans required</span>
            <span className="text-accent-500 ml-1.5">
              Upload both a hand scan and a foot scan before processing can begin.
              {hand.preview && !foot.preview && ' — Foot scan still needed.'}
              {!hand.preview && foot.preview && ' — Hand scan still needed.'}
            </span>
          </div>
        </div>
      )}

      {/* ── Two upload panels ── */}
      <div className="flex gap-5">
        <UploadPanel
          id="hand"
          title="Hand Scan"
          icon={Hand}
          illustration={HandIllustration}
          state={{
            ...hand,
            onAngleChange: handleAngleChange(setHand),
          }}
          onUpload={handleUpload(setHand)}
          onClear={handleClear(setHand)}
        />
        <UploadPanel
          id="foot"
          title="Foot Scan"
          icon={Footprints}
          illustration={FootIllustration}
          state={{
            ...foot,
            onAngleChange: handleAngleChange(setFoot),
          }}
          onUpload={handleUpload(setFoot)}
          onClear={handleClear(setFoot)}
        />
      </div>

      {/* ── Summary status row ── */}
      <div className="card px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Hand status */}
          <div className="flex items-center gap-2">
            {hand.preview
              ? <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={2} />
              : <div className="w-4 h-4 rounded-full border-2 border-clinical-border" />
            }
            <span className={`text-sm font-medium ${hand.preview ? 'text-green-700' : 'text-clinical-muted'}`}>
              Hand Scan
            </span>
            {hand.preview && (
              <span className="badge-success text-[10px]">{hand.angle === 'top' ? 'Top-down' : 'Side-angle'}</span>
            )}
          </div>

          <div className="w-px h-5 bg-clinical-border" />

          {/* Foot status */}
          <div className="flex items-center gap-2">
            {foot.preview
              ? <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={2} />
              : <div className="w-4 h-4 rounded-full border-2 border-clinical-border" />
            }
            <span className={`text-sm font-medium ${foot.preview ? 'text-green-700' : 'text-clinical-muted'}`}>
              Foot Scan
            </span>
            {foot.preview && (
              <span className="badge-success text-[10px]">{foot.angle === 'top' ? 'Top-down' : 'Side-angle'}</span>
            )}
          </div>
        </div>

        {/* Start Processing button */}
        <button
          id="btn-start-processing"
          disabled={!bothUploaded}
          onClick={() => navigate('/patients')}
          className={`
            flex items-center gap-2 px-6 py-2.5 rounded-btn text-sm font-semibold
            transition-all duration-200
            ${bothUploaded
              ? 'bg-teal text-white hover:bg-teal-600 shadow-md hover:shadow-lg cursor-pointer'
              : 'bg-clinical-subtle text-clinical-muted border border-clinical-border cursor-not-allowed opacity-60'
            }
          `}
        >
          <Cpu className="w-4 h-4" strokeWidth={1.75} />
          Start Processing
          {bothUploaded && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>

    </div>
  );
}
