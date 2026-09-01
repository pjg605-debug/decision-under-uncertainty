import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  airtableRecordToArticle,
  fetchPublishedArticlesFromAirtable,
} from '../core/airtable-articles.mjs';

const record = {
  id: 'recExample',
  fields: {
    Slug: 'choice-under-pressure',
    Version: 2,
    Status: 'PUBLISHED',
    'Is Current': true,
    Title: '압박 속의 선택',
    Subtitle: '부제',
    Excerpt: '요약',
    Category: '행동경제학',
    'Tags JSON': '["압박","선택"]',
    'Reading Minutes': 6,
    Difficulty: '중급',
    'Hero Kicker': '판단 연구',
    'Content Blocks JSON': '[{"kind":"paragraph","text":"본문"}]',
    'Thought Experiment JSON': '{"title":"가정","prompt":"질문","choices":[],"reflection":"검토"}',
    'Practice JSON': '{"title":"쟁점","minutes":0,"steps":[],"rule_template":"관점"}',
    'Source Notes JSON': '[]',
    'Published At': '2026-09-01T09:00:00.000Z',
  },
};

test('Airtable JSON text fields normalize into the article contract', () => {
  const article = airtableRecordToArticle(record);
  assert.equal(article.slug, 'choice-under-pressure');
  assert.equal(article.version, 2);
  assert.deepEqual(article.tags, ['압박', '선택']);
  assert.equal(article.content_blocks[0].kind, 'paragraph');
  assert.equal(article.practice.minutes, 0);
});

test('Airtable reader follows pagination and keeps only valid articles', async () => {
  const pages = [
    { records: [record], offset: 'next-page' },
    { records: [{ id: 'invalid', fields: {} }] },
  ];
  const requests = [];
  const articles = await fetchPublishedArticlesFromAirtable({
    token: 'test-token',
    baseId: 'appTest',
    tableId: 'tblTest',
    fetchImpl: async (url) => {
      requests.push(url instanceof URL ? url.href : typeof url === 'string' ? url : url.url);
      const body = pages.shift();
      return new Response(JSON.stringify(body), { status: 200 });
    },
  });
  assert.equal(requests.length, 2);
  assert.match(requests[1], /offset=next-page/);
  assert.equal(articles.length, 1);
});

test('Supabase recovery RPC is service-role-only and idempotent by slug and version', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/202609010006_airtable_article_sync.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /on conflict \(slug, version\) do update/);
  assert.match(migration, /grant execute on function public\.sync_airtable_article\(jsonb\) to service_role/);
  assert.match(migration, /revoke all on function public\.sync_airtable_article\(jsonb\) from public, anon, authenticated/);
});

test('site reader supports explicit and automatic failover modes', async () => {
  const source = await readFile(new URL('../core/articles.ts', import.meta.url), 'utf8');
  assert.match(source, /ARTICLE_SOURCE_MODE/);
  assert.match(source, /fetchPublishedArticlesFromAirtable/);
  assert.match(source, /for \(const article of airtableArticles\)/);
  assert.match(source, /for \(const article of supabaseArticles\)/);
});
