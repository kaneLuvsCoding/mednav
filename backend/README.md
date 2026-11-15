# MEDNAV backend foundation

Python 3.11+, FastAPI, Pydantic 2, SQLAlchemy 2 and local SQLite. Only synthetic data; no backend clinical rules, cloud services, or outbound requests. Frontend and Member 3 files are untouched.

## Start locally (Windows PowerShell)

```powershell
cd C:\Users\ZL_sht_H\NASA_Space_APP_Challenge\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

On Linux/macOS use `python3 -m venv .venv` and `.venv/bin/python` for the Python executable. Installation requires locally cached wheels or network access; runtime does not. Python 3.13.1 was used for verification.

The database defaults to backend/mednav.db, independent of current working directory. Override with `MEDNAV_DATABASE_URL=sqlite:///absolute/path/to/mednav.db` (parent directory must already exist). Startup creates tables and inserts versioned synthetic fixtures once, in a transaction. Restarts do not overwrite observations or inventory edits. Database files and virtual environments are ignored by Git. `create_app(url, seed_demo=False)` starts without seeding for integration tests.

## Endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/v1/healthz` | Server readiness and SQLite query |
| GET | `/api/v1/astronauts` | Seeded profiles with latest observations |
| GET | `/api/v1/astronauts/{astronaut_id}` | Individual profile |
| GET | `/api/v1/astronauts/{astronaut_id}/history` | Persisted history, oldest first; limit/offset |
| POST | `/api/v1/check-ins` | Append synthetic observation, 201 |
| GET | `/api/v1/check-ins/{check_in_id}` | Retrieve persisted observation |
| GET | `/api/v1/inventory` | Synthetic equipment list |
| PATCH | `/api/v1/inventory/{name}` | Change quantity and/or availability |
| POST | `/api/v1/investigations` | Explicit fixture preview through adapter |
| GET | `/openapi.json` | Locally generated API schema |

Unknown entities return 404. Invalid input/unsupported fixture returns 422 with `detail` entries. Null measurements remain null. CDN-backed Swagger/ReDoc pages are disabled so documentation does not silently require internet; use the OpenAPI JSON and examples below.

## Frontend integration examples

Allowed browser origins: http://127.0.0.1:5173 and http://localhost:5173. No credentials needed. The frontend has not been connected automatically. Read CONTRACT_NOTES.md first.

```js
const base = 'http://127.0.0.1:8000/api/v1';
const profiles = await fetch(`${base}/astronauts`).then(r => r.json());
const savedResponse = await fetch(`${base}/check-ins`, {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({astronaut_id: 'Crew A', hr: 88, sleep: 4.2,
    bp: null, symptoms: ['Headache', 'Dizziness', 'Fatigue']})
});
if (!savedResponse.ok) throw await savedResponse.json();
const saved = await savedResponse.json();
const fixtureResponse = await fetch(`${base}/investigations`, {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({check_in_id: saved.id, fixture_id: 'MN-0000'})
});
if (!fixtureResponse.ok) throw await fixtureResponse.json();
const preview = await fixtureResponse.json(); // Scripted scenario, NOT a clinical result.
```

## Member 3 integration seam

Implement `InvestigationAdapter.investigate(check_in=..., inventory=..., fixture_id=...)` and inject using `create_app(adapter=your_adapter)`. It receives validated DTOs detached from API concerns. Return an InvestigationResponse. The schema enforces null diagnosis, review requirement, no next check for escalation, and fixture resource consistency. Backend route validates the output. Real engine exceptions and request versioning must be agreed with Member 3 before integration. No decision engine is implemented here.

The fixture adapter uses exact ID lookup in app/fixtures/investigations.json; it deliberately ignores clinical input and live inventory. For example, MN-1000 displays a simulated available monitor even when the saved inventory has no usable monitor. This is explicitly a sandbox scenario, not an onboard recommendation. No fixture creates a procedure or automatically detects an emergency.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Tests cover API responses, null preservation, validation, finite values, UTC timestamps, idempotent startup, persistence across app recreation, inventory invariants, fixture scenarios, adapter replacement, CORS and offline execution. All tests block external socket connections and DNS; loopback is allowed only because Windows asyncio needs it for its wake-up socket. Tests use temporary file databases.

## Structure / next dependencies

- app/main.py: application factory, lifespan, routes, local CORS.
- app/schemas.py: request/response DTOs and representation validation.
- app/database.py: SQLAlchemy tables, SQLite/session setup.
- app/seed.py and app/fixtures/: synthetic seed and explicit mock scenarios.
- app/investigation.py: replaceable adapter protocol and exact-fixture mock.
- tests/test_api.py: isolated API/integration coverage.
- CONTRACT_NOTES.md: proposed contract and unresolved decisions.

Member 1: agree DTO shapes and connect UI via API adapter. Member 3: supply the decision-engine adapter contract/implementation. Member 4: supply approved synthetic datasets with provenance; introduce a new seed version or migration deliberately, never overwrite saved observations. Team: provide the missing shared contract and ownership/integration documents.

## Executed verification (2026-11-14)

- Python 3.13.1: `.venv/Scripts/python.exe -m pytest -q` — 56 passed in 10.48 seconds; one upstream Starlette/AnyIO deprecation warning.
- `.venv/Scripts/python.exe -m pip check` — no broken requirements.
- `.venv/Scripts/python.exe -m compileall -q app` — passed.
- Real Uvicorn on 127.0.0.1:8000: healthz, profiles (3), Crew A history (7), inventory (6), and OpenAPI each returned HTTP 200.
- Live POST investigations with MN-0001 returned HTTP 200, status=escalate, next_check=null, diagnosis=null.
- Working branch: feature/backend-foundation. Changes confined to backend/. Frontend unchanged.
