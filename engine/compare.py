"""Compare form navigation with identical safety and eligibility gates."""
from pathlib import Path

from .models import InvestigationRequest
from .next_check import investigate_with_trace
from .rules import CATALOG


def compare(request: InvestigationRequest, target="measure_blood_pressure", **options) -> dict[str, list[str]]:
    trace = investigate_with_trace(request, **options)
    eligible = {c.id: c.utility for c in trace.candidates if c.utility is not None}
    orders = {
        "fixed_order": [c.id for c in CATALOG if c.id in eligible],
        "mednav": sorted(eligible, key=lambda key: (-eligible[key], key)),
    }
    for order in orders.values():
        if target in order:
            del order[order.index(target) + 1:]
    return orders


if __name__ == "__main__":
    request = InvestigationRequest.model_validate_json((Path(__file__).parent / "examples/checkin.json").read_bytes())
    for equipment in ([], ["bp_monitor"]):
        case = request.model_copy(update={"available_equipment": equipment})
        print("Synthetic BP target | available equipment:", equipment)
        for method, path in compare(case).items():
            print(method, path, "target reached:", "measure_blood_pressure" in path)
