
from pathlib import Path
import math

import cv2
import mediapipe as mp

from app.measurement.calibration import (
    load_image,
    detect_marker_scale,
)


def _distance_px(point_a, point_b):
    """Euclidean distance between two image points, in pixels."""
    return math.hypot(
        point_a[0] - point_b[0],
        point_a[1] - point_b[1],
    )


def measure_hand(
    image_path,
    marker_mm=50.0,
    output_path=None,
    marker_id=None,
):
    """
    Estimate hand dimensions from an image.

    If an ArUco marker is detected, use its scale.
    Otherwise, use an assumed 180 mm hand length for DEMO ONLY.

    Uncalibrated estimates must not be used to manufacture a cast.
    """

    image = load_image(image_path)
    height, width = image.shape[:2]

    # Detect the hand first.
    if not hasattr(mp, "solutions") or not hasattr(mp.solutions, "hands"):
        raise RuntimeError(
            "This MediaPipe installation does not expose mp.solutions.hands."
        )

    hands_api = mp.solutions.hands
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    with hands_api.Hands(
        static_image_mode=True,
        max_num_hands=1,
        model_complexity=1,
        min_detection_confidence=0.6,
    ) as hands:
        result = hands.process(rgb_image)

    if not result.multi_hand_landmarks:
        raise ValueError(
            "No hand detected. Use a clear photo showing the entire hand."
        )

    hand_landmarks = result.multi_hand_landmarks[0]

    # Convert normalized MediaPipe coordinates to image pixels.
    points = [
        (
            int(landmark.x * width),
            int(landmark.y * height),
        )
        for landmark in hand_landmarks.landmark
    ]

    # Try real image calibration first.
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

        # Demo fallback: assume wrist-to-middle-finger-tip length is 180 mm.
        # This assumption varies by person and camera perspective.
        reference_length_px = _distance_px(points[0], points[12])

        if reference_length_px <= 0:
            raise ValueError(
                "Could not estimate hand scale from detected landmarks."
            )

        pixels_per_mm = reference_length_px / 180.0

        calibration = {
            "marker_mm": None,
            "marker_ids": [],
            "marker_side_px": None,
            "pixels_per_mm": pixels_per_mm,
            "mm_per_pixel": 1.0 / pixels_per_mm,
            "marker_count": 0,
            "calibration_mode": "uncalibrated_demo",
        }
        calibration_mode = "uncalibrated_demo"

    pixels_per_mm = calibration.get("pixels_per_mm")

    if not pixels_per_mm or pixels_per_mm <= 0:
        raise ValueError("Image calibration produced an invalid scale.")

    # MediaPipe landmark distances:
    # 0 = wrist, 5 = index MCP, 9 = middle MCP,
    # 12 = middle-finger tip, 17 = pinky MCP.
    measurements = {
        # Palm breadth proxy; NOT anatomical wrist circumference.
        "wrist_width_mm": round(
            _distance_px(points[5], points[17]) / pixels_per_mm, 2
        ),
        "palm_length_mm": round(
            _distance_px(points[0], points[9]) / pixels_per_mm, 2
        ),
        "hand_length_mm": round(
            _distance_px(points[0], points[12]) / pixels_per_mm, 2
        ),
    }

    # Annotate the detected landmarks and measurement lines.
    annotated = image.copy()

    for point in points:
        cv2.circle(annotated, point, 4, (0, 255, 0), -1)

    connections = hands_api.HAND_CONNECTIONS
    for start, end in connections:
        cv2.line(
            annotated,
            points[start],
            points[end],
            (255, 180, 0),
            2,
        )

    cv2.line(
        annotated, points[0], points[12], (0, 0, 255), 2
    )
    cv2.line(
        annotated, points[5], points[17], (255, 0, 255), 2
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
        "Measurements are 2D image estimates and require verification.",
        "wrist_width_mm is a palm-breadth proxy, not wrist circumference.",
    ]

    if calibration_mode == "uncalibrated_demo":
        warnings.append(
            "UNCALIBRATED DEMO: scale assumes a 180 mm hand length. "
            "Values are not reliable physical measurements and must not "
            "be used to manufacture a cast."
        )

    return {
        "region": "wrist",
        "measurements": measurements,
        "calibration": calibration,
        "calibration_mode": calibration_mode,
        "landmark_count": len(points),
        "annotated_image": annotated_path,
        "method": "MediaPipe hand landmarks with image-scale estimation",
        "warnings": warnings,
    }
