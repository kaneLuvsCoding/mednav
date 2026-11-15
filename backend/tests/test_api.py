import socket

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select, func

from app.database import CheckInRow
from app.investigation import FixtureAdapter
from app.main import create_app
from app.schemas import InvestigationResponse


@pytest.fixture(autouse=True)
def block_network(monkeypatch):
    """Every test, including startup/seeding, must work without outbound networking."""
    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex
    original_resolve = socket.getaddrinfo

    def guard(method):
        def guarded(sock, address):
            # Windows implements asyncio socketpair using loopback TCP.
            if isinstance(address, tuple) and address[0] in ("127.0.0.1", "::1"):
                return method(sock, address)
            raise AssertionError("External network access is forbidden")
        return guarded

    def resolve(host, *args, **kwargs):
        if host in ("127.0.0.1", "::1"):
            return original_resolve(host, *args, **kwargs)
        raise AssertionError("External DNS access is forbidden")

    monkeypatch.setattr(socket.socket, "connect", guard(original_connect))
    monkeypatch.setattr(socket.socket, "connect_ex", guard(original_connect_ex))
    monkeypatch.setattr(socket, "getaddrinfo", resolve)


@pytest.fixture
def url(tmp_path):
    return f"sqlite:///{(tmp_path / 'test.db').as_posix()}"


@pytest.fixture
def client(url):
    with TestClient(create_app(url)) as client:
        yield client


def test_health_profiles_history_and_offline_schema(client):
    assert client.get("/api/v1/healthz").json()["status"] == "ok"
    profiles = client.get("/api/v1/astronauts").json()
    assert len(profiles) == 3
    crew = profiles[0]
    assert (crew["id"], crew["hr"], crew["baseline"], crew["sleep"], crew["sleepBaseline"], crew["bp"]) == ("Crew A", 88, 70, 4.2, 7.3, None)
    assert all(p["synthetic"] for p in profiles)
    history = client.get("/api/v1/astronauts/Crew%20A/history").json()
    assert len(history) == 7
    assert history[-1]["bp"] is None
    assert history[-1]["recorded_at"].endswith("Z")
    assert [h["recorded_at"] for h in history] == sorted(h["recorded_at"] for h in history)
    assert len(client.get("/api/v1/astronauts/Crew%20A/history?limit=2&offset=2").json()) == 2
    assert client.get("/openapi.json").status_code == 200
    assert client.get("/docs").status_code == 404  # No external-CDN documentation dependency.


def test_null_round_trip_latest_profile_and_restart(url):
    with TestClient(create_app(url)) as c:
        response = c.post("/api/v1/check-ins", json={"astronaut_id": "Crew A", "sleep": 0, "symptoms": [" Fatigue ", "Fatigue"]})
        assert response.status_code == 201
        saved = response.json()
        assert saved["hr"] is None and saved["bp"] is None and saved["sleep"] == 0
        assert saved["symptoms"] == ["Fatigue"]
        item = c.patch("/api/v1/inventory/Blood-pressure%20monitor", json={"available": True})
        assert item.status_code == 200
    with TestClient(create_app(url)) as c:
        assert c.get(f"/api/v1/check-ins/{saved['id']}").json() == saved
        profile = c.get("/api/v1/astronauts/Crew%20A").json()
        assert profile["hr"] is None and profile["sleep"] == 0
        history = c.get("/api/v1/astronauts/Crew%20A/history").json()
        assert len(history) == 8 and history[-1]["id"] == saved["id"]
        assert c.get("/api/v1/inventory").json()[0]["available"] is True
        with c.app.state.sessions() as session:
            assert session.scalar(select(func.count()).select_from(CheckInRow)) == 22


@pytest.mark.parametrize("invalid", [
    {"hr": -1}, {"hr": 0}, {"hr": True}, {"hr": "88"},
    {"sleep": -1}, {"sleep": 25}, {"sleep": "NaN"},
    {"bp": "120"}, {"bp": "120/80"}, {"bp": "normal"},
    {"symptoms": [""]}, {"symptoms": ["   "]}, {"symptoms": None},
    {"diagnosis": "invented"}, {"synthetic": False},
])
def test_validation_rejects_without_persisting(client, invalid):
    response = client.post("/api/v1/check-ins", json={"astronaut_id": "Crew A", **invalid})
    assert response.status_code == 422
    assert len(client.get("/api/v1/astronauts/Crew%20A/history").json()) == 7


def test_valid_bp_is_preserved(client):
    saved = client.post("/api/v1/check-ins", json={"astronaut_id": "Crew A", "bp": "120 / 80", "hr": 88, "sleep": 4.2}).json()
    assert saved["bp"] == "120 / 80"
    assert client.get("/api/v1/astronauts/Crew%20A").json()["bp"] == "120 / 80"


@pytest.mark.parametrize("path", ["/astronauts/missing", "/astronauts/missing/history", "/check-ins/missing"])
def test_unknown_entities(client, path):
    assert client.get("/api/v1" + path).status_code == 404


def test_unknown_references_and_invalid_pagination(client):
    assert client.post("/api/v1/check-ins", json={"astronaut_id": "missing"}).status_code == 404
    assert client.post("/api/v1/investigations", json={"check_in_id": "missing"}).status_code == 404
    assert client.patch("/api/v1/inventory/missing", json={"available": False}).status_code == 404
    for query in ["limit=0", "limit=1001", "offset=-1"]:
        assert client.get("/api/v1/astronauts/Crew%20A/history?" + query).status_code == 422


@pytest.mark.parametrize("body", [{}, {"quantity": -1}, {"quantity": True}, {"quantity": 1.5}, {"quantity": None}, {"available": None}, {"available": "false"}, {"quantity": 0}, {"name": "overwrite"}])
def test_invalid_inventory_updates_are_atomic(client, body):
    initial = client.get("/api/v1/inventory").json()
    assert client.patch("/api/v1/inventory/Crew%20check-in%20tablet", json=body).status_code == 422
    assert client.get("/api/v1/inventory").json() == initial


def test_zero_quantity_and_false_preserved(client):
    response = client.patch("/api/v1/inventory/Crew%20check-in%20tablet", json={"quantity": 0, "available": False})
    assert response.status_code == 200
    assert response.json()["quantity"] == 0 and response.json()["available"] is False


@pytest.mark.parametrize("bits", [f"{n:04b}" for n in range(16)])
def test_finite_investigation_fixtures(client, bits):
    response = client.post("/api/v1/investigations", json={"check_in_id": "demo-A-180", "fixture_id": "MN-" + bits})
    assert response.status_code == 200
    data = response.json()
    assert data["synthetic"] and data["diagnosis"] is None
    assert data["check_in_id"] == "demo-A-180"
    assert data["resource_constraints"]["bp_monitor_available"] is (bits[0] == "1")
    assert data["observations"]["bp"] == ("120 / 80" if bits[1] == "1" else None)
    if bits[3] == "1":
        assert data["status"] == "escalate" and data["next_check"] is None
    elif bits[0] == "0":
        assert "Blood-pressure monitor" not in data["next_check"]["equipment"]


def test_unknown_fixture_and_adapter_injection(url):
    class SpyAdapter:
        def __init__(self):
            self.calls = []

        def investigate(self, **kwargs):
            self.calls.append(kwargs)
            return FixtureAdapter().investigate(**kwargs)

    adapter = SpyAdapter()
    with TestClient(create_app(url, adapter=adapter)) as c:
        assert c.post("/api/v1/investigations", json={"check_in_id": "demo-A-180", "fixture_id": "unknown"}).status_code == 422
        c.post("/api/v1/investigations", json={"check_in_id": "demo-A-180"})
        assert adapter.calls[-1]["check_in"].hr == 88
        assert len(adapter.calls[-1]["inventory"]) == 6


def test_schema_guards_escalation_and_resource_invariants(client):
    data = client.post("/api/v1/investigations", json={"check_in_id": "demo-A-180"}).json()
    data["status"] = "escalate"
    with pytest.raises(ValidationError):
        InvestigationResponse.model_validate(data)
    data["status"] = "review"
    data["next_check"]["equipment"] = ["Blood-pressure monitor"]
    with pytest.raises(ValidationError):
        InvestigationResponse.model_validate(data)


def test_cors_and_no_cloud_database(client):
    response = client.options("/api/v1/check-ins", headers={"Origin": "http://127.0.0.1:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    denied = client.options("/api/v1/check-ins", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"})
    assert denied.status_code == 400
    with pytest.raises(ValueError):
        create_app("postgresql://example/db")


@pytest.mark.parametrize("number", ["NaN", "Infinity", "1e999"])
def test_nonfinite_input_returns_validation_error(client, number):
    response = client.post("/api/v1/check-ins", content='{"astronaut_id":"Crew A","hr":'+number+'}', headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert "detail" in response.json()


def test_offline_guard_is_active():
    with pytest.raises(AssertionError, match="DNS"):
        socket.getaddrinfo("example.org", 443)
    with socket.socket() as sock:
        with pytest.raises(AssertionError, match="network"):
            sock.connect(("192.0.2.1", 443))


def test_empty_database_startup_without_fixtures(url):
    with TestClient(create_app(url, seed_demo=False)) as c:
        assert c.get("/api/v1/healthz").status_code == 200
        assert c.get("/api/v1/astronauts").json() == []
        assert c.get("/api/v1/inventory").json() == []
