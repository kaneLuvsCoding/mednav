# MEDNAV — Member 3 Decision Engine: Stable v1 Handoff & Integration Guide

**Project:** MEDNAV — Offline, Resource-Aware Astronaut Health Decision Support  
**Scope:** Member 3's `engine/` Python package  
**Release label:** `member3-stable-v1` (suggested Git tag/PR label; not a claim of full application release)  
**API contract:** `API_CONTRACT.md` v1  
**Engine rule version:** `demo-2`  
**Dataset:** Synthetic demonstration data only  
**Status:** Standalone engine implemented and tested; **real Member 2 backend, SQLite and Member 1 UI integration remain to be verified**  
**Last local verification:** 2026-11-14; Python 3.13.5; 35/35 unit tests passed

> **Safety notice:** This is a hackathon research prototype, **not clinical software**. It does not diagnose disease, prescribe treatment, calculate clinical risk probabilities, automatically determine medical emergencies or control spacecraft systems. All checklist actions are prototype navigation entries, not mission-approved medical procedures. An explicit `emergency_override` directs the user toward the mission-approved emergency workflow and crew medical officer.

---

## 1. What is implemented right now?

Member 3 has built a **deterministic, offline investigation engine**. Given a fictional astronaut check-in, individual baseline and equipment availability, it returns an explainable **next permissible check** or an explicit escalation/abstention outcome.

| Implemented capability | What it actually does | Main file |
|---|---|---|
| Request validation | Validates required types, aware timestamps, nonnegative supported measurements, daily sleep not exceeding 24 hours, distinct equipment IDs and `dataset_type="synthetic"` | `engine/models.py` |
| Baseline observations | Compares current available readings with supplied personal baseline and describes above/below changes; not a diagnosis or longitudinal prediction | `engine/next_check.py` |
| Missing-data awareness | Lists absent or `null` measurements as unknown; never substitutes normal/zero | `engine/next_check.py` |
| Evidence quality | Internally flags stale/conflicting records when trusted metadata is supplied; detects a reversed BP pair | `engine/next_check.py` |
| Safety override | On explicit `emergency_override=true`, returns `escalate`, no `next_check`, and no normal candidate ranking | `engine/next_check.py` |
| Equipment eligibility | Filters checks against allowed equipment and optional inventory quantity, usability and expiration | `engine/next_check.py` |
| Context-aware check selection | Scores matching **prototype** checklist entries using synthetic information benefit minus time/resource costs | `engine/rules.py`, `engine/next_check.py` |
| Explainable result | Returns observations, missing data, constraints, flags, choice, explanation, source labels and `diagnosis: null` | `engine/next_check.py` |
| Internal decision trace | Keeps candidate eligibility/rejection reasons and utility components for audit/debugging; **not an API v1 response field** | `engine/next_check.py` |
| What-if simulator | Locally compares before/after results for BP monitor, emergency override or communication status changes | `engine/whatif.py` |
| Checklist comparison | Compares navigation order with a fixed-order checklist using the same eligible catalog | `engine/compare.py` |
| Synthetic benchmark | Replays 16 labeled scenarios and reports implementation/navigation metrics with denominators | `engine/benchmark.py` |
| Automated tests | Covers API response shape, safety, resources, missing values, deterministic selection, evidence flags, benchmark and a test-only FastAPI adapter | `engine/tests/` |

**Five current prototype check IDs:**

1. `symptom_review_checklist` — open symptom review form.
2. `review_sleep_workload` — review recorded sleep history.
3. `measure_blood_pressure` — open prototype BP measurement workflow; requires `bp_monitor`.
4. `review_equipment_status` — review locally recorded equipment status.
5. `contact_medical_officer` — open onboard medical-officer handoff.

**Important:** The engine **selects/navigation-links to a check**; it does **not** perform a measurement, send a medical message, execute an emergency protocol, or track completed checklist steps. The frontend/backend must not misrepresent these actions as already performed.

---

## 2. Files and ownership

From the shared **repository root**, keep this shape:

```text
mednav/
├── AGENTS.md
├── API_CONTRACT.md
├── PROJECT_SPEC.md
├── ARCHITECTURE.md
├── engine/                         # Member 3 — keep this folder intact
│   ├── __init__.py                 # Public imports
│   ├── __main__.py                 # CLI runner
│   ├── models.py                   # Pydantic request/response models
│   ├── rules.py                    # Versioned synthetic checklist catalog
│   ├── next_check.py               # Main engine and decision trace
│   ├── whatif.py                   # Local what-if CLI
│   ├── compare.py                  # Fixed-order comparison
│   ├── benchmark.py                # Reproducible benchmark
│   ├── requirements.txt
│   ├── README.md
│   ├── UPGRADE.md
│   ├── examples/
│   │   ├── checkin.json
│   │   ├── benchmark.json
│   │   └── benchmark-results.json
│   └── tests/
│       ├── test_engine.py
│       ├── test_upgrade.py
│       └── test_compare.py
├── backend/                        # Member 2
├── frontend/                       # Member 1
├── data/                           # Member 4
└── MEMBER_3_STABLE_V1_HANDOFF.md   # This guide
```

**Extracting the provided ZIP:** Its internal root folder is named `member 3/`. Copy **the contents needed**, especially `member 3/engine/`, into the **shared** repository root; do **not** nest the package as `mednav/member 3/engine/` if the commands below are to work. Shared project specifications may already exist: do not overwrite teammates' copies without review.

Do **not** commit generated `__pycache__/`, `.pytest_cache/` or `*.pyc` files. A project `.gitignore` should exclude these.

---

## 3. Quick start — run the engine alone (any team member)

**Requirements:** Python **3.11+**; a terminal opened at the repository root (the directory containing `engine/`). Install packages **before** disconnecting from the internet. Runtime evaluation itself makes no network calls.

```powershell
# Windows PowerShell; run from mednav/ (repository root)
python -m pip install -r engine/requirements.txt

# Sample contract request → JSON response
python -m engine

# Optional: pass your own API v1 request fixture
python -m engine engine/examples/checkin.json

# What-if demonstrations
python -m engine.whatif monitor
python -m engine.whatif emergency
python -m engine.whatif communication

# Checklist navigation comparison
python -m engine.compare

# Full hand-labeled benchmark (prints JSON)
python -m engine.benchmark

# All Member 3 automated tests
python -m pytest -q engine/tests
```

**Verified result from the uploaded source:**

```text
...................................                                      [100%]
35 passed in 0.26s
```

Observed local benchmark summary for the uploaded source:

| Metric | Result |
|---|---:|
| Synthetic scenarios | 16 |
| Exact expected selections/status/missing-set matches | 16 / 16 |
| Deterministic replays | 16 / 16 |
| Expected missing-field detections | 26 / 26 |
| Explicit emergency override cases handled | 2 / 2 |
| Reported infeasible selections | 0 |
| Reachable target scenarios in fixed-order comparison | 11 |
| Total forms opened to those targets — fixed order | 23 |
| Total forms opened to those targets — MEDNAV | 12 |

These are **software/synthetic-fixture results**, not clinical performance or independently proven information gain. Benchmark targets are often derived from hand-labeled expected selections; do not report a medical accuracy percentage or claim improved health outcomes.

### Expected output for `python -m engine`

The bundled `engine/examples/checkin.json` contains synthetic Crew `A01`: headache/dizziness, HR 88 vs baseline 70, sleep 4.2 vs baseline 7.3, unknown BP values, and **no usable `bp_monitor` in the allowed list**. The output includes:

```json
{
  "status": "needs_review",
  "missing_data": ["systolic_bp_mm_hg", "diastolic_bp_mm_hg"],
  "resource_constraints": ["bp_monitor unavailable"],
  "safety_flags": [],
  "next_check": {
    "id": "symptom_review_checklist",
    "label": "Open the symptom review form",
    "requires_equipment": [],
    "prototype_only": true
  },
  "requires_medical_officer_review": true,
  "diagnosis": null
}
```

This is a **selected-fields excerpt**, not the entire API response. The complete output also contains `observations`, `explanation` and `evidence_sources`. Use the actual generated JSON, not this excerpt, for contract testing.

---

## 4. Integration contract — DO NOT invent field names

Member 2 owns `API_CONTRACT.md` v1. The engine does **not** implement HTTP endpoints or a database. Member 2's FastAPI layer must call the Python function and expose the agreed path:

**`POST /api/v1/investigations`**

The engine accepts the following **complete** example request:

```json
{
  "astronaut_id": "A01",
  "observed_at": "2026-11-14T09:00:00+06:30",
  "symptoms": ["headache", "dizziness"],
  "measurements": {
    "resting_hr_bpm": 88,
    "sleep_hours": 4.2,
    "systolic_bp_mm_hg": null,
    "diastolic_bp_mm_hg": null
  },
  "personal_baseline": {
    "resting_hr_bpm": 70,
    "sleep_hours": 7.3
  },
  "available_equipment": ["thermometer"],
  "communication_status": "offline",
  "emergency_override": false,
  "dataset_type": "synthetic"
}
```

**Official `InvestigationResponse` fields (keep all):**

| Field | Meaning for UI / API |
|---|---|
| `status` | `needs_review`, `insufficient_evidence`, or `escalate` |
| `observations` | Recorded observations/baseline differences; not diagnoses |
| `missing_data` | Field IDs whose current measurement is absent or `null` |
| `resource_constraints` | Equipment-related reasons for excluding a candidate |
| `safety_flags` | Explicit safety flags; on manual override includes `approved_emergency_protocol_required` |
| `next_check` | A prototype check object, or `null`; check object has `id`, `label`, `requires_equipment`, `prototype_only` |
| `requires_medical_officer_review` | Boolean flag for UI; **does not send an alert by itself** |
| `explanation` | Why the check was chosen or why the engine abstained/escalated |
| `evidence_sources` | Synthetic observation/rule/catalog provenance labels |
| `diagnosis` | Always `null` in current MVP |

**Safety invariants across teams:**

- `null` is unknown, **not** normal or zero.
- Never recommend a check requiring equipment absent from sanitized usable inventory.
- `emergency_override=true` → `status="escalate"`, `next_check=null`, `requires_medical_officer_review=true`; no optional ranking.
- `next_check=null` must have an honest no-check/escalation UI state.
- `dataset_type` for crew scenarios is `synthetic`; do not label demo readings as NASA astronaut telemetry.
- Same validated input + same rule/catalog version + same supplied inventory/evidence metadata → same output.
- No auto diagnosis, prescription or unapproved medical procedures.

**Versions:** Git release label `member3-stable-v1` is only a package snapshot name. It does **not** change API v1 or internal `Rules(version="demo-2")` / catalog `prototype:mednav_catalog_v2`.

---

## 5. Member 2 — Backend/FastAPI integration

### 5.1 Minimal import (stable public interface)

```python
from engine import InvestigationRequest, InvestigationResponse, InventoryItem, evaluate_investigation

# payload: dictionary matching API_CONTRACT.md v1
request = InvestigationRequest.model_validate(payload)
result: InvestigationResponse = evaluate_investigation(request)
response_json = result.model_dump(mode="json")
```

The **actual callable** is:

```python
evaluate_investigation(
    request: InvestigationRequest,
    candidate_checks=None,
    inventory=None,
    rules=Rules(),
    *,
    evidence=None,
) -> InvestigationResponse
```

For the normal MVP, call `evaluate_investigation(request, inventory=inventory_snapshot)` after sanitizing inventory. Optional `candidate_checks` is an allowlist of current catalog IDs (`None` = use the full catalog; `[]` = no eligible candidates). **Do not** pass a separate list of arbitrary medical instructions.

### 5.2 Small test-only route example

This snippet is useful to confirm the HTTP → engine → JSON round trip. It is **not the final production route** because it does not read SQLite, sanitize inventory or save a report.

```python
from fastapi import APIRouter
from engine import InvestigationRequest, InvestigationResponse, evaluate_investigation

router = APIRouter(prefix="/api/v1")

@router.post("/investigations", response_model=InvestigationResponse)
def investigate(payload: InvestigationRequest):
    return evaluate_investigation(payload)
```

Include that router in your actual FastAPI app and ensure **one** `/api/v1/investigations` route exists. Do not introduce a second endpoint version.

### 5.3 What production Member 2 must additionally do

1. Read trusted inventory rows from SQLite and validate them as `InventoryItem` objects (`equipment_id`, `quantity`, `usable`, optional `expires_on`). `dataset_type` from the public inventory response is **not** an `InventoryItem` field: omit it when constructing this internal model.
2. Compute `available_equipment` from **usable, positive-quantity, non-expired** rows as of the check-in date; do not trust arbitrary availability claimed by the browser.
3. Create a new validated request with the sanitized `available_equipment`, then pass the **same inventory snapshot** to `evaluate_investigation` so the engine can independently apply its intersection filter.
4. Save the check-in, returned response, incident ID, timestamps and inventory/rule provenance in SQLite. Enable `GET /api/v1/reports/{incident_id}` to reopen the saved result.
5. Map request validation errors to the agreed envelope, e.g. HTTP 422 `{"error":{"code":"validation_error","message":"..."}}`. Handle internal errors separately; do not silently swallow them.
6. Use a stable repo-root Python import path (the `engine/` package should be a sibling of `backend/`). Do not copy engine logic into backend controllers.
7. Verify repeated requests, server restart persistence, emergency and resource shortage in the **real** backend tests. The Member 3 repository includes only a **test-only ASGI/FastAPI adapter**, not verified application integration.

**Example inventory sanitization logic** (adapt the database read to your project):

```python
from engine import InvestigationRequest, InventoryItem, evaluate_investigation


def evaluate_with_db_inventory(api_payload: dict, db_rows: list[dict]):
    original = InvestigationRequest.model_validate(api_payload)
    snapshot = [
        InventoryItem(
            equipment_id=row["equipment_id"],
            quantity=row["quantity"],
            usable=row["usable"],
            expires_on=row.get("expires_on"),
        )
        for row in db_rows
    ]
    usable = sorted({
        item.equipment_id
        for item in snapshot
        if item.usable and item.quantity > 0
        and (item.expires_on is None or item.expires_on >= original.observed_at.date())
    })
    trusted = InvestigationRequest.model_validate({
        **original.model_dump(),
        "available_equipment": usable,
    })
    return evaluate_investigation(trusted, inventory=snapshot)
```

This helper is illustrative and does **not** replace DB transaction handling, permissions, persistence or the final FastAPI route. It uses the exact engine models in the ZIP.

### 5.4 Optional internal audit metadata (no API contract change)

The engine supports additional **Python-only** inputs:

```python
from engine.next_check import EvidenceMetadata, investigate_with_trace

# Example only: provide these flags from verified incident/source records.
trace = investigate_with_trace(
    request,
    evidence={
        "sleep_hours": EvidenceMetadata(
            valid_until="2026-11-14T08:00:00+06:30",
            conflicting=False,
            source_verified=True,
        )
    },
)
result = trace.response
```

`trace.field_quality`, `trace.candidates` and `trace.disposition` are **internal Python data**, not approved API v1 response fields. The backend would need a reviewed contract change before exposing them to the frontend. Evidence metadata must come from trustworthy, matched source records; do not fabricate it for live results.

---

## 6. Member 1 — Frontend integration and acceptance

Member 1 owns form/optional voice capture and response rendering. **The frontend must not run its own medical decision or select a next check independently.**

1. Select a fictional astronaut, show synthetic history and collect symptoms/measurements (including **Unknown** explicitly).
2. Send a JSON request matching section 4 to Member 2's **`POST /api/v1/investigations`**; use the API base URL configured by Member 2. Voice-to-text, if added, only fills fields after user confirmation.
3. Display `observations`, `missing_data`, `resource_constraints`, `safety_flags`, `next_check` and `explanation`; indicate synthetic/prototype source labels.
4. When `status="needs_review"`, show the chosen **prototype navigation action**. Never claim the check has been performed.
5. When `status="escalate"`, visibly show a mission-approved emergency **handoff notice**, not generated treatment instructions.
6. When `status="insufficient_evidence"` or `next_check=null`, display **No permissible next check selected**; never render a blank or fake check.
7. Distinguish `requires_medical_officer_review` as a **review-needed flag**, not proof that a medical officer was contacted.
8. Use Member 2's persisted report endpoint to show saved incidents when that backend feature exists.

**Frontend smoke-test cases:** bundled example request; repeat with `emergency_override=true`; repeat with sanitized BP monitor availability toggled in backend inventory; show unknown BP as unknown throughout.

---

## 7. Member 4 — Synthetic fixtures, evaluation and QA

Member 4 owns the production synthetic records, documentation and cross-team demo evaluation. Member 3's fixtures are **examples**, not a substitute for Member 4's full dataset.

1. Read `engine/examples/checkin.json` and `engine/examples/benchmark.json` for field spelling and scenario patterns.
2. Preserve `dataset_type="synthetic"` on fictional crew data; keep NASA research claims/sources in separately labeled metadata.
3. Supply 4 fictional astronauts, at least 30 synthetic mission days, equipment inventory and at least 12 independent scenarios, as required by `PROJECT_SPEC.md`.
4. Run `python -m pytest -q engine/tests` and `python -m engine.benchmark`; record **actual** counts and denominators.
5. Add independent/held-out cases with predeclared expected outputs, including missing BP, monitor absent, monitor expired/unusable, conflicting records, explicit emergency override, no eligible check, offline mode and repeated inputs.
6. Verify the benchmark's meaning: **forms opened to a synthetic target**, **not** clinical accuracy or real evidence improvement. Some targets in the bundled benchmark default to the labeled expected selection; disclose this limitation.
7. After Member 2 integrates, test **UI → API → engine → persisted report → UI** and disconnect from the internet to prove the primary demo flow is local.

**Handoff limit:** Changing a public field/schema requires approval through Member 2's contract process; updating Member 4 data should not silently change engine API assumptions.

---

## 8. End-to-end integration smoke test (all members)

**Prerequisite:** Member 2 has the actual FastAPI app running locally and confirms its host/port; commands below assume `http://127.0.0.1:8000`. If a different port is used, adjust the URL. The engine package alone does **not** start this server.

### Case A — ordinary investigation

Windows PowerShell, from repo root:

```powershell
$body = Get-Content .\engine\examples\checkin.json -Raw
$result = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/v1/investigations' `
  -Method Post -ContentType 'application/json' -Body $body
$result | ConvertTo-Json -Depth 10
```

Expected for the example **when the backend has no usable BP monitor and passes equivalent sanitized inventory**:

- HTTP success; `status = needs_review`.
- `missing_data` includes both BP fields.
- `resource_constraints` includes `bp_monitor unavailable`.
- `next_check.id = symptom_review_checklist`.
- `next_check.requires_equipment` is empty.
- `diagnosis = null`.

### Case B — explicit emergency override

```powershell
$payload = Get-Content .\engine\examples\checkin.json -Raw | ConvertFrom-Json
$payload.emergency_override = $true
$body = $payload | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/v1/investigations' `
  -Method Post -ContentType 'application/json' -Body $body
```

Expected: `status=escalate`; `next_check=null`; `requires_medical_officer_review=true`; `safety_flags` contains `approved_emergency_protocol_required`.

### Case C — inventory changes the eligible action

- Set the **backend's actual inventory** to make `bp_monitor` usable, quantity > 0, and non-expired.
- Re-send the original synthetic check-in. Backend must recompute its trusted `available_equipment` from inventory.
- With the bundled `demo-2` rules and otherwise identical values, `measure_blood_pressure` is the selected prototype action; **BP readings remain missing** until a measurement is actually supplied.
- Remove/disable the monitor and repeat. The engine must never select a check requiring a now-unavailable monitor.

### Case D — validation errors

- Send an invalid measurement (e.g. `sleep_hours: 30`) or a timestamp without timezone.
- Expect HTTP 422 and the agreed `error.code=validation_error` envelope in Member 2's actual API.

### Case E — persistence and offline

- Save an investigation and reopen it with Member 2's `GET /api/v1/reports/{incident_id}` endpoint.
- Restart backend, reopen the same report and compare saved content.
- Disable internet connectivity (keeping localhost services running), repeat Case A and confirm frontend → local API → engine still works.

**Pass criteria:** Every tested action is explicitly supported by usable inventory; unknowns are not disguised; emergency precedence is preserved; UI shows correct status; saved reports reopen after restart; core workflow works without external services.

---

## 9. Known limits / do not overclaim

- **No completed-check state / multi-step session** in this stable version. Repeating the same input may select the same check. A future multi-step feature needs an agreed session contract and persistence.
- **No real longitudinal trend engine**: current/baseline comparison is simple value comparison, not clinical time-series analysis.
- **Precision-sensitive comparison**: even a very small nonzero difference from baseline can affect synthetic utility; no clinically validated tolerance exists.
- **Input validation is partial**: supported measurements get basic nonnegative/sleep-window checks, but arbitrary measurement keys are currently possible and no universal clinical ranges are claimed.
- **Explicit emergency only**: arbitrary symptoms are not clinically classified as an emergency; `emergency_override` is a trusted scenario/reviewed-protocol trigger.
- **No live devices or speech recognition in Member 3**: Member 1 owns form/optional voice, Member 2 owns API/database; neither is supplied by this engine.
- **No auto messaging**: `contact_medical_officer` is a navigation/handoff entry; it does not communicate with Earth or send a message.
- **Metadata provenance**: stale/conflicting/source-verified flags require trusted per-field metadata from an adapter. A verified source label does not turn synthetic values into genuine NASA crew data.
- **What-if is local CLI-level**, not integrated into the public HTTP contract; the monitor scenario toggles allowed-equipment membership, not an actual SQLite inventory snapshot.
- **Benchmark limits**: 16 synthetic hand-labeled cases; navigation/form-count metrics only; no medical accuracy, clinical safety or health-outcome evidence.
- **API integration is not complete**: Member 3 has a test-only FastAPI/ASGI serialization test, not Member 2's complete deployment, inventory adapter or SQLite tests.

If additional improvements are developed, keep them on a separate feature branch and preserve this stable snapshot for integration. Do not break API v1 just to add internal diagnostics.

---

## 10. Suggested GitHub handoff workflow

Member 3 should **not push directly to `main`**. Use the shared integration rules in `INTEGRATION_WORKFLOW.md`.

```powershell
# Run from shared repository root

git switch -c feature/decision-engine

# Copy engine/ and this markdown guide into the repository first.
# Ensure the shared .gitignore includes: __pycache__/, .pytest_cache/, *.pyc
# The source ZIP contains cache folders that should NOT be committed.
git status

git add engine MEMBER_3_STABLE_V1_HANDOFF.md
# Inspect staged paths and unstage any generated cache files before committing.
git diff --cached --name-only

git commit -m "feat(engine): hand off tested member 3 stable v1"

git push -u origin feature/decision-engine
```

Open a PR to Member 2 / team reviewers. PR description should include:

- What was implemented (section 1).
- Public callable + API contract version (sections 4–5).
- Test command and observed 35/35 result (section 3).
- Sample JSON fixture and expected output (sections 3–4).
- How to integrate/test (sections 5–8).
- Known limitations (section 9).

After review/merge, the team can create a release tag such as `member3-stable-v1` on the approved commit if desired; **a Git tag is not the same as the internal engine rules version**.

### Team readiness checklist

- [ ] `engine/` is importable from repo root with `from engine import evaluate_investigation`.
- [ ] `python -m pytest -q engine/tests` passes on the team checkout.
- [ ] Member 2's actual `/api/v1/investigations` endpoint returns full contract response.
- [ ] Backend uses sanitized, usable, positive-quantity, non-expired inventory.
- [ ] Member 1 renders normal, `insufficient_evidence` and emergency states safely.
- [ ] Member 4 records actual independent test outcomes and NASA source provenance.
- [ ] Saved incident can be reopened from SQLite after a backend restart.
- [ ] End-to-end MVP runs locally without internet; source data remain labeled synthetic.

**Bottom line:** Member 3 Stable v1 is ready for **team integration testing**, not yet a claim that the full MEDNAV application is integrated, medically validated or production-ready.
