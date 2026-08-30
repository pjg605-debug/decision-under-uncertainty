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
