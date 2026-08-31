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

## Shared content hub

- GitHub: canonical code, schemas, migrations, architecture, tests, and fallback fixtures.
- Supabase: canonical case facts, evidence, narrative versions, reviews, revisions, scores, shorts variants, and workflow state.
- Browser: approved Supabase content through `/api/content`; bundled `data/` fixtures on remote failure.
- My Decisions: intentionally remains device-local for this release.

Copy `.env.example` to `.env.local` for local development. `SUPABASE_URL` and `SUPABASE_ANON_KEY` power the read-only content route. `SUPABASE_SERVICE_ROLE_KEY` and `REVIEW_DASHBOARD_TOKEN` are server-only and are used by `/review` and the editorial CLI. Never prefix server-only values with `NEXT_PUBLIC_` or `VITE_`.

The reproducible schema is in `supabase/migrations/202608300001_content_hub.sql`. The six MVP cases are generated into `supabase/seed.sql` from the current facts, narratives, and evidence:

```bash
pnpm db:seed:generate
supabase db reset
```

Server-side queue examples:

```bash
pnpm editorial get-case-for-research 10
pnpm editorial get-case-for-narrative 10
pnpm editorial get-case-for-codex-review 10
pnpm editorial get-revision-requests 10
pnpm editorial transition <case-key> <status> <agent> <reason>
```

`submit-review` and `submit-narrative-version` accept JSON payloads; see `scripts/editorial-desk.mjs`. The internal dashboard at `/review` requires `REVIEW_DASHBOARD_TOKEN`.
