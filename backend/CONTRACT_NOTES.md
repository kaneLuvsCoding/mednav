# Provisional contract — team agreement required

Repository inspection (2026-11-14) found none of AGENTS.md, PROJECT_SPEC.md, ARCHITECTURE.md, API_CONTRACT.md, MEMBER_2_BACKEND_INTEGRATION.md, or INTEGRATION_WORKFLOW.md locally or on the fetched remote. There is no assigned shared-contract file to edit. This file proposes backend integration details only; it does not claim an agreed contract.

## Preserved existing frontend names

The source references are frontend/src/data/fixtures.ts and frontend/src/types/scenario.ts (read only). Profiles preserve `id`, `role`, `hr`, `sleep`, `bp`, `baseline`, `sleepBaseline`, `symptoms`. Inventory preserves `name`, `category`, `quantity`, `available`. Investigation responses preserve all existing scenario fields, including `diagnosis: null` and `next_check: null` for escalation.

## Decisions needing Member 1 / Member 3 / Member 4 agreement

1. Endpoint paths are proposed under `/api/v1`; no agreed paths existed. Collections return arrays. History uses oldest-first `limit` (1–1000) and `offset` pagination. Confirm response envelopes and pagination before connecting clients.
2. Crew IDs remain `Crew A`, `Crew B`, `Crew C`. Inventory names are provisional URL keys; URL-encode both. Agree stable machine IDs before renaming anything.
3. BP remains a nullable display string, e.g. `120 / 80`, to preserve the frontend type. Both values must be positive, up to four digits, separated by ` / `. This is input-shape validation, not clinical plausibility validation. A structured systolic/diastolic model would require team agreement.
4. New fields: `astronaut_id`, `recorded_at`, `synthetic`, `provenance`; check-in UUID `id`; investigation request `check_in_id` and `fixture_id`; investigation response adds `check_in_id`, `synthetic`, `provenance`. Explicit null measurements round-trip. Omitted measurements become null. Omitted symptoms become an empty list; symptoms=null is rejected.
5. New check-in timestamps are server UTC receipt times. Seed timestamps are fictional UTC dates mapped in provenance to mission days 174–180. There is no agreed mission epoch or acquisition timestamp yet. No staleness inference is performed.
6. Investigation is an isolated fixture preview. `fixture_id` explicitly chooses one of MN-0000 through MN-1111 (bits: monitor available, BP available, Earth online, manual override). The adapter receives the persisted check-in and current inventory, but the mock intentionally does not analyze either. Its BP/resource values are scenario fixtures, not live readings. Clients must label them as such and must not merge them into saved observations. Unknown fixture returns 422, never an inferred action. Agree the real Member 3 adapter input and output before replacing it.
7. Current inventory endpoints edit quantity/availability only. Profiles and baseline records are seeded, read-only. Check-ins are append-only and update the profile's latest observation view. Missing measurements in a new check-in remain null; they do not inherit older readings. Confirm whether profile creation/editing is needed in the next phase.
8. All synthetic labels are server-controlled true. Client-supplied synthetic=false and unrecognized request keys are rejected. No diagnosis, treatment or clinical threshold calculations are implemented. Sleep 0–24 describes one 24-hour observation window; HR must be positive; all numbers must be finite. These are representation constraints only.
9. Inventory cannot be marked available with quantity zero. An update to zero must also supply available=false when needed. This is a stock invariant, not medical prioritization.
10. No authentication, concurrent multi-user edit control, durable investigation reports, or production migrations are included. This is a loopback-only local integration foundation. SQLite create_all creates missing tables, not migrations for existing schemas.

No shared file or existing API field has been renamed. Resolve these proposals with the team before treating OpenAPI as a frozen integration contract.
