import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pendingDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'content',
  'pending-narratives',
);
const processedDir = path.join(pendingDir, 'processed');

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

test('submitOne never creates a decision_cases row itself -- that is a separate pipeline (scripts/import-pending-case.mjs)', async () => {
  const filename = '__test-missing-case.json';
  const filePath = path.join(pendingDir, filename);
  await writeFile(filePath, JSON.stringify({ ...validDraft(), case_key: 'no-such-case-key' }));
  const { restore } = mockFetch((url) => {
    if (url.includes('decision_cases?case_key=')) return jsonResponse([]); // no matching case
    throw new Error('should not reach any other endpoint when the case is missing');
  });
  try {
    await assert.rejects(
      () => submitOne(filename),
      /no decision_cases row.*content\/pending-cases/s,
    );
  } finally {
    restore();
    await unlink(filePath).catch(() => {});
  }
});

test('submitOne auto-approves and publishes a freshly submitted narrative -- product owner decision, 2026-09-03, no human/Codex review step', async () => {
  const filename = '__test-happy-narrative.json';
  const filePath = path.join(pendingDir, filename);
  const draft = validDraft();
  await writeFile(filePath, JSON.stringify(draft));
  const transitions = [];
  let statusCheckCount = 0;
  const { restore } = mockFetch((url, init) => {
    const u = String(url);
    if (u.includes('decision_cases?case_key=eq.cuban-missile-1962&select=id,case_key'))
      return jsonResponse([{ id: 'case-1', case_key: 'cuban-missile-1962' }]);
    if (u.includes('narratives?case_id=eq.case-1&language=eq.ko&select=version'))
      return jsonResponse([]); // no existing ko narrative yet -> version 1
    if (u.includes('/rest/v1/narratives') && init.method === 'POST')
      return jsonResponse([{ id: 'narr-1', version: 1, ...draft.narrative, case_id: 'case-1' }]);
    if (u.includes('narratives?id=eq.narr-1&select=*'))
      return jsonResponse([{ id: 'narr-1', version: 1, ...draft.narrative, case_id: 'case-1' }]);
    if (u.includes('decision_cases?case_key=eq.cuban-missile-1962&select=status')) {
      // Called twice: once inside submitNarrativeVersion (still RESEARCH_DONE,
      // triggers the NARRATIVE_DRAFTED transition), once inside
      // autoApproveAndPublish afterward (now NARRATIVE_DRAFTED).
      statusCheckCount += 1;
      return jsonResponse([{ status: statusCheckCount === 1 ? 'RESEARCH_DONE' : 'NARRATIVE_DRAFTED' }]);
    }
    if (u.includes('/rest/v1/reviews')) return jsonResponse([{ id: 'review-1' }]);
    if (u.includes('narratives?case_id=eq.case-1&language=eq.ko&is_current=eq.true'))
      return jsonResponse([]);
    if (u.includes('narratives?id=eq.narr-1') && init.method === 'PATCH')
      return jsonResponse([{ id: 'narr-1' }]);
    if (u.includes('/rest/v1/rpc/transition_case_status')) {
      const toStatus = JSON.parse(init.body).p_to_status;
      if (toStatus === 'NARRATIVE_DRAFTED') return jsonResponse({}); // the submitNarrativeVersion transition, not part of the auto-publish chain
      transitions.push(toStatus);
      return jsonResponse({});
    }
    throw new Error(`unexpected fetch: ${u}`);
  });
  try {
    const result = await submitOne(filename);
    assert.equal(result.status, 'PUBLISHED');
    assert.deepEqual(transitions, ['CODEX_REVIEW', 'APPROVED', 'PROTOTYPE_READY', 'PUBLISHED']);
  } finally {
    restore();
    // submitOne archives the draft to processed/ on success, so the file
    // is no longer at its original path -- clean up both locations.
    await unlink(filePath).catch(() => {});
    await unlink(path.join(processedDir, filename)).catch(() => {});
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

test('workflow passes the Slack webhook through so autoApproveAndPublish can announce a first publish', () => {
  assert.match(
    workflowSource,
    /SLACK_INSIGHT_WEBHOOK_URL:\s*\$\{\{\s*secrets\.SLACK_INSIGHT_WEBHOOK_URL\s*\}\}/,
  );
  assert.doesNotMatch(workflowSource, /run:[\s\S]*echo[\s\S]*SLACK_INSIGHT_WEBHOOK_URL/);
});
