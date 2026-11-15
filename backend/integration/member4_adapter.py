"""Member4 inventory API seam. Never manufactures an engine response."""
import importlib
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database import InventoryRow
from app.member4_app import create_member4_app
from app.member4_import import Member4Source, import_package, normalize_inventory

PACKAGE = Path(__file__).resolve().parents[1] / "vendor/member4"


def evaluate(request_dict, inventory_rows):
    target = os.getenv("MEDNAV_MEMBER3_ENGINE")
    if not target:
        raise unittest.SkipTest("Real Member3 engine absent; inventory API end-to-end test pending")
    module, name = target.split(":", 1)
    engine = getattr(importlib.import_module(module), name)
    with TemporaryDirectory() as temp:
        path = Path(temp) / "inventory-qa.db"
        import_package(PACKAGE, path)
        app = create_member4_app(path, engine=engine)
        with TestClient(app) as client:
            with app.state.sessions.begin() as session:
                session.execute(delete(Member4Source).where(Member4Source.kind == "inventory"))
                session.execute(delete(InventoryRow))
                for item in inventory_rows:
                    row = normalize_inventory(item)
                    session.add(Member4Source(kind="inventory", key=row["equipment_id"], payload=row))
                    session.add(InventoryRow(name=row["label"], category="Member4 scenario override", quantity=row["quantity"], available=row["available"]))
            response = client.post("/api/v1/investigations", json=request_dict)
            return response.status_code, response.json()
