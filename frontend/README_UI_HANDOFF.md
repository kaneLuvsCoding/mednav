# Mission console handoff

## Run / verify
From frontend/: `npm install`, `npm run dev` (http://127.0.0.1:5173), `npm run build`, `npm test`.
Tests use installed Microsoft Edge through Playwright. No lint script is configured.

## Views
Existing six navigation buttons remain. Mission Overview and Investigation share the incident console. Mission What-If Lab opens its inline control drawer. Check-In and Medical Inventory retain existing forms and local interactions. Reports renders the current scenario, crew observations and resource state; no transmission occurs. Navigation is React view state, not URL routing.

## Files and ownership
- src/components/MissionConsole.tsx: three-column console, CrewHealthRail, selectable evidence flow, decision trace, scenario drawer, degraded-mode disclosure and report.
- src/console.css: console tokens, connections, selected states and responsive composition.
- src/types/scenario.ts: provisional ScenarioResponse model with requested API-shaped fields.
- src/data/scenarios.ts: finite mapping of 16 exact switch combinations to authored response fixtures. `getScenario` returns null for unsupported keys. No clinical scoring.
- src/main.tsx: existing app shell, crew profiles, inventory and scenario flags; coordinates state across views.
- src/data/fixtures.ts: original synthetic profiles and fixed trend history.
- src/components/ui.tsx, src/styles.css: preserved P1 visual primitives.
- tests/journey.spec.ts: crew selection, explicit Unknown controls, save/review, evidence connections, all 16 combinations, report consistency, resource synchronization, keyboard activation and mobile overflow.

## State and safety
App owns crew records, inventory and the four scenario flags. What-if monitor edits also update local inventory; inventory monitor edits update the flag. Crew switching and saved check-ins update BP availability. BP available uses the crew's saved BP, or 120 / 80 from the synthetic fixture if no saved value exists. The scenario overlay does not overwrite saved observations. Report and console use the same derived scenario. Required non-monitor equipment missing from inventory yields No demo fixture available. Manual override always selects status=escalate, next_check=null. All fixture responses have diagnosis=null. No clinical thresholds or automatic triage exist.

Known limits: React memory resets on refresh. History remains a separate fixed historical fixture. All displayed timestamps are explicitly demonstration timestamps, not device acquisition times. No NASA research citations are included or claimed. Shared API documentation was absent; field types are provisional pending team contract review. No backend, real medical decision, persistence, 3D, voice or remote synchronization.

## Verified handoff
Production build and three Playwright tests passed during implementation. Build emits a non-blocking >500 kB bundle warning. Screenshots: tests/console-desktop.png and tests/console-mobile.png (generated local QA artifacts, ignored by Git). No horizontal overflow at 390x844 across six views. Desktop inspected at 1440x900.

## Git
Feature branch: feature/frontend-mission-console. This repository had no commits or remote branches when work began, so this feature commit also preserves the existing frontend from the earlier local prototype. A draft PR to main requires an existing remote main base; do not create or update main without coordination. No direct main push or force push.

Once a maintainer establishes main and authorizes publishing:

    git push -u origin feature/frontend-mission-console
    gh pr create --draft --base main --head feature/frontend-mission-console --title "feat(frontend): build MEDNAV mission incident console" --body-file frontend/PR_DESCRIPTION.md

Next teammate: agree the API response types, replace local fixtures through an adapter, extract console subcomponents as it grows, and add persistent offline storage only in an authorized phase. Keep scenario responses deterministic and preserve Unknown semantics.
