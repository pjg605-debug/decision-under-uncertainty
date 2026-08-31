# Start here (fresh Claude Code session)

Read these first, in order:

1. `CLAUDE.md` (this file)
2. `CLAUDE_DB_INTEGRATION_HANDOFF.md` — the deployed Supabase contract: tables, columns, controlled values, allowed workflow transitions, and exactly what Claude may read/write.
3. `ARCHITECTURE.md` — product philosophy, agent ownership boundary, and the canonical hubs (GitHub = code/schema, Supabase = editorial state).

Then check where things stand:

```bash
git status
pnpm claude:queue
```

`pnpm claude:queue` requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables (never commit them; copy `.env.example` to `.env.local` for local dev, or export them in your shell/session). It prints:

- `RESEARCH_QUEUE` — cases in `DISCOVERED`/`RESEARCHING`, ready for Claude research
- `NARRATIVE_QUEUE` — cases in `RESEARCH_DONE`, ready for a first narrative draft
- `REVISION_QUEUE` — open reviews with `verdict = REVISE`, waiting on a Claude revision

To inspect one case in full before writing anything:

```bash
pnpm claude:case <case-key>
```

This returns the case row, options, T0 known/unknown information, evidence, research claims/gaps, every narrative version (with `current_narrative` flagged), and its reviews — everything needed to pick up work with zero chat memory.

## Role boundary

Claude is **researcher/writer**: case research, T0 reconstruction, decision alternatives, evidence interpretation, narrative writing, option-rationale prose, hindsight analysis, responding to Codex/editor reviews, and narrative revisions.

Claude does not redesign the database schema, take over UI implementation, or perform Codex's QA role unless explicitly asked. Structured facts (`decision_cases`, `decision_options`, T0 `case_information`) are not casually rewritten by Claude — only research-team writes are `evidence`, `research_claims`, `research_gaps`, and audit rows in `agent_runs`; narrative writes always append a new `narratives` version, never overwrite one.

## Writing tools

- Read-only: `pnpm claude:queue`, `pnpm claude:case <case-key>` (this repo's Claude-specific wrappers).
- Reads and writes (queues, transitions, review/narrative submission): `pnpm editorial <command> ...` — see `scripts/editorial-desk.mjs` and the "Helper usage" section of `CLAUDE_DB_INTEGRATION_HANDOFF.md` for exact payload shapes. `claude-desk.mjs` reuses `editorial-desk.mjs`'s `request`/`rpc` helpers rather than re-implementing them — do not add a second Supabase access layer.
- Always call `transition_case_status` (via `pnpm editorial transition ...`) for workflow moves. Never update `decision_cases.status` by any other path.

## Before every write

1. Re-read current DB state for the case (`pnpm claude:case <case-key>`).
2. Confirm it's in the state you expect (e.g. don't submit a first narrative draft if `narrative_version_count > 0` already — that's a revision, not a draft).
3. Perform the write through `scripts/editorial-desk.mjs`.
4. Re-read to verify the result, and that no newer state written by Codex or another session was clobbered.

## Editorial rules that always apply

- **T0 discipline**: only information genuinely available at the decision point may inform the player's choice. Never leak outcome knowledge into `known_at_t0` / option rationale.
- **Decision quality ≠ outcome quality**: the actual historical choice is not "the correct answer." Score both independently.
- **Player fairness**: the viewer needs enough information for a meaningful choice. Don't manufacture difficulty by withholding what the actor actually had.
- **Genuine dilemma**: both options need a credible contemporary rationale wherever history allows it. Don't make one option a strawman to sharpen the reveal.
- **Evidence discipline**: `FACT` / `CONTEMPORARY_BELIEF` / `STATED_RATIONALE` / `INFERENCE` stay distinct. Never write inference as fact. Surface real source disagreement (`research_gaps`, `source_disagreement`) instead of hiding it.

## Where the hand-researched pilot content lives

`data/cases/<case-id>/{case,evidence,narrative,shorts,progressive}.json` is a separately-schema'd research pilot (see `schema/*.json` and the "Prior narrative pilot architecture" appendix in `ARCHITECTURE.md`) covering 16 hand-researched cases, split into `CURATED_HIGH_POTENTIAL` and `LOW_FAME_STRESS_TEST` batches. It predates and is **not yet imported into** the Supabase `decision_cases` table — case IDs there do not match live `case_key` values 1:1. See `CLAUDE_PILOT_TO_DB_MAPPING.md` for the case-by-case mapping and which ones are safe candidates to bring into the DB. Do not bulk-import this content; each case needs its own mapping/review pass, and creating a brand-new `decision_cases` row is outside Claude's granted writes per `CLAUDE_DB_INTEGRATION_HANDOFF.md` (that's schema/case-creation territory — coordinate with Codex).
