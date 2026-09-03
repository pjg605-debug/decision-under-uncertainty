import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// This is a Deno Edge Function (not a Node module), so it can't be imported
// and run under `node --test`. As with the other workflow/route source-text
// tests in this repo, we assert on the source directly.
const src = await readFile(
  new URL(
    '../supabase/functions/get-narrative-queue-status/index.ts',
    import.meta.url,
  ),
  'utf8',
);

test('the queue-status function requires its own narrow secret, not the service role key, from the caller', () => {
  assert.match(src, /x-queue-secret/);
  assert.match(src, /Deno\.env\.get\('NARRATIVE_QUEUE_SECRET'\)/);
  assert.match(src, /return json\(\{ error: 'Unauthorized' \}, 401\)/);
});

test('the function never performs a write -- read-only by construction', () => {
  assert.doesNotMatch(src, /\.insert\(/);
  assert.doesNotMatch(src, /\.update\(/);
  assert.doesNotMatch(src, /\.upsert\(/);
  assert.doesNotMatch(src, /\.delete\(/);
  assert.doesNotMatch(src, /rpc\('transition_case_status'/);
  assert.doesNotMatch(src, /rpc\('submit_narrative/);
});

test('the service role key is read only from the platform-provided env var, never a literal', () => {
  assert.match(src, /Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/);
  assert.doesNotMatch(src, /eyJ[A-Za-z0-9_-]{20,}/, 'no literal JWT-shaped secret in source');
});

test('the queue-status function reports missing_languages per case so the caller knows what to draft', () => {
  assert.match(src, /missing_languages:\s*SUPPORTED_LANGUAGES\.filter/);
  assert.match(src, /const SUPPORTED_LANGUAGES = \['en', 'ko'\]/);
});

test('the revision queue carries the actual review feedback needed to write a fix', () => {
  assert.match(src, /comment: review\.comment/);
  assert.match(src, /suggested_change: review\.suggested_change/);
});
