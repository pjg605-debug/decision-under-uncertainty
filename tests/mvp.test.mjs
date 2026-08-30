import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateDecisionEvent } from '../core/validation/decision-event.mjs';
import { canReveal, filterCases, narrativeText, nextProgressiveState } from '../core/logic.mjs';

const fixture = JSON.parse(await readFile(new URL('../data/fixtures/austerlitz.json', import.meta.url)));
test('fixture conforms to the DecisionEvent contract', () => assert.deepEqual(validateDecisionEvent(fixture), {valid:true,errors:[]}));
test('actual decision cannot reveal before a locked choice', () => { assert.equal(canReveal({choice:null,locked:false}),false); assert.equal(canReveal({choice:'hold',locked:false}),false); assert.equal(canReveal({choice:'hold',locked:true}),true); });
test('decision and outcome quality are independent', () => { const x={...fixture,decision_quality:'Strong',outcome_quality:'Bad'}; assert.equal(validateDecisionEvent(x).valid,true); });
test('evidence classes reject unknown labels', () => { const x=structuredClone(fixture); x.evidence[0].evidence_class='OPINION'; assert.equal(validateDecisionEvent(x).valid,false); });
test('missing narrative slots fall back safely', () => assert.match(narrativeText({},'hindsight_analysis'),/not yet available/));
test('filters compose across independent dimensions', () => assert.deepEqual(filterCases([fixture,{...fixture,id:'x',domain:'business',outcome_quality:'Good'}],{domain:'business',outcome_quality:'Good'}).map(x=>x.id),['x']));
test('progressive case shows evidence before reveal', () => { assert.equal(nextProgressiveState({initialChoice:null},fixture),'NEW_EVIDENCE'); assert.equal(nextProgressiveState({initialChoice:'advance'},fixture),'REVEALED'); });
