# Scenario matrix

All requests are fictional. S13 is intentionally invalid. Context is test setup, not API fields.

| ID | Scenario | Expected status | Execution route |
|---|---|---|---|
| S01 | Normal-looking fictional check-in | Unpinned; assert contract invariants | Engine; API where configured |
| S02 | Fatigue and lower sleep | Unpinned; assert contract invariants | Engine; API where configured |
| S03 | Missing BP with usable monitor | Unpinned; assert contract invariants | Engine + inventory API adapter |
| S04 | Missing BP with monitor out of stock | needs_review | Engine; API where configured |
| S05 | One day sensor outage | Unpinned; assert contract invariants | Engine; API where configured |
| S06 | Conflicting source records | Unpinned; assert contract invariants | Blocked: conflict interface pending |
| S07 | Reviewed checklist available | Unpinned; assert contract invariants | Engine; API where configured |
| S08 | Listed but unusable BP monitor | Unpinned; assert contract invariants | Engine + inventory API adapter |
| S09 | Earth communication offline | Unpinned; assert contract invariants | Engine; API where configured |
| S10 | Manual emergency override | escalate | Engine; API where configured |
| S11 | Deterministic replay | Unpinned; assert contract invariants | Engine; API where configured |
| S12 | Empty eligible checklist catalog | insufficient_evidence | Context adapter: empty catalog |
| S13 | Invalid measurement type | Unpinned; assert contract invariants | API validation only |
| S14 | Synthetic provenance preserved | Unpinned; assert contract invariants | Engine; API where configured |
| S15 | All four measurements unknown | Unpinned; assert contract invariants | Engine; API where configured |
| S16 | Emergency override with all data missing | escalate | Engine; API where configured |
