import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL ||= 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-placeholder-not-a-real-key';

const { autoApproveAndPublish } = await import('../scripts/editorial-desk.mjs');

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

// Product owner decision, 2026-09-03: cases sourced/drafted through
// Claude's file-based pipelines are approved and published automatically,
// with no human or Codex review step. autoApproveAndPublish is the
// mechanism -- it must replicate every safety property
// app/api/review/route.ts's human-triggered approve endpoint has, since
// removing the human is the only thing that changed.

test('autoApproveAndPublish records an APPROVE review attributed to the automation, not a human/Codex reviewer', async () => {
  const { calls, restore } = mockFetch((url) => {
    if (url.includes('/rest/v1/reviews') ) return jsonResponse([{ id: 'review-1' }]);
    if (url.includes('/rest/v1/narratives?case_id=eq.case-1&language=eq.en&is_current=eq.true')) return jsonResponse([]);
    if (url.includes('/rest/v1/narratives?id=eq.narr-1')) return jsonResponse([{ id: 'narr-1' }]);
    if (url.includes('/rest/v1/decision_cases?case_key=eq.d-day-launch-1944')) return jsonResponse([{ status: 'NARRATIVE_DRAFTED' }]);
    if (url.includes('/rest/v1/rpc/transition_case_status')) return jsonResponse({});
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    await autoApproveAndPublish({
      case_id: 'case-1',
      case_key: 'd-day-launch-1944',
      narrative_id: 'narr-1',
      language: 'en',
      author_agent: 'claude',
    });
    const reviewCall = calls.find((c) => c.url.includes('/rest/v1/reviews'));
    const body = JSON.parse(reviewCall.init.body);
    assert.equal(body.verdict, 'APPROVE');
    assert.equal(body.reviewer_agent, 'claude');
    assert.match(body.comment, /Automated approval/);
  } finally {
    restore();
  }
});

test('autoApproveAndPublish unsets is_current scoped by case_id AND language, never case_id alone', async () => {
  const { calls, restore } = mockFetch((url) => {
    if (url.includes('/rest/v1/reviews')) return jsonResponse([{ id: 'review-1' }]);
    if (url.includes('/rest/v1/narratives?case_id=eq.case-1&language=eq.en&is_current=eq.true'))
      return jsonResponse([]);
    if (url.includes('/rest/v1/narratives?id=eq.narr-1')) return jsonResponse([{ id: 'narr-1' }]);
    if (url.includes('/rest/v1/decision_cases?case_key=eq.d-day-launch-1944')) return jsonResponse([{ status: 'NARRATIVE_DRAFTED' }]);
    if (url.includes('/rest/v1/rpc/transition_case_status')) return jsonResponse({});
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    await autoApproveAndPublish({
      case_id: 'case-1',
      case_key: 'd-day-launch-1944',
      narrative_id: 'narr-1',
      language: 'en',
      author_agent: 'claude',
    });
    const unsetCall = calls.find(
      (c) => c.url.includes('narratives?case_id=eq.case-1&language=eq.en&is_current=eq.true'),
    );
    assert.ok(unsetCall, 'must scope the is_current unset by case_id AND language');
    assert.deepEqual(JSON.parse(unsetCall.init.body), { is_current: false });
    const setCall = calls.find((c) => c.url.includes('narratives?id=eq.narr-1'));
    assert.deepEqual(JSON.parse(setCall.init.body), { status: 'APPROVED', is_current: true });
  } finally {
    restore();
  }
});

test('autoApproveAndPublish walks a fresh draft all the way from NARRATIVE_DRAFTED to PUBLISHED', async () => {
  const transitions = [];
  const { restore } = mockFetch((url, init) => {
    if (url.includes('/rest/v1/reviews')) return jsonResponse([{ id: 'review-1' }]);
    if (url.includes('/rest/v1/narratives?case_id=')) return jsonResponse([]);
    if (url.includes('/rest/v1/narratives?id=eq.narr-1')) return jsonResponse([{ id: 'narr-1' }]);
    if (url.includes('/rest/v1/decision_cases?case_key=eq.d-day-launch-1944')) return jsonResponse([{ status: 'NARRATIVE_DRAFTED' }]);
    if (url.includes('/rest/v1/rpc/transition_case_status')) {
      transitions.push(JSON.parse(init.body).p_to_status);
      return jsonResponse({});
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    const result = await autoApproveAndPublish({
      case_id: 'case-1',
      case_key: 'd-day-launch-1944',
      narrative_id: 'narr-1',
      language: 'en',
      author_agent: 'claude',
    });
    assert.deepEqual(transitions, ['CODEX_REVIEW', 'APPROVED', 'PROTOTYPE_READY', 'PUBLISHED']);
    assert.equal(result.status, 'PUBLISHED');
  } finally {
    restore();
  }
});

test('autoApproveAndPublish only transitions the remaining stages when a case is already partway through review', async () => {
  const transitions = [];
  const { restore } = mockFetch((url, init) => {
    if (url.includes('/rest/v1/reviews')) return jsonResponse([{ id: 'review-1' }]);
    if (url.includes('/rest/v1/narratives?case_id=')) return jsonResponse([]);
    if (url.includes('/rest/v1/narratives?id=eq.narr-1')) return jsonResponse([{ id: 'narr-1' }]);
    if (url.includes('/rest/v1/decision_cases?case_key=eq.d-day-launch-1944')) return jsonResponse([{ status: 'APPROVED' }]);
    if (url.includes('/rest/v1/rpc/transition_case_status')) {
      transitions.push(JSON.parse(init.body).p_to_status);
      return jsonResponse({});
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    await autoApproveAndPublish({
      case_id: 'case-1',
      case_key: 'd-day-launch-1944',
      narrative_id: 'narr-1',
      language: 'en',
      author_agent: 'claude',
    });
    assert.deepEqual(transitions, ['PROTOTYPE_READY', 'PUBLISHED']);
  } finally {
    restore();
  }
});

test('autoApproveAndPublish posts to Slack #insight only when this call is what actually reaches PUBLISHED for the first time', async () => {
  const originalWebhook = process.env.SLACK_INSIGHT_WEBHOOK_URL;
  process.env.SLACK_INSIGHT_WEBHOOK_URL = 'https://hooks.slack.test/services/fake';
  const slackCalls = [];
  const { restore } = mockFetch((url, init) => {
    if (url === process.env.SLACK_INSIGHT_WEBHOOK_URL) {
      slackCalls.push(JSON.parse(init.body));
      return jsonResponse({});
    }
    if (url.includes('/rest/v1/reviews')) return jsonResponse([{ id: 'review-1' }]);
    if (url.includes('/rest/v1/narratives?case_id=')) return jsonResponse([]);
    if (url.includes('/rest/v1/narratives?id=eq.narr-1')) return jsonResponse([{ id: 'narr-1' }]);
    if (url.includes('/rest/v1/decision_cases?case_key=eq.d-day-launch-1944'))
      return jsonResponse([{ status: 'NARRATIVE_DRAFTED', title: 'Launch on the Marginal Forecast' }]);
    if (url.includes('/rest/v1/rpc/transition_case_status')) return jsonResponse({});
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    await autoApproveAndPublish({
      case_id: 'case-1',
      case_key: 'd-day-launch-1944',
      narrative_id: 'narr-1',
      language: 'en',
      author_agent: 'claude',
    });
    assert.equal(slackCalls.length, 1);
    assert.match(slackCalls[0].text, /Launch on the Marginal Forecast/);
    assert.match(slackCalls[0].text, /d-day-launch-1944/);
  } finally {
    restore();
    if (originalWebhook === undefined) delete process.env.SLACK_INSIGHT_WEBHOOK_URL;
    else process.env.SLACK_INSIGHT_WEBHOOK_URL = originalWebhook;
  }
});

test('autoApproveAndPublish does not re-announce an already-published case (adding a sibling language)', async () => {
  const originalWebhook = process.env.SLACK_INSIGHT_WEBHOOK_URL;
  process.env.SLACK_INSIGHT_WEBHOOK_URL = 'https://hooks.slack.test/services/fake';
  const slackCalls = [];
  const { restore } = mockFetch((url, init) => {
    if (url === process.env.SLACK_INSIGHT_WEBHOOK_URL) {
      slackCalls.push(JSON.parse(init.body));
      return jsonResponse({});
    }
    if (url.includes('/rest/v1/reviews')) return jsonResponse([{ id: 'review-1' }]);
    if (url.includes('/rest/v1/narratives?case_id=')) return jsonResponse([{ id: 'old-narr' }]);
    if (url.includes('/rest/v1/narratives?id=eq.narr-1')) return jsonResponse([{ id: 'narr-1' }]);
    if (url.includes('/rest/v1/decision_cases?case_key=eq.d-day-launch-1944'))
      return jsonResponse([{ status: 'PUBLISHED', title: 'Launch on the Marginal Forecast' }]);
    if (url.includes('/rest/v1/rpc/transition_case_status')) return jsonResponse({});
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    await autoApproveAndPublish({
      case_id: 'case-1',
      case_key: 'd-day-launch-1944',
      narrative_id: 'narr-1',
      language: 'ko',
      author_agent: 'claude',
    });
    assert.equal(slackCalls.length, 0);
  } finally {
    restore();
    if (originalWebhook === undefined) delete process.env.SLACK_INSIGHT_WEBHOOK_URL;
    else process.env.SLACK_INSIGHT_WEBHOOK_URL = originalWebhook;
  }
});

test('autoApproveAndPublish never fails the whole approval if the Slack call itself fails', async () => {
  const originalWebhook = process.env.SLACK_INSIGHT_WEBHOOK_URL;
  process.env.SLACK_INSIGHT_WEBHOOK_URL = 'https://hooks.slack.test/services/fake';
  const { restore } = mockFetch((url) => {
    if (url === process.env.SLACK_INSIGHT_WEBHOOK_URL) throw new Error('Slack is down');
    if (url.includes('/rest/v1/reviews')) return jsonResponse([{ id: 'review-1' }]);
    if (url.includes('/rest/v1/narratives?case_id=')) return jsonResponse([]);
    if (url.includes('/rest/v1/narratives?id=eq.narr-1')) return jsonResponse([{ id: 'narr-1' }]);
    if (url.includes('/rest/v1/decision_cases?case_key=eq.d-day-launch-1944'))
      return jsonResponse([{ status: 'NARRATIVE_DRAFTED', title: 'Launch on the Marginal Forecast' }]);
    if (url.includes('/rest/v1/rpc/transition_case_status')) return jsonResponse({});
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    const result = await autoApproveAndPublish({
      case_id: 'case-1',
      case_key: 'd-day-launch-1944',
      narrative_id: 'narr-1',
      language: 'en',
      author_agent: 'claude',
    });
    assert.equal(result.status, 'PUBLISHED');
  } finally {
    restore();
    if (originalWebhook === undefined) delete process.env.SLACK_INSIGHT_WEBHOOK_URL;
    else process.env.SLACK_INSIGHT_WEBHOOK_URL = originalWebhook;
  }
});

test('autoApproveAndPublish is a no-op transition-wise for a case that is already published (adding a sibling language)', async () => {
  const transitions = [];
  const { restore } = mockFetch((url, init) => {
    if (url.includes('/rest/v1/reviews')) return jsonResponse([{ id: 'review-1' }]);
    if (url.includes('/rest/v1/narratives?case_id=')) return jsonResponse([{ id: 'old-narr' }]);
    if (url.includes('/rest/v1/narratives?id=eq.narr-1')) return jsonResponse([{ id: 'narr-1' }]);
    if (url.includes('/rest/v1/decision_cases?case_key=eq.d-day-launch-1944')) return jsonResponse([{ status: 'PUBLISHED' }]);
    if (url.includes('/rest/v1/rpc/transition_case_status')) {
      transitions.push(JSON.parse(init.body).p_to_status);
      return jsonResponse({});
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    const result = await autoApproveAndPublish({
      case_id: 'case-1',
      case_key: 'd-day-launch-1944',
      narrative_id: 'narr-1',
      language: 'ko',
      author_agent: 'claude',
    });
    assert.deepEqual(transitions, []);
    assert.equal(result.status, 'PUBLISHED');
  } finally {
    restore();
  }
});
