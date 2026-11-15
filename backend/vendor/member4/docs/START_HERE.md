# MEDNAV Member 4 starter package

Hackathon prototype, not clinically validated. All crew, inventory and health values
are fictional and labeled synthetic. No NASA astronaut telemetry is included.

Merge the data/, docs/ and tests/member4/ directories into the project after review.
Do not replace other members' files. Shared root README and API contract are untouched.
Use feature/data-testing in the team's repository; Member 2 coordinates merge.

## Quick start (Python 3.11+, no package installation)

Run from the project/package root:

```sh
python data/generate_seed.py
python tests/member4/run_evaluation.py
```

The first command deterministically recreates seed files; it overwrites only its own
synthetic CSV/JSON, scenarios/context and provenance files. The second executes tests
and writes docs/evaluation_results.json. A green exit with skips is NOT integration success.

## Contents

- data/synthetic/: 4 crew, 120 records, 4 inventory items, historical baselines.
- data/scenarios/scenarios.json: 16 independent cases with API request objects.
- data/scenarios/context.json: out-of-band inventory and catalog setup, never sent as API fields.
- data/sources/provenance.json: origin, transformations and limitations.
- tests/member4/: fixture checks and real-component integration contracts.
- docs/HANDOFF.md: adapter interfaces, team decisions and run instructions.
- docs/research_sources.md: verified references and resource-tab retrieval limitation.
- docs/demo_script.md: conditional 90-second live demonstration.
- docs/evaluation.md: interpretation and pending evaluation procedure.

## Import details

CSV uses UTF-8, headers and LF line endings. Empty numeric cells mean unknown;
convert them to None / JSON null. Never coerce missing numbers to zero. Parse
reported_symptoms using JSON; parse usable by equality with 'true', not bool(text).
Stock is available only when quantity > 0 AND usable is true. Expiry is not part of
v1; map a separately verified unusable/expired item to usable=false upstream.
Timestamps are ISO-8601 with +06:30. Heart rate is bpm, sleep is hours, BP is mmHg.

Scenario personal_baseline values are independent supplied test inputs. The historical
baselines file uses the first seven daily records (2026-10-16 through 2026-10-22).
It must not be silently substituted into scenarios. There are no medical cutoffs.

Only investigation_request goes to POST /api/v1/investigations. expected_status=null
means the ordinary status is not specified by the supplied contract, not that the
API should return null. Tests still enforce shape, missing data, feasibility,
no diagnosis and provenance. S04 uses the example's needs_review status; S10/S16
require escalate; S12 requires insufficient_evidence after empty-catalog setup.
