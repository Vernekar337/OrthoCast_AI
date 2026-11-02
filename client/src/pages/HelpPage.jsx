import React from 'react';
import {
  HelpCircle,
  BookOpen,
  Layers,
  Camera,
  CheckSquare,
  AlertTriangle,
  Printer,
  Sliders,
  Server,
  FileQuestion,
} from 'lucide-react';
import { PageHeader, Card } from '../components/common';

export default function HelpPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in font-mono text-xs">
      <PageHeader
        title="Clinical Engineering Documentation & Protocols"
        subtitle="Standard operating procedures for imaging, calibration, ML inference, and 3D printing."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Imaging Protocol */}
        <Card title="Photogrammetry & Calibration Protocol" icon={Camera} reticle={true}>
          <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed font-sans">
            <p>
              1. <strong>Reference Marker Placement:</strong> Place a rigid, printed <strong>50.0 mm (5 cm)</strong> square reference marker coplanar with the limb.
            </p>
            <p>
              2. <strong>Perpendicular Top View:</strong> Position the camera at a strict 90° angle directly above the limb, capturing knuckles/toes down to mid-forearm/calf.
            </p>
            <p>
              3. <strong>Lateral Side View:</strong> Capture the lateral side profile at 90° horizontal alignment.
            </p>
            <p>
              4. <strong>Illumination:</strong> Ensure uniform diffuse clinical lighting without harsh drop-shadows across limb contours.
            </p>
          </div>
        </Card>

        {/* Bi-valved Fabrication */}
        <Card title="Bi-Valved Shell Fabrication" icon={Layers} reticle={true}>
          <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed font-sans">
            <p>
              1. <strong>Dual-Half Architecture:</strong> The CAD generator bisects the parametric shell into Half A (Anterior) and Half B (Posterior).
            </p>
            <p>
              2. <strong>Interlocking Tabs:</strong> 3 to 6 pairs of alignment pins/slots allow Velcro strap or screw-fastened assembly without cast saw hazards.
            </p>
            <p>
              3. <strong>Ventilation Lattice:</strong> Hexagonal or orthogonal perforations maintain aeration, preventing skin maceration.
            </p>
            <p>
              4. <strong>Material Selection:</strong> Recommended for biocompatible PLA, PETG, or medical-grade nylon (PA12).
            </p>
          </div>
        </Card>

        {/* Troubleshooting */}
        <Card title="Clinical Troubleshooting & Recovery" icon={AlertTriangle}>
          <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed font-sans">
            <p>
              • <strong>Marker Detection Warning:</strong> If automatic marker extraction fails, switch to the <em>Manual Caliper Mode</em> in New Patient intake.
            </p>
            <p>
              • <strong>Severe Edema (Swelling):</strong> For acute trauma, select <em>Acute Swelling</em> (+4.0 mm buffer) to prevent compartmental constriction.
            </p>
            <p>
              • <strong>Model Boundary Alert:</strong> If patient limb measurements deviate &gt;10% from the synthetic training cohort, calibrate values on the <em>Extracted Measurement Results</em> tab before lofting.
            </p>
          </div>
        </Card>

        {/* Endpoints & Architecture */}
        <Card title="FastAPI Subsystem Contracts" icon={Server}>
          <div className="space-y-2 text-xs font-mono text-slate-300">
            <div>
              <span className="text-cyan-400 font-bold">GET /api/meta</span>
              <p className="text-[11px] text-slate-400 font-sans">Provides server slider min/max boundaries.</p>
            </div>
            <div>
              <span className="text-cyan-400 font-bold">POST /api/patients/:id/pipeline/start</span>
              <p className="text-[11px] text-slate-400 font-sans">Dispatches asynchronous landmark extraction.</p>
            </div>
            <div>
              <span className="text-cyan-400 font-bold">POST /api/patients/:id/cast/generate</span>
              <p className="text-[11px] text-slate-400 font-sans">Runs Trimesh CSG lofting and creates Half A & B STLs.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
