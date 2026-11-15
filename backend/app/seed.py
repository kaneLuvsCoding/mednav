"""Idempotent synthetic seeding; existing records are never overwritten."""
import json
from datetime import datetime
from pathlib import Path

from .database import AstronautRow, CheckInRow, InventoryRow, SeedVersion

FIXTURES = Path(__file__).parent / "fixtures"


def seed(session):
    if session.get(SeedVersion, "synthetic-v1"):
        return
    data = json.loads((FIXTURES / "seed.json").read_text(encoding="utf-8"))
    for row in data["astronauts"]:
        if not session.get(AstronautRow, row["id"]):
            session.add(AstronautRow(**row))
    session.flush()
    for row in data["history"]:
        if not session.get(CheckInRow, row["id"]):
            row["recorded_at"] = datetime.fromisoformat(row["recorded_at"])
            session.add(CheckInRow(**row))
    for row in data["inventory"]:
        if not session.get(InventoryRow, row["name"]):
            session.add(InventoryRow(**row))
    session.add(SeedVersion(id="synthetic-v1"))
    session.commit()
