"""Change a single resource or safety input and inspect both candidate traces."""
import argparse
import json
from dataclasses import asdict
from pathlib import Path

from .models import InvestigationRequest
from .next_check import investigate_with_trace


def simulate(request, change):
    data = request.model_dump()
    if change == "monitor":
        items = set(request.available_equipment)
        items.symmetric_difference_update(["bp_monitor"])
        data["available_equipment"] = sorted(items)
    elif change == "emergency":
        data["emergency_override"] = not request.emergency_override
    elif change == "communication":
        data["communication_status"] = "online" if request.communication_status == "offline" else "offline"
    else:
        raise ValueError("unknown simulation input")
    after = InvestigationRequest.model_validate(data)
    output = {}
    for name, case in (("before", request), ("after", after)):
        trace = investigate_with_trace(case)
        output[name] = dict(available_equipment=case.available_equipment, emergency_override=case.emergency_override,
            communication_status=case.communication_status, disposition=trace.disposition, field_quality=trace.field_quality,
            candidates=[asdict(c) for c in trace.candidates], response=trace.response.model_dump())
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("change", choices=["monitor", "emergency", "communication"])
    parser.add_argument("file", type=Path, nargs="?", default=Path(__file__).parent / "examples/checkin.json")
    args = parser.parse_args()
    print(json.dumps(simulate(InvestigationRequest.model_validate_json(args.file.read_bytes()), args.change), indent=2))
