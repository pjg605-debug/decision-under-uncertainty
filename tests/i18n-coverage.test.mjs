import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// This is a regression guard for a real gap found in production: actor,
// actor_role, location, and the auto-generated "<upside> versus <downside>"
// known_tradeoffs string were shipping to Korean readers as raw English
// because no one had ever added them to the ko dictionary. data/cases.ts
// is TypeScript and this suite runs under plain `node --test` (no TS
// loader), so both files are parsed as text rather than imported --
// matching the existing pattern in tests/supabase.test.mjs.
const casesSrc = await readFile(
  new URL('../data/cases.ts', import.meta.url),
  'utf8',
);
const i18nSrc = await readFile(
  new URL('../data/i18n.ts', import.meta.url),
  'utf8',
);

// Extracted as plain text (key/value pairs are matched with a regex) rather
// than imported or eval'd, matching the read-only, no-code-execution pattern
// tests/supabase.test.mjs already uses for this repo's other source files.
function ko() {
  const keys = new Set();
  const pairRegex = /'((?:[^'\\]|\\.)*)':'(?:[^'\\]|\\.)*'/g;
  let match;
  while ((match = pairRegex.exec(i18nSrc))) keys.add(match[1]);
  return keys;
}

function extractAll(pattern, src) {
  const values = [];
  const regex = new RegExp(pattern, 'g');
  let match;
  while ((match = regex.exec(src))) values.push(match[1]);
  return values;
}

function extractOptionTradeoffs(src) {
  const tradeoffs = [];
  const regex = /option\('[^']*','[^']*','[^']*','([^']*)','([^']*)'\)/g;
  let match;
  while ((match = regex.exec(src)))
    tradeoffs.push(`${match[1]} versus ${match[2]}`);
  return tradeoffs;
}

test('every fixture case has a ko translation for actor, actor_role, and location', () => {
  const dict = ko();
  const fields = [
    ...extractAll("actor:'([^']*)'", casesSrc),
    ...extractAll("actor_role:'([^']*)'", casesSrc),
    ...extractAll("location:'([^']*)'", casesSrc),
  ];
  assert.ok(fields.length > 0, 'sanity check: extraction found some values');
  const missing = fields.filter((value) => !dict.has(value));
  assert.deepEqual(
    missing,
    [],
    `missing ko translations: ${JSON.stringify(missing)}`,
  );
});

test('every fixture case option has a ko translation for its combined known_tradeoffs string', () => {
  const dict = ko();
  const tradeoffs = extractOptionTradeoffs(casesSrc);
  assert.ok(tradeoffs.length > 0, 'sanity check: found option() tradeoffs');
  const missing = tradeoffs.filter((value) => !dict.has(value));
  assert.deepEqual(
    missing,
    [],
    `missing ko translations: ${JSON.stringify(missing)}`,
  );
});
