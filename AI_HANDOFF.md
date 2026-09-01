# AI Handoff — 판단 훈련 아티클 자동 발행

Updated: 2026-09-01 (Asia/Seoul)

This document is the canonical task brief for any AI agent taking over this project. If code, an automation, or an older document conflicts with this brief, this brief represents the user's current intent. Never place credentials or secret values in this file, Git history, logs, prompts, or generated articles.

## 1. User outcome

Build and operate a cumulative Korean reading site that publishes one new behavioral decision article every six hours. The editorial level is roughly a second-year university major course: explain relevant experiments, observational designs, or theoretical models and use varied thought experiments. Investment is material for reflection, not individualized advice, and the articles should not overemphasize drills or time limits.

The active production site is:

- Home: `https://decision-under-uncertainty.pjg605.chatgpt.site`
- Archive: `https://decision-under-uncertainty.pjg605.chatgpt.site/articles`
- Supabase project: `fnxbilbihakhqvxjmoqo`
- GitHub repository: `pjg605-debug/decision-under-uncertainty` (public)

## 2. Non-negotiable constraints

1. Do not charge or use the OpenAI API. The user will not add API credit.
2. Do not use a ChatGPT/Codex scheduled task as the production timer.
3. Do not use a prewritten article queue as the normal production design.
4. The server timer must initiate writing at each scheduled time, validate the result, save it to Supabase, and publish it.
5. Use GitHub Actions as the server timer while the repository remains public and standard hosted-runner use remains free.
6. If any proposed provider, model, runner, or integration may incur a fee, stop and obtain explicit user approval before enabling it.
7. Do not publish an article when generation, schema validation, duplicate detection, or citation validation fails. A missed slot is preferable to a fabricated or malformed article.
8. Never give individualized investment advice, promise returns, or recommend a specific trade.

## 3. Required schedule

Target four runs per day at 03:00, 09:00, 15:00, and 21:00 Asia/Seoul. GitHub schedules may start late under platform load; record both the scheduled slot and actual start time. Enforce one successful publication per slot with an idempotency key.

## 4. Article contract

Each article must:

- be a clean Korean blog article whose length follows the topic; do not show a reader-facing time limit;
- use the most appropriate lens among behavioral economics, behavioral finance, neuroeconomics, consumer psychology, and economic psychology;
- focus on one judgment error in trading, investing, shopping, or money use;
- identify whether its evidence is an experiment, observational study, meta-analysis, or theoretical model; explain the design and interpretation limits when an actual study exists;
- include a varied thought experiment and further-inquiry questions without turning the article into a timed training worksheet;
- cite 2–4 real primary or authoritative sources with verified title, author, year, and HTTPS DOI/original URL;
- avoid repeating the core bias, title, slug, or main scenario of recent articles;
- conform to the existing `public.articles` schema and JSON shapes for `content_blocks`, `thought_experiment`, `practice`, and `source_notes`;
- be inserted with `status='PUBLISHED'`, `is_current=true`, and a real `published_at` only after every validation passes.

Store structured content in Supabase. Produce copy/paste HTML only when the user explicitly asks for HTML.

## 5. Intended architecture

```text
GitHub Actions schedule (KST 03/09/15/21)
  -> run a no-fee open-source Korean-capable model on the hosted runner
  -> choose a topic not present in recent Supabase articles
  -> generate structured article JSON
  -> validate schema, safety, duplication, and citations
  -> call a narrowly authenticated Supabase Edge Function
  -> atomically claim the six-hour slot and insert the published article
  -> return and log the public article URL
```

Preferred authentication is GitHub OIDC validated by the Edge Function. If a shared secret is used instead, store it only in GitHub Actions Secrets and Supabase Edge Function Secrets, rotate it after exposure, and never print it.

The no-fee model must be small enough for a standard GitHub-hosted runner. Quality should be constrained with a checked-in, human-verifiable source catalog and strict structured-output validation. Do not pretend a local open-source model is ChatGPT.

## 6. Current state and known conflicts

Treat all items below as requiring live verification before mutation.

- The website and first article are already live.
- The existing Supabase Edge Function `generate-judgment-article` calls the OpenAI Responses API and failed with `429 credit_balance_exhausted`.
- A Supabase pg_cron job named `generate-judgment-article-every-6-hours` was previously enabled. It should be disabled because it calls the unpaid OpenAI path.
- Local commit `3ac8e2a` contains a draft-queue publisher design. That design conflicts with the current no-queue goal and must not be enabled as production architecture.
- GitHub default branch `claude/decision-uncertainty-case-selection-9q6h5y` contains `.github/workflows/publish-judgment-article.yml` at commit `9e23d45...`. It publishes a queued draft and therefore must be replaced, not merely supplied with a secret.
- A Codex heartbeat named `판단훈련 초안 매일 보충` may be active. It conflicts with the server-only timer requirement and should be removed or paused.
- The local implementation branch is `codex/articles-site`. GitHub scheduled workflows run from the repository's default branch, so verify the default branch before testing.
- Airtable failover code is present locally. In `auto` mode the reader merges both sources and prefers Supabase for duplicate slugs. `slug + version` is the recovery idempotency key. The Airtable base has not yet been created because four writable workspaces exist and no destination has been chosen. See `docs/AIRTABLE_FAILOVER.md`.
- Slack delivery is not configured because no workspace/channel destination has been provided. Do not guess a Slack channel. Once supplied, post only the article link and a short introduction.

## 7. Takeover sequence

1. Read this file and query the matching Supabase `ai_project_briefs` row.
2. Audit live GitHub workflows, Codex automations, Supabase cron jobs, Edge Functions, secrets by name only, and the `articles`/`article_generation_runs` tables. Do not reveal secret values.
3. Disable the failing OpenAI cron and the contradictory ChatGPT draft-replenishment timer.
4. Replace the queued-draft GitHub workflow with scheduled at-run generation.
5. Add a checked-in topic/source catalog and a deterministic recent-topic exclusion step.
6. Add strict article JSON validation, URL allow/deny rules, safety checks, and an idempotent Supabase publish endpoint.
7. Test a manual workflow run without publishing, then test one controlled live publication.
8. Confirm the article appears in `/articles` and its detail route.
9. Record the implementation commit, workflow run, Supabase deployment, model artifact and license, actual cost, and verification result in this document and the Supabase brief.

## 8. Definition of done

- Four server-side schedules exist at the required KST times.
- No active production path references `OPENAI_API_KEY` or invokes a paid inference API.
- No ChatGPT/Codex timer is required for article production.
- A scheduled run creates the article during that run; it does not consume a prewritten queue.
- Duplicate/retried runs cannot publish twice for the same six-hour slot.
- Invalid output and unverified citations fail closed.
- One controlled end-to-end run publishes a valid article to Supabase and the live site renders it.
- The GitHub Actions billing page shows no billable usage for the tested public-repository standard runner path, or the agent stops and reports otherwise.
- Tests and the production site build pass.
- The handoff record is updated with exact evidence and remaining risks.

## 9. Explicitly out of scope until requested

- Paid OpenAI API or any other paid model provider
- Automated trading, brokerage access, or trade recommendations
- PDF generation
- HTML export unless explicitly requested
- Slack posting until the user identifies a destination
