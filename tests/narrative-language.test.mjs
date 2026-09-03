import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchApprovedContent } from '../core/supabase-content.mjs';
import {
  SUPPORTED_NARRATIVE_LANGUAGES,
  assertSupportedNarrativeLanguage,
  submitNarrativeVersion,
} from '../scripts/editorial-desk.mjs';

const migration = await readFile(
  new URL('../supabase/migrations/202609020001_narrative_language.sql', import.meta.url),
  'utf8',
);

test('narrative language migration adds a not-null, checked language column', () => {
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
  assert.match(migration, /alter table public\.narratives add column if not exists language text/);
  assert.match(migration, /update public\.narratives set language = 'en' where language is null/);
  assert.match(migration, /alter table public\.narratives alter column language set not null/);
  assert.match(migration, /check \(language in \('en', 'ko'\)\)/);
  // No default after tightening to not null -- new inserts must state a
  // language explicitly; only the backfill UPDATE sets 'en' for old rows.
  assert.doesNotMatch(migration, /language text (not null )?default 'en'/);
  assert.doesNotMatch(migration, /\b(drop table|truncate)\b/i);
});

test('narrative language migration rescopes version and is_current uniqueness per language', () => {
  assert.match(migration, /drop constraint if exists narratives_case_id_version_key/);
  assert.match(migration, /add constraint narratives_case_id_language_version_key unique \(case_id, language, version\)/);
  assert.match(migration, /drop index if exists public\.narratives_one_current_per_case;/);
  assert.match(
    migration,
    /create unique index narratives_one_current_per_case_language on public\.narratives\(case_id, language\) where is_current/,
  );
});

test('fetchApprovedContent rejects an unsupported language before making a request', async () => {
  await assert.rejects(
    () =>
      fetchApprovedContent({
        url: 'https://example.supabase.co',
        key: 'sb_publishable_fake',
        language: 'fr',
        fetchImpl: () => {
          throw new Error('fetchImpl must not be called for an unsupported language');
        },
      }),
    /Unsupported language "fr"/,
  );
});

test('fetchApprovedContent defaults to English and filters the embedded narratives resource by language', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => [] };
  };
  await fetchApprovedContent({
    url: 'https://example.supabase.co',
    key: 'sb_publishable_fake',
    fetchImpl,
  });
  assert.equal(calls.length, 1);
  const requested = new URL(calls[0]);
  assert.equal(requested.searchParams.get('narratives.language'), 'eq.en');

  calls.length = 0;
  await fetchApprovedContent({
    url: 'https://example.supabase.co',
    key: 'sb_publishable_fake',
    language: 'ko',
    fetchImpl,
  });
  const requestedKo = new URL(calls[0]);
  assert.equal(requestedKo.searchParams.get('narratives.language'), 'eq.ko');
});

test('assertSupportedNarrativeLanguage only accepts en/ko and never silently defaults', () => {
  assert.deepEqual(SUPPORTED_NARRATIVE_LANGUAGES, ['en', 'ko']);
  assert.doesNotThrow(() => assertSupportedNarrativeLanguage('en'));
  assert.doesNotThrow(() => assertSupportedNarrativeLanguage('ko'));
  assert.throws(() => assertSupportedNarrativeLanguage(undefined), /language is required/);
  assert.throws(() => assertSupportedNarrativeLanguage(''), /language is required/);
  assert.throws(() => assertSupportedNarrativeLanguage('fr'), /language is required/);
  assert.throws(() => assertSupportedNarrativeLanguage('EN'), /language is required/, 'must be exact, not case-insensitive');
});

function mockRequest(existingVersionRow) {
  const calls = [];
  const request = async (path, init) => {
    calls.push({ path, init });
    if (typeof path === 'string' && path.startsWith('narratives?case_id=')) {
      return existingVersionRow ? [existingVersionRow] : [];
    }
    if (path === 'narratives') {
      return [{ id: 'new-narrative-id' }];
    }
    return null;
  };
  return { request, calls };
}

test('submitNarrativeVersion rejects a payload with no narrative.language', async () => {
  const { request } = mockRequest();
  const rpc = async () => {};
  await assert.rejects(
    () =>
      submitNarrativeVersion(request, rpc, {
        case_id: 'case-1',
        author_agent: 'claude',
        narrative: { hook: 'no language field' },
      }),
    /language is required/,
  );
});

test('submitNarrativeVersion scopes the next-version lookup by (case_id, language), not case_id alone', async () => {
  const { request, calls } = mockRequest({ version: 4 });
  const rpc = async () => {};
  const inserted = await submitNarrativeVersion(request, rpc, {
    case_id: 'case-1',
    author_agent: 'claude',
    narrative: { language: 'ko', hook: 'ko hook' },
  });
  assert.deepEqual(inserted, [{ id: 'new-narrative-id' }]);
  const versionLookup = calls.find((c) => c.path.startsWith('narratives?case_id='));
  assert.match(versionLookup.path, /language=eq\.ko/);
  const insertCall = calls.find((c) => c.path === 'narratives');
  const body = JSON.parse(insertCall.init.body);
  assert.equal(body.version, 5, 'next version after an existing ko v4');
  assert.equal(body.language, 'ko');
  assert.equal(body.is_current, false, 'new versions never start current');
});

test('two languages for the same case get independent version sequences', async () => {
  const enRequest = mockRequest({ version: 2 }).request;
  const koRequest = mockRequest({ version: 7 }).request;
  const rpc = async () => {};
  const enInsert = await submitNarrativeVersion(enRequest, rpc, {
    case_id: 'case-1',
    author_agent: 'claude',
    narrative: { language: 'en', hook: 'en' },
  });
  const koInsert = await submitNarrativeVersion(koRequest, rpc, {
    case_id: 'case-1',
    author_agent: 'claude',
    narrative: { language: 'ko', hook: 'ko' },
  });
  assert.ok(enInsert);
  assert.ok(koInsert);
});

test('submitNarrativeVersion does not force a workflow transition when adding a sibling-language narrative to an already-approved case', async () => {
  const calls = [];
  const request = async (path, init) => {
    calls.push({ path, init });
    if (path.startsWith('decision_cases?case_key=')) return [{ status: 'APPROVED' }];
    if (path.startsWith('narratives?case_id=')) return [];
    if (path === 'narratives') return [{ id: 'new-narrative-id' }];
    return null;
  };
  const rpc = async (name) => {
    throw new Error(`must not call rpc(${name}) from an already-APPROVED case`);
  };
  await submitNarrativeVersion(request, rpc, {
    case_id: 'case-1',
    case_key: 'cuban-missile-1962',
    author_agent: 'claude',
    narrative: { language: 'ko', hook: 'ko hook' },
  });
  assert.ok(
    !calls.some((c) => c.path.includes('rpc/transition_case_status')),
    'an already-APPROVED case must not receive a transition attempt for a new-language draft',
  );
});

test('submitNarrativeVersion still transitions RESEARCH_DONE -> NARRATIVE_DRAFTED for a genuine first draft', async () => {
  const rpcCalls = [];
  const request = async (path) => {
    if (path.startsWith('decision_cases?case_key=')) return [{ status: 'RESEARCH_DONE' }];
    if (path.startsWith('narratives?case_id=')) return [];
    if (path === 'narratives') return [{ id: 'new-narrative-id' }];
    return null;
  };
  const rpc = async (name, body) => {
    rpcCalls.push({ name, body });
    return { status: 'NARRATIVE_DRAFTED' };
  };
  await submitNarrativeVersion(request, rpc, {
    case_id: 'case-1',
    case_key: 'some-new-case',
    author_agent: 'claude',
    narrative: { language: 'en', hook: 'en hook' },
  });
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'transition_case_status');
  assert.equal(rpcCalls[0].body.p_to_status, 'NARRATIVE_DRAFTED');
});

test('the API route defaults to English and only switches to Korean on an explicit ?lang=ko', async () => {
  const route = await readFile(new URL('../app/api/content/route.ts', import.meta.url), 'utf8');
  assert.match(route, /searchParams\.get\('lang'\)/);
  assert.match(route, /requested === 'ko' \? 'ko' : 'en'/);
  assert.match(route, /language,\s*\n\s*\}\);/, 'fetchApprovedContent must receive the resolved language');
});

test('the review approval endpoint scopes is_current unset by the approved narrative\'s own language', async () => {
  const route = await readFile(new URL('../app/api/review/route.ts', import.meta.url), 'utf8');
  assert.match(
    route,
    /narratives\?id=eq\.\$\{encodeURIComponent\(body\.narrative_id\)\}&select=language/,
    'must look up the language of the narrative being approved before unsetting any other current row',
  );
  assert.match(
    route,
    /narratives\?case_id=eq\.\$\{encodeURIComponent\(current\.id\)\}&language=eq\.\$\{encodeURIComponent\(approving\?\.language \|\| ''\)\}&is_current=eq\.true/,
    'the is_current unset query must be scoped by language, not case_id alone',
  );
});
