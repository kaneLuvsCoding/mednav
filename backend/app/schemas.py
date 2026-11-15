"""Provisional API models; see CONTRACT_NOTES.md before integrating."""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True, allow_inf_nan=False)


PositiveReading = Annotated[float, Field(gt=0, strict=True)]
SleepHours = Annotated[float, Field(ge=0, le=24, strict=True)]
BloodPressure = Annotated[str, Field(pattern=r"^[1-9][0-9]{0,3} / [1-9][0-9]{0,3}$")]


class Measurements(Model):
    hr: PositiveReading | None = None
    sleep: SleepHours | None = None
    bp: BloodPressure | None = None
    symptoms: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(default_factory=list, max_length=20)

    @field_validator("symptoms")
    @classmethod
    def clean_symptoms(cls, values):
        cleaned = [v.strip() for v in values]
        if any(not v for v in cleaned):
            raise ValueError("Symptom labels cannot be blank")
        return list(dict.fromkeys(cleaned))


class Astronaut(Measurements):
    id: str
    role: str
    baseline: PositiveReading
    sleepBaseline: SleepHours
    synthetic: Literal[True] = True
    provenance: str = "MEDNAV synthetic fixture v1"


class CheckInCreate(Measurements):
    astronaut_id: Annotated[str, Field(min_length=1, max_length=100)]


class CheckIn(CheckInCreate):
    id: str
    recorded_at: datetime
    synthetic: Literal[True] = True
    provenance: str


class HistoryPoint(Measurements):
    id: str
    astronaut_id: str
    recorded_at: datetime
    synthetic: Literal[True] = True
    provenance: str


class InventoryItem(Model):
    name: str
    category: str
    quantity: Annotated[int, Field(ge=0, strict=True)]
    available: bool
    synthetic: Literal[True] = True
    provenance: str = "MEDNAV synthetic fixture v1"


class InventoryUpdate(Model):
    quantity: Annotated[int, Field(ge=0, strict=True)] | None = None
    available: bool | None = Field(default=None, strict=True)

    @model_validator(mode="after")
    def require_update(self):
        if not self.model_fields_set or any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Provide quantity and/or available; explicit null is not supported")
        return self


class InvestigationRequest(Model):
    check_in_id: str
    fixture_id: str = "MN-0000"


class BPObservation(Model):
    bp: BloodPressure | None


class ResourceConstraints(Model):
    bp_monitor_available: bool


class NextCheck(Model):
    title: str
    equipment: list[str]


class Explanation(Model):
    selected: str
    excluded: str


class EvidenceSource(Model):
    id: str
    kind: Literal["scripted-demo"]
    version: str


class InvestigationResponse(Model):
    id: str
    status: Literal["review", "resource-unavailable", "escalate"]
    observations: BPObservation
    missing_data: list[str]
    resource_constraints: ResourceConstraints
    safety_flags: list[str]
    next_check: NextCheck | None
    requires_medical_officer_review: Literal[True]
    explanation: Explanation
    evidence_sources: list[EvidenceSource]
    diagnosis: None
    check_in_id: str
    synthetic: Literal[True] = True
    provenance: str = "Explicit scenario fixture; not an analysis of the saved check-in"

    @model_validator(mode="after")
    def validate_contract_invariants(self):
        if self.status == "escalate" and self.next_check is not None:
            raise ValueError("Escalation fixture must have next_check=null")
        if self.next_check and "Blood-pressure monitor" in self.next_check.equipment and not self.resource_constraints.bp_monitor_available:
            raise ValueError("Fixture cannot require an unavailable BP monitor")
        return self
