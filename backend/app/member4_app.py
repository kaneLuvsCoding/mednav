"""Opt-in disposable integration app. Does not change app.main:app."""
import importlib
import os
from pathlib import Path

from fastapi import Depends, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .main import create_app, db, require_astronaut
from .member4_contract import Member3Engine, Member4Request, Member4Response
from .member4_import import source_rows


def sanitize_request(body, inventory):
    # Never trust client-advertised availability. No clinical inference occurs here.
    available = sorted(row["equipment_id"] for row in inventory if row["quantity"] > 0 and row["usable"] is True)
    return {**body.model_dump(mode="json"), "available_equipment": available}


def create_member4_app(database: Path, engine: Member3Engine | None = None):
    database = Path(database).resolve()
    if not database.is_file() or database == Path(__file__).resolve().parents[1] / "mednav.db":
        raise ValueError("An imported disposable database is required; mednav.db is forbidden")
    app = create_app(f"sqlite:///{database.as_posix()}", seed_demo=False)
    with app.state.sessions() as session:
        if not source_rows(session, "provenance"):
            raise ValueError("Database has no Member4 import provenance")
    # Explicit compatibility app only. Existing application factory stays unchanged.
    overridden = {"/api/v1/investigations", "/api/v1/inventory", "/api/v1/inventory/{name}", "/api/v1/astronauts", "/api/v1/astronauts/{astronaut_id}", "/api/v1/check-ins", "/api/v1/check-ins/{check_in_id}"}
    app.router.routes = [r for r in app.router.routes if getattr(r, "path", None) not in overridden]
    app.title = "MEDNAV Member4 isolated QA integration (proposed contract)"

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse(status_code=422, content={"error": {"code": "validation_error", "message": "Invalid Member4 investigation request"}, "detail": [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]})

    @app.get("/api/v1/astronauts")
    def astronauts(session: Session = Depends(db)):
        return source_rows(session, "astronaut")

    @app.get("/api/v1/health")
    def health(astronaut_id: str | None = None, session: Session = Depends(db)):
        rows = source_rows(session, "health")
        return [r for r in rows if astronaut_id is None or r["astronaut_id"] == astronaut_id]

    @app.get("/api/v1/inventory")
    def inventory(session: Session = Depends(db)):
        return source_rows(session, "inventory")

    @app.post("/api/v1/investigations", response_model=Member4Response)
    def investigate(body: Member4Request, session: Session = Depends(db)):
        require_astronaut(session, body.astronaut_id)
        request = sanitize_request(body, source_rows(session, "inventory"))
        if engine is None:
            return JSONResponse(status_code=503, content={"error": {"code": "engine_unavailable", "message": "Real Member3 engine adapter not installed; no mock result generated"}})
        response = Member4Response.model_validate(engine(request))
        if response.next_check and not set(response.next_check.requires_equipment) <= set(request["available_equipment"]):
            raise HTTPException(502, "Engine contract violation: unavailable equipment")
        if body.emergency_override and (response.status != "escalate" or response.next_check is not None or not response.requires_medical_officer_review or "approved_emergency_protocol_required" not in response.safety_flags):
            raise HTTPException(502, "Engine contract violation: override invariants")
        return response

    return app


def factory():
    """uvicorn app.member4_app:factory --factory; env path must be explicitly supplied."""
    path = os.environ["MEDNAV_MEMBER4_TEST_DB"]
    engine = None
    if target := os.getenv("MEDNAV_MEMBER3_ENGINE"):
        module, name = target.split(":", 1)
        engine = getattr(importlib.import_module(module), name)
    return create_member4_app(Path(path), engine=engine)
