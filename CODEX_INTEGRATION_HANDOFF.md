# Codex Integration Handoff

## Production-ready content

| Status | Case | Narrative file | Evidence file | Integration note |
|---|---|---|---|---|
| Ready | Cuban Missile Crisis | `data/narratives/cuban-missile-1962.json` | `data/evidence/cuban-missile-1962.json` | Connected by `narrative_id`; all evidence refs resolve. |
| Ready | New Coke | `data/narratives/new-coke-1985.json` | `data/evidence/new-coke-1985.json` | Connected by `narrative_id`; preserves `Weak Decision / Mixed Outcome`. |
| Ready with caveat | Netflix streaming | `data/narratives/netflix-2007.json` | `data/evidence/netflix-2007.json` | Connected; narrative explicitly labels the A/B choice as editorial reconstruction. |

## Held content

| Case | Evidence file | Reason | Required remediation |
|---|---|---|---|
| Austerlitz | `data/evidence/austerlitz-1805.json` | Current card conflates war-council and battlefield T0; “Allied command” is not one actor; the stated target does not faithfully describe Weyrother's plan. | Rebuild actor, T0, known information, and options before writing a production narrative. |
| Challenger | `data/evidence/challenger-1986.json` | Composite actor received a cleaner warning set than some actual senior decisionmakers; launch becomes too easy to reject. | Select one viewpoint and reconstruct its exact information packet. |

## Rejected content

| Case | Evidence file | Reason |
|---|---|---|
| Apollo 13 in current A/B form | `data/evidence/apollo-13-1970.json` | “Stay in CM” is dominated after the known system losses. Rebuild only as progressive crisis decisions. |
| USS Johnston low-fame stress candidate | `data/evidence/low-fame-uss-johnston-1944.json` | Strong story and evidence, but withdrawal is morally and operationally dominated. Low fame does not produce dilemma balance. |

## Narrative-to-evidence connection

Each approved JSON contains `evidence_refs`. `tests/narrative.test.mjs` loads the paired evidence file and fails on missing narrative slots, missing evaluations, out-of-range scores, or unresolved source IDs. `data/cases.ts` imports the three approved JSON files and maps them to their existing `narrative_id` values.

## UI issues discovered from real content

No UI code was changed. The following should be considered in a later Codex implementation pass:

1. The case page does not render `why_option_a_made_sense`, `why_option_b_made_sense`, `outcome_story`, `longform_story`, or the four editorial evaluations.
2. Evidence displayed in the UI comes from the short embedded `DecisionEvent.evidence` array; it does not resolve the new claim-level `evidence_refs` sidecars.
3. The UI has no badge for “editorially reconstructed options.” This is required for Netflix-like strategic cases where the action is documented but a literal A/B meeting is not.
4. Evidence titles and URLs are not rendered as a claim-linked, clickable ledger.
5. The current Korean localization is keyed by exact English source strings. Replacing a production narrative can cause Korean fallback to English. Narrative localization needs locale-specific files or stable message IDs.
6. `longform_story` has no reading surface, so production longform is currently stored but invisible.
7. The product cannot mark a case as `production`, `hold`, or `rejected`; demo records remain visible even when editorial review fails.

## Schema fields missing after real-content testing

These are proposals only; the schema was not changed:

- `editorial_status`: `DRAFT | CONDITIONAL | PRODUCTION | HOLD | REJECTED`
- `option_provenance`: `DOCUMENTED_DELIBERATION | EDITORIAL_RECONSTRUCTION`
- `decision_owner` and `viewpoint_actor_id` separate from a broad actor label
- `t0_precision`: timestamp/range and the decision meeting or operational state represented
- `information_provenance[]`: evidence refs attached to each known/unknown item
- `claim_evidence_refs`: source IDs attached to individual narrative claims, not only the whole narrative
- `narrative_version`, `fact_checked_at`, `reviewed_by`, and `review_status`
- `locale` or stable translatable message IDs for narrative content
- `editorial_evaluations` for PLAYER_FAIRNESS, DILEMMA_BALANCE, CONTEXT_COMPRESSION, and REVEAL_PAYOFF
- `content_warning` and `sensitivity_notes` for fatal disasters and war
- progressive-step-specific `decision_quality` when a case contains more than one decision

## Exact next Codex scope

1. Add editorial status and hide non-production cases from the default archive.
2. Add option-provenance and reconstructed-choice disclosure.
3. Resolve sidecar evidence by ID and render claim-linked sources.
4. Add locale-aware narrative loading independent of English string identity.
5. Add progressive multi-decision support before reconsidering Apollo 13.
6. Do not alter the three approved narratives unless new evidence changes a factual claim or fairness evaluation.
