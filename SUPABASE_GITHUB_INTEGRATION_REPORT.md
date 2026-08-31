# Supabase / GitHub Integration Report

## Outcome

Decision / T0 is connected to the existing Supabase project as a shared editorial content hub. The deployed product reads approved remote content through a server route and retains the six checked-in fixtures as an automatic outage fallback. Privileged editorial access remains server-side.

- Supabase project: `fnxbilbihakhqvxjmoqo`
- Migration applied: `supabase/migrations/202608300001_content_hub.sql` (`202608300001`)
- GitHub repository: `pjg605-debug/decision-under-uncertainty`
- GitHub branch: `codex/supabase-content-hub`
- Local integration source commit: `1c42b522d47d944ba47d31bb5fadf0739fa90ba9`
- Published GitHub integration snapshot: `61145826fb5a1f624f881de82d549908b37628c0`
- Production URL: `https://decision-under-uncertainty.pjg605.chatgpt.site/`
- Applied date: 2026-08-30

## Actual deployed tables

The following fourteen tables were verified in the live `public` schema after migration:

1. `agent_runs`
2. `case_information`
3. `case_scores`
4. `decision_cases`
5. `decision_options`
6. `evidence`
7. `narratives`
8. `publication_results`
9. `research_claims`
10. `research_gaps`
11. `reviews`
12. `revisions`
13. `shorts_variants`
14. `status_transitions`

The migration is additive and transactional. It contains no `DROP`, `TRUNCATE`, or `RENAME`. A preflight collision check found the existing generic `public.set_updated_at()` function, so the deployed migration was changed to the project-scoped `public.duu_set_updated_at()` rather than replacing the existing function.

## RLS and credential boundary

RLS is enabled on all fourteen tables.

- `anon` and `authenticated` receive `SELECT` only on `decision_cases`, `decision_options`, `case_information`, `evidence`, `narratives`, `case_scores`, and `shorts_variants`.
- Public case rows are limited to `APPROVED`, `PROTOTYPE_READY`, or `PUBLISHED`.
- Public narratives must be both `APPROVED` and `is_current = true`.
- Public shorts must be `APPROVED` and belong to a public case.
- `reviews`, `revisions`, `agent_runs`, `status_transitions`, `research_claims`, `research_gaps`, and `publication_results` have no public policies or grants.
- All public writes are revoked. A live `anon` insert into `agent_runs` was rejected with PostgreSQL `42501 permission denied`.
- Queue and transition RPCs are revoked from `public`, `anon`, and `authenticated`, and granted only to `service_role`.
- `SUPABASE_SERVICE_ROLE_KEY` and the dashboard token are used only by server routes and helper processes. Neither appears in Git, the client bundle, logs, or this report.

Sites environment variable names configured (values intentionally omitted):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REVIEW_DASHBOARD_TOKEN`
- `SITE_URL`

## Seeded MVP content

The seed is scoped to the six listed `case_key` values. Parent rows use `ON CONFLICT (case_key) DO UPDATE`; child rows are replaced only where `case_id` belongs to those six keys, making re-runs deterministic without duplicate child records.

| Case | Status | Options | Information | Evidence | Narratives | Scores | Reviews | Revisions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `apollo-13-1970` | APPROVED | 2 | 5 | 3 | 1 | 1 | 0 | 0 |
| `austerlitz-1805` | APPROVED | 2 | 6 | 3 | 1 | 1 | 0 | 0 |
| `challenger-1986` | APPROVED | 2 | 4 | 3 | 1 | 1 | 0 | 0 |
| `cuban-missile-1962` | APPROVED | 2 | 5 | 4 | 2 | 1 | 1 | 1 |
| `netflix-2007` | APPROVED | 2 | 5 | 4 | 1 | 1 | 0 | 0 |
| `new-coke-1985` | APPROVED | 2 | 5 | 4 | 1 | 1 | 0 | 0 |

The Cuban Missile case contains the deployed feedback-loop sample: Claude narrative v1, Codex revision request, Claude v2, linked `revisions` row, and Codex approval.

## Live verification

- Live anon content read: 6 cases, 6 current approved narratives, and 12 options.
- Normalized relation transform: all six cases returned options, T0-known information, T0-unknown information, evidence, narrative, and score data.
- Decision/outcome independence: live values retained distinct `decision_quality` and `outcome_quality` fields, including New Coke (`Weak` / `Mixed`).
- Reveal boundary: the existing UI state machine still withholds `actual_decision`, immediate outcome, long-term outcome, and quality fields until a choice is locked; progressive evidence remains pre-reveal only where configured.
- Review dashboard: authenticated server-side request returned all six reviewable cases; an invalid dashboard token returned HTTP 401.
- Agent helper: the service-role-only `get-case-for-codex-review` RPC executed successfully against the live database and returned an empty active queue, as expected for six approved cases.
- Privileged read/write cycle: a temporary `codex-smoke-test` `agent_runs` row was inserted and read; cleanup deleted exactly one row. No test row remains.
- Fixture fallback: with an intentionally unreachable Supabase URL, `/api/content` returned the safe local fallback signal (HTTP 503, `source = local`), and the client retained the bundled fixtures through its fallback branch.
- Application tests: 19 passed, 0 failed.
- Production build: passed with `/`, `/api/content`, `/api/review`, and `/review` routes.

## Existing shared-project objects

Before migration the live `public` schema contained nine unrelated tables:

- `daily_research_snapshots`
- `pipeline_errors`
- `prescreen_candidates`
- `rescue_requests`
- `rescue_results`
- `research_ledger`
- `research_runs`
- `schema_versions`
- `system_status`

All nine remained present after migration and seeding. The applied migration and seed contain no references to these tables and executed no broad destructive statement. No existing table, row, function, policy, or index was deleted, renamed, truncated, or updated. The pre-existing `public.set_updated_at()` function was specifically left untouched.

## Application behavior

`/api/content` uses only `SUPABASE_ANON_KEY`, loads approved normalized rows, and transforms them into the existing `DecisionEvent` contract. The browser begins with checked-in fixture content, swaps to Supabase only after a valid non-empty response, and marks remote failure as fallback without breaking the experience.

`/api/review` and `/review` require `REVIEW_DASHBOARD_TOKEN`; only the server route receives the service-role credential. Pending narrative versions use `is_current = false`, so an approved production narrative remains visible until Codex approves its replacement.

## Claude shared editorial DB handoff

Claude should use `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` in a trusted server or local agent environment. It must never expose the service credential to a browser or write it into Git, logs, prompts, narrative JSON, or review comments.

The exact deployed table/column contract, relationships, workflow states, transitions, queues, attribution rules, narrative versioning protocol, review/revision linkage, and helper examples are in `CLAUDE_DB_INTEGRATION_HANDOFF.md`. The supported entry point is `scripts/editorial-desk.mjs`; Claude should append narrative versions and revisions, use evidence keys for citations, and call `transition_case_status` instead of directly mutating workflow state.

