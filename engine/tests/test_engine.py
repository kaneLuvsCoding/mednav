import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from engine import InvestigationRequest, InventoryItem, evaluate_investigation
from engine.rules import BP, CATALOG


@pytest.fixture
def payload():
    return json.loads((Path(__file__).parents[1] / "examples/checkin.json").read_text())


def run(payload, **kwargs):
    result = evaluate_investigation(InvestigationRequest.model_validate(payload), **kwargs)
    assert result.diagnosis is None
    assert result.evidence_sources[0].startswith("synthetic:")
    assert "No diagnosis" in result.explanation
    if result.next_check:
        assert set(result.next_check.requires_equipment) <= set(payload["available_equipment"])
    return result


def test_contract_and_baseline(payload):
    result = run(payload)
    assert result.status == "needs_review"
    assert result.missing_data == list(BP)
    assert payload["measurements"][BP[0]] is None
    assert result.next_check.id == "symptom_review_checklist"
    assert result.resource_constraints == ["bp_monitor unavailable"]
    assert "sleep_hours is below the recorded personal baseline." in result.observations
    assert result.requires_medical_officer_review
    assert set(result.model_dump()) == {
        "status", "observations", "missing_data", "resource_constraints", "safety_flags",
        "next_check", "requires_medical_officer_review", "explanation", "evidence_sources", "diagnosis"
    }


def test_partial_measurement(payload):
    payload["measurements"].pop(BP[0])
    payload["measurements"][BP[1]] = 0
    assert run(payload).missing_data == [BP[0]]


def test_override_preempts_inventory(payload):
    def forbidden():
        raise AssertionError("override reached inventory filtering")
        yield
    payload["emergency_override"] = True
    result = run(payload, inventory=forbidden())
    assert (result.status, result.next_check) == ("escalate", None)
    assert result.safety_flags == ["approved_emergency_protocol_required"]
    assert result.requires_medical_officer_review and result.missing_data == list(BP)


@pytest.mark.parametrize("quantity,usable,expiry,eligible", [
    (0, True, None, False), (1, False, None, False), (1, True, "2026-11-13", False),
    (1, True, "2026-11-14", True), (1, True, None, True)
])
def test_inventory_snapshot(payload, quantity, usable, expiry, eligible):
    payload["available_equipment"].append("bp_monitor")
    item = InventoryItem(equipment_id="bp_monitor", quantity=quantity, usable=usable, expires_on=expiry)
    result = run(payload, candidate_checks=["measure_blood_pressure"], inventory=[item])
    assert bool(result.next_check) == eligible
    if not eligible:
        assert result.status == "insufficient_evidence" and result.requires_medical_officer_review


def test_snapshot_cannot_expand_allowlist(payload):
    item = InventoryItem(equipment_id="bp_monitor", quantity=1, usable=True)
    assert run(payload, inventory=[item]).next_check.id != "measure_blood_pressure"


@pytest.mark.parametrize("candidates", [[], ["unknown"], ["measure_blood_pressure"]])
def test_abstention(payload, candidates):
    result = run(payload, candidate_checks=candidates)
    assert (result.status, result.next_check) == ("insufficient_evidence", None)


def test_ranking_and_replay(payload):
    payload["available_equipment"].append("bp_monitor")
    ids = [check.id for check in CATALOG]
    result = run(payload, candidate_checks=ids)
    assert result.next_check.id == "measure_blood_pressure"
    assert result == run(payload, candidate_checks=ids[::-1])
    assert run(payload, candidate_checks=ids[:2]).next_check.id == "symptom_review_checklist"
    assert run(payload, candidate_checks=ids[:2]) == run(payload, candidate_checks=ids[1::-1])


def test_complete_checkin(payload):
    payload.update(symptoms=[], personal_baseline={})
    payload["measurements"].update(dict.fromkeys(BP, 70))
    result = run(payload)
    assert result.next_check.id == "review_sleep_workload"
    assert not result.requires_medical_officer_review
    assert result.missing_data == result.safety_flags == []


def test_no_fabricated_sleep_history(payload):
    payload.update(symptoms=[], measurements={})
    assert run(payload).status == "insufficient_evidence"


@pytest.mark.parametrize("change", [
    {"emergency_override": "false"}, {"dataset_type": "real"}, {"observed_at": "yesterday"},
    {"measurements": {"sleep_hours": True}}, {"measurements": {"resting_hr_bpm": "88"}},
    {"measurements": {"sleep_hours": float("nan")}}
])
def test_validation(payload, change):
    with pytest.raises(ValidationError):
        run({**payload, **change})
