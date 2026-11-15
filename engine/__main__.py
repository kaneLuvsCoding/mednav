"""Run a contract JSON fixture through the same entry point as the API."""
import argparse
import json
from pathlib import Path

from pydantic import ValidationError

from . import InvestigationRequest, evaluate_investigation


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", nargs="?", type=Path, default=Path(__file__).parent / "examples/checkin.json")
    args = parser.parse_args()
    try:
        request = InvestigationRequest.model_validate_json(args.file.read_bytes())
    except (OSError, ValidationError) as error:
        parser.exit(2, json.dumps({"error": {"code": "validation_error", "message": str(error)}}) + "\n")
    print(evaluate_investigation(request).model_dump_json(indent=2))


if __name__ == "__main__":
    main()
