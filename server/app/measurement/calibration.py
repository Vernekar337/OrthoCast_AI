
from typing import Any

import cv2
import numpy as np


def load_image(image_path: str) -> np.ndarray:
    """Load an image and fail clearly if the path is invalid."""
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")
    return image


def detect_marker_scale(
    image: np.ndarray,
    marker_mm: float = 50.0,
    marker_id: int | None = None,
) -> dict[str, Any]:
    """
    Detect an ArUco marker and estimate pixels per millimetre.

    The marker must be visible, approximately square to the camera,
    and in the same plane as the body part being measured.
    """
    if marker_mm <= 0:
        raise ValueError("marker_mm must be greater than zero")

    if image is None or image.size == 0:
        raise ValueError("Image is empty")

    if not hasattr(cv2, "aruco"):
        raise RuntimeError(
            "OpenCV ArUco is unavailable. Install opencv-contrib-python."
        )

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    dictionary = cv2.aruco.getPredefinedDictionary(
        cv2.aruco.DICT_4X4_50
    )

    if hasattr(cv2.aruco, "DetectorParameters"):
        parameters = cv2.aruco.DetectorParameters()
    else:
        parameters = cv2.aruco.DetectorParameters_create()

    if hasattr(cv2.aruco, "ArucoDetector"):
        detector = cv2.aruco.ArucoDetector(dictionary, parameters)
        corners, ids, _ = detector.detectMarkers(gray)
    else:
        corners, ids, _ = cv2.aruco.detectMarkers(
            gray, dictionary, parameters=parameters
        )

    if ids is None or len(corners) == 0:
        raise ValueError(
            "No ArUco marker detected. Use a clearly visible "
            "DICT_4X4_50 marker and verify the marker's printed size."
        )

    side_lengths = []
    accepted_ids = []

    for marker_corners, marker_identifier in zip(corners, ids.flatten()):
        identifier = int(marker_identifier)

        if marker_id is not None and identifier != marker_id:
            continue

        points = marker_corners.reshape(4, 2).astype(np.float32)
        edges = [
            np.linalg.norm(points[(i + 1) % 4] - points[i])
            for i in range(4)
        ]

        # Average the four detected sides to reduce pixel noise.
        side_px = float(np.mean(edges))

        if side_px > 0:
            side_lengths.append(side_px)
            accepted_ids.append(identifier)

    if not side_lengths:
        raise ValueError(
            f"ArUco marker ID {marker_id} was not detected."
        )

    mean_side_px = float(np.mean(side_lengths))
    pixels_per_mm = mean_side_px / float(marker_mm)

    return {
        "marker_mm": float(marker_mm),
        "marker_ids": accepted_ids,
        "marker_side_px": round(mean_side_px, 3),
        "pixels_per_mm": round(pixels_per_mm, 6),
        "mm_per_pixel": round(1.0 / pixels_per_mm, 6),
        "marker_count": len(side_lengths),
    }


def pixel_distance_to_mm(
    point_a: tuple[float, float],
    point_b: tuple[float, float],
    pixels_per_mm: float,
) -> float:
    """Convert a 2D pixel distance into millimetres."""
    if pixels_per_mm <= 0:
        raise ValueError("pixels_per_mm must be greater than zero")

    distance_px = float(np.linalg.norm(
        np.asarray(point_a, dtype=float)
        - np.asarray(point_b, dtype=float)
    ))

    return round(distance_px / pixels_per_mm, 2)
