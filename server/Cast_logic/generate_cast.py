

import numpy as np
import trimesh
import json
import os


def build_loft_rings(cross_sections, n_circle_pts=48):
    
    theta = np.linspace(0, 2 * np.pi, n_circle_pts, endpoint=False)
    rings = []
    for cs in cross_sections:
        r = cs["diameter_mm"] / 2.0
        z = cs["position_mm"]
        x = r * np.cos(theta)
        y = r * np.sin(theta)
        pts = np.column_stack([x, y, np.full_like(x, z)])
        rings.append(pts)
    return rings


def loft_rings_to_mesh(rings, close_ends=False):
    
    n = rings[0].shape[0]
    vertices = []
    faces = []
    ring_start_idx = []

    for ring in rings:
        ring_start_idx.append(len(vertices))
        vertices.extend(ring.tolist())

    # side faces
    for i in range(len(rings) - 1):
        a0 = ring_start_idx[i]
        b0 = ring_start_idx[i + 1]
        for j in range(n):
            j2 = (j + 1) % n
            # two triangles per quad
            faces.append([a0 + j, b0 + j, b0 + j2])
            faces.append([a0 + j, b0 + j2, a0 + j2])

    if close_ends:
        # bottom cap
        bottom = rings[0]
        centroid_bottom = bottom.mean(axis=0)
        c_idx = len(vertices)
        vertices.append(centroid_bottom.tolist())
        b0 = ring_start_idx[0]
        for j in range(n):
            j2 = (j + 1) % n
            faces.append([c_idx, b0 + j2, b0 + j])

        # top cap
        top = rings[-1]
        centroid_top = top.mean(axis=0)
        c_idx = len(vertices)
        vertices.append(centroid_top.tolist())
        b0 = ring_start_idx[-1]
        for j in range(n):
            j2 = (j + 1) % n
            faces.append([c_idx, b0 + j, b0 + j2])

    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces), process=True)
    return mesh



def build_hollow_shell(cross_sections, wall_thickness_mm, n_circle_pts=48):
    
    outer_rings = build_loft_rings(cross_sections, n_circle_pts)

    inner_cross_sections = [
        {"position_mm": cs["position_mm"], "diameter_mm": max(cs["diameter_mm"] - 2 * wall_thickness_mm, 2.0)}
        for cs in cross_sections
    ]
    inner_rings = build_loft_rings(inner_cross_sections, n_circle_pts)

    n = n_circle_pts
    vertices = []
    faces = []

    outer_start = []
    for ring in outer_rings:
        outer_start.append(len(vertices))
        vertices.extend(ring.tolist())

    inner_start = []
    for ring in inner_rings:
        inner_start.append(len(vertices))
        vertices.extend(ring.tolist())

    # outer surface faces
    for i in range(len(outer_rings) - 1):
        a0, b0 = outer_start[i], outer_start[i + 1]
        for j in range(n):
            j2 = (j + 1) % n
            faces.append([a0 + j, b0 + j, b0 + j2])
            faces.append([a0 + j, b0 + j2, a0 + j2])

    # inner surface faces
    for i in range(len(inner_rings) - 1):
        a0, b0 = inner_start[i], inner_start[i + 1]
        for j in range(n):
            j2 = (j + 1) % n
            faces.append([a0 + j, b0 + j2, b0 + j])
            faces.append([a0 + j, a0 + j2, b0 + j2])

    # bottom annular cap
    ao, ai = outer_start[0], inner_start[0]
    for j in range(n):
        j2 = (j + 1) % n
        faces.append([ao + j, ai + j, ai + j2])
        faces.append([ao + j, ai + j2, ao + j2])

    # top annular cap
    ao, ai = outer_start[-1], inner_start[-1]
    for j in range(n):
        j2 = (j + 1) % n
        faces.append([ao + j, ai + j2, ai + j])
        faces.append([ao + j, ao + j2, ai + j2])

    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces), process=True)
    mesh.merge_vertices()
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.fix_normals()
    return mesh



def add_ventilation_holes(shell_mesh, cross_sections, hole_diameter_mm=6.0,
                           spacing_mm=18.0, wall_thickness_mm=4.0, margin_mm=15.0):
    
    z_min = cross_sections[0]["position_mm"] + margin_mm
    z_max = cross_sections[-1]["position_mm"] - margin_mm
    z_positions = np.arange(z_min, z_max, spacing_mm)

    cutters = []
    for z in z_positions:
       
        diam = np.interp(z, [cs["position_mm"] for cs in cross_sections],
                          [cs["diameter_mm"] for cs in cross_sections])
        radius = diam / 2.0
        circumference = np.pi * diam
        n_holes_around = max(int(circumference / spacing_mm), 6)
        angles = np.linspace(0, 2 * np.pi, n_holes_around, endpoint=False)

        for theta in angles:
            x = radius * np.cos(theta)
            y = radius * np.sin(theta)
            direction = np.array([np.cos(theta), np.sin(theta), 0])
            cyl = trimesh.creation.cylinder(
                radius=hole_diameter_mm / 2.0,
                height=wall_thickness_mm * 3,  
                sections=16,
            )
            
            z_axis = np.array([0, 0, 1])
            rot_axis = np.cross(z_axis, direction)
            if np.linalg.norm(rot_axis) > 1e-6:
                angle = np.arccos(np.clip(np.dot(z_axis, direction), -1, 1))
                cyl.apply_transform(trimesh.transformations.rotation_matrix(angle, rot_axis))
            cyl.apply_translation([x, y, z])
            cutters.append(cyl)

    holes_union = trimesh.boolean.union(cutters) if len(cutters) > 1 else cutters[0]
    perforated = trimesh.boolean.difference([shell_mesh, holes_union])
    return perforated


def split_into_two_halves(mesh):
    
    half_a = trimesh.intersections.slice_mesh_plane(
        mesh, plane_normal=[0, 1, 0], plane_origin=[0, 0, 0], cap=True
    )
    half_b = trimesh.intersections.slice_mesh_plane(
        mesh, plane_normal=[0, -1, 0], plane_origin=[0, 0, 0], cap=True
    )
    return half_a, half_b



def add_closure_tabs(half_mesh, cross_sections, tab_width_mm=12, tab_thickness_mm=3):
    
    z_positions = np.linspace(
        cross_sections[0]["position_mm"] + 20,
        cross_sections[-1]["position_mm"] - 20,
        3,
    )
    tabs = []
    for z in z_positions:
        diam = np.interp(z, [cs["position_mm"] for cs in cross_sections],
                          [cs["diameter_mm"] for cs in cross_sections])
        r = diam / 2.0
        tab = trimesh.creation.box(extents=[8, tab_width_mm, tab_thickness_mm])
        tab.apply_translation([r + 2, 0, z])
        tabs.append(tab)
    try:
        combined = trimesh.boolean.union([half_mesh] + tabs)
        return combined
    except Exception:
        return trimesh.util.concatenate([half_mesh] + tabs)



def generate_cast(prediction_json, output_dir="output_stl", add_vent=True, add_tabs=True):
    os.makedirs(output_dir, exist_ok=True)

    cross_sections = sorted(prediction_json["cross_sections"], key=lambda c: c["position_mm"])
    wall_thickness_mm = prediction_json["wall_thickness_mm"]

    print("Building lofted hollow shell...")
    shell = build_hollow_shell(cross_sections, wall_thickness_mm)
    print(f"  shell watertight: {shell.is_watertight}, volume: {shell.volume:.1f} mm^3")

    if add_vent:
        print("Cutting ventilation holes...")
        shell = add_ventilation_holes(
            shell, cross_sections,
            hole_diameter_mm=prediction_json.get("ventilation_hole_diameter_mm", 6.0),
            spacing_mm=prediction_json.get("ventilation_spacing_mm", 18.0),
            wall_thickness_mm=wall_thickness_mm,
        )
        print(f"  after venting -> watertight: {shell.is_watertight}, volume: {shell.volume:.1f} mm^3")

    print("Splitting into two halves...")
    half_a, half_b = split_into_two_halves(shell)

    if add_tabs:
        print("Adding closure tabs...")
        half_a = add_closure_tabs(half_a, cross_sections)
        half_b = add_closure_tabs(half_b, cross_sections)

    path_a = os.path.join(output_dir, "cast_half_A.stl")
    path_b = os.path.join(output_dir, "cast_half_B.stl")
    half_a.export(path_a)
    half_b.export(path_b)

    total_volume_mm3 = half_a.volume + half_b.volume
   
    material_grams = total_volume_mm3 * 0.00124

    est_print_minutes = total_volume_mm3 / 800

    summary = {
        "half_a_watertight": bool(half_a.is_watertight),
        "half_b_watertight": bool(half_b.is_watertight),
        "total_volume_mm3": round(total_volume_mm3, 1),
        "estimated_material_grams": round(material_grams, 1),
        "estimated_print_time_minutes": round(est_print_minutes, 1),
        "output_files": [path_a, path_b],
    }
    with open(os.path.join(output_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    print("\nDone.")
    print(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    
    example_prediction = {
        "cross_sections": [
            {"position_mm": 0,   "diameter_mm": 58.2},
            {"position_mm": 80,  "diameter_mm": 71.4},
            {"position_mm": 160, "diameter_mm": 84.0},
        ],
        "wall_thickness_mm": 4.3,
        "ventilation_hole_diameter_mm": 6.0,
        "ventilation_spacing_mm": 18.0,
    }
    generate_cast(example_prediction)

