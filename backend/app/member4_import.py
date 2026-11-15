"""Lossless source retention + projections into a NEW disposable SQLite database."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path

from sqlalchemy import JSON, String, select
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base, AstronautRow, CheckInRow, InventoryRow, create_database


class Member4Source(Base):
    __tablename__ = "member4_source"
    kind: Mapped[str] = mapped_column(String, primary_key=True)
    key: Mapped[str] = mapped_column(String, primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)


def source_rows(session, kind):
    return [row.payload for row in session.scalars(select(Member4Source).where(Member4Source.kind == kind).order_by(Member4Source.key))]


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def require_synthetic(row):
    if row.get("dataset_type") != "synthetic":
        raise ValueError("Only explicitly synthetic data is accepted")


def number(value):
    if value == "" or value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Boolean is not a measurement")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Non-finite measurement")
    return result


def normalize_inventory(row):
    require_synthetic(row)
    usable = row["usable"]
    if type(usable) is str and usable in ("true", "false"):
        usable = usable == "true"
    if type(usable) is not bool:
        raise ValueError("usable must be true/false")
    raw_quantity = row["quantity"]
    if type(raw_quantity) is bool or not (type(raw_quantity) is int or (type(raw_quantity) is str and raw_quantity.isdigit())):
        raise ValueError("quantity must be an integer")
    quantity = int(raw_quantity)
    if quantity < 0:
        raise ValueError("Negative inventory quantity")
    return {**row, "quantity": quantity, "usable": usable, "available": quantity > 0 and usable}


def load_package(package):
    package = Path(package)
    crew = read_csv(package / "data/synthetic/astronauts.csv")
    health = read_csv(package / "data/synthetic/health_daily.csv")
    inventory = [normalize_inventory(row) for row in read_csv(package / "data/synthetic/inventory.csv")]
    baselines = json.loads((package / "data/synthetic/baselines.json").read_text(encoding="utf-8"))
    provenance = json.loads((package / "data/sources/provenance.json").read_text(encoding="utf-8"))
    require_synthetic(provenance)
    ids = set()
    for row in crew:
        require_synthetic(row)
        if row["astronaut_id"] in ids:
            raise ValueError("Duplicate astronaut")
        ids.add(row["astronaut_id"])
        require_synthetic(baselines[row["astronaut_id"]])
    if set(baselines) != ids:
        raise ValueError("Baseline IDs must match crew")
    keys = set()
    for row in health:
        require_synthetic(row)
        timestamp = datetime.fromisoformat(row["observed_at"])
        if timestamp.utcoffset() is None or row["astronaut_id"] not in ids:
            raise ValueError("History requires known crew and timezone-aware timestamp")
        key = (row["astronaut_id"], row["observed_at"])
        if key in keys:
            raise ValueError("Duplicate history record")
        keys.add(key)
        row["resting_hr_bpm"] = number(row["resting_hr_bpm"])
        row["sleep_hours"] = number(row["sleep_hours"])
        row["reported_symptoms"] = json.loads(row["reported_symptoms"])
        if not isinstance(row["reported_symptoms"], list) or not all(isinstance(v, str) for v in row["reported_symptoms"]):
            raise ValueError("reported_symptoms must be a JSON string array")
    if len({r["equipment_id"] for r in inventory}) != len(inventory) or len({r["label"] for r in inventory}) != len(inventory):
        raise ValueError("Duplicate equipment ID/label")
    return crew, health, inventory, baselines, provenance


def import_package(package: Path, destination: Path):
    destination = Path(destination).resolve()
    # Refuse even an empty existing file, so shared/development DBs are never modified.
    if destination.exists():
        raise FileExistsError(f"Refusing existing database: {destination}")
    crew, health, inventory, baselines, provenance = load_package(package)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("xb"):
        pass  # Atomic reservation: prevents racing another importer.
    engine, sessions = create_database(f"sqlite:///{destination.as_posix()}")
    try:
        Base.metadata.create_all(engine)
        with sessions.begin() as session:
            for row in crew:
                ident = row["astronaut_id"]
                baseline = baselines[ident]
                session.add(Member4Source(kind="astronaut", key=ident, payload=row))
                session.add(Member4Source(kind="baseline", key=ident, payload=baseline))
                session.add(AstronautRow(id=ident, role="Unspecified in Member 4 package", baseline=number(baseline["resting_hr_bpm"]), sleepBaseline=number(baseline["sleep_hours"])))
            session.flush()
            for row in health:
                key = f"member4:{row['astronaut_id']}:{row['observed_at']}"
                session.add(Member4Source(kind="health", key=key, payload=row))
                session.add(CheckInRow(id=key, astronaut_id=row["astronaut_id"], recorded_at=datetime.fromisoformat(row["observed_at"]).astimezone(timezone.utc), hr=row["resting_hr_bpm"], sleep=row["sleep_hours"], bp=None, symptoms=row["reported_symptoms"], synthetic=True, provenance=provenance["source"]))
            for row in inventory:
                session.add(Member4Source(kind="inventory", key=row["equipment_id"], payload=row))
                session.add(InventoryRow(name=row["label"], category="Unspecified in Member 4 package", quantity=row["quantity"], available=row["available"]))
            session.add(Member4Source(kind="provenance", key=provenance["version"], payload=provenance))
        return {"database": str(destination), "dataset_type": "synthetic", "astronauts": len(crew), "health_records": len(health), "inventory_items": len(inventory), "baselines": len(baselines), "unknown_numeric_cells": sum(r[k] is None for r in health for k in ("resting_hr_bpm", "sleep_hours")), "available_equipment": sorted(r["equipment_id"] for r in inventory if r["available"]), "database_sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}
    finally:
        engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--database", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(import_package(args.package, args.database), indent=2))
