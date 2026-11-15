import copy
import hashlib
import json
from pathlib import Path
import shutil

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import select, func

from app.database import CheckInRow, create_database
from app.main import create_app
from app.member4_app import create_member4_app, sanitize_request
from app.member4_contract import Member4Request
from app.member4_import import Member4Source, import_package, normalize_inventory, source_rows

PACKAGE = Path(__file__).resolve().parents[1] / "vendor/member4"
CASES = json.loads((PACKAGE / "data/scenarios/scenarios.json").read_text())
CONTEXT = json.loads((PACKAGE / "data/scenarios/context.json").read_text())


@pytest.fixture
def imported(tmp_path):
    path = tmp_path / "member4.db"
    result = import_package(PACKAGE, path)
    return path, result


def test_import_counts_null_timestamp_symptoms_and_baselines(imported):
    path, result = imported
    assert (result["astronauts"], result["health_records"], result["inventory_items"], result["baselines"]) == (4, 120, 4, 4)
    assert result["unknown_numeric_cells"] == 2
    assert result["available_equipment"] == ["thermometer", "weighing_scale"]
    app = create_member4_app(path)
    with TestClient(app) as client:
        crew = client.get("/api/v1/astronauts").json()
        assert {r["astronaut_id"] for r in crew} == {"A01", "A02", "A03", "A04"}
        health = client.get("/api/v1/health").json()
        outage = next(r for r in health if r["astronaut_id"] == "A03" and r["observed_at"].startswith("2026-10-30"))
        assert outage["resting_hr_bpm"] is None and outage["sleep_hours"] is None
        assert outage["observed_at"] == "2026-10-30T09:00:00+06:30"
        assert all(r["dataset_type"] == "synthetic" for r in health)
        assert all(isinstance(r["reported_symptoms"], list) for r in health)
        assert any(r["reported_symptoms"] == ["fatigue"] for r in health)
        with app.state.sessions() as session:
            assert session.scalar(select(func.count()).select_from(CheckInRow)) == 120
            baseline = session.get(Member4Source, ("baseline", "A01")).payload
            assert baseline["resting_hr_bpm"] == 68
            assert CASES[3]["investigation_request"]["personal_baseline"]["resting_hr_bpm"] == 70
            projection = session.scalar(select(CheckInRow).where(CheckInRow.astronaut_id == "A03", CheckInRow.hr.is_(None)))
            assert projection.sleep is None and projection.bp is None
            assert projection.recorded_at.hour == 2 and projection.recorded_at.minute == 30


def test_existing_database_never_overwritten(imported):
    path, _ = imported
    before = path.read_bytes()
    with pytest.raises(FileExistsError):
        import_package(PACKAGE, path)
    assert before == path.read_bytes()


def test_import_round_trip_and_default_projection_compatibility(imported):
    path, _ = imported
    for _ in range(2):
        with TestClient(create_app(f"sqlite:///{path.as_posix()}", seed_demo=False)) as client:
            profiles = client.get("/api/v1/astronauts").json()
            assert len(profiles) == 4 and profiles[0]["id"] == "A01"
            assert profiles[0]["baseline"] == 68
            history = client.get("/api/v1/astronauts/A01/history").json()
            assert len(history) == 30
            assert all(row["bp"] is None for row in history)


@pytest.mark.parametrize("case_id", ["S03", "S04", "S08"])
def test_inventory_sanitization_without_engine_outputs(case_id):
    case = next(c for c in CASES if c["scenario_id"] == case_id)
    request = copy.deepcopy(case["investigation_request"])
    request["available_equipment"] = ["bp_monitor", "thermometer", "pulse_oximeter", "weighing_scale"]
    original = copy.deepcopy(request)
    body = Member4Request.model_validate(request)
    prepared = sanitize_request(body, [normalize_inventory(r) for r in CONTEXT[case_id]["inventory"]])
    assert set(prepared["available_equipment"]) == set(case["investigation_request"]["available_equipment"])
    assert request == original
    assert prepared["personal_baseline"] == request["personal_baseline"]


def test_real_path_receives_sanitized_request_without_faking_response(imported):
    captured = []
    def stop_at_engine(request):
        captured.append(request)
        raise NotImplementedError("Engine intentionally absent")
    with TestClient(create_member4_app(imported[0], engine=stop_at_engine)) as client:
        request = copy.deepcopy(CASES[0]["investigation_request"])
        request["available_equipment"] = ["bp_monitor"]
        with pytest.raises(NotImplementedError):
            client.post("/api/v1/investigations", json=request)
    assert captured[0]["available_equipment"] == ["thermometer", "weighing_scale"]


def test_no_mock_fallback_and_actionable_validation(imported):
    with TestClient(create_member4_app(imported[0])) as client:
        response = client.post("/api/v1/investigations", json=CASES[0]["investigation_request"])
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "engine_unavailable"
        assert "next_check" not in response.json()
        invalid = client.post("/api/v1/investigations", json=CASES[12]["investigation_request"])
        assert invalid.status_code == 422
        assert invalid.json()["error"]["code"] == "validation_error"
        assert any(e["loc"][-1] == "resting_hr_bpm" for e in invalid.json()["detail"])


@pytest.mark.parametrize("change", [{"usable": "False"}, {"usable": "yes"}, {"quantity": -1}, {"quantity": True}, {"quantity": 1.5}, {"dataset_type": "real"}])
def test_invalid_inventory_encoding(change):
    with pytest.raises(ValueError):
        normalize_inventory({"equipment_id": "test", "label": "Test", "quantity": "1", "usable": "false", "dataset_type": "synthetic", **change})


def test_false_string_does_not_become_true():
    assert normalize_inventory({"equipment_id": "test", "label": "Test", "quantity": "1", "usable": "false", "dataset_type": "synthetic"})["available"] is False


def test_invalid_package_does_not_create_database(tmp_path):
    copy_path = tmp_path / "bad-package"
    shutil.copytree(PACKAGE, copy_path)
    path = copy_path / "data/synthetic/astronauts.csv"
    path.write_text(path.read_text().replace("synthetic", "real"))
    db = tmp_path / "bad.db"
    with pytest.raises(ValueError):
        import_package(copy_path, db)
    assert not db.exists()


def test_snapshot_matches_original_manifest():
    manifest = json.loads((PACKAGE.parents[1] / "integration/member4_manifest.json").read_text())
    for name, digest in manifest.items():
        assert hashlib.sha256((PACKAGE / name).read_bytes()).hexdigest() == digest
