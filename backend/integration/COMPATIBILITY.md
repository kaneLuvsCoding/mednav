# Member 4 integration proposal — recorded before implementation

The supplied directory is an extracted package, not a ZIP. Original contents will be preserved byte-for-byte under backend/vendor/member4; hashes record the source snapshot. Generator and QA files will not be edited. All execution writes occur in disposable copies.

## Compatibility findings

| Area | Existing backend | Member 4 | Planned boundary |
|---|---|---|---|
| Profiles | Crew A–C identifiers, role and baselines | A01–A04, display_name, dataset_type | Preserve A IDs; explicitly map display labels; raw rows retained |
| History | hr/sleep/bp/symptoms; UTC recorded_at | resting_hr_bpm/sleep_hours/reported_symptoms; observed_at +06:30 | Store exact offset timestamp and null values in source rows; project UTC into existing history table; BP stays null because historical CSV has no BP |
| Inventory | name/category/quantity/available | equipment_id/label/quantity/usable | Retain raw IDs/usability; availability = quantity > 0 AND usable; no invented expiry rule |
| Baselines | profile scalar fields | separate first-seven-day historical means | Import historical means; never replace independently supplied scenario baselines |
| Investigation input | check_in_id + explicit demo fixture_id | full observation, measurements, baseline, equipment, communication, override | Opt-in Member4 integration app only; existing app/routes remain unchanged |
| Investigation output | observations/resources objects, structured explanation/source entries, review/resource-unavailable statuses | observations/resources/source string arrays, explanation string, needs_review/insufficient_evidence | No lossy fake translation. Real Member3 adapter required; validate output at boundary |
| Endpoints | /astronauts/{id}/history; no /health | /health mentioned; investigation same path | Opt-in /health read endpoint; compatibility app exposes source-native profiles/inventory. Default frontend contract unchanged |
| Validation | detail array | error.code=validation_error + message | Opt-in error envelope includes both error and detail |
| Reports | check-ins persisted; investigations not persisted | disconnected checklist expects reopen/restart report | Pending shared report schema and real engine; do not fabricate reports |

## Proposed implementation / agreement gate

Add importer into exclusively new, empty file-based SQLite databases. Refuse any existing destination; do not touch mednav.db. Store typed source JSON with dataset_type and original ISO timestamp, JSON symptom arrays, baselines and provenance; project usable data to existing tables without renaming their columns. Preserve original generator and fixtures. Hash the development DB before/after QA.

The explicit integration app is a test/integration seam, NOT a replacement of default app.main:app. It validates Member4 requests, sanitizes equipment from imported inventory, and invokes ONLY an explicitly configured real Member3 callable. Without it, return 503 engine_unavailable. No fallback to FixtureAdapter. QA engine tests stay pending; do not turn expected responses into an engine.

Shared API contract changes remain PROPOSED: identifier convention; BP numeric object vs string; response vocabulary/types; error envelope; /health shape; report persistence schema; rule/catalog versioning; S06 conflict representation. Team approval is required before promoting the integration app contract into default v1. No shared contract file exists in the checkout, so none will be created or overwritten.
