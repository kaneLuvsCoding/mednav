"""Replay hand-labeled synthetic cases and emit JSON with counts and denominators."""
import json
from pathlib import Path

from .compare import compare
from .models import InvestigationRequest, InventoryItem
from .next_check import EvidenceMetadata, investigate_with_trace

EXAMPLES = Path(__file__).parent / "examples"


def benchmark():
    base = json.loads((EXAMPLES / "checkin.json").read_text())
    scenarios = json.loads((EXAMPLES / "benchmark.json").read_text())
    cases = []
    for case in scenarios:
        patch = case["patch"]
        payload = {**base, **patch, "measurements": {**base["measurements"], **patch.get("measurements", {})}}
        req = InvestigationRequest.model_validate(payload)
        options = dict(candidate_checks=case.get("candidates"),
                       evidence={k: EvidenceMetadata(**v) for k, v in case.get("evidence", {}).items()})
        if "inventory" in case:
            options["inventory"] = [InventoryItem(**row) for row in case["inventory"]]
        trace = investigate_with_trace(req, **options)
        response = trace.response
        selected = response.next_check.id if response.next_check else None
        expected = case["expected"]
        target = case.get("target", expected["selected"])
        paths = compare(req, target, **options) if target else {}
        required = set(response.next_check.requires_equipment) if selected else set()
        safety_ok = response.status == "escalate" and selected is None and not trace.candidates and response.requires_medical_officer_review and "approved_emergency_protocol_required" in response.safety_flags
        cases.append(dict(id=case["id"], selected=selected, expected_selected=expected["selected"],
            exact=selected == expected["selected"] and response.status == expected["status"]
                  and set(response.missing_data) == set(expected["missing"]),
            missing_hits=len(set(response.missing_data) & set(expected["missing"])), missing_total=len(expected["missing"]),
            feasible=required <= set(req.available_equipment) and not required.intersection(case.get("forbidden", [])),
            replay=trace == investigate_with_trace(req, **options), emergency=req.emergency_override,
            override_ok=safety_ok, routine=expected.get("routine", False), officer=response.requires_medical_officer_review,
            target=target, paths=paths))
    targeted = [c for c in cases if c["paths"]]
    reachable = [c for c in targeted if c["target"] in c["paths"]["fixed_order"]]
    return dict(dataset_type="synthetic", cases=cases, summary=dict(
        cases=len(cases), exact=sum(c["exact"] for c in cases), repeatable=sum(c["replay"] for c in cases),
        selected=sum(c["selected"] is not None for c in cases), infeasible=sum(not c["feasible"] for c in cases),
        missing_found=sum(c["missing_hits"] for c in cases), missing_total=sum(c["missing_total"] for c in cases),
        override_correct=sum(c["override_ok"] for c in cases if c["emergency"]), overrides=sum(c["emergency"] for c in cases),
        routine_handoffs=sum(c["officer"] for c in cases if c["routine"]), routine_cases=sum(c["routine"] for c in cases),
        reachable=len(reachable), targeted=len(targeted), form_openings_on_reachable={
            method: sum(len(c["paths"][method]) for c in reachable) for method in ("fixed_order", "mednav")}))


if __name__ == "__main__":
    print(json.dumps(benchmark(), indent=2))
