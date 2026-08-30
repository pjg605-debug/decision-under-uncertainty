import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformSupabaseRows } from '../core/supabase-content.mjs';

const migration = await readFile(new URL('../supabase/migrations/202608300001_content_hub.sql', import.meta.url), 'utf8');
const seed = await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8');

const tables = ['decision_cases','decision_options','case_information','evidence','narratives','reviews','revisions','case_scores','shorts_variants','publication_results','agent_runs','status_transitions','research_claims','research_gaps'];

test('content hub migration creates and enables RLS on every requested table', () => {
  for (const table of tables) {
    assert.match(migration, new RegExp(`create table public\\.${table} \\(`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test('public roles receive reads only for approved content tables', () => {
  assert.match(migration, /revoke all on public\.decision_cases[\s\S]+from anon, authenticated/);
  assert.match(migration, /approved_cases_are_public[\s\S]+status in \('APPROVED','PROTOTYPE_READY','PUBLISHED'\)/);
  assert.doesNotMatch(migration, /grant (insert|update|delete)[\s\S]+to anon/i);
  assert.doesNotMatch(migration, /grant select on public\.reviews[\s\S]+to anon/i);
});

test('seed contains the six MVP cases and one auditable feedback loop', () => {
  for (const id of ['austerlitz-1805','cuban-missile-1962','challenger-1986','netflix-2007','new-coke-1985','apollo-13-1970']) assert.match(seed, new RegExp(id));
  assert.match(seed, /Integration feedback-loop validation/);
  assert.match(seed, /before_version,after_version/);
});

test('Supabase normalized rows transform back into the existing DecisionEvent contract', () => {
  const result = transformSupabaseRows([{
    case_key:'sample',title:'Sample',domain:'history',subdomain:'test',actor:'Actor',actor_role:'Role',date_or_period:'1900',era:'1900s',location:'Here',t0:'Before',context_summary:'Context',actual_decision_key:'A',immediate_outcome:'Immediate',long_term_outcome:'Long',decision_quality:'Reasonable',outcome_quality:'Mixed',uncertainty_factors:['risk'],metadata:{popularity:1},progressive:null,narrative_key:'sample',
    decision_options:[{option_key:'B',decision_key:'b',sort_order:2,label:'B',short_description:'B desc',upside:'B up',downside:'B down',known_tradeoffs:[]},{option_key:'A',decision_key:'a',sort_order:1,label:'A',short_description:'A desc',upside:'A up',downside:'A down',known_tradeoffs:[]}],
    case_information:[{information_type:'UNKNOWN_AT_T0',sequence:1,content:'Unknown'},{information_type:'KNOWN_AT_T0',sequence:1,content:'Known'}],
    evidence:[{evidence_key:'e1',source_type:'archive',title:'Source',author_or_institution:'Archive',evidence_class:'FACT'}],
    case_scores:[{curiosity:1,decision:2,stakes:3,mystery:4,explainability:5,evidence:6}],
    narratives:[{version:1,hook:'Hook',short_setup:'Setup',why_option_a_made_sense:'A why',why_option_b_made_sense:'B why',actual_decision_explanation:'Actual',outcome_story:'Outcome',hindsight_analysis:'Analysis',decision_principle:'Principle',longform_story:'Longform'}],
  }]);
  assert.equal(result.cases[0].id, 'sample');
  assert.deepEqual(result.cases[0].options.map((option) => option.id), ['a','b']);
  assert.deepEqual(result.cases[0].known_information, ['Known']);
  assert.equal(result.narratives.sample.hook, 'Hook');
});

test('service role remains server-only', async () => {
  const client = await readFile(new URL('../components/decision-platform.tsx', import.meta.url), 'utf8');
  const publicRoute = await readFile(new URL('../app/api/content/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(client, /SERVICE_ROLE|service_role/);
  assert.doesNotMatch(publicRoute, /SUPABASE_SERVICE_ROLE_KEY/);
});
