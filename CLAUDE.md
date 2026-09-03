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

For an unattended/automated session with no live Supabase credentials, `supabase/functions/get-narrative-queue-status` exposes the same `NARRATIVE_QUEUE`/`REVISION_QUEUE` information (plus each case's structured facts) behind its own narrow, read-only secret — see that file's header comment.

To inspect one case in full before writing anything:

```bash
pnpm claude:case <case-key>
```

This returns the case row, options, T0 known/unknown information, evidence, research claims/gaps, every narrative version (with `current_narrative` flagged), and its reviews — everything needed to pick up work with zero chat memory.

## Role boundary

Claude is **researcher/writer**, and as of 2026-09-03 (product owner decision) also owns **new case supply**: case discovery, T0 reconstruction, decision alternatives, evidence interpretation, structuring a new case's facts and creating its `decision_cases`/`decision_options`/`case_information`/`evidence` rows through `RESEARCH_DONE`, narrative writing, option-rationale prose, hindsight analysis, responding to Codex/editor reviews, and narrative revisions.

Claude still does not redesign the database schema or take over UI implementation unless explicitly asked. **As of 2026-09-03 (later the same day, product owner decision), Claude also drives `CODEX_REVIEW → APPROVED → PUBLISHED` for narratives it submits itself** — see "Automated approval/publish" in `scripts/editorial-desk.mjs`'s `autoApproveAndPublish` and `CODEX_INTEGRATION_HANDOFF.md`'s section of the same name. This was a deliberate, informed removal of the review checkpoint, not a default to assume elsewhere: it does not extend to anything submitted through `app/api/review/route.ts`'s human dashboard or the `submit-review` CLI command, and it does not change any editorial rule below — T0 discipline, decision quality vs. outcome quality, genuine dilemma, and evidence discipline still constrain what gets written, there is just no second reviewer confirming it before publish. The former blanket rule against Claude writing `decision_cases`/`decision_options`/`case_information` is superseded for **new** cases only (see "Creating a new case" below) — an **existing** row, whether created by Codex or by Claude in an earlier session, is still never casually rewritten; narrative writes always append a new `narratives` version, never overwrite one, and a case that already has a `decision_cases` row is never re-imported or silently patched.

## Creating a new case

Use the same file-based, write-through-CI pattern as narrative submission, so this session never needs a live `SUPABASE_SERVICE_ROLE_KEY`:

1. Write `content/pending-cases/<case-key>.json` (see `scripts/import-pending-case.mjs`'s `validateDraft` for the exact required shape — `decision_cases` fields, 2+ `options`, `case_information` with at least one `KNOWN_AT_T0` and one `UNKNOWN_AT_T0`, and a non-empty `evidence` array).
2. `status` may only be `DISCOVERED`, `RESEARCHING`, or `RESEARCH_DONE` in the draft — never anything from `CODEX_REVIEW` onward; those stages happen through the normal editorial review flow afterward, not at import time.
3. Commit and push to `claude/decision-uncertainty-case-selection-9q6h5y`. The `import-pending-case.yml` workflow validates, calls the `import_pending_case()` Postgres function (one transaction — a mid-import failure leaves no partial case behind), reads the result back, and archives the draft on success; on any mismatch it leaves the file in place and fails the job (fail closed).
4. The function itself refuses outright if `case_key` already exists — check `CLAUDE_PILOT_TO_DB_MAPPING.md` and/or the live queue first so you're not wasting a research pass on a case that's already in.
5. Do not import in bulk. Land one case, confirm it actually reaches `RESEARCH_DONE` and shows up in `get-narrative-queue-status`, and only then continue with the next.
6. Keep a backlog target, not an unbounded one — a handful of cases sitting at `RESEARCH_DONE`/awaiting review is healthy; producing far more than Codex can review is not. If `get-narrative-queue-status` already shows several cases waiting, prioritize drafting their narratives over sourcing new cases.

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

`data/cases/<case-id>/{case,evidence,narrative,shorts,progressive}.json` is a separately-schema'd research pilot (see `schema/*.json` and the "Prior narrative pilot architecture" appendix in `ARCHITECTURE.md`) covering 16 hand-researched cases, split into `CURATED_HIGH_POTENTIAL` and `LOW_FAME_STRESS_TEST` batches. It predates the Supabase `decision_cases` table and its case IDs do not match live `case_key` values 1:1. See `CLAUDE_PILOT_TO_DB_MAPPING.md` for the case-by-case mapping, which are already live (never re-import those), and which are safe candidates for "Creating a new case" above. Import one at a time via that pipeline, not in bulk, and re-check the mapping doc (or the live queue) immediately before each one — Codex may have created a row for it independently since the mapping doc was last updated.
