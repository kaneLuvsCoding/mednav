"""Replace this adapter with Member 3's implementation; no medical logic here."""
import json
from pathlib import Path
from typing import Protocol

from .schemas import CheckIn, InventoryItem, InvestigationResponse


class UnknownFixture(Exception):
    pass


class InvestigationAdapter(Protocol):
    def investigate(self, *, check_in: CheckIn, inventory: list[InventoryItem], fixture_id: str) -> InvestigationResponse: ...


class FixtureAdapter:
    def __init__(self):
        self.fixtures = json.loads((Path(__file__).parent / "fixtures" / "investigations.json").read_text(encoding="utf-8"))

    def investigate(self, *, check_in, inventory, fixture_id):
        # Deliberately ignores clinical inputs and live inventory. The selected fixture
        # is an isolated what-if scenario, never represented as a computed recommendation.
        if fixture_id not in self.fixtures:
            raise UnknownFixture(fixture_id)
        return InvestigationResponse.model_validate({**self.fixtures[fixture_id], "check_in_id": check_in.id})
