# Decision / T0 Architecture

> This project is not fundamentally about history, business, or quizzes.
> It is about human judgment under uncertainty.

## Canonical principles

1. Hide the future.
2. Reconstruct what was knowable at T0.
3. Separate decision quality from outcome quality.
4. Do not invent motives.
5. Actual history is not the answer key.
6. Make uncertainty experiential, not merely explanatory.

`Viewer Choice`, `Actual Historical Decision`, `Outcome`, `Decision Quality`, and `Outcome Quality` are independent concepts. A match with history is a descriptive statistic, never correctness.

## System shape

The MVP is a mobile-first Vinext/React application. `core/schemas/decision-event.ts` is the canonical TypeScript contract. Structured facts live in `data/`; narrative prose lives in separate files under `data/narratives/`. UI code consumes both by `narrative_id`, so a narrative can be replaced without changing the fact record or component tree.

```text
structured DecisionEvent + replaceable NarrativeSlots
                    ↓
       staged disclosure state machine
                    ↓
 home / case / library / compare / decisions / shorts
```

The disclosure boundary is explicit: `choice → lock → optional new evidence → keep/change → reveal`. Actual decisions, outcomes, unknown information, and hindsight analysis are mounted only after the reveal state.

## DecisionEvent

The schema contains identity and taxonomy, actor and T0 framing, known/unknown information, structured options and tradeoffs, the actual decision, immediate/long-term outcomes, independent quality judgments, uncertainty factors, typed evidence, an external narrative key, six editorial scores, metadata for discovery/risk, and an optional progressive evidence step.

Evidence classes are `FACT`, `CONTEMPORARY_BELIEF`, `STATED_RATIONALE`, and `INFERENCE`. They describe epistemic status, not importance.

## Scaling

Case list controls are already expressed as independent filters. For thousands of records, preserve the schema and move filtering/search to an indexed service without changing the page contract. Local storage is intentionally limited to user play history; it is not authoritative content storage.

## Editorial boundary

Only claims supportable by evidence belong in structured records. Interpretations must be marked `INFERENCE`. Motives are included only when supported as `STATED_RATIONALE`. Decision/outcome quality labels are editorial judgments and the UI says so.

## Canonical hubs

GitHub is the source of truth for code, SQL migrations, schemas, validation, prompts, architecture, and bundled fallback fixtures. Supabase is the source of truth for case facts, research state, evidence, narrative versions, reviews, revisions, scores, shorts variants, and workflow history.

The application reads approved content from Supabase through `/api/content`. If the remote reader is unavailable, the browser keeps using bundled fixtures. Local fixtures remain a migration and outage fallback; they are not the editorial system of record once Supabase is configured.

The public reader never receives a service credential. Browser roles have read-only grants on approved content, filtered by RLS. Reviews, revisions, research queues, agent runs, publication results, and every write require server-side credentials.

## Agent ownership

Claude owns research interpretation, narrative prose, option-rationale prose, hindsight analysis, longform writing, evidence interpretation, and narrative revisions requested by reviews.

Codex owns schema, validation, workflow state, UI, display constraints, automated checks, structured review generation, and integration.

Verified evidence, canonical T0, the canonical factual timeline, and case identity are protected. Neither agent may overwrite them without evidence and an auditable review/revision or status-transition record. Narrative revisions create a new `narratives.version`; they never silently replace a prior version.

## Editorial workflow

```text
DISCOVERED → RESEARCHING → RESEARCH_DONE
    → NARRATIVE_DRAFTED → CODEX_REVIEW
    → REVISION_REQUESTED → REVISION_DONE → CODEX_REVIEW
    → EDITOR_REVIEW → APPROVED → PROTOTYPE_READY → PUBLISHED
```

`HOLD` and `REJECTED` are explicit side exits. The database rejects invalid transitions and records accepted transitions in `status_transitions`. Claude normally advances research and narrative states; Codex creates structured reviews and advances review states; an editor may use `EDITOR_REVIEW`; publication automation advances approved content to prototype and published states.

## Evidence discipline and source preference

Evidence classes remain mandatory: `FACT`, `CONTEMPORARY_BELIEF`, `STATED_RATIONALE`, and `INFERENCE`. Prefer primary records, then government/archive/museum sources, academic work, high-quality references, research institutions, and specialist journalism. Source disagreement belongs in explicit evidence metadata or research gaps, not in unmarked narrative certainty.

The curated pilot and low-fame stress-test sets must remain distinguishable in metadata. A high hit rate among famous, hand-picked cases is evidence that the format can work, not that every historical event fits the format.
## Research content-pipeline appendix

The pre-existing GitHub research branch established the following narrative-pilot contract. Its JSON schemas and hand-researched case packages remain available under `schema/` and `data/cases/`. Where those exploratory schemas differ from the running product, `core/schemas/decision-event.ts` and the Supabase migration are the integration contracts; the research packages remain protected source material.

### Prior narrative pilot architecture

## 0. Status of this document

This repository was empty when this content pipeline was built (no prior
Codex-authored schema existed). Everything in this file and in `schema/`
is a **first-draft, minimal schema** created to unblock a narrative
content pilot. Treat it as a proposal, not a locked contract: if a real
product/UI schema already exists elsewhere, this should be reconciled
with it rather than treated as authoritative.

## 1. Core philosophy

This project is not fundamentally about history, business trivia, or quiz
content. **It is about human judgment under uncertainty.**

The central question every case must answer:

> Given only the information available *before* the outcome was known,
> what could the person in that situation actually know, which option
> looked reasonable, and what would we have chosen in their place?

Two disciplines follow directly from this:

1. **No hindsight contamination.** Every case defines a precise decision
   moment, `T0`. Anything the decision-maker could not have known at T0
   is walled off from the "known" side of the case and is only revealed
   as part of the outcome/hindsight sections.
2. **Decision quality and outcome quality are independent axes.** A
   reasonable decision can produce a bad outcome (bad luck), and a weak
   decision can produce a good outcome (good luck). The schema forces
   both to be scored separately so the content never collapses into
   "good decision = good outcome."

## 2. Repository layout

```
ARCHITECTURE.md
schema/
  decision-event.schema.json   # case.json shape
  evidence.schema.json         # evidence.json shape
  narrative.schema.json        # narrative.json shape
  shorts.schema.json           # shorts.json shape (3 script lengths)
  progressive.schema.json      # progressive.json shape (sequential-info cases only)
data/
  cases/
    <case-id>/
      case.json         # structured DecisionEvent (required)
      evidence.json     # sourcing package (required)
      narrative.json    # long-form narrative slots (required)
      shorts.json        # 3 short-form video scripts (required)
      progressive.json   # sequential "new info arrives" version (only for select cases)
NARRATIVE_PILOT_REPORT.md
```

`case-id` is a kebab-case slug, generally `<short-name>-<year>` (e.g.
`cuban-missile-crisis-1962`). Structured/comparable fields in `case.json`
are written in English for portability and easy cross-referencing with
English-language primary sources. `narrative.json`, `shorts.json`, and
`progressive.json` — the actual audience-facing content — are written in
Korean, matching the target audience implied by the project brief. This
is a judgment call made because no product-language spec existed; revisit
if the real product needs bilingual or English-first content.

Structured fact (`case.json`, `evidence.json`) is kept strictly separate
from narrative prose (`narrative.json`, `shorts.json`, `progressive.json`)
so a UI can render the "facts panel" and the "story" independently, and so
narrative writers are never tempted to smuggle unsupported claims into the
structured record.

## 3. Evidence classification (mandatory on every claim in case.json)

- `FACT` — established by current historical/scientific research or
  strong primary sources; not seriously contested.
- `CONTEMPORARY_BELIEF` — what the actor(s) believed or understood to be
  true at T0, whether or not it was actually true.
- `STATED_RATIONALE` — a reason the actor(s) themselves gave, in their
  own words or documented paraphrase, for the choice they made.
- `INFERENCE` — a later researcher's or our own interpretation, clearly
  flagged as interpretation rather than fact.

`INFERENCE` must never be phrased as `FACT`. Where sources genuinely
conflict on a load-bearing detail (troop counts, exact wording, timing),
the case records a `source_disagreements` entry and the narrative uses
only the minimal common ground, not either contested version.

## 4. Source hierarchy (preference order)

1. Primary sources (transcripts, logs, letters, diaries, telemetry)
2. Government / archive / museum records
3. Academic books and peer-reviewed papers
4. High-quality general reference (e.g. Britannica)
5. University / research institution publications
6. High-quality specialist journalism / history media

Wikipedia is allowed only for discovery/orientation, never as the sole
citation for a load-bearing claim in `evidence.json`.

## 5. `case.json` — DecisionEvent schema (see `schema/decision-event.schema.json`)

Key fields:

- `id`, `title`, `case_type[]` (military | political | diplomacy |
  exploration | science | crisis | survival | industry), `fame_level`
  (well_known | medium | lesser_known)
- `pilot_batch` — `CURATED_HIGH_POTENTIAL` or `LOW_FAME_STRESS_TEST`. See
  section 11 below; this distinction is load-bearing for how the pilot's
  results should and should not be generalized.
- `quality_scores` — four narrative/format scores, each `{ score: 0-100,
  rationale }`, deliberately separate from `decision_quality` /
  `outcome_quality` (which judge the historical actor, not the content):
  - `player_fairness` — can a viewer make a meaningful call from the
    information actually given? 100 = enough information and both
    options are genuinely reasonable; 0 = a coin flip dressed up as a
    choice. This is the single most important score: the project's goal
    is "a hard judgment made with real information," never "a viewer
    tricked into guessing wrong."
  - `dilemma_balance` — how evenly matched do A and B feel? 100 = both
    persuasive; 0 = one looks obviously correct.
  - `context_compression` — can someone with zero background understand
    the situation in 5-10 seconds? Higher is better.
  - `reveal_payoff` — once the real choice and outcome are revealed, is
    there real surprise/intellectual payoff?
- `production_verdict` — an explicit `{ status: VIABLE|WEAK|FAILED,
  reasoning }` call on whether the case is fit for showcase content.
  Landing on `FAILED` for some fraction of researched cases is an
  expected, useful pilot outcome — the goal is never "make every
  candidate work."
- `t0` — `{ definition, date, location }`: the precise moment "the
  decision" is frozen at. Everything before this line is fair game for
  "known at T0"; everything after is outcome/hindsight only.
- `stakes` — why the decision mattered
- `known_at_t0[]` / `unknown_at_t0[]` — each entry `{ statement,
  evidence_class }`
- `options[]` — target length 2 (`option_a`, `option_b`), each with
  `label`, `description`, `upside`, `downside`, `why_it_made_sense`,
  `risk_carried`
- `actual_decision` — `{ chosen_option_id, decided_by, decided_when,
  stated_basis, constraints }`
- `decision_quality` — `{ rating: STRONG|REASONABLE|WEAK|UNCLEAR,
  justification }`
- `outcome_quality` — `{ rating: GOOD|BAD|MIXED, justification }`
- `outcome` — `{ immediate, long_term, causal_directness:
  DIRECT|CONTRIBUTING|CONTESTED }`
- `source_disagreements[]` — `{ topic, description }`

## 6. `evidence.json`

Array of entries: `{ id, title, author_or_institution, date,
citation (URL or bibliographic reference), source_type, evidence_class,
supported_claim, note }`. `source_type` enum matches the hierarchy in
section 4. Every `FACT` and `STATED_RATIONALE` claim used in `case.json`
should trace to at least one entry here.

## 7. `narrative.json`

```
{
  "case_id": "",
  "hook": "",
  "short_setup": "",
  "why_option_a_made_sense": "",
  "why_option_b_made_sense": "",
  "actual_decision_explanation": "",
  "outcome_story": { "immediate": "", "long_term": "" },
  "hindsight_analysis": "",
  "decision_principle": { "plain_language": "", "tag": "" },
  "longform_story": ""
}
```

`hook` must work with zero historical background (present the human
dilemma before names/dates). `decision_principle.plain_language` states
the behavioral pattern in ordinary language first; `tag` is an optional
short label (e.g. "Status quo bias") appended after, never the whole
sentence. `longform_story` targets 800–2000 words structured as: cold
open → T0 situation → what was known → options → actual decision →
outcome → the simplified legend vs. reality → restoring the T0
perspective → decision quality vs. outcome quality → the question we take
away.

## 8. `shorts.json`

Three script versions per case (`20-25s`, `30-40s`, `45-60s`), each with
beats: `hook, context, options, lock_in, actual_choice, outcome,
why_it_was_hard`. Shorter versions compress; they don't drop the A/B
choice or the "why it was hard" beat, since that beat is this project's
differentiator.

## 9. `progressive.json` (select cases only)

For cases where information genuinely arrived in sequence at the time
(not reconstructed after the fact), a step array:
`context → initial_choice → new_information → keep_or_change →
actual_decision → outcome`. New information must be something the actors
actually learned in that order — never a later-known outcome dressed up
as a mid-story clue.

## 10. Selection bias and the two pilot batches — read before generalizing results

This pilot's first 12 cases were **deliberately chosen because their
decision points are unusually strong** (clean T0, well-documented
alternatives, high stakes, good sourcing). Whatever hit rate this batch
achieves says "this format works when you pick a good historical case,"
never "cases like this are common across history." That generalization
gap is called out explicitly in `NARRATIVE_PILOT_REPORT.md`, tagged
`pilot_batch: CURATED_HIGH_POTENTIAL`.

A second consideration: a large share of the curated batch (Cuban Missile
Crisis, Midway, Cannae, Challenger, Apollo 13, Petrov, Shackleton, ...)
are cases whose decision-under-uncertainty framing is already
well-trodden territory — the raw material was easier to find and reason
about specifically because it is famous. To stress-test whether the
format still works without that head start, a separate small batch is
tagged `pilot_batch: LOW_FAME_STRESS_TEST`: genuinely obscure cases
(general audiences essentially don't know them; even history specialists
may only know them in passing), held to the identical quality bar and
evaluated with the identical scores. Comparing quality-score
distributions between the two batches is the actual test of whether
"good decision content" requires fame to begin with, or whether fame was
incidental to case selection.

## 11. Non-goals for this pass

No UI changes, no crawler, no mass generation, no SEO, no video
rendering/upload automation. This pass is a narrative-quality and
research-feasibility pilot across ~10-12 hand-researched cases; see
`NARRATIVE_PILOT_REPORT.md` for the verdict.
