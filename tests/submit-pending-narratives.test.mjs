import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// scripts/editorial-desk.mjs (imported transitively by
// scripts/submit-pending-narratives.mjs) reads
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY at module import time and exits
// the process if they're missing -- same pattern as tests/claude-desk.test.mjs.
process.env.SUPABASE_URL ||= 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-placeholder-not-a-real-key';

const { validateDraft, findMismatch, submitOne } = await import(
  '../scripts/submit-pending-narratives.mjs'
);
const workflowSource = await readFile(
  new URL('../.github/workflows/submit-pending-narratives.yml', import.meta.url),
  'utf8',
);

function mockFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
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

function validDraft(overrides = {}) {
  return {
    case_key: 'cuban-missile-1962',
    summary: 'Add Korean narrative.',
    narrative: {
      narrative_key: 'cuban-missile-1962',
      language: 'ko',
      hook: '훅',
      short_setup: '설정',
      why_option_a_made_sense: 'A',
      why_option_b_made_sense: 'B',
      actual_decision_explanation: '실제 결정',
      outcome_story: '결과',
      hindsight_analysis: '분석',
      decision_principle: '원칙',
      longform_story: '전체 이야기',
      evidence_refs: [],
      quality_evaluations: {},
      ...overrides,
    },
  };
}

test('validateDraft requires case_key and every narrative field', () => {
  assert.doesNotThrow(() => validateDraft(validDraft(), 'ok.json'));
  assert.throws(
    () => validateDraft({ narrative: validDraft().narrative }, 'bad.json'),
    /missing case_key/,
  );
  const missingHook = validDraft();
  delete missingHook.narrative.hook;
  assert.throws(() => validateDraft(missingHook, 'bad.json'), /missing required field.*hook/);
});

test('validateDraft rejects a narrative with no language (no silent default)', () => {
  const draft = validDraft();
  delete draft.narrative.language;
  assert.throws(() => validateDraft(draft, 'bad.json'), /language/);
});

test('findMismatch detects a corrupted field after insert', () => {
  assert.equal(findMismatch({ hook: 'a' }, { hook: 'a' }), null);
  assert.match(findMismatch({ hook: 'a' }, { hook: 'tampered' }), /hook: "a" vs "tampered"/);
});

test('submitOne refuses to create a decision_cases row -- that is not one of Claude\'s granted writes', async () => {
  const { restore } = mockFetch((url) => {
    if (url.includes('decision_cases?case_key=')) return jsonResponse([]); // no matching case
    throw new Error('should not reach any other endpoint when the case is missing');
  });
  try {
    await assert.rejects(
      () => submitOne('cuban-missile-1962-ko.json'),
      /no decision_cases row.*ask Codex to create it first/s,
    );
  } finally {
    restore();
  }
});

test('workflow triggers on push to the pending-narratives path and never re-triggers on its own archive commit', () => {
  assert.match(workflowSource, /branches: \[claude\/decision-uncertainty-case-selection-9q6h5y\]/);
  assert.match(workflowSource, /content\/pending-narratives\/\*\.json/);
  assert.match(workflowSource, /workflow_dispatch:/);
  assert.match(workflowSource, /\[skip ci\]/);
});

test('workflow references the service key only via the GitHub secrets expression, never a literal value', () => {
  assert.match(
    workflowSource,
    /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/,
  );
  assert.doesNotMatch(workflowSource, /run:[\s\S]*echo[\s\S]*SUPABASE_SERVICE_ROLE_KEY/);
});
