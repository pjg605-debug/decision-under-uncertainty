import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  isSupabaseNewFormatKey,
  supabaseAuthHeaders,
  resolveSupabaseServiceKey,
} from '../core/supabase-auth.mjs';

// Obviously-fake placeholders -- never real credentials. A "legacy" JWT
// only needs to start with "eyJ" for this module's detection logic; the
// rest of the string is deliberately not a valid JWT.
const FAKE_LEGACY_JWT = 'eyJhbGciOiJIUzI1NiJ9.fake-legacy-service-role-placeholder.not-a-real-signature';
const FAKE_NEW_SECRET_KEY = 'sb_secret_fake_placeholder_not_a_real_key_00000000';
const FAKE_NEW_PUBLISHABLE_KEY = 'sb_publishable_fake_placeholder_not_a_real_key_0000';

test('isSupabaseNewFormatKey distinguishes the two Supabase key formats', () => {
  assert.equal(isSupabaseNewFormatKey(FAKE_LEGACY_JWT), false);
  assert.equal(isSupabaseNewFormatKey(FAKE_NEW_SECRET_KEY), true);
  assert.equal(isSupabaseNewFormatKey(FAKE_NEW_PUBLISHABLE_KEY), true);
});

test('supabaseAuthHeaders sends both headers for a legacy JWT key (preserves existing behavior)', () => {
  const headers = supabaseAuthHeaders(FAKE_LEGACY_JWT);
  assert.equal(headers.apikey, FAKE_LEGACY_JWT);
  assert.equal(headers.authorization, `Bearer ${FAKE_LEGACY_JWT}`);
  assert.equal(Object.keys(headers).length, 2);
});

test('supabaseAuthHeaders sends only apikey for a new-format secret key (no Bearer/JWT parse)', () => {
  const headers = supabaseAuthHeaders(FAKE_NEW_SECRET_KEY);
  assert.equal(headers.apikey, FAKE_NEW_SECRET_KEY);
  assert.equal('authorization' in headers, false);
  assert.equal('Authorization' in headers, false);
  assert.equal(Object.keys(headers).length, 1);
});

test('supabaseAuthHeaders sends only apikey for a new-format publishable key too', () => {
  const headers = supabaseAuthHeaders(FAKE_NEW_PUBLISHABLE_KEY);
  assert.equal(headers.apikey, FAKE_NEW_PUBLISHABLE_KEY);
  assert.equal('authorization' in headers, false);
});

test('supabaseAuthHeaders refuses to build headers for an empty/missing key', () => {
  assert.throws(() => supabaseAuthHeaders(''), /Supabase key is required/);
  assert.throws(() => supabaseAuthHeaders(undefined), /Supabase key is required/);
});

test('resolveSupabaseServiceKey prefers SUPABASE_SECRET_KEY over the legacy var when both are set', () => {
  const resolved = resolveSupabaseServiceKey({
    SUPABASE_SECRET_KEY: FAKE_NEW_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: FAKE_LEGACY_JWT,
  });
  assert.equal(resolved, FAKE_NEW_SECRET_KEY);
});

test('resolveSupabaseServiceKey falls back to SUPABASE_SERVICE_ROLE_KEY so legacy-only deployments keep working', () => {
  const resolved = resolveSupabaseServiceKey({
    SUPABASE_SERVICE_ROLE_KEY: FAKE_LEGACY_JWT,
  });
  assert.equal(resolved, FAKE_LEGACY_JWT);
});

test('resolveSupabaseServiceKey returns an empty string, never throws, when neither var is set', () => {
  assert.equal(resolveSupabaseServiceKey({}), '');
});

test('no secret leakage: supabase-auth.mjs never logs, throws-with, or otherwise echoes a key value', async () => {
  const source = await readFile(new URL('../core/supabase-auth.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /console\.(log|error|warn)\([^)]*key/i);
  // The only place `key` may appear inside a template literal is building
  // the Bearer header itself, not an error message or log line.
  const throwLines = source.split('\n').filter((line) => /throw new Error/.test(line));
  for (const line of throwLines) assert.doesNotMatch(line, /\$\{.*key/i);
});

test('Deno edge functions inline the same rule (cross-file .ts imports do not typecheck under this repo\'s tsconfig) and never log a key', async () => {
  for (const relativePath of [
    '../supabase/functions/publish-next-article/index.ts',
    '../supabase/functions/generate-judgment-article/index.ts',
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    const fn = source.match(/function supabaseAuthHeaders[\s\S]*?\n\}/);
    assert.ok(fn, `${relativePath} should define the inline twin`);
    assert.match(fn[0], /startsWith\('sb_'\)/, `${relativePath}'s inline twin should use the same "sb_" rule`);
    // Scope the leakage check to the twin's own body, not the whole file --
    // unrelated existing log lines elsewhere (e.g. a "slot_key" identifier)
    // aren't this function's concern and shouldn't fail this assertion.
    assert.doesNotMatch(fn[0], /console\.(log|error|warn)/i);
  }
});

test('all known Supabase server-side call sites build headers through supabaseAuthHeaders(...)', async () => {
  // Node/TS call sites import the shared core/supabase-auth.mjs helper.
  const nodeCallSites = [
    '../scripts/editorial-desk.mjs',
    '../core/supabase-content.mjs',
    '../scripts/airtable-article-failover.mjs',
    '../app/api/review/route.ts',
    '../core/articles.ts',
  ];
  for (const relativePath of nodeCallSites) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(
      source,
      /import\s*\{[^}]*supabaseAuthHeaders[^}]*\}\s*from\s*['"].*supabase-auth(\.mjs)?['"]/,
      `${relativePath} should import supabaseAuthHeaders from core/supabase-auth.mjs`,
    );
    assert.match(source, /supabaseAuthHeaders\(/, `${relativePath} should call supabaseAuthHeaders(...)`);
    assert.doesNotMatch(
      source,
      /apikey:\s*\w*[Kk]ey\w*,\s*\n?\s*(authorization|Authorization):\s*`Bearer \$\{/,
      `${relativePath} should not hand-build the apikey+Bearer pair for a Supabase key anymore`,
    );
  }
  // The two Deno edge functions call their own inline twin (verified for
  // content/no-leakage in the dedicated test above) rather than importing
  // it, so they're checked here only for calling it, not for the
  // "no hand-rolled pair" pattern -- their twin's own body legitimately
  // contains that pair, guarded by the sb_ prefix check.
  for (const relativePath of [
    '../supabase/functions/publish-next-article/index.ts',
    '../supabase/functions/generate-judgment-article/index.ts',
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(source, /supabaseAuthHeaders\(key\)/, `${relativePath} should call its inline supabaseAuthHeaders(key)`);
  }
});

test('server-side key preference is documented in .env.example without a filled-in value', async () => {
  const source = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(source, /SUPABASE_SECRET_KEY=\s*$/m);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY=\s*$/m);
});
