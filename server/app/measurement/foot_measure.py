
from pathlib import Path
import math

import cv2
import numpy as np

from app.measurement.calibration import (
    load_image,
    detect_marker_scale,
)


def _segment_foreground(image):
    """Estimate the foreground mask using the image-border background."""
    height, width = image.shape[:2]

    border = np.concatenate([
        image[0, :, :],
        image[-1, :, :],
        image[:, 0, :],
        image[:, -1, :],
    ])

    background = np.median(border, axis=0).astype(np.uint8)

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    background_lab = cv2.cvtColor(
        background.reshape(1, 1, 3),
        cv2.COLOR_BGR2LAB,
    )[0, 0].astype(np.float32)

    difference = np.linalg.norm(
        lab.astype(np.float32) - background_lab,
        axis=2,
    )

    difference_u8 = np.clip(difference, 0, 255).astype(np.uint8)
    _, mask = cv2.threshold(
        difference_u8,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )

    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(
        mask, cv2.MORPH_CLOSE, kernel, iterations=2
    )
    mask = cv2.morphologyEx(
        mask, cv2.MORPH_OPEN, kernel, iterations=1
    )

    # Remove contours touching the image border, often background noise.
    contours, _ = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    cleaned = np.zeros((height, width), dtype=np.uint8)

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        touches_border = (
            x <= 0 or y <= 0 or x + w >= width or y + h >= height
        )

        if not touches_border and cv2.contourArea(contour) >= (
            height * width * 0.01
        ):
            cv2.drawContours(cleaned, [contour], -1, 255, -1)

    return cleaned


def measure_foot(
    image_path,
    marker_mm=50.0,
    output_path=None,
    marker_id=None,
):
    """
    Estimate foot length and width from a top-down image.

    Without an ArUco marker, demo mode assumes a foot length of 250 mm.
    Uncalibrated results are for software demonstrations only.
    """

    image = load_image(image_path)
    height, width = image.shape[:2]

    # Try calibrated scale first.
    try:
        calibration = detect_marker_scale(
            image,
            marker_mm=marker_mm,
            marker_id=marker_id,
        )
        calibration_mode = "aruco_calibrated"

    except ValueError as exc:
        if "No ArUco marker detected" not in str(exc):
            raise

        calibration = None
        calibration_mode = "uncalibrated_demo"

    mask = _segment_foreground(image)

    contours, _ = cv2.findContours(
        mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    if not contours:
        raise ValueError(
            "Could not isolate the foot. Use a clear top-down photo "
            "with the foot separated from the background."
        )

    # Select the largest detected foreground contour.
    contour = max(contours, key=cv2.contourArea)

    if cv2.contourArea(contour) < height * width * 0.02:
        raise ValueError(
            "Detected foreground is too small. Retake the photo "
            "with the complete foot visible."
        )

    points = contour.reshape(-1, 2).astype(np.float64)
    center = points.mean(axis=0)

    centered = points - center
    covariance = np.cov(centered.T)
    eigenvalues, eigenvectors = np.linalg.eigh(covariance)

    major_axis = eigenvectors[:, np.argmax(eigenvalues)]
    minor_axis = np.array([-major_axis[1], major_axis[0]])

    major_projection = centered @ major_axis
    minor_projection = centered @ minor_axis

    length_px = float(
        major_projection.max() - major_projection.min()
    )
    width_px = float(
        minor_projection.max() - minor_projection.min()
    )

    if length_px <= 0 or width_px <= 0:
        raise ValueError("Could not estimate the foot outline.")

    if calibration is None:
        # Demo-only assumption; not a measurement of the user's foot.
        pixels_per_mm = length_px / 250.0
        calibration = {
            "marker_mm": None,
            "marker_ids": [],
            "marker_side_px": None,
            "pixels_per_mm": pixels_per_mm,
            "mm_per_pixel": 1.0 / pixels_per_mm,
            "marker_count": 0,
            "calibration_mode": "uncalibrated_demo",
            "assumed_foot_length_mm": 250.0,
        }
    else:
        pixels_per_mm = calibration["pixels_per_mm"]

    foot_length_mm = round(length_px / pixels_per_mm, 2)
    foot_width_mm = round(width_px / pixels_per_mm, 2)

    # Draw contour and principal measurement axes.
    annotated = image.copy()
    cv2.drawContours(annotated, [contour], -1, (0, 255, 0), 2)

    start_length = center + major_axis * major_projection.min()
    end_length = center + major_axis * major_projection.max()

    start_width = center + minor_axis * minor_projection.min()
    end_width = center + minor_axis * minor_projection.max()

    cv2.line(
        annotated,
        tuple(np.round(start_length).astype(int)),
        tuple(np.round(end_length).astype(int)),
        (0, 0, 255),
        3,
    )

    cv2.line(
        annotated,
        tuple(np.round(start_width).astype(int)),
        tuple(np.round(end_width).astype(int)),
        (255, 0, 255),
        3,
    )

    annotated_path = None

    if output_path:
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        if not cv2.imwrite(str(output), annotated):
            raise ValueError(
                f"Could not save annotated image to: {output}"
            )

        annotated_path = str(output.resolve())

    warnings = [
        "2D outline measurements depend on foot pose, perspective, "
        "and foreground segmentation.",
        "Ankle circumference cannot be determined reliably from "
        "a top-down foot photograph.",
    ]

    if calibration_mode == "uncalibrated_demo":
        warnings.append(
            "UNCALIBRATED DEMO: foot length was assumed to be 250 mm. "
            "These estimates must not be used to manufacture a cast."
        )

    return {
        "region": "ankle",
        "measurements": {
            "foot_length_mm": foot_length_mm,
            "foot_width_mm": foot_width_mm,
            "ankle_circumference_mm": None,
        },
        "calibration": calibration,
        "calibration_mode": calibration_mode,
        "annotated_image": annotated_path,
        "method": "Foreground segmentation and principal-axis analysis",
        "warnings": warnings,
    }
