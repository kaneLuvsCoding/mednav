# MEDNAV Member 3 decision engine

## Run locally

Use Python 3.11+ from the directory containing engine. Install dependencies before disconnecting. For a preloaded wheel directory add --no-index --find-links wheelhouse to pip install.

```powershell
python -m pip install -r engine/requirements.txt
python -m engine
python -m engine.whatif monitor
python -m engine.whatif emergency
python -m engine.whatif communication
python -m engine.compare
python -m engine.benchmark
python -m pytest -q engine/tests
```

Pass a request JSON file after the what-if option or directly to python -m engine. All commands read local files. See examples/checkin.json for API v1 input and examples/benchmark.json for the hand-labeled evaluation cases. Benchmark output includes per-case paths, expected selections and denominators.

## API handoff

```python
from engine import InvestigationRequest, evaluate_investigation

def investigate(payload: dict) -> dict:
    request = InvestigationRequest.model_validate(payload)
    return evaluate_investigation(request).model_dump(mode="json")
```

Member 2 supplies the sanitized available_equipment from usable inventory and persists the response. Member 1 can display observations, missing_data, resource_constraints and explanation from POST /api/v1/investigations. API v1 uses needs_review for ordinary checklist navigation. A complete check-in with no symptoms or quality flags returns requires_medical_officer_review=false and explicit routine-review wording. An override returns escalate and skips candidate evaluation. An empty candidate allowlist returns insufficient_evidence on the ordinary path.

For audit or local UI prototypes import investigate_with_trace and EvidenceMetadata from engine.next_check. The trace includes the response, field_quality, candidate eligibility reasons, utility components and disposition. This internal Python interface adds no HTTP fields. Member 2 may attach trusted per-field metadata using evidence={"sleep_hours": EvidenceMetadata(valid_until=..., source_verified=True)}. valid_until is an offset-aware timestamp supplied by the provider. No freshness window is assumed. Conflicting repeated records must be matched to this check-in upstream and marked conflicting=True. A verified source is still synthetic. Keep the metadata associated with the recorded incident for replay.

A supplied inventory snapshot uses one InventoryItem per aggregated equipment ID. Quantity must be positive, usable true and expiry on or after the incident's local date. Duplicate IDs are rejected. Snapshot rows can restrict the sanitized allowlist. Earth communication status never blocks an onboard form or the onboard medical officer workflow.

## How the five prototype checks are ranked

The manual emergency gate precedes inventory filtering and scoring. Candidate restrictions, evidence applicability and equipment feasibility apply before utility. Data validation rejects incompatible units (negative supported measurements, daily sleep above 24 hours), timezone-free timestamps and duplicate available-equipment IDs. Reversed BP pairs are flagged for source review. Missing is distinct from zero. A stale/conflicting measurement is shown as present with a quality flag, and its baseline comparison is withheld. The engine compares current values with supplied individual baselines. Clinical thresholds and trend inference are outside this calculation.

| Check | Synthetic information benefit | Time / resource cost |
|---|---|---|
| Symptom form | 2 + distinct symptom count capped at 2 to bound the effect of multiple entries | 1 / 0 |
| Sleep review | 1 for an available usable record, plus 2 for a difference from the supplied baseline | 1 / 0 |
| BP workflow | 2 + 2 per unknown or flagged BP field, giving more weight to a check covering two gaps | 2 / 1 |
| Equipment review | 2 for a blocked BP workflow when at least one measurement is present | 1 / 0 |
| Onboard officer handoff | 4 + number of distinct flagged current fields, or 6 for a conflicting baseline pair | 1 / 0 |

Utility subtracts 0.5 per time or resource unit. Equal utility resolves alphabetically by ID. These are declared prototype preferences. A score measures the navigator's priorities and carries no clinical interpretation. Rule and catalog identifiers appear in evidence_sources. Archived v1 results should retain their recorded versions.

## Judge demo and evaluation

Run the monitor what-if. Compare before and after on the same fictional check-in. Both BP readings stay unknown when the monitor becomes available, and only the proposed next action changes. Run the emergency what-if to show an empty candidate trace. Run the communication variant to show that an Earth connection is unnecessary.

The benchmark merges each fixture's measurement patch into the same versioned example and uses explicit per-case expected outputs. Both navigators share eligibility gates and cost-free exclusion of unusable resources. The fixed order is the published catalog order. The evaluation counts forms opened to a specified synthetic target assuming no new readings arrive between openings. Unreachable targets are reported separately. Most targets are the expected checklist, so this is an implementation and navigation benchmark on selected examples. Independent held-out scenarios and observations acquired after each action remain for Member 4 validation.

NASA's Earth-Independent Medical Operations concept documents communication delays and limited resources as design constraints. The reproducible dataset here consists of synthetic fixtures. NASA provided no crew readings, scoring coefficients or approved medical checklist for this software. [NASA NTRS, EIMO Concept of Operations](https://ntrs.nasa.gov/citations/20250000009)

## Verification and remaining integration

The socket-free FastAPI adapter test passes synthetic POST requests through actual routing, validation and response serialization. Member 2 still needs to verify its inventory adapter, SQLite persistence, HTTP error mapping and saved incident reopening. The frontend can then test both ordinary and emergency responses. Keep the public API contract under Member 2 ownership. Clinical validation and actual emergency protocol content are outside this package.
