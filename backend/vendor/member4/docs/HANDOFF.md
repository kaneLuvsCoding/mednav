# Handoff to Members 2 and 3

## Ready now

Four fictional crew; 30 days each (120 daily records); 4 inventory items; 16 scenarios;
reproducible generator; source provenance; standard-library tests; demo script.
See START_HERE.md. No code outside Member 4 areas was changed. This document is a
handoff deliverable, not a message already sent to teammates.

## Member 2 — backend and integration

- Import the three CSVs, preserving unknown numeric cells as null. Parse booleans
  explicitly. Load into a disposable test database before running integration tests.
- Use only investigation_request from each scenario. The outer scenario fields and
  context.json are test metadata, not additions to API v1.
- Calculate available_equipment from quantity > 0 and usable=true. The inventory API
  test deliberately submits a stale list to verify the backend sanitizes it.
- Keep synthetic labels in /astronauts, /health, /inventory and response evidence.
- Return the agreed error envelope for S13. Do not silently coerce invalid text.
- Provide a test-only adapter callable via MEDNAV_INVENTORY_API_EVALUATOR. It accepts
  (request_dict, inventory_rows), seeds an isolated DB, invokes the real backend path,
  and returns (http_status, response_dict). It must not synthesize a response.
- Other HTTP tests use MEDNAV_API_URL=http://127.0.0.1:8000. Endpoint suffix is appended.
  This changes local test data: never point it at a production/shared database.

## Member 3 — engine

Provide a thin test adapter via MEDNAV_EVALUATOR=module:function. Interface:

```python
# Example structure ONLY; replace imports with your actual production symbols.
def evaluate(request_dict):
    model = InvestigationRequest.model_validate(request_dict)
    return evaluate_investigation(model).model_dump(mode='json')
```

Adapt the real engine's types only; do not hardcode expected responses. Freeze and
record its actual rule version when running comparisons. No example import is assumed.
MEDNAV_CONTEXT_EVALUATOR=module:function additionally accepts (request_dict, context_dict)
and configures the real engine with context['candidate_checks'] for S12.

The tests assert missing measurement reporting, available equipment gating,
synthetic provenance, diagnosis=null, override status/flag/next_check, deterministic
replay and unchanged inputs. Offline execution runs engine import and evaluation
in a fresh interpreter with Python socket calls blocked. Network use via native
libraries/subprocesses needs the separate disconnected-machine test.

## Decisions to resolve together (no silent schema changes)

1. S06: API v1 has one measurement object and no conflicting-record structure.
   context.json supplies two fictional readings only as research/test metadata.
   Agree whether conflicts are resolved from stored records upstream or via an
   approved contract change, then implement its currently skipped test.
2. S12: equipment-free checks remain feasible even with no devices. The empty-catalog
   test therefore needs explicit internal catalog setup, not a new request field.
3. Ordinary statuses are not enumerated by v1. Null expected_status means unpinned;
   confirm a versioned status vocabulary. S04 follows the supplied illustrative response.
4. Expiry is not a v1 inventory field; usable=false covers unusable equipment here.
5. Catalog review/version, rule version and empty-catalog handling need confirmation.
6. Confirm UI missing-value display, explanation wording and no procedural medical
   advice in a manual review; structural tests do not prove text safety.

## Commands

From the project root, with adapter modules on Python's import path:

```sh
python data/generate_seed.py
python tests/member4/run_evaluation.py
```

Set applicable environment variables in your shell before rerunning. On PowerShell,
use `$env:MEDNAV_EVALUATOR='your_test_adapter:evaluate'`; on bash,
use `export MEDNAV_EVALUATOR=your_test_adapter:evaluate`. Use actual module names.
Then run the same evaluation command. No pytest dependency is needed.

Expected current state: fixture/harness checks pass; engine/backend checks skip
until real components are configured. See evaluation_results.json for measured counts.
Do not report skip counts as successful application tests.

## Completion gate

Run real component tests, resolve S06, execute the disconnected UI checklist,
record rule/catalog versions, capture an actual demo, and obtain review before merge.
No performance improvement, successful offline UI flow or clinical outcome is claimed.
