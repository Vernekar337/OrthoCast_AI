
from datetime import datetime, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


def create_cast_report(report: dict, destination: str | Path) -> str:
    """Create a PDF report describing prototype cast-generation output."""
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(destination),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            alignment=TA_CENTER,
            textColor=colors.HexColor("#17365D"),
        )
    )

    story = [
        Paragraph("OrthoCast AI — Cast Generation Report", styles["ReportTitle"]),
        Spacer(1, 4 * mm),
        Paragraph(
            "<b>PROTOTYPE REPORT — NOT APPROVED FOR PATIENT USE</b>",
            styles["Heading2"],
        ),
        Paragraph(
            f"Cast ID: {report.get('cast_id', 'N/A')}<br/>"
            f"Region: {report.get('region', 'N/A')}<br/>"
            f"Generated (UTC): "
            f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')}<br/>"
            f"Status: {report.get('status', 'unknown')}",
            styles["BodyText"],
        ),
        Spacer(1, 5 * mm),
        Paragraph("Geometry Parameters", styles["Heading2"]),
    ]

    params = report.get("parameters", {})
    vent = params.get("vent", {})

    rows = [
        ["Parameter", "Value"],
        ["Station diameters (mm)", ", ".join(map(str, params.get("station_diameters_mm", [])))],
        ["Cast length (mm)", str(params.get("total_length_mm", "N/A"))],
        ["Wall thickness (mm)", str(params.get("wall_thickness_mm", "N/A"))],
        ["Ventilation enabled", str(vent.get("enabled", False))],
        ["Vent hole (mm)", str(vent.get("hole_mm", "N/A"))],
        ["Vent spacing (mm)", str(vent.get("spacing_mm", "N/A"))],
    ]

    table = Table(rows, colWidths=[65 * mm, 95 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17365D")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.extend([table, Spacer(1, 5 * mm)])
    story.append(Paragraph("Mesh Validation Checks", styles["Heading2"]))

    mesh_rows = [["File", "Watertight", "Faces", "Volume (mm³)"]]
    for filename, checks in report.get("mesh_checks", {}).items():
        mesh_rows.append(
            [
                filename,
                str(checks.get("watertight", False)),
                str(checks.get("faces", "N/A")),
                str(checks.get("volume_mm3", "N/A")),
            ]
        )

    mesh_table = Table(
        mesh_rows,
        colWidths=[42 * mm, 28 * mm, 28 * mm, 62 * mm],
        repeatRows=1,
    )
    mesh_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9EAF7")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([mesh_table, Spacer(1, 5 * mm)])
    story.append(Paragraph("Warnings and Limitations", styles["Heading2"]))

    for warning in report.get("warnings", []):
        story.append(Paragraph(f"• {warning}", styles["BodyText"]))
        story.append(Spacer(1, 2 * mm))

    story.extend(
        [
            Spacer(1, 4 * mm),
            Paragraph(
                "A watertight mesh check is a geometric check only. "
                "This report does not certify fit, strength, material safety, "
                "printability, or clinical suitability.",
                styles["Italic"],
            ),
        ]
    )

    doc.build(story)
    return str(destination.resolve())
