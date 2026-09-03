# Pilot content → Supabase mapping

This maps the 16 hand-researched cases under `data/cases/<case-id>/` (the
separate research pilot, schema in `schema/*.json`) against what is
actually seeded in the live `decision_cases` table today, per
`SUPABASE_GITHUB_INTEGRATION_REPORT.md`'s documented seed and
`CODEX_INTEGRATION_HANDOFF.md`'s own review verdicts.

**This is deliberately a mapping, not an import.** No bulk import was run.
Live DB state below is taken from the two integration reports, not from a
live query — this session has no `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
configured (see "Live verification" note at the end). Treat the "existing
DB status" column as **last known from documentation, not re-verified live**.

## Overlapping events (same real-world event, independently authored content)

| Local case-id (pilot) | Supabase `case_key` | Existing DB status (documented) | Existing narrative version | Safe import action |
|---|---|---|---|---|
| `apollo-13-free-return-1970` (verdict: **VIABLE**, player_fairness 78) | `apollo-13-1970` | `APPROVED`, 1 narrative (per seed report) — **but** `CODEX_INTEGRATION_HANDOFF.md` separately rejects this case in its current binary form ("Stay in CM is dominated... rebuild only as progressive crisis decisions"). These two documents disagree on this case's actual status; flagging rather than resolving it. | v1 (per seed report) | **Do not overwrite.** Flag the seed-report/handoff discrepancy to Codex first. If Apollo 13 is reworked as a progressive multi-decision case (as the handoff recommends), the pilot's `data/cases/apollo-13-free-return-1970/progressive.json` (already written, real sequential info) is a useful input — hand it over, don't auto-import. |
| `challenger-launch-1986` (verdict: **WEAK**, player_fairness 60) | `challenger-1986` | `APPROVED`, 1 narrative (per seed report) — **but** `CODEX_INTEGRATION_HANDOFF.md` separately puts Challenger on `Hold` ("current viewpoint is not stable... launch becomes too easy to reject"). Same discrepancy as above. | v1 (per seed report) | **Do not overwrite.** Both independent efforts (this pilot and Codex's own QA) reached the same substantive conclusion — the fairness problem is real, not a one-off judgment call — which is worth more than either verdict alone. Useful convergence to report, not something to silently patch by import. |
| `cuban-missile-crisis-1962` (verdict: **VIABLE**, player_fairness 80) | `cuban-missile-1962` | `APPROVED`, 2 narrative versions, 1 review, 1 revision (the deployed feedback-loop demo case) | v2, `is_current = true` | **Do not overwrite.** This is the DB's most mature case and its worked review→revision example. Both independent efforts also agree this is the strongest case. If Codex wants a second opinion narrative, submit it as a new version through `pnpm editorial submit-narrative-version` (never touch the existing `is_current` row directly), not as a replacement. |

## Local cases with no corresponding `decision_cases` row at all

None of these have ever been created in Supabase — there is no row to read, no status, no narrative version. **As of 2026-09-03 (product owner decision), creating a brand-new `decision_cases` row is one of Claude's granted writes** — see `CLAUDE.md`'s "Creating a new case" section and `CODEX_INTEGRATION_HANDOFF.md`'s "Role boundary change" note. Import happens one case at a time via `content/pending-cases/<case-key>.json` → `import_pending_case()`, landing the case at `RESEARCH_DONE`; Codex's `CODEX_REVIEW → APPROVED → PUBLISHED` ownership is unchanged.

`d-day-launch-1944` was the canary for this pipeline (see "Canary import" below) — check its status before treating it as still unimported.

Ordered by `production_verdict` (VIABLE first) as a suggested import priority:

| Local case-id | Verdict | player_fairness | fame_level | pilot_batch |
|---|---|---|---|---|
| `battle-of-midway-1942` | VIABLE | 78 | well_known | CURATED_HIGH_POTENTIAL |
| `stanislav-petrov-1983` | VIABLE | 78 | medium | CURATED_HIGH_POTENTIAL |
| `whaleship-essex-1820` | VIABLE | 78 | medium | CURATED_HIGH_POTENTIAL |
| `panama-canal-design-1906` | VIABLE | 78 | lesser_known | LOW_FAME_STRESS_TEST |
| `seikanron-debate-1873` | VIABLE | 74 | lesser_known | LOW_FAME_STRESS_TEST |
| `molotov-ribbentrop-1939` | WEAK | 72 | well_known | CURATED_HIGH_POTENTIAL |
| `battle-of-cannae-216bce` | WEAK | 68 | well_known | CURATED_HIGH_POTENTIAL |
| `karluk-expedition-1914` | WEAK | 62 | lesser_known | LOW_FAME_STRESS_TEST |
| `mawson-far-eastern-party-1912` | WEAK | 60 | lesser_known | CURATED_HIGH_POTENTIAL |
| `shackleton-endurance-1915` | WEAK | 55 | medium | CURATED_HIGH_POTENTIAL |
| `barry-marshall-self-experiment-1984` | WEAK | 58 | lesser_known | LOW_FAME_STRESS_TEST |
| `tetraethyl-lead-1924` | WEAK | 52 | medium | CURATED_HIGH_POTENTIAL |

None of these are `FAILED` outright — the pilot's honest floor turned out to be `WEAK` (real sourcing, but a guessable or context-heavy dilemma), not "no viable case at all." See the pilot report for what specifically makes each `WEAK` case fall short.

## Canary import: `d-day-launch-1944`

Chosen as the first case through the new import pipeline: highest `player_fairness` (82) among all VIABLE cases with no existing DB row, the strongest sourcing in the pilot (Stagg's own memoir, IWM, US National Archives, Naval History and Heritage Command), and no overlap with the six live cases. Draft: `content/pending-cases/d-day-launch-1944.json` (archived to `content/pending-cases/processed/` on successful import). See this session's completion report for the actual import result (`decision_cases.id`, confirmed `status`, and the `get-narrative-queue-status` before/after count) — do not assume success from this doc alone; re-check the live queue.

## Supabase-only content with no local equivalent

`austerlitz-1805`, `netflix-2007`, `new-coke-1985` are Codex's own MVP demo content (`data/narratives/`, `data/evidence/` — a different, flatter file layout than this pilot's `data/cases/<id>/`) with no counterpart in the 16-case research pilot. Not this pilot's to touch; noted only so the mapping is complete. `austerlitz-1805` is on `Hold` per `CODEX_INTEGRATION_HANDOFF.md` for reasons unrelated to this pilot (T0/actor conflation), and a fourth Codex candidate, `low-fame-uss-johnston-1944`, was independently `Reject`-ed by Codex's own low-fame stress test — for almost exactly the reason this pilot's brief warns against (a "withdraw" option that is morally/operationally dominated, not a genuine dilemma). Worth noting as independent convergence on the same failure mode, from a completely separate low-fame test run.

## Live verification note

No live Supabase read was performed for this mapping — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are not set anywhere in this session's environment or in any `.env*` file in the working tree (only `.env.example`, with values blank, is checked in — correctly). This mapping is therefore built entirely from `SUPABASE_GITHUB_INTEGRATION_REPORT.md` and `CODEX_INTEGRATION_HANDOFF.md`'s own documented state, not re-verified against the live database. See the integration report at the end of this session's summary for what live verification would need (the three env var names) and what running `pnpm claude:queue` / `pnpm claude:case <case-key>` would confirm once they're set.
