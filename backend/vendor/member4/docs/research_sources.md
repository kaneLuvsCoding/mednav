# Research sources and provenance

Checked 2026-11-14. These references support problem framing, not the generated
numeric values, a clinical threshold, a treatment, or validation of MEDNAV.

| Source/title | URL | Verification and supported claim | Access / dataset / license caveat |
|---|---|---|---|
| NASA — 5 Hazards of Human Spaceflight | https://www.nasa.gov/hrp/hazards/ | Page retrieved and relevant text read. NASA groups hazards into radiation, isolation/confinement, distance from Earth, gravity changes and hostile/closed environments. Distance complicates access to supplies and medical care. | Public explanatory page, not synchronized crew telemetry. Only a short original summary is included; no images or raw data copied. No blanket dataset license inferred. |
| NASA — Risks of Human Spaceflight | https://www.nasa.gov/hrp/risks/ | Page retrieved; section “Risk of Inadequate Sleep and Irregular Schedules” discusses sleep loss, work demands and circadian disruption as research concerns. | Supports including a sleep trend demonstration only. Does not validate any fictional value, score or diagnostic rule. Public summary, not a downloaded dataset; data-specific permission not established. |
| NASA Space Apps — Create Health Monitoring Software for Astronauts on Space Missions | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/ | Official-domain search result verified title and broad challenge aim: gather health indicators and support astronaut health self-monitoring. Direct page fetch returned 502. | Partial verification only. Search text does not establish detailed resource requirements or download rights. |
| Challenge Resources tab — verification pending | https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources | Two retrieval attempts failed. Tab contents and challenge-specific dataset list could not be verified. | Submission blocker: Member 4 must inspect the actual tab and log resources/access terms when accessible. No required dataset is asserted. |
| OSDR entry point | https://osdr.nasa.gov/ | Retrieval redirected to https://science.nasa.gov/biological-physical/data/ (BPS Data). | Discovery lead only. No selected dataset/accession/DOI, download, license or telemetry access verified. Not used as evidence for the synthetic values. |

## Data provenance

All health and inventory data originate in data/generate_seed.py, version
member4-seed-v1. Generation uses fixed arithmetic sequences, not fitted human data
or NASA-derived distributions. Four fictional names, dates, symptoms and equipment
states are chosen for software test coverage. No personal or protected health
information is used. No environmental data are joined to fictional crew.

Each CSV row includes dataset_type=synthetic. Each request has the same label.
Output evidence_sources must include a synthetic: reference; the engine owns its
exact record references. Source prefixes for handoff: synthetic:member4-seed-v1
and synthetic:S01 through synthetic:S16. The v1 request has no scenario_id field,
so the runner retains scenario/output association externally; do not add that field.

Missing sensor values are empty numeric CSV cells and null in API fixtures. Baselines
are simple averages of the first seven historical records. Scenario baselines are
separate fixed inputs. None of these values constitute medical normal ranges.

## Remaining research work

1. Recheck the actual challenge Resources tab and record links individually.
2. If using any real dataset, first record accession/DOI, units, collection dates,
   license/access conditions and transformations; keep it separate from crew fixtures.
3. Verify every additional submission claim against its source. Do not imply NASA
   endorsement, real mission access, clinical effectiveness or dataset availability.
