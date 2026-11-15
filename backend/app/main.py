from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .database import AstronautRow, Base, CheckInRow, InventoryRow, create_database
from .investigation import FixtureAdapter, InvestigationAdapter, UnknownFixture
from .schemas import Astronaut, CheckIn, CheckInCreate, HistoryPoint, InventoryItem, InventoryUpdate, InvestigationRequest, InvestigationResponse
from .seed import seed


def db(request: Request):
    with request.app.state.sessions() as session:
        yield session


def check_in_dto(row):
    # SQLite stores naive UTC timestamps; API consistently returns explicit UTC.
    record = CheckIn.model_validate(row)
    if record.recorded_at.tzinfo is None:
        record.recorded_at = record.recorded_at.replace(tzinfo=timezone.utc)
    return record


def require_astronaut(session, astronaut_id):
    row = session.get(AstronautRow, astronaut_id)
    if row is None:
        raise HTTPException(404, "Astronaut not found")
    return row


def profile(session, row):
    latest = session.scalar(select(CheckInRow).where(CheckInRow.astronaut_id == row.id).order_by(CheckInRow.recorded_at.desc(), CheckInRow.id.desc()).limit(1))
    readings = {key: getattr(latest, key) for key in ("hr", "sleep", "bp", "symptoms")} if latest else {}
    return Astronaut(id=row.id, role=row.role, baseline=row.baseline, sleepBaseline=row.sleepBaseline, provenance=latest.provenance if latest else "Synthetic profile v1", **readings)


def create_app(database_url: str | None = None, *, adapter: InvestigationAdapter | None = None, seed_demo: bool = True):
    default_path = Path(__file__).resolve().parents[1] / "mednav.db"
    url = database_url or os.getenv("MEDNAV_DATABASE_URL", f"sqlite:///{default_path.as_posix()}")
    engine, sessions = create_database(url)

    @asynccontextmanager
    async def lifespan(app):
        Base.metadata.create_all(engine)
        if seed_demo:
            with sessions() as session:
                seed(session)
        try:
            yield
        finally:
            engine.dispose()

    # Disable CDN-backed Swagger/ReDoc so even documentation endpoints are offline.
    app = FastAPI(title="MEDNAV Synthetic Backend", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.sessions = sessions
    app.state.engine = engine
    app.state.investigation_adapter = adapter if adapter is not None else FixtureAdapter()
    app.add_middleware(CORSMiddleware, allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"], allow_methods=["GET", "POST", "PATCH"], allow_headers=["Content-Type"])

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # Do not echo medical input or non-JSON finite values in error responses.
        return JSONResponse(status_code=422, content={"detail": [{"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]} for error in exc.errors()]})

    @app.get("/api/v1/healthz")
    def healthz(session: Session = Depends(db)):
        session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "sqlite", "synthetic": True, "investigation_mode": "adapter"}

    @app.get("/api/v1/astronauts", response_model=list[Astronaut])
    def astronauts(session: Session = Depends(db)):
        return [profile(session, row) for row in session.scalars(select(AstronautRow).order_by(AstronautRow.id))]

    @app.get("/api/v1/astronauts/{astronaut_id}", response_model=Astronaut)
    def astronaut(astronaut_id: str, session: Session = Depends(db)):
        return profile(session, require_astronaut(session, astronaut_id))

    @app.get("/api/v1/astronauts/{astronaut_id}/history", response_model=list[HistoryPoint])
    def history(astronaut_id: str, limit: int = Query(100, ge=1, le=1000), offset: int = Query(0, ge=0), session: Session = Depends(db)):
        require_astronaut(session, astronaut_id)
        rows = session.scalars(select(CheckInRow).where(CheckInRow.astronaut_id == astronaut_id).order_by(CheckInRow.recorded_at, CheckInRow.id).offset(offset).limit(limit))
        return [check_in_dto(row) for row in rows]

    @app.post("/api/v1/check-ins", response_model=CheckIn, status_code=201)
    def create_check_in(body: CheckInCreate, session: Session = Depends(db)):
        require_astronaut(session, body.astronaut_id)
        row = CheckInRow(**body.model_dump(), id=str(uuid4()), recorded_at=datetime.now(timezone.utc), synthetic=True, provenance="Synthetic user-entered MVP check-in")
        session.add(row)
        session.commit()
        return check_in_dto(row)

    @app.get("/api/v1/check-ins/{check_in_id}", response_model=CheckIn)
    def check_in(check_in_id: str, session: Session = Depends(db)):
        row = session.get(CheckInRow, check_in_id)
        if row is None:
            raise HTTPException(404, "Check-in not found")
        return check_in_dto(row)

    @app.get("/api/v1/inventory", response_model=list[InventoryItem])
    def inventory(session: Session = Depends(db)):
        return list(session.scalars(select(InventoryRow).order_by(InventoryRow.name)))

    @app.patch("/api/v1/inventory/{name}", response_model=InventoryItem)
    def update_inventory(name: str, body: InventoryUpdate, session: Session = Depends(db)):
        row = session.get(InventoryRow, name)
        if row is None:
            raise HTTPException(404, "Inventory item not found")
        updates = body.model_dump(exclude_unset=True)
        quantity = updates.get("quantity", row.quantity)
        available = updates.get("available", row.available)
        if quantity == 0 and available:
            raise HTTPException(422, "Zero-quantity equipment cannot be available; set available=false")
        for key, value in updates.items():
            setattr(row, key, value)
        session.commit()
        return row

    @app.post("/api/v1/investigations", response_model=InvestigationResponse)
    def investigate(body: InvestigationRequest, request: Request, session: Session = Depends(db)):
        row = session.get(CheckInRow, body.check_in_id)
        if row is None:
            raise HTTPException(404, "Check-in not found")
        items = [InventoryItem.model_validate(item) for item in session.scalars(select(InventoryRow).order_by(InventoryRow.name))]
        try:
            result = request.app.state.investigation_adapter.investigate(check_in=check_in_dto(row), inventory=items, fixture_id=body.fixture_id)
        except UnknownFixture:
            raise HTTPException(422, "No demo fixture available") from None
        # Validate adapter outputs too, preserving invariants at the integration boundary.
        return InvestigationResponse.model_validate(result)

    return app


app = create_app()
