# Claude DB Integration Handoff

## Deployed connection contract

This handoff describes the schema actually deployed to Supabase project `fnxbilbihakhqvxjmoqo` by migration `202608300001_content_hub.sql` on 2026-08-30. The project URL is `https://fnxbilbihakhqvxjmoqo.supabase.co`. Store credentials only in server-side environment variables.

Required environment variable names:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — server/agent runtime only; never put it in a browser, Git, logs, prompts, or generated content
- `SUPABASE_ANON_KEY` — read-only approved-content access; not sufficient for Claude writes
- `REVIEW_DASHBOARD_TOKEN` — internal Codex dashboard only

Claude should run from a trusted server or local agent environment with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Prefer the checked-in helper `scripts/editorial-desk.mjs`; it sends credentials only in HTTPS request headers.

## Deployed tables and columns

All IDs are UUIDs. All timestamps are `timestamptz` unless noted.

| Table | Actual deployed columns |
| --- | --- |
| `decision_cases` | `id`, `case_key`, `title`, `domain`, `subdomain`, `actor`, `actor_role`, `date_or_period`, `era`, `location`, `t0`, `context_summary`, `actual_decision_key`, `immediate_outcome`, `long_term_outcome`, `decision_quality`, `outcome_quality`, `popularity`, `controversy_risk`, `context_compression`, `visualizability`, `source_disagreement`, `uncertainty_factors`, `metadata`, `progressive`, `narrative_key`, `status`, `fame_score`, `research_priority`, `created_at`, `updated_at` |
| `decision_options` | `id`, `case_id`, `option_key`, `decision_key`, `sort_order`, `label`, `short_description`, `upside`, `downside`, `known_tradeoffs`, `created_at` |
| `case_information` | `id`, `case_id`, `information_type`, `sequence`, `content`, `evidence_id`, `created_at` |
| `evidence` | `id`, `case_id`, `evidence_key`, `source_type`, `title`, `author_or_institution`, `publication_date`, `url`, `accessed_at` (date), `citation`, `evidence_class`, `supported_claim`, `source_quality`, `source_disagreement`, `created_at` |
| `narratives` | `id`, `case_id`, `narrative_key`, `version` (integer), `status`, `author_agent`, `hook`, `short_setup`, `why_option_a_made_sense`, `why_option_b_made_sense`, `actual_decision_explanation`, `outcome_story`, `hindsight_analysis`, `decision_principle`, `longform_story`, `evidence_refs`, `quality_evaluations`, `revision_summary`, `is_current`, `created_at`, `updated_at` |
| `reviews` | `id`, `case_id`, `narrative_id`, `reviewer_agent`, `review_type`, `field_name`, `severity`, `status`, `verdict`, `comment`, `suggested_change`, `findings`, `created_at`, `resolved_at` |
| `revisions` | `id`, `case_id`, `narrative_id`, `triggered_by_review_id`, `author_agent`, `before_version`, `after_version`, `summary`, `changes`, `created_at` |
| `case_scores` | `id`, `case_id`, `curiosity`, `decision`, `stakes`, `mystery`, `explainability`, `evidence`, `player_fairness`, `dilemma_balance`, `context_compression`, `reveal_payoff`, `scorer`, `scoring_version`, `shorts_potential`, `notes`, `updated_at` |
| `shorts_variants` | `id`, `case_id`, `narrative_id`, `version`, `status`, `author_agent`, `duration_target`, `script`, `storyboard`, `hook_variant`, `created_at` |
| `publication_results` | `id`, `case_id`, `shorts_variant_id`, `platform`, `external_id`, `published_at`, `views`, `likes`, `comments`, `average_view_duration`, `average_percentage_viewed`, `stayed_to_watch`, `subscribers_gained`, `created_at`, `updated_at` |
| `agent_runs` | `id`, `agent_name`, `run_type`, `status`, `case_id`, `input`, `output`, `error_message`, `started_at`, `completed_at` |
| `status_transitions` | `id`, `case_id`, `from_status`, `to_status`, `actor_agent`, `reason`, `created_at` |
| `research_claims` | `id`, `case_id`, `claim_key`, `claim_text`, `claim_class`, `evidence_keys`, `status`, `created_at`, `updated_at` |
| `research_gaps` | `id`, `case_id`, `gap_type`, `description`, `severity`, `status`, `assigned_agent`, `created_at`, `resolved_at` |

JSONB columns are `uncertainty_factors`, `metadata`, `progressive`, `known_tradeoffs`, `evidence_refs`, `quality_evaluations`, `findings`, `changes`, `storyboard`, `input`, `output`, and `evidence_keys`.

## Relationships

- `decision_cases.id` is the parent key for every case-scoped table.
- `decision_options.case_id`, `case_information.case_id`, `evidence.case_id`, `narratives.case_id`, `reviews.case_id`, `revisions.case_id`, `case_scores.case_id`, `shorts_variants.case_id`, `publication_results.case_id`, `status_transitions.case_id`, `research_claims.case_id`, and `research_gaps.case_id` cascade on case deletion.
- `agent_runs.case_id` uses `ON DELETE SET NULL`.
- `case_information.evidence_id → evidence.id` uses `ON DELETE SET NULL`.
- `reviews.narrative_id → narratives.id` uses `ON DELETE SET NULL`.
- `revisions.narrative_id → narratives.id` cascades; `revisions.triggered_by_review_id → reviews.id` uses `ON DELETE SET NULL`.
- `shorts_variants.narrative_id → narratives.id` and `publication_results.shorts_variant_id → shorts_variants.id` use `ON DELETE SET NULL`.
- `case_scores.case_id` is unique: one scorecard per case.
- `narratives` is unique on `(case_id, version)` and has a partial unique index allowing only one `is_current = true` row per case.

## Controlled values

- Case workflow: `DISCOVERED`, `RESEARCHING`, `RESEARCH_DONE`, `NARRATIVE_DRAFTED`, `CODEX_REVIEW`, `REVISION_REQUESTED`, `REVISION_DONE`, `EDITOR_REVIEW`, `APPROVED`, `PROTOTYPE_READY`, `PUBLISHED`, `HOLD`, `REJECTED`.
- Narrative status: `DRAFT`, `IN_REVIEW`, `REVISION_REQUESTED`, `APPROVED`, `ARCHIVED`.
- Information type: `KNOWN_AT_T0`, `UNKNOWN_AT_T0`, `PROGRESSIVE_EVIDENCE`.
- Evidence/claim class: `FACT`, `CONTEMPORARY_BELIEF`, `STATED_RATIONALE`, `INFERENCE`.
- Review verdict: `APPROVE`, `REVISE`, `HOLD`, `REJECT`; review status: `OPEN`, `RESOLVED`, `DISMISSED`.
- Review severity: `LOW`, `MEDIUM`, `HIGH`, `BLOCKING`.
- Agent run status: `STARTED`, `SUCCEEDED`, `FAILED`, `CANCELLED`.

## Allowed case transitions

Self-transitions are accepted. Other deployed transitions are:

- `DISCOVERED → RESEARCHING | HOLD | REJECTED`
- `RESEARCHING → RESEARCH_DONE | HOLD | REJECTED`
- `RESEARCH_DONE → NARRATIVE_DRAFTED | HOLD | REJECTED`
- `NARRATIVE_DRAFTED → CODEX_REVIEW | REVISION_REQUESTED | HOLD`
- `CODEX_REVIEW → REVISION_REQUESTED | EDITOR_REVIEW | APPROVED | HOLD | REJECTED`
- `REVISION_REQUESTED → REVISION_DONE | HOLD`
- `REVISION_DONE → CODEX_REVIEW | EDITOR_REVIEW | APPROVED | REVISION_REQUESTED | HOLD`
- `EDITOR_REVIEW → APPROVED | REVISION_REQUESTED | REJECTED`
- `APPROVED → PROTOTYPE_READY | REVISION_REQUESTED | HOLD`
- `PROTOTYPE_READY → PUBLISHED | REVISION_REQUESTED`
- `PUBLISHED → REVISION_REQUESTED`
- `HOLD → DISCOVERED | RESEARCHING | RESEARCH_DONE | NARRATIVE_DRAFTED | CODEX_REVIEW`
- `REJECTED → DISCOVERED`

Never update `decision_cases.status` directly. Call the service-role-only `transition_case_status` RPC so validation and `status_transitions` attribution remain intact.

## Claude queues and write responsibilities

Claude reads:

- Research queue: RPC `get_cases_for_research(10)` returns `DISCOVERED` and `RESEARCHING` ordered by `research_priority`.
- Narrative queue: RPC `get_cases_for_narrative(10)` returns `RESEARCH_DONE`.
- Revision queue: RPC `get_revision_requests(10)` returns `reviews` where `status = 'OPEN'` and `verdict = 'REVISE'`.
- For a selected case, read `decision_cases`, `decision_options`, `case_information`, `evidence`, `research_claims`, `research_gaps`, `narratives`, and the referenced `reviews`.

Claude writes only as required by its assignment:

- Research: `evidence`, `research_claims`, `research_gaps`, and an `agent_runs` audit row.
- Narrative: append a row to `narratives`; never overwrite a previous version.
- Revision: append the new `narratives` version, then append `revisions` with `triggered_by_review_id` pointing to the requesting `reviews` row.
- Workflow: call `transition_case_status`; do not bypass the RPC.

Canonical structured facts belong to `decision_cases`, `decision_options`, and T0 `case_information`. Claude must not alter them casually or rewrite them as part of narrative editing.

## Narrative versioning and review loop

1. Determine `version = max(version) + 1` for the case.
2. Insert the draft with `status = 'IN_REVIEW'`, `author_agent = 'claude'`, and `is_current = false`.
3. Keep the existing approved `is_current = true` narrative serving production while the new version is reviewed.
4. When responding to a revision request, add a `revisions` row linking the new narrative to `reviews.id` through `triggered_by_review_id`, with `before_version`, `after_version`, `summary`, and structured `changes`.
5. Transition the case to `NARRATIVE_DRAFTED` for a first draft or `REVISION_DONE` for a requested revision.
6. Codex approval makes the approved target `is_current = true` and clears the previous current flag. Claude does not self-approve.

Use `evidence_refs` to store the case-scoped `evidence.evidence_key` values supporting narrative claims. Keep `Actual Decision`, `Outcome`, and `Decision Quality` separate. Do not contaminate T0 sections with outcome knowledge.

## Agent attribution

- Narrative authorship: `narratives.author_agent = 'claude'`.
- Research/revision ownership: `research_gaps.assigned_agent`, `revisions.author_agent`.
- Run audit: insert `agent_runs` with `agent_name = 'claude'`, a stable `run_type`, input/output summaries without secrets, and final status/timestamps.
- Workflow audit: pass `p_actor_agent = 'claude'` and a concise non-secret reason to `transition_case_status`; the trigger records `status_transitions.actor_agent` and `reason`.

## Helper usage

From the repository root, after setting the two server variables:

```powershell
node scripts/editorial-desk.mjs get-case-for-research 10
node scripts/editorial-desk.mjs get-case-for-narrative 10
node scripts/editorial-desk.mjs get-revision-requests 10
node scripts/editorial-desk.mjs transition <case-key> RESEARCH_DONE claude "Evidence package complete"
node scripts/editorial-desk.mjs submit-narrative-version '<json-payload>'
```

Minimum `submit-narrative-version` payload shape:

```json
{
  "case_id": "uuid",
  "case_key": "stable-case-key",
  "author_agent": "claude",
  "summary": "What this version changes",
  "triggered_by_review_id": "optional-review-uuid",
  "changes": [],
  "narrative": {
    "narrative_key": "stable-case-key",
    "hook": "...",
    "short_setup": "...",
    "why_option_a_made_sense": "...",
    "why_option_b_made_sense": "...",
    "actual_decision_explanation": "...",
    "outcome_story": "...",
    "hindsight_analysis": "...",
    "decision_principle": "...",
    "longform_story": "...",
    "evidence_refs": ["case-scoped-evidence-key"],
    "quality_evaluations": {
      "PLAYER_FAIRNESS": 0,
      "DILEMMA_BALANCE": 0,
      "CONTEXT_COMPRESSION": 0,
      "REVEAL_PAYOFF": 0
    }
  }
}
```

## Safety rules

- Use HTTPS and server environment variables; never paste a privileged key into content, commits, logs, or a browser bundle.
- The anon key is read-only under RLS and exposes only approved cases plus approved child content. It cannot access reviews, revisions, queues, status history, or agent runs.
- Do not run `TRUNCATE`, broad `DELETE`, destructive migrations, or schema renames.
- Every mutation must be scoped by `case_id`, `case_key`, narrative/review ID, or the helper RPC.
- Preserve the local `data/` fixtures; they are the production outage fallback.
