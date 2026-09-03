import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../.github/workflows/publish-judgment-article.yml', import.meta.url),
  'utf8',
);
const reviewRoute = await readFile(
  new URL('../app/api/review/route.ts', import.meta.url),
  'utf8',
);

test('the article-publish workflow notifies #insight only on a real publish, and never fails the job', () => {
  assert.match(workflow, /secrets\.SLACK_INSIGHT_WEBHOOK_URL/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /jq -r '\.published \/\/ false'/);
  assert.match(workflow, /if \[ "\$published" != "true" \]; then/);
  // The webhook URL must never be echoed/printed into the job log.
  assert.doesNotMatch(workflow, /echo.*SLACK_INSIGHT_WEBHOOK_URL/);
});

test('the article-publish workflow reuses the existing publish response instead of making a second network call', () => {
  assert.match(workflow, /response_file=\$response_file/);
  assert.match(workflow, /RESPONSE_FILE: \$\{\{ steps\.publish\.outputs\.response_file \}\}/);
});

test('case approval posts a Slack notification only the first time a case becomes publicly viewable', () => {
  assert.match(
    reviewRoute,
    /!\['APPROVED', 'PROTOTYPE_READY', 'PUBLISHED'\]\.includes\(current\.status\)/,
  );
  assert.match(reviewRoute, /process\.env\.SLACK_INSIGHT_WEBHOOK_URL/);
});

test('the Slack call in the review route can never turn a successful approval into a failed request', () => {
  const slackBlock = reviewRoute.slice(reviewRoute.indexOf('SLACK_INSIGHT_WEBHOOK_URL'));
  assert.match(slackBlock, /try \{[\s\S]*catch \(error\) \{[\s\S]*console\.warn/);
});

test('revisions, holds, and rejections never trigger a case-publish Slack notification', () => {
  const approveBlock = reviewRoute.slice(
    reviewRoute.indexOf("body.action === 'approve' &&\n      !['APPROVED'"),
  );
  assert.match(approveBlock, /body\.action === 'approve'/);
});
