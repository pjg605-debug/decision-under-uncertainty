import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const handoff = await readFile(new URL('../AI_HANDOFF.md', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../supabase/migrations/202609010004_ai_project_brief.sql', import.meta.url),
  'utf8',
);

test('handoff states the current no-fee server-only goal', () => {
  assert.match(handoff, /Do not charge or use the OpenAI API/);
  assert.match(handoff, /Do not use a ChatGPT\/Codex scheduled task/);
  assert.match(handoff, /Do not use a prewritten article queue/);
  assert.match(handoff, /03:00, 09:00, 15:00, and 21:00 Asia\/Seoul/);
});

test('handoff exposes conflicts and a concrete takeover sequence', () => {
  assert.match(handoff, /credit_balance_exhausted/);
  assert.match(handoff, /3ac8e2a/);
  assert.match(handoff, /9e23d45/);
  assert.match(handoff, /Takeover sequence/);
  assert.match(handoff, /Definition of done/);
});

test('Supabase stores the same brief behind RLS', () => {
  assert.match(migration, /create table if not exists public\.ai_project_briefs/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.ai_project_briefs from anon, authenticated/);
  assert.match(migration, /judgment-training-article-automation/);
  assert.match(migration, /AI_HANDOFF\.md/);
});
