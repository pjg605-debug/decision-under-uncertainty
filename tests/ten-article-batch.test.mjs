import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../supabase/migrations/202609010005_publish_ten_judgment_articles.sql', import.meta.url),
  'utf8',
);

const slugs = [
  'sunk-cost-next-decision',
  'overconfidence-trading-frequency',
  'anchor-price-independence',
  'mental-accounting-money-fungibility',
  'pain-of-paying-digital-wallet',
  'myopic-loss-checking-frequency',
  'house-money-risk-budget',
  'choice-overload-investment-products',
  'attention-stock-selection',
  'present-bias-subscription-renewal',
];

const marker = '$articles$';
const jsonStart = migration.indexOf(marker) + marker.length;
const jsonEnd = migration.indexOf(marker, jsonStart);
const articles = JSON.parse(migration.slice(jsonStart, jsonEnd));

test('batch contains ten distinct publishable articles', () => {
  assert.equal(articles.length, 10);
  assert.equal(new Set(articles.map((article) => article.slug)).size, 10);
  for (const slug of slugs) assert.match(migration, new RegExp(`"slug":"${slug}"`));
  assert.equal(new Set(slugs).size, 10);
  assert.match(migration, /'PUBLISHED'/);
  assert.match(migration, /true, 'PUBLISHED'/);
});

test('every article includes a study discussion and primary sources', () => {
  for (const article of articles) {
    assert.ok(article.content_blocks.length >= 10);
    assert.ok(article.practice.steps.length >= 4);
    assert.equal(article.practice.minutes, 0);
    assert.ok(article.source_notes.length >= 2);
    assert.ok(article.source_notes.every((source) => source.url.startsWith('https://doi.org/')));
    assert.ok(article.content_blocks.some((block) => /실험|연구|모형/.test(`${block.title ?? ''} ${block.text ?? ''}`)));
  }
  assert.equal(new Set(articles.map((article) => article.thought_experiment.title)).size, 10);
  assert.equal((migration.match(/"thought_experiment":/g) || []).length, 10);
  assert.equal((migration.match(/"practice":/g) || []).length, 10);
  assert.equal((migration.match(/"source_notes":/g) || []).length, 10);
  assert.ok((migration.match(/https:\/\/doi\.org\//g) || []).length >= 20);
  assert.doesNotMatch(migration, /"practice":\{[^\n]+"minutes":[1-9]/);
  assert.doesNotMatch(migration, /10분|7분|6분|시간 후/);
  assert.doesNotMatch(migration, /특정 종목을 매수|수익을 보장/);
});
