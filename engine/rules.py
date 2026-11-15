"""Versioned prototype catalog and synthetic evidence-coverage utility."""
from dataclasses import dataclass

from .models import InvestigationRequest


@dataclass(frozen=True)
class Rules:
    version: str = "demo-2"


@dataclass(frozen=True)
class Check:
    id: str
    label: str
    equipment: tuple[str, ...]
    time_cost: int
    resource_cost: int


BP = ("systolic_bp_mm_hg", "diastolic_bp_mm_hg")
CATALOG_SOURCE = "prototype:mednav_catalog_v2"
CATALOG = (
    Check("symptom_review_checklist", "Open the symptom review form", (), 1, 0),
    Check("review_sleep_workload", "Review the recorded sleep history", (), 1, 0),
    Check("measure_blood_pressure", "Open the prototype blood-pressure workflow", ("bp_monitor",), 2, 1),
    Check("review_equipment_status", "Review the local equipment record", (), 1, 0),
    Check("contact_medical_officer", "Open the onboard medical officer handoff", (), 1, 0),
)


def benefits(request: InvestigationRequest, missing: list[str], uncertain: set[str],
             usable: set[str]) -> dict[str, tuple[int, str]]:
    # Only address gaps relevant to a catalog entry. Counts are synthetic utility units.
    result = {}
    symptoms = len(set(request.symptoms))
    if symptoms:
        result["symptom_review_checklist"] = (2 + min(symptoms, 2), f"{symptoms} distinct symptom entries")
    sleep = request.measurements.get("sleep_hours")
    if sleep is not None and "sleep_hours" not in uncertain:
        baseline = request.personal_baseline.get("sleep_hours")
        changed = baseline is not None and sleep != baseline
        result["review_sleep_workload"] = (1 + 2 * changed, "sleep differs from baseline" if changed else "sleep record available")
    gaps = sorted(set(BP) & (set(missing) | uncertain))
    if gaps:
        result["measure_blood_pressure"] = (2 + 2 * len(gaps), "BP evidence gaps: " + ", ".join(gaps))
        if "bp_monitor" not in usable and any(v is not None for v in request.measurements.values()):
            result["review_equipment_status"] = (2, "BP evidence blocked by monitor availability")
    if uncertain:
        result["contact_medical_officer"] = (4 + len(uncertain), "flagged evidence: " + ", ".join(sorted(uncertain)))
    return result
