# Airtable failover for articles

## Outcome

Airtable is a temporary publishing source when Supabase management or data access is unavailable. The website can read both stores, and an idempotent recovery job copies pending Airtable records into Supabase after service returns.

The system never copies Supabase credentials into Airtable. Tokens remain server-side environment variables or GitHub secrets.

Current provisioned destination:

- Workspace: `Insight`
- Base: `Decision Articles Failover` (`appwRBRbocw1KUlHa`)
- Table: `Articles` (`tblZGa8VwchQTAznx`)
- Initial records: 10 articles, all `PUBLISHED / PENDING`

## Source policy

- `ARTICLE_SOURCE_MODE=auto`: read both sources, merge by `slug`, and prefer the Supabase row when both stores contain the same slug.
- `ARTICLE_SOURCE_MODE=airtable`: read only Airtable, then use bundled content if Airtable fails.
- `ARTICLE_SOURCE_MODE=supabase`: read only Supabase, then use bundled content if Supabase fails.
- A malformed or unavailable external source fails closed and does not prevent the other source from rendering.

## Airtable table contract

Create one table named `Articles`. Use `Title` as the primary field.

| Field | Airtable type |
| --- | --- |
| Title | Single line text (primary) |
| Slug | Single line text |
| Version | Number, integer |
| Status | Single select: `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| Is Current | Checkbox |
| Subtitle, Excerpt, Hero Kicker | Long text |
| Category, Difficulty, Author Agent | Single line text |
| Tags JSON | Long text |
| Reading Minutes | Number, integer |
| Content Blocks JSON | Long text |
| Thought Experiment JSON | Long text |
| Practice JSON | Long text |
| Source Notes JSON | Long text |
| Published At | Date with time |
| Sync State | Single select: `PENDING`, `SYNCED`, `ERROR` |
| Supabase ID | Single line text |
| Last Sync Error | Long text |

`slug + version` is the application-level idempotency key. Do not manually reuse it for different content.

## Activation

1. Add a narrowly scoped `AIRTABLE_TOKEN`, the recorded base/table IDs, and `ARTICLE_SOURCE_MODE=auto` to the hosted Site environment.
2. Seed future prepared batches with `pnpm airtable:seed`; the initial ten-article batch is already present.
3. After Supabase returns, apply migration `202609010006_airtable_article_sync.sql`.
4. Add the matching GitHub secrets/variables and set repository variable `AIRTABLE_FAILOVER_ENABLED=true`.
5. Run the sync workflow manually once. It will then retry hourly at minute 17.

Use `--dry-run` with either script command to count work without writing.

## Recovery behavior

The sync job reads only current published Airtable records whose `Sync State` is not `SYNCED`. Supabase receives each record through a service-role-only RPC. The RPC retires an older current version of the same slug and upserts the requested `slug + version` atomically. Airtable is marked `SYNCED` only after Supabase returns success; otherwise it records a bounded error and leaves the record retryable.
