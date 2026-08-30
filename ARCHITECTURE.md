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
