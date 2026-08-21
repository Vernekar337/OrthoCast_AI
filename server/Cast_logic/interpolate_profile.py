
import numpy as np


def build_cross_sections(station_diameters_mm, total_length_mm, resolution_mm=10):
    n_stations = len(station_diameters_mm)
    station_positions = np.linspace(0, total_length_mm, n_stations)

    fine_positions = np.arange(0, total_length_mm + resolution_mm, resolution_mm)
    fine_positions = np.clip(fine_positions, 0, total_length_mm)

    if n_stations >= 4:
        fine_diameters = np.interp(fine_positions, station_positions, station_diameters_mm)
       
        kernel = np.ones(3) / 3
        fine_diameters = np.convolve(fine_diameters, kernel, mode="same")
    else:
        fine_diameters = np.interp(fine_positions, station_positions, station_diameters_mm)

    cross_sections = [
        {"position_mm": round(float(p), 1), "diameter_mm": round(float(d), 1)}
        for p, d in zip(fine_positions, fine_diameters)
    ]
    return cross_sections


if __name__ == "__main__":
    
    model_output = {
        "station_diameters_mm": [58.2, 71.4, 84.0],  
        "wall_thickness_mm": 4.3,
        "total_cast_length_mm": 160,  
    }

    cross_sections = build_cross_sections(
        model_output["station_diameters_mm"],
        model_output["total_cast_length_mm"],
        resolution_mm=10,
    )

    print(f"Generated {len(cross_sections)} cross-sections from {len(model_output['station_diameters_mm'])} predicted stations:")
    for cs in cross_sections:
        print(f"  z={cs['position_mm']:>6} mm   diameter={cs['diameter_mm']:>6} mm")
