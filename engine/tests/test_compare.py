from pathlib import Path

from engine import InvestigationRequest
from engine.compare import compare


def test_synthetic_target_comparison():
    request = InvestigationRequest.model_validate_json((Path(__file__).parents[1] / "examples/checkin.json").read_bytes())
    blocked = compare(request)
    assert all("measure_blood_pressure" not in path for path in blocked.values())
    paths = compare(request.model_copy(update={"available_equipment": ["bp_monitor"]}))
    assert paths["fixed_order"][-1] == paths["mednav"][-1] == "measure_blood_pressure"
    assert len(paths["fixed_order"]) == 3 and len(paths["mednav"]) == 1
