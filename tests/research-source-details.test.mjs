import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import bundledArticles from '../data/articles/bundled-articles.json' with { type: 'json' };

const articleSource = fs.readFileSync(
  new URL('../core/articles.ts', import.meta.url),
  'utf8',
);
const detailSource = fs
  .readFileSync(
    new URL('../core/research-source-details.ts', import.meta.url),
    'utf8',
  )
  .toLowerCase();

test('every published DOI has a structured research explanation', () => {
  const bundledDois = bundledArticles.flatMap((article) =>
    article.source_notes.map((source) =>
      source.url.replace('https://doi.org/', '').toLowerCase(),
    ),
  );
  const fallbackDois = [
    ...articleSource.matchAll(/url: 'https:\/\/doi\.org\/([^']+)'/g),
  ].map((match) => match[1].toLowerCase());

  for (const doi of new Set([...bundledDois, ...fallbackDois])) {
    assert.match(
      detailSource,
      new RegExp(`'${doi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`),
    );
  }

  assert.match(detailSource, /study:/);
  assert.match(detailSource, /finding:/);
  assert.match(detailSource, /application:/);
  assert.match(detailSource, /caution:/);
});
