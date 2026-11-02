
import json
import math
import uuid
from pathlib import Path

import trimesh

from app import config
from Cast_logic.generate_cast import generate_cast
from Cast_logic.interpolate_profile import build_cross_sections
from app.services.cast_report import create_cast_report


def generate_cast_artifacts(params: dict, cast_id: str | None = None) -> dict:
    """
    Generate prototype cast STL files and a JSON summary.

    This is a prototype CAD pipeline, not a clinically validated
    cast-design or manufacturing approval system.
    """
    params = dict(params)
    cast_id = cast_id or f"cast_{uuid.uuid4().hex[:12]}"

    if not cast_id.replace("_", "").isalnum():
        raise ValueError("Invalid cast_id.")

    diameters = params.get("station_diameters_mm")
    length = params.get("total_length_mm")
    wall = params.get("wall_thickness_mm")

    if not isinstance(diameters, list) or not 3 <= len(diameters) <= 5:
        raise ValueError("Provide 3 to 5 station diameters.")

    diameters = [float(value) for value in diameters]
    length = float(length)
    wall = float(wall)

    values = diameters + [length, wall]
    if not all(math.isfinite(value) for value in values):
        raise ValueError("All geometry parameters must be finite numbers.")

    if any(not 20 <= value <= 220 for value in diameters):
        raise ValueError("Each station diameter must be between 20 and 220 mm.")

    if not 60 <= length <= 600:
        raise ValueError("Cast length must be between 60 and 600 mm.")

    if not 2 <= wall <= 10:
        raise ValueError("Wall thickness must be between 2 and 10 mm.")

    if any(diameter <= 2 * wall for diameter in diameters):
        raise ValueError(
            "Every station diameter must exceed twice the wall thickness."
        )

    vent = params.get("vent", {}) or {}
    vent_enabled = bool(vent.get("enabled", True))
    hole_diameter = float(vent.get("hole_mm", 6.0))
    vent_spacing = float(vent.get("spacing_mm", 18.0))

    if not math.isfinite(hole_diameter) or not math.isfinite(vent_spacing):
        raise ValueError("Vent parameters must be finite numbers.")

    if vent_enabled:
        if not 3 <= hole_diameter <= 16:
            raise ValueError("Vent hole diameter must be between 3 and 16 mm.")
        if not 8 <= vent_spacing <= 50:
            raise ValueError("Vent spacing must be between 8 and 50 mm.")
        if hole_diameter > vent_spacing - 2:
            raise ValueError(
                "Vent hole diameter must be at least 2 mm smaller "
                "than the vent spacing."
            )

    config.ensure_dirs()
    output_dir = (config.CASTS / cast_id).resolve()
    output_dir.mkdir(parents=True, exist_ok=False)

    try:
        cross_sections = build_cross_sections(
            diameters,
            length,
            resolution_mm=5,
        )

        prediction = {
            "cross_sections": cross_sections,
            "wall_thickness_mm": wall,
            "ventilation_hole_diameter_mm": hole_diameter,
            "ventilation_spacing_mm": vent_spacing,
        }

        tabs = params.get("tabs", {}) or {}
        add_tabs = int(tabs.get("count", 3)) > 0

        summary = generate_cast(
            prediction,
            output_dir=str(output_dir),
            add_vent=vent_enabled,
            add_tabs=add_tabs,
        )

        stl_paths = [
            output_dir / "cast_half_A.stl",
            output_dir / "cast_half_B.stl",
        ]

        for path in stl_paths:
            if not path.is_file() or path.stat().st_size == 0:
                raise RuntimeError(f"STL export failed: {path.name}")

        mesh_checks = {}
        for path in stl_paths:
            mesh = trimesh.load_mesh(str(path), file_type="stl")

            if len(mesh.vertices) == 0 or len(mesh.faces) == 0:
                raise RuntimeError(f"Exported mesh is empty: {path.name}")

            mesh_checks[path.name] = {
                "vertices": int(len(mesh.vertices)),
                "faces": int(len(mesh.faces)),
                "watertight": bool(mesh.is_watertight),
                "winding_consistent": bool(mesh.is_winding_consistent),
                "bounds_mm": mesh.bounds.tolist(),
                "volume_mm3": (
                    round(float(mesh.volume), 2)
                    if mesh.is_watertight
                    else None
                ),
            }

        report = {
            "cast_id": cast_id,
            "status": "prototype_generated",
            "region": params.get("region", "wrist"),
            "units": "mm",
            "parameters": {
                "station_diameters_mm": diameters,
                "total_length_mm": length,
                "wall_thickness_mm": wall,
                "vent": {
                    "enabled": vent_enabled,
                    "hole_mm": hole_diameter,
                    "spacing_mm": vent_spacing,
                },
                "tabs_requested": int(tabs.get("count", 3)),
            },
            "cross_sections": cross_sections,
            "mesh_checks": mesh_checks,
            "generation_summary": summary,
            "output_files": {
    "half_a_stl": str(stl_paths[0]),
    "half_b_stl": str(stl_paths[1]),
    "summary_json": str(output_dir / "summary.json"),
    "generation_report_json": str(output_dir / "generation_report.json"),
},
            "warnings": [
                "Prototype geometry only; not approved for patient use.",
                "Mesh checks do not establish structural strength, fit, "
                "biocompatibility, or clinical safety.",
                "Existing CAD closure tabs are prototype geometry; the "
                "requested tab count is not yet configurable in the CAD engine.",
                "Material and print-time figures from the legacy generator "
                "are estimates, not slicer-verified results.",
            ],
        }

        report_path = output_dir / "generation_report.json"
        pdf_path = output_dir / "generation_report.pdf"

        report["output_files"]["report_pdf"] = str(pdf_path)

        report_path.write_text(
            json.dumps(report, indent=2),
            encoding="utf-8",
        )

        create_cast_report(report, pdf_path)

        return report

    except Exception:
        # Keep the output directory for debugging if generation fails.
        raise
