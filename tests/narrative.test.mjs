import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateProductionNarrative } from '../core/validation/narrative.mjs';

const pairs = [
  ['cuban-missile-1962','cuban-missile-1962'],
  ['netflix-2007','netflix-2007'],
  ['new-coke-1985','new-coke-1985']
];

for (const [narrativeId,evidenceId] of pairs) {
  test(`${narrativeId} is production-valid and every evidence ref resolves`, async () => {
    const narrative=JSON.parse(await readFile(new URL(`../data/narratives/${narrativeId}.json`,import.meta.url)));
    const evidence=JSON.parse(await readFile(new URL(`../data/evidence/${evidenceId}.json`,import.meta.url)));
    const evidenceIds=new Set(evidence.sources.map((source)=>source.id));
    assert.deepEqual(validateProductionNarrative(narrative,evidenceIds),{valid:true,errors:[]});
  });
}

test('production narratives are connected by narrative_id in cases.ts', async () => {
  const source=await readFile(new URL('../data/cases.ts',import.meta.url),'utf8');
  for (const [id] of pairs) {
    assert.match(source,new RegExp(`['\"]${id}['\"]\\s*:`));
    assert.match(source,new RegExp(`narrative_id:['\"]${id}['\"]`));
  }
});

test('low-fame stress case remains outside production narratives', async () => {
  const source=await readFile(new URL('../data/cases.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/narrative_id:['"]low-fame-uss-johnston-1944['"]/);
});
