from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

Gender = Literal["M", "F"]
Region = Literal["wrist", "ankle"]
Swelling = Literal["acute", "subacute", "none"]


class PatientIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    age: int = Field(ge=1, le=110)
    gender: Gender
    height_cm: Optional[float] = Field(default=None, ge=50, le=230)
    injury_region: Region
    swelling_stage: Swelling = "acute"
    notes: Optional[str] = Field(default=None, max_length=500)


class PatientPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    age: Optional[int] = Field(default=None, ge=1, le=110)
    gender: Optional[Gender] = None
    height_cm: Optional[float] = Field(default=None, ge=50, le=230)
    injury_region: Optional[Region] = None
    swelling_stage: Optional[Swelling] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class MeasurementIn(BaseModel):
    wrist_width_mm: Optional[float] = Field(default=None, ge=20, le=120)
    palm_length_mm: Optional[float] = Field(default=None, ge=40, le=150)
    hand_length_mm: Optional[float] = Field(default=None, ge=80, le=260)
    foot_length_mm: Optional[float] = Field(default=None, ge=100, le=340)
    foot_width_mm: Optional[float] = Field(default=None, ge=40, le=140)
    ankle_circumference_mm: Optional[float] = Field(default=None, ge=100, le=380)
    note: Optional[str] = Field(default=None, max_length=300)


class PipelineStart(BaseModel):
    mode: Literal["scan", "measurements"] = "scan"
    marker_mm: float = Field(default=50.0, ge=10, le=200)
    total_length_mm: Optional[float] = Field(default=None, ge=60, le=600)


class VentParams(BaseModel):
    enabled: bool = True
    pattern: Literal["grid", "staggered"] = "staggered"
    hole_mm: float = Field(default=6.0, ge=3.0, le=16.0)
    spacing_mm: float = Field(default=18.0, ge=8.0, le=50.0)


class TabParams(BaseModel):
    count: int = Field(default=3, ge=0, le=6)


class CastParams(BaseModel):
    region: Region = "wrist"
    station_diameters_mm: List[float] = Field(min_length=3, max_length=5)
    total_length_mm: float = Field(ge=60, le=600)
    wall_thickness_mm: float = Field(ge=2.0, le=10.0)
    vent: VentParams = Field(default_factory=VentParams)
    seam_angle_deg: float = Field(default=0.0, ge=0.0, le=180.0)
    tabs: TabParams = Field(default_factory=TabParams)

    @field_validator("station_diameters_mm")
    @classmethod
    def _check_diameters(cls, v):
        for d in v:
            if not 20 <= d <= 220:
                raise ValueError("each station diameter must be between 20 and 220 mm")
        return v

    @model_validator(mode="after")
    def _check_vent(self):
        if self.vent.enabled and self.vent.hole_mm > self.vent.spacing_mm - 2:
            raise ValueError("vent hole must be at least 2 mm smaller than the vent spacing")
        return self


class PreviewIn(BaseModel):
    params: CastParams
    quick: bool = True


class VersionIn(BaseModel):
    params: CastParams
    label: Optional[str] = Field(default=None, max_length=60)


class ValidationLogIn(BaseModel):
    patient_id: Optional[str] = None
    metric: str = Field(max_length=40)
    manual_value: float
    system_value: float
    note: Optional[str] = Field(default=None, max_length=200)


# Served at GET /api/meta so the frontend sliders always match server validation.
PARAM_LIMITS = {
    "station_diameter_mm": {"min": 20, "max": 220},
    "total_length_mm": {"min": 60, "max": 600},
    "wall_thickness_mm": {"min": 2.0, "max": 10.0, "step": 0.1},
    "vent_hole_mm": {"min": 3, "max": 16, "step": 0.5},
    "vent_spacing_mm": {"min": 8, "max": 50, "step": 1},
    "seam_angle_deg": {"min": 0, "max": 180, "step": 5},
    "tab_count": {"min": 0, "max": 6},
    "vent_patterns": ["grid", "staggered"],
}