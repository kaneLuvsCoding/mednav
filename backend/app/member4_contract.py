"""Proposed Member4 contract, isolated from existing frontend DTOs."""
from datetime import datetime
from typing import Annotated, Literal, Protocol
from pydantic import Field, field_validator, model_validator
from .schemas import Model

Numeric = Annotated[float, Field(strict=True)]


class Measurements(Model):
    resting_hr_bpm: Numeric | None
    sleep_hours: Numeric | None
    systolic_bp_mm_hg: Numeric | None
    diastolic_bp_mm_hg: Numeric | None


class Baseline(Model):
    resting_hr_bpm: Numeric
    sleep_hours: Numeric


class Member4Request(Model):
    astronaut_id: str
    observed_at: datetime
    symptoms: list[str]
    measurements: Measurements
    personal_baseline: Baseline
    available_equipment: list[str]
    communication_status: Literal["online", "offline"]
    emergency_override: Annotated[bool, Field(strict=True)]
    dataset_type: Literal["synthetic"]

    @field_validator("observed_at")
    @classmethod
    def require_offset(cls, value):
        if value.utcoffset() is None:
            raise ValueError("observed_at requires a timezone offset")
        return value


class Member4NextCheck(Model):
    id: str
    label: str
    requires_equipment: list[str]
    prototype_only: Literal[True]


class Member4Response(Model):
    status: Annotated[str, Field(min_length=1)]
    observations: list[str]
    missing_data: list[str]
    resource_constraints: list[str]
    safety_flags: list[str]
    next_check: Member4NextCheck | None
    requires_medical_officer_review: bool
    explanation: Annotated[str, Field(min_length=1)]
    evidence_sources: list[str]
    diagnosis: None

    @model_validator(mode="after")
    def invariants(self):
        if self.status == "escalate" and self.next_check is not None:
            raise ValueError("Escalation cannot include a next check")
        if not any(s.startswith("synthetic:") for s in self.evidence_sources):
            raise ValueError("Synthetic provenance required")
        return self


class Member3Engine(Protocol):
    def __call__(self, request_dict: dict) -> dict:
        """Evaluate real engine; no local fallback or fixture substitution."""
        ...
