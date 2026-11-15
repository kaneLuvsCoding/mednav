# MEDNAV mission incident console

Replaces the generic dashboard and disconnected investigation examples with a three-column crew/evidence/decision workspace. Evidence buttons highlight relevant stages and explain their connection; 16 explicit local scenario fixtures keep BP availability, resource constraints, manual escalation and report output consistent.

All data is synthetic. No backend, clinical ranking, diagnosis or remote transmission. Check-in and inventory functionality are preserved. Changes are confined to frontend/.

Validation: npm run build passed (TypeScript + Vite; non-blocking bundle-size warning). npm test passed: 3 Playwright tests covering crew/save/Unknown behavior, all 16 fixtures, keyboard evidence selection, inventory/report consistency, runtime error capture, and six mobile views without horizontal overflow. Desktop 1440x900 and mobile 390x844 screenshots inspected. No lint script configured.

Limitations: in-memory state resets on refresh; history is a fixed fixture; no shared API contract was present; research citations and optional 3D are deferred. See README_UI_HANDOFF.md for state flow and next steps.

This is the repository's first commit; it includes the preserved frontend foundation from the earlier local prototype.

Exact files in this feature commit:
- frontend/.gitignore
- frontend/PR_DESCRIPTION.md
- frontend/README.md
- frontend/README_UI_HANDOFF.md
- frontend/index.html
- frontend/package-lock.json
- frontend/package.json
- frontend/playwright.config.ts
- frontend/src/components/MissionConsole.tsx
- frontend/src/components/ui.tsx
- frontend/src/console.css
- frontend/src/data/fixtures.ts
- frontend/src/data/scenarios.ts
- frontend/src/main.tsx
- frontend/src/styles.css
- frontend/src/types/scenario.ts
- frontend/tests/journey.spec.ts
- frontend/tsconfig.json
