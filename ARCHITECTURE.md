# decision-under-uncertainty — Architecture

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

## 10. Non-goals for this pass

No UI changes, no crawler, no mass generation, no SEO, no video
rendering/upload automation. This pass is a narrative-quality and
research-feasibility pilot across ~10-12 hand-researched cases; see
`NARRATIVE_PILOT_REPORT.md` for the verdict.
