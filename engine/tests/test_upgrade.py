import json

import pytest
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from pydantic import ValidationError

from engine import InvestigationRequest, InvestigationResponse, InventoryItem, evaluate_investigation
from engine.benchmark import EXAMPLES, benchmark
from engine.next_check import EvidenceMetadata, investigate_with_trace
from engine.whatif import simulate


@pytest.fixture
def payload():
    return json.loads((EXAMPLES / "checkin.json").read_text())


@pytest.mark.parametrize("field,value", [
    ("observed_at", "2026-11-14T10:00:00"), ("available_equipment", ["bp_monitor", " bp_monitor "]),
    ("measurements", {"sleep_hours": 30}), ("personal_baseline", {"sleep_hours": -1}),
    ("measurements", {"resting_hr_bpm": -10}), ("measurements", {"diastolic_bp_mm_hg": -1})
])
def test_invalid_record(payload, field, value):
    with pytest.raises(ValidationError):
        InvestigationRequest.model_validate({**payload, field: value})


def test_duplicate_inventory(payload):
    item = InventoryItem(equipment_id="bp_monitor", quantity=2, usable=True)
    with pytest.raises(ValueError, match="duplicate equipment_id"):
        evaluate_investigation(InvestigationRequest(**payload), inventory=[item, item])


def test_tie_independent_of_catalog_order(payload, monkeypatch):
    import engine.next_check as module
    payload["symptoms"] = ["fatigue"]
    request = InvestigationRequest(**payload)
    allowed = ["review_sleep_workload", "symptom_review_checklist"]
    trace = investigate_with_trace(request, allowed)
    assert {c.utility for c in trace.candidates if c.id in allowed} == {2.5}
    monkeypatch.setattr(module, "CATALOG", tuple(reversed(module.CATALOG)))
    assert trace.response == evaluate_investigation(request, allowed)
    assert trace.response.next_check.id == min(allowed)


def test_quality_and_source_labels(payload):
    req = InvestigationRequest(**payload)
    meta = EvidenceMetadata(valid_until=req.observed_at, source_verified=True)
    trace = investigate_with_trace(req, evidence={"sleep_hours": meta})
    assert trace.field_quality["sleep_hours"] == ["synthetic", "present", "source_verified"]
    stale = EvidenceMetadata(valid_until="2026-01-01T00:00:00Z", conflicting=True)
    trace = investigate_with_trace(req, evidence={"sleep_hours": stale})
    assert trace.field_quality["sleep_hours"] == ["synthetic", "present", "stale", "conflicting"]
    assert trace.response.next_check.id == "contact_medical_officer"
    assert not any("sleep_hours is below" in s for s in trace.response.observations)


def test_baseline_conflict(payload):
    payload["personal_baseline"].update(systolic_bp_mm_hg=70, diastolic_bp_mm_hg=90)
    trace = investigate_with_trace(InvestigationRequest(**payload))
    assert trace.response.next_check.id == "contact_medical_officer"


def test_whatif(payload):
    req = InvestigationRequest(**payload)
    assert simulate(req, "monitor")["after"]["response"]["next_check"]["id"] == "measure_blood_pressure"
    assert simulate(req, "emergency")["after"]["candidates"] == []
    pair = simulate(req, "communication")
    assert pair["before"]["response"] == pair["after"]["response"]
    assert req.model_dump(mode="json") == payload


def test_benchmark():
    result = benchmark()
    assert len({row["id"] for row in result["cases"]}) == 16
    for row in result["cases"]:
        assert row["exact"] and row["replay"] and row["feasible"], row["id"]
        if row["emergency"]:
            assert row["override_ok"]
    summary = result["summary"]
    assert summary["routine_handoffs"] == 0 and summary["routine_cases"] > 0
    assert summary["missing_total"] == summary["missing_found"] > 0


def test_fastapi_adapter(payload):
    # Test-only application exercising the real FastAPI request and response serializers.
    app = FastAPI()

    @app.exception_handler(RequestValidationError)
    async def invalid(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"error": {"code": "validation_error", "message": str(exc)}})

    @app.post("/api/v1/investigations", response_model=InvestigationResponse)
    async def evaluate(body: InvestigationRequest):
        return evaluate_investigation(body)

    def post(data):
        # All operations on this test application are in-memory. An actual
        # suspension would require an ASGI server and must fail this harness.
        messages = []

        async def receive():
            return {"type": "http.request", "body": json.dumps(data).encode(), "more_body": False}

        async def send(message):
            messages.append(message)

        scope = dict(type="http", asgi={"version": "3.0"}, http_version="1.1",
                     method="POST", path="/api/v1/investigations", query_string=b"",
                     scheme="http", headers=[(b"content-type", b"application/json")])
        transaction = app(scope, receive, send)
        try:
            with pytest.raises(StopIteration):
                transaction.send(None)
        finally:
            transaction.close()
        start, body = messages
        return start["status"], json.loads(body["body"])

    for override in (False, True):
        data = {**payload, "emergency_override": override}
        status, body = post(data)
        assert status == 200
        assert body == evaluate_investigation(InvestigationRequest(**data)).model_dump()
    status, body = post({**payload, "measurements": {"sleep_hours": 30}})
    assert status == 422 and body["error"]["code"] == "validation_error"
