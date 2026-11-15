"""API v1 boundary models and the optional internal inventory snapshot."""
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StringConstraints, field_validator

Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Reading = StrictInt | StrictFloat | None
FIELDS = ("resting_hr_bpm", "sleep_hours", "systolic_bp_mm_hg", "diastolic_bp_mm_hg")


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class InvestigationRequest(Model):
    astronaut_id: Identifier
    observed_at: AwareDatetime
    symptoms: list[Identifier]
    measurements: dict[Identifier, Reading]
    personal_baseline: dict[Identifier, Reading]
    available_equipment: list[Identifier]
    communication_status: Identifier
    emergency_override: StrictBool
    dataset_type: Literal["synthetic"]

    @field_validator("measurements", "personal_baseline")
    @classmethod
    def check_units(cls, values):
        for name, value in values.items():
            if value is None:
                continue
            if name in FIELDS and value < 0:
                raise ValueError(f"{name} must be nonnegative")
            if name == "sleep_hours" and value > 24:
                raise ValueError("sleep_hours exceeds the 24-hour recording window")
        return values

    @field_validator("available_equipment")
    @classmethod
    def unique_equipment(cls, values):
        if len(set(values)) != len(values):
            raise ValueError("duplicate available_equipment ID")
        return values

    @field_validator("observed_at", mode="before")
    @classmethod
    def iso_timestamp(cls, value):
        if isinstance(value, datetime):
            return value
        if not isinstance(value, str) or "T" not in value:
            raise ValueError("expected an ISO-8601 timestamp with a time component")
        return datetime.fromisoformat(value)


class InventoryItem(Model):
    equipment_id: Identifier
    quantity: Annotated[StrictInt, Field(ge=0)]
    usable: StrictBool
    expires_on: date | None = None


class NextCheck(Model):
    id: str
    label: str
    requires_equipment: list[str]
    prototype_only: Literal[True] = True


class InvestigationResponse(Model):
    status: Literal["needs_review", "insufficient_evidence", "escalate"]
    observations: list[str]
    missing_data: list[str]
    resource_constraints: list[str]
    safety_flags: list[str]
    next_check: NextCheck | None
    requires_medical_officer_review: bool
    explanation: str
    evidence_sources: list[str]
    diagnosis: None = None
