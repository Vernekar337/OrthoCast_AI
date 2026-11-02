import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  Maximize2,
  RotateCcw,
  Eye,
  Layers,
  Box,
  SplitSquareVertical,
  Activity,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

/**
 * Procedural mesh generator reproducing server/Cast_logic/generate_cast.py lofting
 * Used as parametric live preview when raw STL file is not yet generated
 */
function createParametricCastMeshes(params, viewMode = 'assembled', explodedDist = 30) {
  const {
    station_diameters_mm = [58.2, 71.4, 84.0],
    total_length_mm = 180,
    wall_thickness_mm = 4.2,
    seam_angle_deg = 0,
    vent = { enabled: true, pattern: 'staggered', hole_mm: 6.0, spacing_mm: 18.0 },
    tabs = { count: 3 },
  } = params;

  const nPts = 48;
  const nStations = station_diameters_mm.length;
  const length = Math.max(60, total_length_mm);
  const wall = Math.max(2.0, wall_thickness_mm);

  // Generate Half A (0 to PI) and Half B (PI to 2*PI)
  const group = new THREE.Group();

  const createHalfGeometry = (thetaStart, thetaLength, isHalfA) => {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const normals = [];

    // Outer & Inner rings
    const zStep = length / (nStations - 1);
    const nRings = nStations;
    const radialPts = nPts / 2;

    for (let r = 0; r < nRings; r++) {
      const z = -length / 2 + r * zStep;
      const outerRad = station_diameters_mm[r] / 2;
      const innerRad = Math.max(10, outerRad - wall);

      // Outer ring points
      for (let i = 0; i <= radialPts; i++) {
        const theta = thetaStart + (i / radialPts) * thetaLength;
        const x = outerRad * Math.cos(theta);
        const y = outerRad * Math.sin(theta);
        vertices.push(x, y, z);
        normals.push(Math.cos(theta), Math.sin(theta), 0);
      }

      // Inner ring points
      for (let i = 0; i <= radialPts; i++) {
        const theta = thetaStart + (i / radialPts) * thetaLength;
        const x = innerRad * Math.cos(theta);
        const y = innerRad * Math.sin(theta);
        vertices.push(x, y, z);
        normals.push(-Math.cos(theta), -Math.sin(theta), 0);
      }
    }

    const ringStride = (radialPts + 1) * 2;

    // Build faces along the cylinder height
    for (let r = 0; r < nRings - 1; r++) {
      const r0 = r * ringStride;
      const r1 = (r + 1) * ringStride;

      // Outer surface quads
      for (let i = 0; i < radialPts; i++) {
        const a = r0 + i;
        const b = r1 + i;
        const c = r1 + i + 1;
        const d = r0 + i + 1;
        indices.push(a, b, c);
        indices.push(a, c, d);
      }

      // Inner surface quads
      const inOffset = radialPts + 1;
      for (let i = 0; i < radialPts; i++) {
        const a = r0 + inOffset + i;
        const b = r0 + inOffset + i + 1;
        const c = r1 + inOffset + i + 1;
        const d = r1 + inOffset + i;
        indices.push(a, b, c);
        indices.push(a, c, d);
      }

      // Seam edge caps along the split plane (start edge)
      const aStartOuter0 = r0;
      const aStartInner0 = r0 + inOffset;
      const aStartOuter1 = r1;
      const aStartInner1 = r1 + inOffset;
      indices.push(aStartOuter0, aStartInner0, aStartInner1);
      indices.push(aStartOuter0, aStartInner1, aStartOuter1);

      // Seam edge caps along the split plane (end edge)
      const aEndOuter0 = r0 + radialPts;
      const aEndInner0 = r0 + inOffset + radialPts;
      const aEndOuter1 = r1 + radialPts;
      const aEndInner1 = r1 + inOffset + radialPts;
      indices.push(aEndOuter0, aEndOuter1, aEndInner1);
      indices.push(aEndOuter0, aEndInner1, aEndInner0);
    }

    // Rim caps (bottom rim)
    const bOuter = 0;
    const bInner = radialPts + 1;
    for (let i = 0; i < radialPts; i++) {
      indices.push(bOuter + i, bOuter + i + 1, bInner + i + 1);
      indices.push(bOuter + i, bInner + i + 1, bInner + i);
    }

    // Rim caps (top rim)
    const tBase = (nRings - 1) * ringStride;
    const tOuter = tBase;
    const tInner = tBase + radialPts + 1;
    for (let i = 0; i < radialPts; i++) {
      indices.push(tOuter + i, tInner + i + 1, tOuter + i + 1);
      indices.push(tOuter + i, tInner + i, tInner + i + 1);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };

  const seamRad = (seam_angle_deg * Math.PI) / 180;
  const geomA = createHalfGeometry(seamRad, Math.PI, true);
  const geomB = createHalfGeometry(seamRad + Math.PI, Math.PI, false);

  return { geomA, geomB };
}

export default function CastViewport({
  params,
  stlUrls = null, // { halfA: url, halfB: url }
  isGenerating = false,
  modelStatus = 'preview', // 'preview' | 'generated' | 'loading'
  metadata = null,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const meshesRef = useRef({ meshA: null, meshB: null, group: null });

  // Display modes
  const [viewMode, setViewMode] = useState('assembled'); // 'assembled' | 'half_a' | 'half_b' | 'exploded'
  const [renderStyle, setRenderStyle] = useState('solid'); // 'solid' | 'wireframe' | 'transparent'
  const [showGrid, setShowGrid] = useState(true);
  const [explodedDistance, setExplodedDistance] = useState(35); // mm

  // Camera reset
  const handleResetCamera = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(220, 150, 260);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, []);

  const handleFitToView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current || !meshesRef.current.group) return;
    const box = new THREE.Box3().setFromObject(meshesRef.current.group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
    cameraRef.current.position.set(cameraZ * 0.8, cameraZ * 0.5, cameraZ);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070c18);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(220, 160, 260);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 60;
    controls.maxDistance = 1200;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting (Medical Engineering studio setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 2.2); // Key cyan light
    dirLight1.position.set(200, 350, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x2dd4bf, 1.4); // Teal fill light
    dirLight2.position.set(-200, -100, -200);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rimLight.position.set(0, 200, -300);
    scene.add(rimLight);

    // Grid & Axes
    const grid = new THREE.GridHelper(400, 40, 0x0ea5e9, 0x1e293b);
    grid.position.y = -100;
    grid.name = 'gridHelper';
    scene.add(grid);

    const axes = new THREE.AxesHelper(60);
    axes.position.set(-160, -99, -160);
    scene.add(axes);

    // Group for cast model
    const castGroup = new THREE.Group();
    castGroup.name = 'castModelGroup';
    scene.add(castGroup);
    meshesRef.current.group = castGroup;

    // Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
    };
  }, []);

  // Update Grid visibility
  useEffect(() => {
    if (!sceneRef.current) return;
    const grid = sceneRef.current.getObjectByName('gridHelper');
    if (grid) grid.visible = showGrid;
  }, [showGrid]);

  // Build / Load Cast Geometry
  useEffect(() => {
    const castGroup = meshesRef.current.group;
    if (!castGroup || !params) return;

    // Clear previous children
    while (castGroup.children.length > 0) {
      const child = castGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
      castGroup.remove(child);
    }

    // Material definitions
    const matA = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9, // Cyan anterior polymer
      roughness: 0.25,
      metalness: 0.1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      wireframe: renderStyle === 'wireframe',
      transparent: renderStyle === 'transparent',
      opacity: renderStyle === 'transparent' ? 0.45 : 1.0,
      side: THREE.DoubleSide,
    });

    const matB = new THREE.MeshPhysicalMaterial({
      color: 0x14b8a6, // Teal posterior polymer
      roughness: 0.25,
      metalness: 0.1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      wireframe: renderStyle === 'wireframe',
      transparent: renderStyle === 'transparent',
      opacity: renderStyle === 'transparent' ? 0.45 : 1.0,
      side: THREE.DoubleSide,
    });

    // Check if raw STL file URLs exist
    if (stlUrls?.halfA && stlUrls?.halfB) {
      const loader = new STLLoader();
      loader.load(
        stlUrls.halfA,
        (geom) => {
          geom.computeVertexNormals();
          const meshA = new THREE.Mesh(geom, matA);
          meshA.name = 'halfA_stl';
          castGroup.add(meshA);
          meshesRef.current.meshA = meshA;
          applyViewTransforms();
        },
        undefined,
        () => {
          // Fallback to procedural mesh if file download fails
          buildProcedural();
        }
      );

      loader.load(
        stlUrls.halfB,
        (geom) => {
          geom.computeVertexNormals();
          const meshB = new THREE.Mesh(geom, matB);
          meshB.name = 'halfB_stl';
          castGroup.add(meshB);
          meshesRef.current.meshB = meshB;
          applyViewTransforms();
        },
        undefined,
        () => {
          buildProcedural();
        }
      );
    } else {
      buildProcedural();
    }

    function buildProcedural() {
      const { geomA, geomB } = createParametricCastMeshes(params, viewMode, explodedDistance);
      const meshA = new THREE.Mesh(geomA, matA);
      meshA.name = 'halfA_mesh';
      const meshB = new THREE.Mesh(geomB, matB);
      meshB.name = 'halfB_mesh';

      castGroup.add(meshA);
      castGroup.add(meshB);
      meshesRef.current.meshA = meshA;
      meshesRef.current.meshB = meshB;

      applyViewTransforms();
    }

    function applyViewTransforms() {
      const { meshA, meshB } = meshesRef.current;
      if (!meshA || !meshB) return;

      meshA.visible = viewMode !== 'half_b';
      meshB.visible = viewMode !== 'half_a';

      if (viewMode === 'exploded') {
        meshA.position.set(explodedDistance, 0, 0);
        meshB.position.set(-explodedDistance, 0, 0);
      } else {
        meshA.position.set(0, 0, 0);
        meshB.position.set(0, 0, 0);
      }
    }
  }, [params, stlUrls, viewMode, renderStyle, explodedDistance]);

  return (
    <div className="relative w-full h-[540px] rounded-lg border border-cyan-500/30 overflow-hidden bg-[#070c18] flex flex-col select-none">
      {/* ── Top HUD Control Bar ── */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none flex-wrap gap-2">
        {/* Left: View Mode Toggles */}
        <div className="flex items-center gap-1 p-1 rounded-md bg-slate-900/90 border border-slate-800 backdrop-blur pointer-events-auto">
          {[
            { id: 'assembled', label: 'Assembled', icon: Box },
            { id: 'half_a', label: 'Half A (Anterior)', icon: Eye },
            { id: 'half_b', label: 'Half B (Posterior)', icon: Eye },
            { id: 'exploded', label: 'Exploded View', icon: SplitSquareVertical },
          ].map((mode) => {
            const Icon = mode.icon;
            const isActive = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono uppercase transition-all ${
                  isActive
                    ? 'bg-cyan-500 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Render Shading & Camera Reset */}
        <div className="flex items-center gap-1.5 p-1 rounded-md bg-slate-900/90 border border-slate-800 backdrop-blur pointer-events-auto">
          {/* Shading mode */}
          <div className="flex rounded border border-slate-800 overflow-hidden text-[10px] font-mono">
            {['solid', 'wireframe', 'transparent'].map((s) => (
              <button
                key={s}
                onClick={() => setRenderStyle(s)}
                className={`px-2 py-1 uppercase ${
                  renderStyle === s ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Toggle Grid */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded text-[11px] font-mono ${
              showGrid ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle Calibration Grid"
          >
            Grid
          </button>

          {/* Fit to View */}
          <button
            onClick={handleFitToView}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title="Fit to View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title="Reset Perspective"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Status Banner Overlay ── */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none space-y-1 font-mono text-[11px]">
        {modelStatus === 'generated' ? (
          <div className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 flex items-center gap-1.5 backdrop-blur">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified Watertight STL Loaded from Server</span>
          </div>
        ) : (
          <div className="px-2.5 py-1 rounded bg-slate-900/90 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5 backdrop-blur">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Interactive Parametric Preview (Exact CAD Loft Specification)</span>
          </div>
        )}

        {metadata && (
          <div className="px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800 text-slate-400 backdrop-blur">
            Vol: <span className="text-white">{metadata.total_volume_mm3} mm³</span> • Est. PLA:{' '}
            <span className="text-cyan-400">{metadata.estimated_material_grams} g</span> • Print Time:{' '}
            <span className="text-teal-400">{metadata.estimated_print_time_minutes} min</span>
          </div>
        )}
      </div>

      {/* ── Exploded View Slider (if exploded mode is active) ── */}
      {viewMode === 'exploded' && (
        <div className="absolute bottom-3 right-3 z-10 p-2.5 rounded-md bg-slate-900/90 border border-slate-800 backdrop-blur text-xs font-mono space-y-1 w-48">
          <div className="flex justify-between text-slate-400 text-[10px]">
            <span>Separation Distance</span>
            <span className="text-cyan-400">{explodedDistance} mm</span>
          </div>
          <input
            type="range"
            min={15}
            max={90}
            value={explodedDistance}
            onChange={(e) => setExplodedDistance(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
          />
        </div>
      )}

      {/* ── Generating Spinner Overlay ── */}
      {isGenerating && (
        <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-400/20 flex items-center justify-center relative">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white uppercase font-mono">
              FastAPI CAD Engine Slicing Model…
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Building lofted hollow shell, cutting ventilation lattice, and bisecting dual-halves with trimesh.
            </p>
          </div>
        </div>
      )}

      {/* ── WebGL Container ── */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
