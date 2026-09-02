import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateDraft,
  findMismatch,
  makeRequest,
  nextVersion,
  ingestOne,
} from '../scripts/ingest-pending-articles.mjs';

// Obviously-fake placeholder -- never a real credential. Only used to prove
// makeRequest() builds a request function without needing a live Supabase.
const FAKE_SECRET_KEY = 'sb_secret_fake_placeholder_not_a_real_key_00000000';

function validDraft(overrides = {}) {
  return {
    slug: 'test-slug',
    title: '제목',
    subtitle: '부제',
    excerpt: '요약',
    category: '행동경제학',
    tags: ['태그1'],
    reading_minutes: 5,
    difficulty: '입문',
    hero_kicker: '킥커',
    content_blocks: Array.from({ length: 10 }, (_, i) => ({ kind: 'paragraph', text: `문단 ${i}` })),
    thought_experiment: { title: 't', prompt: 'p', choices: ['a', 'b'], reflection: 'r' },
    practice: {
      title: '실행',
      minutes: 0,
      steps: ['1', '2', '3', '4'],
      rule_template: 'rule',
    },
    source_notes: [
      { title: 'A', authors: 'X', year: 2000, url: 'https://doi.org/10.1/a', note: 'n' },
      { title: 'B', authors: 'Y', year: 2001, url: 'https://doi.org/10.1/b', note: 'n' },
    ],
    author_agent: 'claude',
    ...overrides,
  };
}

test('validateDraft accepts a well-formed draft', () => {
  assert.doesNotThrow(() => validateDraft(validDraft(), 'ok.json'));
});

test('validateDraft rejects a draft missing a required field', () => {
  const draft = validDraft();
  delete draft.title;
  assert.throws(() => validateDraft(draft, 'bad.json'), /missing required field/);
});

test('validateDraft rejects too few content_blocks', () => {
  const draft = validDraft({ content_blocks: [{ kind: 'paragraph', text: 'only one' }] });
  assert.throws(() => validateDraft(draft, 'bad.json'), /content_blocks must be an array of at least 10/);
});

test('validateDraft rejects too few practice steps', () => {
  const draft = validDraft({ practice: { title: 't', minutes: 0, steps: ['1', '2'], rule_template: 'r' } });
  assert.throws(() => validateDraft(draft, 'bad.json'), /practice.steps must have at least 4/);
});

test('validateDraft rejects too few source_notes', () => {
  const draft = validDraft({ source_notes: [{ title: 'A', authors: 'X', year: 2000, url: 'https://doi.org/1', note: 'n' }] });
  assert.throws(() => validateDraft(draft, 'bad.json'), /source_notes must cite at least 2/);
});

test('validateDraft rejects a source_notes entry without an https url', () => {
  const draft = validDraft({
    source_notes: [
      { title: 'A', authors: 'X', year: 2000, url: 'http://insecure.example/a', note: 'n' },
      { title: 'B', authors: 'Y', year: 2001, url: 'https://doi.org/10.1/b', note: 'n' },
    ],
  });
  assert.throws(() => validateDraft(draft, 'bad.json'), /needs an https:\/\/ url/);
});

test('validateDraft rejects disallowed individualized-advice phrases anywhere in the draft', () => {
  const draft = validDraft({ excerpt: '이 종목은 수익을 보장합니다' });
  assert.throws(() => validateDraft(draft, 'bad.json'), /disallowed individualized-advice phrase/);
});

test('findMismatch returns null for identical primitives, arrays, and objects', () => {
  assert.equal(findMismatch('a', 'a'), null);
  assert.equal(findMismatch(5, 5), null);
  assert.equal(findMismatch([1, 2, { a: 'b' }], [1, 2, { a: 'b' }]), null);
  assert.equal(findMismatch({ x: [1, 2], y: 'z' }, { x: [1, 2], y: 'z' }), null);
});

test('findMismatch detects a corrupted primitive field', () => {
  const mismatch = findMismatch({ title: 'original' }, { title: 'corrupted' }, '');
  assert.match(mismatch, /title: "original" vs "corrupted"/);
});

test('findMismatch detects a dropped array element (truncated content_blocks)', () => {
  const sent = [{ text: 'a' }, { text: 'b' }, { text: 'c' }];
  const stored = [{ text: 'a' }, { text: 'b' }];
  const mismatch = findMismatch(sent, stored, 'content_blocks');
  assert.match(mismatch, /array length 3 vs 2/);
});

test('findMismatch detects a mutated nested field deep inside an array of objects', () => {
  const sent = [{ kind: 'paragraph', text: 'safe text' }];
  const stored = [{ kind: 'paragraph', text: 'tampered text' }];
  const mismatch = findMismatch(sent, stored, 'content_blocks');
  assert.match(mismatch, /content_blocks\[0\]\.text: "safe text" vs "tampered text"/);
});

test('findMismatch detects a type change (e.g. a field silently coerced to null)', () => {
  const mismatch = findMismatch('some text', null, 'excerpt');
  assert.match(mismatch, /excerpt: type string vs object/);
});

test('makeRequest builds a working request function without requiring live env vars', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ id: 'abc123' }]),
    };
  };
  try {
    const request = makeRequest('https://example.supabase.co/', FAKE_SECRET_KEY);
    const result = await request('articles', { method: 'POST', body: '{}' });
    assert.deepEqual(result, [{ id: 'abc123' }]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/articles');
    assert.equal(calls[0].init.headers.apikey, FAKE_SECRET_KEY);
    assert.equal('authorization' in calls[0].init.headers, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('makeRequest throws with status and body text on a non-ok response (no silent failure)', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    text: async () => '{"code":"PGRST202"}',
  });
  try {
    const request = makeRequest('https://example.supabase.co', FAKE_SECRET_KEY);
    await assert.rejects(() => request('articles'), /404.*PGRST202/s);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('nextVersion returns 1 when no prior version exists, and max+1 otherwise', async () => {
  const requestNone = async () => [];
  assert.equal(await nextVersion(requestNone, 'brand-new-slug'), 1);

  const requestExisting = async () => [{ version: 3 }];
  assert.equal(await nextVersion(requestExisting, 'existing-slug'), 4);
});

test('ingestOne throws and leaves the file in place when the read-back does not match what was sent (fail closed)', async () => {
  // Simulate a request() where the POST insert "succeeds" but the
  // read-back has a corrupted field -- ingestOne must throw rather than
  // archive the source file, per this script's fail-closed contract.
  // ingestOne resolves filenames against the real content/pending-articles
  // directory, so this exercises it against the actual seeded draft file.
  let insertedPayload;
  const fakeRequest = async (_path, init) => {
    if (init?.method === 'POST') {
      insertedPayload = JSON.parse(init.body);
      return [{ id: 'row-1', ...insertedPayload }];
    }
    // Read-back: corrupt the title to simulate DB-layer corruption.
    return [{ ...insertedPayload, id: 'row-1', title: 'CORRUPTED' }];
  };

  await assert.rejects(
    () => ingestOne(fakeRequest, 'disposition-effect-stop-loss.json'),
    /content mismatch after insert/,
  );
});

test('the pending draft file has been created and is schema-valid', async () => {
  const source = await readFile(
    new URL('../content/pending-articles/disposition-effect-stop-loss.json', import.meta.url),
    'utf8',
  );
  const draft = JSON.parse(source);
  assert.doesNotThrow(() => validateDraft(draft, 'disposition-effect-stop-loss.json'));
});

test('ingestion script never logs a Supabase key value', async () => {
  const source = await readFile(new URL('../scripts/ingest-pending-articles.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /console\.(log|error|warn)\([^)]*serviceKey/i);
});

test('ingestion script builds headers through the shared supabaseAuthHeaders helper', async () => {
  const source = await readFile(new URL('../scripts/ingest-pending-articles.mjs', import.meta.url), 'utf8');
  assert.match(source, /import\s*\{[^}]*supabaseAuthHeaders[^}]*\}\s*from\s*['"].*supabase-auth(\.mjs)?['"]/);
  assert.match(source, /supabaseAuthHeaders\(serviceKey\)/);
});

test('ingest workflow is workflow_dispatch-only (no schedule)', async () => {
  const source = await readFile(
    new URL('../.github/workflows/ingest-pending-articles.yml', import.meta.url),
    'utf8',
  );
  assert.match(source, /workflow_dispatch:/);
  assert.doesNotMatch(source, /^\s*schedule:/m);
});
