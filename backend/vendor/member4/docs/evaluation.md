# Evaluation method and limits

The executable report is evaluation_results.json. It counts test methods, with
subtest failure/skip events collapsed to their parent method. A skipped method is
not a pass. These counts are not scenario-level accuracy or clinical validation.
No application implementation was available during package preparation.

## What runs now

Fixture shape, four fictional profiles, 30 unique days each, unknown-value encoding,
synthetic labels, inventory-context consistency and byte-identical regeneration.
The harness also verifies that its response checker rejects selected bad outputs
and its Python socket guard rejects a connection attempt. These are harness tests,
not measured engine behavior. The local shape validator is not the authoritative
Pydantic schema; Member 2's actual API validation remains to be run.

## Real-component tests implemented but pending

- Missing measurements are included in missing_data.
- No unavailable equipment in next_check; BP check cannot hide its dependency.
- Manual override sets escalate, null next_check, required review and safety flag.
- Identical inputs at the same engine version yield identical full responses.
- Fresh-process engine import and S09 evaluation with Python sockets blocked.
- Invalid API field produces a validation_error envelope.
- Backend strips stale availability using seeded usable inventory.
- Empty candidate catalog produces insufficient_evidence without a next check.

S06 is explicitly blocked by an unresolved contract representation. Some ordinary
statuses are deliberately not pinned; shape and safety invariants still apply.
The test suite cannot establish clinical wording safety, absence of all possible
hidden native network calls, browser asset independence or clinical validity.

## Engineering metrics to collect after integration

Use scenario IDs and rule/catalog versions for every result. Report numerator and
denominator, never an unexplained percentage:

| Metric | Numerator / denominator |
|---|---|
| Resource-feasibility violations | Outputs using unavailable equipment / evaluated non-null next checks |
| Missing measurement recall | Expected null measurement fields reported missing / deliberately null fields evaluated |
| Override compliance | Override cases satisfying all override invariants / override cases evaluated |
| Determinism | Exact matching replay pairs / replay pairs evaluated |
| False alerts in synthetic normals | Reviewed false alerts / predeclared normal scenarios evaluated |

Keep denominators zero/unavailable if no eligible case ran. The current package
contains no fabricated values for these metrics.

## Fixed-order comparison (pending Member 3 catalog)

Freeze one shared reviewed/prototype candidate catalog and one declared fixed order
before running evaluation. Both systems receive the same scenario inputs, safety
overrides and synthetic evidence target. Do not rig the baseline by disabling
safety. State whether the fixed order includes resource filtering; use the same
eligibility filter for a fair ranking-only comparison. Report skipped/infeasible
checks separately if examining an equipment-agnostic variant.

Have Member 3 declare each synthetic target and the evidence revealed by each check
before running either method. Count checks until that target, with explicit unmet
or censored outcomes; do not assume every scenario can reach it. Log actual traces
and versions under docs/ before claiming improvement. No comparison has been run.

## Full-app disconnected test — pending integrated application

1. Install dependencies and bundle assets while connected; seed a disposable local DB.
2. Start local UI and API. Disconnect external network access at OS level.
3. Open a fresh browser session with cache disabled; select Crew A, display trends.
4. Enter S04, show BP unknown, ensure no unavailable measurement action is suggested.
5. Save and reopen the report locally, then restart services and reopen again.
6. Run S10; verify approved-protocol escalation, no ordinary ranked check.
7. Confirm mouse/keyboard paths if voice fails, and visible synthetic labels.
8. Record actual pass/fail, browser/network evidence and a local screen recording.

The offline request flag and Python socket guard do not replace this test.
