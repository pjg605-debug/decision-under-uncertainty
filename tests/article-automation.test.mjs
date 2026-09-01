import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../supabase/migrations/202609010002_article_automation.sql', import.meta.url),
  'utf8',
);
const worker = await readFile(
  new URL('../supabase/functions/generate-judgment-article/index.ts', import.meta.url),
  'utf8',
);
const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');
const queueMigration = await readFile(
  new URL('../supabase/migrations/202609010003_article_draft_queue.sql', import.meta.url),
  'utf8',
);
const publisher = await readFile(
  new URL('../supabase/functions/publish-next-article/index.ts', import.meta.url),
  'utf8',
);
const workflow = await readFile(
  new URL('../.github/workflows/publish-judgment-article.yml', import.meta.url),
  'utf8',
);

test('server cron invokes the article generator every six hours', () => {
  assert.match(migration, /'0 \*\/6 \* \* \*'/);
  assert.match(migration, /net\.http_post/);
  assert.match(migration, /timeout_milliseconds := 120000/);
  assert.match(migration, /article_generator_cron_secret/);
});

test('generation slots are idempotent and auditable', () => {
  assert.match(migration, /slot_key text not null unique/);
  assert.match(migration, /claim_article_generation_slot/);
  assert.match(migration, /finish_article_generation_slot/);
  assert.match(worker, /slot_already_processed/);
});

test('the worker keeps privileged credentials server-side', () => {
  assert.match(config, /\[functions\.generate-judgment-article\][\s\S]*verify_jwt = false/);
  assert.match(worker, /Deno\.env\.get\('OPENAI_API_KEY'\)/);
  assert.match(worker, /Deno\.env\.get\('ARTICLE_CRON_SECRET_V2'\)/);
  assert.doesNotMatch(worker, /sk-[A-Za-z0-9_-]{16,}/);
});

test('the worker generates structured research-backed articles', () => {
  assert.match(worker, /json_schema/);
  assert.match(worker, /web_search_preview/);
  assert.match(worker, /source_notes/);
  assert.match(worker, /status: 'PUBLISHED'/);
});

test('the paid API cron is removed when the draft queue is installed', () => {
  assert.match(queueMigration, /cron\.unschedule/);
  assert.match(queueMigration, /generate-judgment-article-every-6-hours/);
});

test('the oldest draft is published atomically', () => {
  assert.match(queueMigration, /publish_next_draft_article/);
  assert.match(queueMigration, /status = 'DRAFT'/);
  assert.match(queueMigration, /order by created_at asc, id asc/);
  assert.match(queueMigration, /for update skip locked/);
  assert.match(queueMigration, /status = 'PUBLISHED'/);
});

test('GitHub publishes one queued draft four times per day in Seoul', () => {
  assert.match(workflow, /cron: '0 3,9,15,21 \* \* \*'/);
  assert.match(workflow, /timezone: 'Asia\/Seoul'/);
  assert.match(workflow, /secrets\.GITHUB_PUBLISH_SECRET/);
  assert.match(workflow, /publish-next-article/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY/);
});

test('the publisher requires the dedicated GitHub secret', () => {
  assert.match(config, /\[functions\.publish-next-article\][\s\S]*verify_jwt = false/);
  assert.match(publisher, /GITHUB_PUBLISH_SECRET/);
  assert.match(publisher, /publish_next_draft_article/);
});
