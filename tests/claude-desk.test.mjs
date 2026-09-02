import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// scripts/editorial-desk.mjs and scripts/claude-desk.mjs read
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY at module import time and exit
// the process if they're missing. No real Supabase project is reachable
// in CI/this sandbox, so tests here use fake, clearly-non-secret
// placeholder values to satisfy that check and a mocked global.fetch to
// intercept the REST/RPC calls the modules would otherwise make — no
// network call ever actually leaves this process in this test file.
process.env.SUPABASE_URL ||= 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-placeholder-not-a-real-key';

const claudeDeskSource = await readFile(
  new URL('../scripts/claude-desk.mjs', import.meta.url),
  'utf8',
);
const editorialDeskSource = await readFile(
  new URL('../scripts/editorial-desk.mjs', import.meta.url),
  'utf8',
);
const claudeMd = await readFile(new URL('../CLAUDE.md', import.meta.url), 'utf8');

const {
  cmdCase,
  cmdTransition,
  cmdDraftNarrative,
  cmdReviseNarrative,
  cmdAgentRun,
  CLAUDE_ALLOWED_TRANSITIONS,
  CLAUDE_AGENT_NAME,
} = await import('../scripts/claude-desk.mjs');
const { assertSupportedNarrativeLanguage, SUPPORTED_NARRATIVE_LANGUAGES } =
  await import('../scripts/editorial-desk.mjs');

function mockFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  // Every call site in this codebase (editorial-desk.mjs's `request`)
  // always invokes fetch with a plain string URL, never a Request/URL
  // object, so no stringification is needed here.
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return handler(url, init, calls.length - 1);
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

const jsonResponse = (body, ok = true, status = ok ? 200 : 400) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

test('CLAUDE.md documents the read-only queue/case entry points a fresh session needs', () => {
  assert.match(claudeMd, /pnpm claude:queue/);
  assert.match(claudeMd, /pnpm claude:case/);
  assert.match(claudeMd, /RESEARCH_QUEUE/);
  assert.match(claudeMd, /NARRATIVE_QUEUE/);
  assert.match(claudeMd, /REVISION_QUEUE/);
});

test('claude-desk reuses editorial-desk\'s request/rpc/submitNarrativeVersion instead of a second Supabase layer', () => {
  assert.match(claudeDeskSource, /import \{ request, rpc, submitNarrativeVersion \} from '\.\/editorial-desk\.mjs'/);
  assert.doesNotMatch(claudeDeskSource, /apikey:/);
  assert.doesNotMatch(claudeDeskSource, /authorization: `Bearer/);
});

test('no secret leakage: the service key value is only ever placed in request headers, never logged or thrown', () => {
  for (const source of [claudeDeskSource, editorialDeskSource]) {
    // Every use of the key identifier is either the header assignment or
    // the initial presence check — never inside a console.*/throw call.
    const dangerousLines = source
      .split('\n')
      .filter((line) => /console\.(log|error|warn)|throw new Error/.test(line))
      .filter((line) => /serviceKey/.test(line));
    assert.deepEqual(
      dangerousLines,
      [],
      `Found a log/throw statement referencing serviceKey: ${JSON.stringify(dangerousLines)}`,
    );
  }
});

test('invalid workflow transition rejection: cmdTransition refuses a status outside Claude\'s assigned set without making any network call', async () => {
  const { calls, restore } = mockFetch(() => {
    throw new Error('should never reach the network for a rejected transition');
  });
  try {
    await assert.rejects(
      () => cmdTransition('some-case', 'APPROVED', 'trying to self-approve'),
      /not a transition Claude is assigned/,
    );
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test('allowed Claude write: cmdTransition proceeds to the RPC call for a status Claude is assigned', async () => {
  const { calls, restore } = mockFetch((url) => {
    assert.match(url, /rpc\/transition_case_status$/);
    return jsonResponse({ id: 'case-uuid', status: 'RESEARCHING' });
  });
  try {
    assert.ok(CLAUDE_ALLOWED_TRANSITIONS.has('RESEARCHING'));
    const result = await cmdTransition('some-case', 'RESEARCHING', 'starting research');
    assert.equal(result.status, 'RESEARCHING');
    assert.equal(calls.length, 1);
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.p_actor_agent, CLAUDE_AGENT_NAME);
    assert.equal(body.p_to_status, 'RESEARCHING');
  } finally {
    restore();
  }
});

test('agent attribution: draft-narrative always writes author_agent="claude" even if the payload claims otherwise', async () => {
  const bodies = [];
  const { restore } = mockFetch((url, init) => {
    bodies.push({ url, body: init.body ? JSON.parse(init.body) : null });
    if (url.includes('narratives?')) return jsonResponse([]); // "existing versions" lookup
    if (url.endsWith('/rest/v1/narratives'))
      return jsonResponse([{ id: 'narrative-uuid', version: 1 }]);
    return jsonResponse({});
  });
  try {
    await cmdDraftNarrative({
      case_id: 'case-uuid',
      author_agent: 'codex', // attempted impersonation — must be overridden
      narrative: { language: 'en', hook: 'h' },
    });
    const insert = bodies.find((b) => b.url.endsWith('/rest/v1/narratives'));
    assert.equal(insert.body.author_agent, 'claude');
    assert.notEqual(insert.body.author_agent, 'codex');
  } finally {
    restore();
  }
});

test('narrative version protection: draft-narrative never inserts is_current=true', async () => {
  const bodies = [];
  const { restore } = mockFetch((url, init) => {
    bodies.push({ url, body: init.body ? JSON.parse(init.body) : null });
    if (url.includes('narratives?')) return jsonResponse([{ version: 3 }]);
    if (url.endsWith('/rest/v1/narratives'))
      return jsonResponse([{ id: 'narrative-uuid', version: 4 }]);
    return jsonResponse({});
  });
  try {
    await cmdDraftNarrative({
      case_id: 'case-uuid',
      narrative: { language: 'en', hook: 'h' },
    });
    const insert = bodies.find((b) => b.url.endsWith('/rest/v1/narratives'));
    assert.equal(insert.body.is_current, false);
    assert.equal(insert.body.status, 'IN_REVIEW');
    assert.equal(insert.body.version, 4, 'version must increment from the existing max, never overwrite it');
  } finally {
    restore();
  }
});

test('revise-narrative requires triggered_by_review_id; draft-narrative refuses one', async () => {
  await assert.rejects(
    () => cmdReviseNarrative({ case_id: 'x', narrative: {} }),
    /requires triggered_by_review_id/,
  );
  await assert.rejects(
    () =>
      cmdDraftNarrative({
        case_id: 'x',
        narrative: {},
        triggered_by_review_id: 'review-uuid',
      }),
    /Use revise-narrative/,
  );
});

test('agent-run audit rows are attributed to claude and require a run_type', async () => {
  const bodies = [];
  const { restore } = mockFetch((url, init) => {
    bodies.push(init.body ? JSON.parse(init.body) : null);
    return jsonResponse([{ id: 'run-uuid' }]);
  });
  try {
    await assert.rejects(() => cmdAgentRun({}), /run_type/);
    await cmdAgentRun({ run_type: 'research', status: 'SUCCEEDED' });
    assert.equal(bodies[0].agent_name, CLAUDE_AGENT_NAME);
    assert.equal(bodies[0].run_type, 'research');
  } finally {
    restore();
  }
});

test('narratives are independently authored per language: draft-narrative rejects a payload with no narrative.language', async () => {
  const { calls, restore } = mockFetch(() => {
    throw new Error('should never reach the network without a valid language');
  });
  try {
    assert.deepEqual(SUPPORTED_NARRATIVE_LANGUAGES, ['en', 'ko']);
    assert.throws(() => assertSupportedNarrativeLanguage(undefined), /language is required/);
    assert.throws(() => assertSupportedNarrativeLanguage('fr'), /language is required/);
    await assert.rejects(
      () => cmdDraftNarrative({ case_id: 'case-uuid', narrative: { hook: 'no language' } }),
      /language is required/,
    );
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test('draft-narrative scopes the next-version lookup by (case_id, language), not case_id alone', async () => {
  const bodies = [];
  const { restore } = mockFetch((url, init) => {
    bodies.push({ url, body: init.body ? JSON.parse(init.body) : null });
    if (url.includes('narratives?')) {
      assert.match(url, /language=eq\.ko/, 'version lookup must filter by the requested language');
      return jsonResponse([{ version: 4 }]); // existing ko v4
    }
    if (url.endsWith('/rest/v1/narratives'))
      return jsonResponse([{ id: 'narrative-uuid', version: 5, language: 'ko' }]);
    return jsonResponse({});
  });
  try {
    await cmdDraftNarrative({
      case_id: 'case-uuid',
      narrative: { language: 'ko', hook: 'ko hook' },
    });
    const insert = bodies.find((b) => b.url.endsWith('/rest/v1/narratives'));
    assert.equal(insert.body.version, 5, 'ko version continues its own sequence (v4 -> v5)');
    assert.equal(insert.body.language, 'ko');
  } finally {
    restore();
  }
});

test('cmdCase groups current narratives by language, so en and ko can both be current at once', async () => {
  const { restore } = mockFetch((url) => {
    if (url.includes('decision_cases?case_key='))
      return jsonResponse([{ id: 'case-uuid', case_key: 'x', status: 'PUBLISHED' }]);
    if (url.includes('narratives?case_id='))
      return jsonResponse([
        { id: 'en-2', language: 'en', version: 2, is_current: true, status: 'APPROVED' },
        { id: 'en-1', language: 'en', version: 1, is_current: false, status: 'ARCHIVED' },
        { id: 'ko-1', language: 'ko', version: 1, is_current: true, status: 'APPROVED' },
      ]);
    return jsonResponse([]);
  });
  try {
    const result = await cmdCase('x');
    assert.equal(result.current_narratives.en.id, 'en-2');
    assert.equal(result.current_narratives.ko.id, 'ko-1');
    assert.equal(
      result.current_narrative.id,
      'en-2',
      'legacy current_narrative stays an English-default convenience',
    );
    assert.equal(result.all_narrative_versions.length, 3);
    assert.ok(result.all_narrative_versions.every((n) => 'language' in n));
  } finally {
    restore();
  }
});

test('stale-state protection is not implemented at the DB RPC layer (documented limitation, not silently assumed)', () => {
  // transition_case_status takes no expected-current-status argument, so
  // there is no server-side compare-and-swap; CLAUDE.md instead documents
  // a read-verify-write-verify procedure as the mitigation. This test
  // exists so a future DB-side stale-state guard doesn't go unnoticed
  // without someone updating this assertion.
  assert.doesNotMatch(editorialDeskSource, /p_expected_status|p_if_match|compare.and.swap/i);
  assert.match(claudeMd, /Re-read current DB state/);
  assert.match(claudeMd, /no newer state written by Codex or another session was clobbered/);
});
