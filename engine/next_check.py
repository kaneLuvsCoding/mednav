"""Deterministic API evaluator and internal audit trace. No network or clock access."""
from collections.abc import Collection, Iterable, Mapping
from dataclasses import dataclass
from typing import Literal

from pydantic import AwareDatetime, StrictBool

from .models import FIELDS, InvestigationRequest, InvestigationResponse, InventoryItem, Model, NextCheck
from .rules import BP, CATALOG, CATALOG_SOURCE, Rules, benefits


class EvidenceMetadata(Model):
    """Trusted adapter input for this check-in. Expiry comes from the data provider."""
    valid_until: AwareDatetime | None = None
    conflicting: StrictBool = False
    source_verified: StrictBool = False


@dataclass(frozen=True)
class Candidate:
    id: str
    reason: str
    utility: float | None = None
    information: int | None = None
    time_cost: int | None = None
    resource_cost: int | None = None


@dataclass
class Trace:
    response: InvestigationResponse
    field_quality: dict[str, list[str]]
    candidates: list[Candidate]
    disposition: Literal["routine_record", "review", "escalate", "abstain"]


def usable_ids(request, inventory):
    usable = set(request.available_equipment)
    if inventory is None:
        return usable
    seen = set()
    snapshot = set()
    for item in inventory:
        if item.equipment_id in seen:
            raise ValueError("duplicate equipment_id in aggregated inventory snapshot")
        seen.add(item.equipment_id)
        if item.usable and item.quantity > 0 and (item.expires_on is None or item.expires_on >= request.observed_at.date()):
            snapshot.add(item.equipment_id)
    return usable & snapshot


def investigate_with_trace(
    request: InvestigationRequest, candidate_checks: Collection[str] | None = None,
    inventory: Iterable[InventoryItem] | None = None, rules: Rules = Rules(),
    *, evidence: Mapping[str, EvidenceMetadata] | None = None,
) -> Trace:
    if rules.version != "demo-2":
        raise ValueError("Unsupported engine rules version")
    metadata = evidence or {}
    fields = dict.fromkeys((*FIELDS, *sorted(request.measurements), *sorted(request.personal_baseline), *sorted(metadata)))
    quality = {}
    observations = []
    if request.symptoms:
        observations.append("Reported symptoms: " + ", ".join(request.symptoms) + ".")
    systolic, diastolic = (request.measurements.get(key) for key in BP)
    reversed_bp = systolic is not None and diastolic is not None and systolic < diastolic
    baseline_sys, baseline_dia = (request.personal_baseline.get(key) for key in BP)
    reversed_baseline = baseline_sys is not None and baseline_dia is not None and baseline_sys < baseline_dia
    missing = []
    uncertain = set()
    for key in fields:
        value = request.measurements.get(key)
        states = ["synthetic"]
        meta = metadata.get(key)
        if value is None:
            states.append("missing")
            missing.append(key)
        else:
            states.append("present")
            if meta and meta.source_verified:
                states.append("source_verified")
            if meta and meta.valid_until and meta.valid_until < request.observed_at:
                states.append("stale")
            if (reversed_bp and key in BP) or (meta and meta.conflicting):
                states.append("conflicting")
            flags = [s for s in states if s in ("stale", "conflicting")]
            if flags:
                uncertain.add(key)
                observations.append(f"{key}: {', '.join(flags)} evidence. Comparison withheld.")
            baseline = request.personal_baseline.get(key)
            if key in BP and reversed_baseline:
                states.append("baseline_conflicting")
                observations.append(f"{key}: conflicting baseline pair. Comparison withheld.")
            elif not flags and baseline is not None and value != baseline:
                direction = "above" if value > baseline else "below"
                observations.append(f"{key} is {direction} the recorded personal baseline.")
                observations.append(f"{key}: current {value:g}, personal baseline {baseline:g}.")
        quality[key] = states
    sources = [f"synthetic:{request.astronaut_id}@{request.observed_at.isoformat()}", f"prototype:mednav_rules_{rules.version}"]
    response = InvestigationResponse(status="escalate", observations=observations, missing_data=missing,
        resource_constraints=[], safety_flags=[], next_check=None, requires_medical_officer_review=True,
        explanation="", evidence_sources=sources)
    if request.emergency_override:
        response.safety_flags = ["approved_emergency_protocol_required"]
        response.explanation = "Follow the mission-approved emergency workflow and contact the crew medical officer. No diagnosis is established."
        return Trace(response, quality, [], "escalate")

    usable = usable_ids(request, inventory)
    values = benefits(request, missing, uncertain, usable)
    if reversed_baseline:
        values["contact_medical_officer"] = (6, "recorded baseline BP pair is internally inconsistent")
    records = []
    eligible = []
    response.evidence_sources.append(CATALOG_SOURCE)
    for check in CATALOG:
        if candidate_checks is not None and check.id not in candidate_checks:
            reason = "outside candidate allowlist"
        elif check.id not in values:
            reason = "no matching evidence gap or record"
        elif unavailable := sorted(set(check.equipment) - usable):
            reason = ", ".join(item + " unavailable" for item in unavailable)
            response.resource_constraints.append(reason)
        else:
            gain, reason = values[check.id]
            score = gain - 0.5 * (check.time_cost + check.resource_cost)
            eligible.append((score, check.id, check))
            records.append(Candidate(check.id, reason, score, gain, check.time_cost, check.resource_cost))
            continue
        records.append(Candidate(check.id, reason))
    notes = []
    if missing:
        notes.append("Unknown measurements: " + ", ".join(missing) + ".")
    if eligible:
        score, _, chosen = min(eligible, key=lambda item: (-item[0], item[1]))
        response.next_check = NextCheck(id=chosen.id, label=chosen.label, requires_equipment=list(chosen.equipment))
        response.status = "needs_review"
        response.requires_medical_officer_review = bool(request.symptoms or missing or uncertain or reversed_baseline)
        disposition = "review" if response.requires_medical_officer_review else "routine_record"
        notes.append(f"Selected {chosen.id} (utility {score:g}).")
        if disposition == "routine_record":
            notes.append("Routine record review. No officer handoff requested.")
    else:
        disposition = "abstain"
        response.status = "insufficient_evidence"
        notes.append("No feasible matching checklist. Request crew medical officer review.")
    for record in sorted(records, key=lambda item: item.id):
        prefix = "excluded" if record.utility is None else f"utility {record.utility:g}"
        notes.append(f"{record.id} ({prefix}): {record.reason}.")
    response.explanation = " ".join([*notes, "No diagnosis is established."])
    return Trace(response, quality, records, disposition)


def evaluate_investigation(
    request: InvestigationRequest, candidate_checks: Collection[str] | None = None,
    inventory: Iterable[InventoryItem] | None = None, rules: Rules = Rules(),
    *, evidence: Mapping[str, EvidenceMetadata] | None = None,
) -> InvestigationResponse:
    return investigate_with_trace(request, candidate_checks, inventory, rules, evidence=evidence).response
