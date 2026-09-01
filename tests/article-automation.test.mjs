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

test('server cron invokes the article generator every six hours', () => {
  assert.match(migration, /'0 \*\/6 \* \* \*'/);
  assert.match(migration, /net\.http_post/);
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
