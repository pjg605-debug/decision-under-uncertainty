import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pendingDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'content',
  'pending-cases',
);

// scripts/editorial-desk.mjs (imported transitively by
// scripts/import-pending-case.mjs) reads
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY at module import time and exits
// the process if they're missing -- same pattern as
// tests/submit-pending-narratives.test.mjs.
process.env.SUPABASE_URL ||= 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-placeholder-not-a-real-key';

const { validateDraft, importOne } = await import(
  '../scripts/import-pending-case.mjs'
);
const workflowSource = await readFile(
  new URL('../.github/workflows/import-pending-case.yml', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL('../supabase/migrations/202609030001_import_pending_case.sql', import.meta.url),
  'utf8',
);
const ambiguityFix = await readFile(
  new URL('../supabase/migrations/202609030002_fix_import_pending_case_ambiguity.sql', import.meta.url),
  'utf8',
);

function mockFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return handler(url, init, calls.length - 1);
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

const jsonResponse = (body, ok = true, status = ok ? 200 : 400) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

function validDraft(overrides = {}) {
  return {
    case_key: 'd-day-launch-1944',
    title: 'Launch on the Marginal Forecast',
    domain: 'history',
    subdomain: 'military',
    actor: 'General Dwight D. Eisenhower',
    actor_role: 'Supreme Allied Commander',
    date_or_period: '1944',
    era: '1900s',
    location: 'Southwick House',
    t0: 'The Southwick House go/no-go meeting.',
    context_summary: 'A storm delayed the invasion; a marginal clearing window opens tomorrow.',
    actual_decision_key: 'launch',
    immediate_outcome: 'The landings proceeded on June 6.',
    long_term_outcome: 'The Normandy beachhead opened the Western Front.',
    decision_quality: 'Strong',
    outcome_quality: 'Good',
    status: 'RESEARCH_DONE',
    options: [
      {
        option_key: 'A',
        decision_key: 'launch',
        sort_order: 1,
        label: 'Launch',
        short_description: 'Go on the marginal forecast.',
        upside: 'Uses the only near-term window.',
        downside: 'The forecast could be wrong.',
      },
      {
        option_key: 'B',
        decision_key: 'postpone',
        sort_order: 2,
        label: 'Postpone',
        short_description: 'Wait two weeks.',
        upside: 'Avoids the unsettled weather.',
        downside: 'Strains the embarked troops further.',
      },
    ],
    case_information: [
      { information_type: 'KNOWN_AT_T0', sequence: 1, content: 'A storm forced a one-day delay.' },
      { information_type: 'UNKNOWN_AT_T0', sequence: 1, content: 'A worse storm hit on June 19.' },
    ],
    evidence: [
      {
        evidence_key: 'src-01',
        source_type: 'PRIMARY',
        title: 'Forecast for Overlord',
        author_or_institution: 'James Martin Stagg',
        evidence_class: 'STATED_RATIONALE',
      },
    ],
    ...overrides,
  };
}

test('validateDraft accepts a well-formed case draft', () => {
  assert.doesNotThrow(() => validateDraft(validDraft(), 'ok.json'));
});

test('validateDraft requires every decision_cases NOT NULL field', () => {
  const draft = validDraft();
  delete draft.context_summary;
  assert.throws(() => validateDraft(draft, 'bad.json'), /missing required field.*context_summary/);
});

test('validateDraft rejects an unsupported domain/decision_quality/outcome_quality', () => {
  assert.throws(() => validateDraft(validDraft({ domain: 'sports' }), 'bad.json'), /domain must be one of/);
  assert.throws(() => validateDraft(validDraft({ decision_quality: 'Great' }), 'bad.json'), /decision_quality must be one of/);
  assert.throws(() => validateDraft(validDraft({ outcome_quality: 'Amazing' }), 'bad.json'), /outcome_quality must be one of/);
});

test('validateDraft refuses to create a case anywhere past RESEARCH_DONE -- later stages belong to the normal editorial review flow', () => {
  assert.throws(
    () => validateDraft(validDraft({ status: 'APPROVED' }), 'bad.json'),
    /status must be one of DISCOVERED, RESEARCHING, RESEARCH_DONE/,
  );
  assert.throws(
    () => validateDraft(validDraft({ status: 'PUBLISHED' }), 'bad.json'),
    /status must be one of DISCOVERED, RESEARCHING, RESEARCH_DONE/,
  );
});

test('validateDraft requires at least two options with valid single-letter option_key values', () => {
  assert.throws(() => validateDraft(validDraft({ options: [validDraft().options[0]] }), 'bad.json'), /at least 2 entries/);
  const badKey = validDraft();
  badKey.options[0].option_key = 'AA';
  assert.throws(() => validateDraft(badKey, 'bad.json'), /option_key must be a single uppercase letter/);
});

test('validateDraft requires actual_decision_key to match one of the options', () => {
  const draft = validDraft({ actual_decision_key: 'retreat' });
  assert.throws(() => validateDraft(draft, 'bad.json'), /does not match any option's decision_key/);
});

test('validateDraft requires at least one KNOWN_AT_T0 and one UNKNOWN_AT_T0 item, never outcome-leaking types at import', () => {
  const onlyKnown = validDraft();
  onlyKnown.case_information = [
    { information_type: 'KNOWN_AT_T0', sequence: 1, content: 'x' },
    { information_type: 'KNOWN_AT_T0', sequence: 2, content: 'y' },
  ];
  assert.throws(() => validateDraft(onlyKnown, 'bad.json'), /at least one KNOWN_AT_T0 and one UNKNOWN_AT_T0/);
});

test('validateDraft requires a non-empty evidence array with a valid evidence_class', () => {
  assert.throws(() => validateDraft(validDraft({ evidence: [] }), 'bad.json'), /evidence must be a non-empty array/);
  const badClass = validDraft();
  badClass.evidence[0].evidence_class = 'RUMOR';
  assert.throws(() => validateDraft(badClass, 'bad.json'), /evidence_class must be one of/);
});

async function withTempDraft(filename, draft, fn) {
  const filePath = path.join(pendingDir, filename);
  await writeFile(filePath, JSON.stringify(draft));
  try {
    return await fn();
  } finally {
    await unlink(filePath).catch(() => {});
  }
}

test('importOne refuses to import a case_key that already exists -- never a duplicate or silent overwrite', async () => {
  const draft = validDraft();
  const { calls, restore } = mockFetch((url) => {
    if (String(url).includes('decision_cases?case_key=eq.d-day-launch-1944&select=id'))
      return jsonResponse([{ id: 'already-there' }]);
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    await withTempDraft('__test-duplicate.json', draft, () =>
      assert.rejects(
        () => importOne('__test-duplicate.json'),
        /already exists -- refusing to import a duplicate/,
      ),
    );
    assert.equal(calls.length, 1, 'must not call the import RPC once a duplicate is found');
  } finally {
    restore();
  }
});

test('importOne inserts via the transactional RPC and verifies every row landed before archiving', async () => {
  const draft = validDraft();
  const { restore } = mockFetch((url) => {
    const u = String(url);
    if (u.includes('decision_cases?case_key=eq.d-day-launch-1944&select=id')) return jsonResponse([]);
    if (u.includes('rpc/import_pending_case'))
      return jsonResponse([{ new_case_id: 'new-case-id', new_case_key: draft.case_key, landed_status: 'RESEARCH_DONE' }]);
    if (u.includes('decision_cases?id=eq.new-case-id'))
      return jsonResponse([{ id: 'new-case-id', case_key: draft.case_key, title: draft.title, status: 'RESEARCH_DONE' }]);
    if (u.includes('decision_options?case_id=eq.new-case-id')) return jsonResponse([{ id: 'o1' }, { id: 'o2' }]);
    if (u.includes('case_information?case_id=eq.new-case-id')) return jsonResponse([{ id: 'i1' }, { id: 'i2' }]);
    if (u.includes('evidence?case_id=eq.new-case-id')) return jsonResponse([{ id: 'e1' }]);
    throw new Error(`unexpected fetch: ${u}`);
  });
  try {
    const result = await withTempDraft('__test-happy.json', draft, () => importOne('__test-happy.json'));
    assert.deepEqual(result, {
      case_key: 'd-day-launch-1944',
      case_id: 'new-case-id',
      status: 'RESEARCH_DONE',
      options: 2,
      case_information: 2,
      evidence: 1,
    });
  } finally {
    restore();
  }
});

test('importOne throws on a read-back count mismatch instead of trusting the RPC blindly', async () => {
  const draft = validDraft();
  const { restore } = mockFetch((url) => {
    const u = String(url);
    if (u.includes('decision_cases?case_key=eq.d-day-launch-1944&select=id')) return jsonResponse([]);
    if (u.includes('rpc/import_pending_case'))
      return jsonResponse([{ new_case_id: 'new-case-id', new_case_key: draft.case_key, landed_status: 'RESEARCH_DONE' }]);
    if (u.includes('decision_cases?id=eq.new-case-id'))
      return jsonResponse([{ id: 'new-case-id', case_key: draft.case_key, title: draft.title, status: 'RESEARCH_DONE' }]);
    if (u.includes('decision_options?case_id=eq.new-case-id')) return jsonResponse([{ id: 'o1' }]); // only 1, draft has 2
    if (u.includes('case_information?case_id=eq.new-case-id')) return jsonResponse([{ id: 'i1' }, { id: 'i2' }]);
    if (u.includes('evidence?case_id=eq.new-case-id')) return jsonResponse([{ id: 'e1' }]);
    throw new Error(`unexpected fetch: ${u}`);
  });
  try {
    await withTempDraft('__test-mismatch.json', draft, () =>
      assert.rejects(
        () => importOne('__test-mismatch.json'),
        /expected 2 options, found 1/,
      ),
    );
  } finally {
    restore();
  }
});

test('the workflow triggers on push to the pending-cases path and never re-triggers on its own archive commit', () => {
  assert.match(workflowSource, /branches: \[claude\/decision-uncertainty-case-selection-9q6h5y\]/);
  assert.match(workflowSource, /content\/pending-cases\/\*\.json/);
  assert.match(workflowSource, /workflow_dispatch:/);
  assert.match(workflowSource, /\[skip ci\]/);
});

test('the workflow references the service key only via the GitHub secrets expression, never a literal value', () => {
  assert.match(
    workflowSource,
    /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/,
  );
  assert.doesNotMatch(workflowSource, /run:[\s\S]*echo[\s\S]*SUPABASE_SERVICE_ROLE_KEY/);
});

test('the import migration wraps the whole case in one transaction and refuses a duplicate case_key', () => {
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
  assert.match(migration, /language plpgsql/);
  assert.match(migration, /security definer/);
  assert.match(
    migration,
    /already exists for case_key=%; import refused to avoid a duplicate or silent overwrite/,
  );
});

test('the import migration can only land a case at DISCOVERED, RESEARCHING, or RESEARCH_DONE -- never straight to review or beyond', () => {
  assert.match(
    migration,
    /v_status not in \('DISCOVERED', 'RESEARCHING', 'RESEARCH_DONE'\)/,
  );
});

test('the import function is granted only to service_role, matching every other write RPC in this schema', () => {
  assert.match(migration, /revoke all on function public\.import_pending_case\(jsonb\) from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.import_pending_case\(jsonb\) to service_role;/);
});

// Real bug found on first live use: `returns table (case_id uuid, case_key
// text, status text)` shadows decision_cases' own case_key column, so
// `where case_key = v_case_key` inside the duplicate check is ambiguous
// (Postgres 42702) at call time even though the function creates fine.
// 202609030002 fixes it by renaming the OUT parameters so no bare
// identifier in the function body can be confused with a table column.
test('202609030002 renames the RETURNS TABLE columns so they can never collide with a table column again', () => {
  assert.match(ambiguityFix, /^begin;/);
  assert.match(ambiguityFix, /commit;\s*$/);
  assert.match(
    ambiguityFix,
    /returns table \(new_case_id uuid, new_case_key text, landed_status text\)/,
  );
});

// Postgres 42P13 ("cannot change return type of existing function") on
// first deploy attempt of this fix: CREATE OR REPLACE cannot change a
// RETURNS TABLE row type, only CREATE (after a DROP) can.
test('202609030002 drops the old function before recreating it, since CREATE OR REPLACE cannot change a RETURNS TABLE row type', () => {
  assert.match(ambiguityFix, /drop function if exists public\.import_pending_case\(jsonb\);/);
  const dropIndex = ambiguityFix.indexOf('drop function if exists public.import_pending_case(jsonb);');
  const createIndex = ambiguityFix.indexOf('create function public.import_pending_case(p_payload jsonb)');
  assert.ok(dropIndex >= 0 && createIndex > dropIndex, 'drop must come before the new create');
});

test('scripts/import-pending-case.mjs reads the RPC result by the fixed, collision-free column names', async () => {
  const scriptSource = await readFile(
    new URL('../scripts/import-pending-case.mjs', import.meta.url),
    'utf8',
  );
  assert.match(scriptSource, /inserted\.new_case_id/);
  assert.doesNotMatch(scriptSource, /inserted\.case_id\b/);
});

