# decision-under-uncertainty

An interactive research prototype for practicing judgment with only the information available at T0.

## Run

```bash
pnpm dev
pnpm test
pnpm build
```

## Key surfaces

- Home and category entry points
- Eight-stage Decision Case flow with future-hiding
- Progressive evidence and keep/change decision flow
- Filterable case archive
- Decision-quality versus outcome-quality comparison
- Device-local play statistics
- Shorts storyboard and rule-based potential score

## Content handoff

Claude should write or replace JSON files in `data/narratives/` using the slots defined by `NarrativeSlots`, then map each file in `data/cases.ts`. It should not edit structured facts unless it is also doing evidence-backed fact review.

See `ARCHITECTURE.md` for the canonical product rules.
