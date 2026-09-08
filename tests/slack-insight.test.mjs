import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { hasNoPreviousApproval, notifyCaseApproval } from '../core/slack-insight.mjs';

// Use the actual route with only its framework lifecycle hook replaced.
const routeUrl = new URL('../app/api/review/route.ts', import.meta.url);
const source = stripTypeScriptTypes(await readFile(routeUrl, 'utf8'))
  .replace("import { after } from 'next/server';", 'const after = (fn) => globalThis.__insightAfter(fn);')
  .replaceAll(/from '(\.\.\/[^']+)'/g, (_, path) => `from '${new URL(path, routeUrl).href}'`);
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const webhookUrl = 'https://hooks.slack.com/services/TEST/TEST/placeholder';

async function runRoute(t, { status = 'CODEX_REVIEW', action = 'approve', previous = false, slack = 'ok', failTransition = false, configured = true, historyError = false, scheduleError = false } = {}) {
  const savedEnv = { ...process.env };
  Object.assign(process.env, { SUPABASE_URL: 'https://db.example', SUPABASE_SECRET_KEY: 'sb_secret_test', REVIEW_DASHBOARD_TOKEN: 'review-test' });
  if (configured) process.env.SLACK_INSIGHT_WEBHOOK_URL = webhookUrl;
  else delete process.env.SLACK_INSIGHT_WEBHOOK_URL;
  t.after(() => { process.env = savedEnv; delete globalThis.__insightAfter; });
  const calls = [];
  const callbacks = [];
  const warnings = [];
  globalThis.__insightAfter = (fn) => {
    if (scheduleError) throw new Error('No request context');
    callbacks.push(fn);
  };
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url, init });
    if (url === webhookUrl) {
      if (slack === 'throw') throw new Error(webhookUrl);
      return new Response(slack === 'ok' ? 'ok' : 'error', { status: slack === 'ok' ? 200 : 503 });
    }
    if (url.includes('status_transitions?')) {
      if (historyError) throw new Error('history unavailable');
      return Response.json(previous ? [{ id: 'prior' }] : []);
    }
    if (url.includes('decision_cases?')) return Response.json([{ id: 'case-id', title: 'Title <test>', status }]);
    if (url.includes('select=language')) return Response.json([{ language: 'ko' }]);
    if (url.includes('rpc/') && failTransition) return new Response('failed', { status: 500 });
    return Response.json({});
  });
  const response = await POST(new Request('https://site.example/api/review', {
    method: 'POST', headers: { authorization: 'Bearer review-test', 'content-type': 'application/json' },
    body: JSON.stringify({ action, case_key: 'test-case', narrative_id: 'narrative-id', summary: 'Reviewed' }),
  }));
  assert.equal(calls.some(call => call.url === webhookUrl), false, 'Slack must not block the response');
  for (const callback of callbacks) await callback();
  return { response, calls, warnings, slackCalls: calls.filter(call => call.url === webhookUrl) };
}

test('first approval posts title and root link after successful mutation', async t => {
  const result = await runRoute(t);
  assert.equal(result.response.status, 200);
  assert.equal(result.slackCalls.length, 1);
  const payload = JSON.parse(result.slackCalls[0].init.body);
  assert.match(payload.text, /Title <test>.*test-case/s);
  assert.match(payload.text, /https:\/\/decision-under-uncertainty.pjg605.chatgpt.site\//);
  assert.equal(payload.mrkdwn, false);
});

for (const status of ['APPROVED', 'PROTOTYPE_READY', 'PUBLISHED']) {
  test(`no notification when already ${status}`, async t => {
    const result = await runRoute(t, { status });
    assert.equal(result.slackCalls.length, 0);
  });
}
for (const options of [
  { action: 'request_revision' }, { previous: true, status: 'REVISION_DONE' },
  { configured: false }, { historyError: true }, { scheduleError: true },
]) {
  test(`successful approval/review stays silent: ${JSON.stringify(options)}`, async t => {
    const result = await runRoute(t, options);
    assert.equal(result.response.status, 200);
    assert.equal(result.slackCalls.length, 0);
  });
}
test('failed editorial transition never posts', async t => {
  const result = await runRoute(t, { failTransition: true });
  assert.equal(result.response.status, 500);
  assert.equal(result.slackCalls.length, 0);
});
for (const slack of ['throw', '503']) {
  test(`Slack ${slack} does not fail approval or leak the webhook`, async t => {
    const result = await runRoute(t, { slack });
    assert.equal(result.response.status, 200);
    assert.ok(result.warnings.length);
    assert.ok(result.warnings.every(warning => !warning.includes(webhookUrl)));
    assert.ok(result.slackCalls[0].init.signal instanceof AbortSignal);
  });
}
test('invalid or missing webhook never makes an external call', async t => {
  t.mock.method(console, 'warn', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('unexpected request'));
  await notifyCaseApproval({ caseKey: 'case' });
  await notifyCaseApproval({ webhookUrl: 'https://elsewhere.example/', caseKey: 'case' });
  assert.equal(fetch.mock.callCount(), 0);
});
test('history read is bounded and fails closed on malformed data', async () => {
  assert.equal(await hasNoPreviousApproval(async (_, init) => {
    assert.ok(init.signal instanceof AbortSignal);
    return {};
  }, 'id'), false);
});
test('workflow reuses successful response and isolates Slack failures', async () => {
  const workflow = await readFile(new URL('../.github/workflows/publish-judgment-article.yml', import.meta.url), 'utf8');
  assert.match(workflow, /id: publish/);
  assert.match(workflow, /response_file=\$response_file.*GITHUB_OUTPUT/);
  assert.match(workflow, /success\(\) && steps.publish.outcome == 'success'/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /steps.publish.outputs.response_file/);
  assert.match(workflow, /\.published == true/);
  assert.match(workflow, /--max-time 5/);
  assert.match(workflow, /secrets.SLACK_INSIGHT_WEBHOOK_URL/);
});
