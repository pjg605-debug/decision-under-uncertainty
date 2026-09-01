import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import bundledArticles from '../data/articles/bundled-articles.json' with { type: 'json' };

const articleSource = fs.readFileSync(
  new URL('../core/articles.ts', import.meta.url),
  'utf8',
);
const guideSource = fs.readFileSync(
  new URL('../core/thought-experiment-guides.ts', import.meta.url),
  'utf8',
);

test('every published thought experiment has choice commentary and a conclusion', () => {
  const bundledSlugs = bundledArticles.map((article) => article.slug);
  const fallbackSlugs = [...articleSource.matchAll(/slug: '([^']+)'/g)].map(
    (match) => match[1],
  );

  for (const slug of new Set([...bundledSlugs, ...fallbackSlugs])) {
    assert.match(guideSource, new RegExp(`'${slug}'`));
  }

  assert.match(guideSource, /choiceNotes:/);
  assert.match(guideSource, /conclusion:/);
});
