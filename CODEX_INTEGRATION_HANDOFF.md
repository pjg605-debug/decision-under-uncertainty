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

## New requirement: bilingual narratives must be independently authored, not translated

Product decision (from the project owner, 2026-09-02): every case's narrative must
exist as two **independently authored** versions — one written natively in Korean,
one written natively in English — each drafted directly in that language from the
shared case/evidence facts. Neither is a translation of the other. The explicit
goal is to eliminate "translationese" (직역체) — the stiff, source-language-shaped
phrasing that results from writing once and translating, which is detectable to a
native reader even when technically accurate.

This is not new: `UI issue #5` above already flagged that "the current Korean
localization is keyed by exact English source strings" and the schema-gap list
below already named `locale or stable translatable message IDs for narrative
content` as missing. This section makes that gap concrete and blocking.

### Why the current schema cannot support this

Per `CLAUDE_DB_INTEGRATION_HANDOFF.md`'s deployed contract, `narratives` has no
`language`/`locale` column at all, and:

> `narratives` is unique on `(case_id, version)` and has a partial unique index
> allowing only one `is_current = true` row per `case_id`.

Because that uniqueness is scoped by `case_id` alone, a case can have exactly one
"live" narrative at a time regardless of language — setting a Korean narrative to
`is_current = true` un-sets any English one for the same case, and vice versa. Two
independently authored, simultaneously live language versions are not
representable today.

### Requested schema change

1. Add a `language` column to `narratives` (e.g. `text`, values `ko` | `en` for
   now, extensible later). Not nullable; every existing row needs a backfill
   value (the current 6 live narratives are English MVP demo content — backfill
   them as `language = 'en'`).
2. Change the `(case_id, version)` unique constraint to `(case_id, language,
   version)`, so each language has its own independent version sequence (a
   Korean revision does not bump the English version number, and vice versa).
3. Change the partial `is_current` unique index from "one per `case_id`" to "one
   per `(case_id, language)`", so a Korean and an English narrative can both be
   `is_current = true` for the same case simultaneously.
4. The public read path (`core/supabase-content.mjs` → `/api/content`, and
   whatever the case-archive equivalent turns out to be) needs a language
   selector (query param or `Accept-Language`) to pick which `is_current` row to
   serve per case.
5. **Resolved (product owner, 2026-09-03):** `decision_options`/`case_information`/
   `decision_cases` stay English-only in the schema — no `language` column, no
   scope change to (1)-(3) above. Korean display for these short structured
   fields is handled entirely client-side: `data/i18n.ts` holds a
   `Record<English source string, natively-written Korean>` dictionary,
   applied at render time by `localizeEvent`/`t()` in
   `components/decision-platform.tsx`. This is a deliberate difference from
   narrative prose, not a stopgap: a literal-string dictionary works fine for
   short labels/bullets where the English source string is stable and known
   in advance, but cannot carry nuance across long-form narrative text, which
   is why narratives alone got the schema-level `language` column instead.
   `tests/i18n-coverage.test.mjs` fails the build if any live fixture case's
   `actor`/`actor_role`/`location`/`known_tradeoffs` (the derived
   `"<upside> versus <downside>"` string per option) has no `ko` entry —
   whoever adds a new case's structured fields must add the matching
   dictionary entries in the same change.

### What Claude will do once this ships

For each case going forward (including the 13 pilot cases with no `decision_cases`
row yet), Claude will submit two separate `narratives` rows per version bump —
`language = 'ko'` and `language = 'en'` — each drafted independently from the same
`evidence`/`case_information`, never by translating the other. Recommend resolving
this schema change before importing any of the 13 pending pilot cases, to avoid a
second migration once bilingual rows already exist.

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
4. **Priority (product owner request, 2026-09-02):** add the `narratives.language` column and the `(case_id, language)`-scoped uniqueness/`is_current` changes described in "New requirement: bilingual narratives must be independently authored, not translated" above, plus locale-aware narrative loading independent of English string identity.
5. Add progressive multi-decision support before reconsidering Apollo 13.
6. Do not alter the three approved narratives unless new evidence changes a factual claim or fairness evaluation.

## Role boundary change: Claude now creates new cases (product owner, 2026-09-03)

The former rule that creating a `decision_cases` row was schema/case-creation territory reserved for Codex is superseded. Claude now owns case discovery through `RESEARCH_DONE` (research, T0 reconstruction, sourcing, and creating `decision_cases`/`decision_options`/`case_information`/`evidence`), via a new file-based pipeline: `content/pending-cases/<case-key>.json` → `.github/workflows/import-pending-case.yml` → the new `import_pending_case()` Postgres function (`supabase/migrations/202609030001_import_pending_case.sql`), which does the whole insert in one transaction and refuses outright if `case_key` already exists.

What does **not** change: Codex still owns `CODEX_REVIEW → APPROVED → PUBLISHED` exclusively. Claude's new pipeline is hard-capped at `RESEARCH_DONE` (the `import_pending_case()` function raises an exception if asked to create a case at any later status), so nothing Claude creates reaches the public site without going through Codex's existing review. This is a supply-side change only, not a review/approval change.

Practical effect for Codex: `get_cases_for_research`/`get_cases_for_narrative` may now surface cases Claude created, not only ones Codex created — nothing else about the review flow (`get_cases_for_codex_review`, `transition_case_status`) changes. The 16-case research pilot in `data/cases/<case-id>/` (`CLAUDE_PILOT_TO_DB_MAPPING.md`) is the first backlog Claude is drawing from, one case at a time, canary-tested before any batch — check that mapping doc (or `get-narrative-queue-status`) before doing manual case-creation work yourself, to avoid a race on the same case.
