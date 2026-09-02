#!/usr/bin/env node

const baseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  'content-type': 'application/json',
};

export const request = async (path, init = {}) => {
  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/rest/v1/${path}`,
    {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
    },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
};

export const rpc = (name, body) =>
  request(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });

// Narratives are independently authored per language, never a translation
// of the other -- see CODEX_INTEGRATION_HANDOFF.md's "bilingual narratives
// must be independently authored" section (main branch). A write must state
// its language explicitly; there is no silent default.
export const SUPPORTED_NARRATIVE_LANGUAGES = ['en', 'ko'];

export function assertSupportedNarrativeLanguage(language) {
  if (!SUPPORTED_NARRATIVE_LANGUAGES.includes(language))
    throw new Error(
      `payload.narrative.language is required and must be one of ${SUPPORTED_NARRATIVE_LANGUAGES.join(', ')} (got ${JSON.stringify(language)}).`,
    );
}

// Shared by the CLI below and scripts/claude-desk.mjs, so narrative
// submission logic (language validation, per-language versioning, revision
// linkage, status transition) lives in exactly one place regardless of
// which agent calls it.
export async function submitNarrativeVersion(payload) {
  assertSupportedNarrativeLanguage(payload?.narrative?.language);
  const language = payload.narrative.language;
  const existing = await request(
    `narratives?case_id=eq.${encodeURIComponent(payload.case_id)}&language=eq.${encodeURIComponent(language)}&select=version&order=version.desc&limit=1`,
  );
  const version = (existing?.[0]?.version || 0) + 1;
  const inserted = await request('narratives', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      ...payload.narrative,
      case_id: payload.case_id,
      version,
      author_agent: payload.author_agent,
      status: 'IN_REVIEW',
      is_current: false,
    }),
  });
  if (payload.triggered_by_review_id) {
    await request('revisions', {
      method: 'POST',
      body: JSON.stringify({
        case_id: payload.case_id,
        narrative_id: inserted[0].id,
        triggered_by_review_id: payload.triggered_by_review_id,
        author_agent: payload.author_agent,
        before_version: version - 1 || null,
        after_version: version,
        summary: payload.summary || 'Narrative revision submitted.',
        changes: payload.changes || [],
      }),
    });
  }
  if (payload.case_key) {
    await rpc('transition_case_status', {
      p_case_key: payload.case_key,
      p_to_status: payload.triggered_by_review_id
        ? 'REVISION_DONE'
        : 'NARRATIVE_DRAFTED',
      p_actor_agent: payload.author_agent,
      p_reason: payload.summary || `Narrative version ${version} submitted.`,
    });
  }
  return inserted;
}

// Everything below is the CLI entry point. It only runs when this file is
// executed directly (`node scripts/editorial-desk.mjs ...`), not when
// another script (e.g. scripts/claude-desk.mjs) imports `request`/`rpc`
// above to avoid duplicating this file's Supabase REST/RPC plumbing.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await runCli();
}

async function runCli() {
const args = process.argv.slice(2);
const command = args.shift();
const readJson = () => {
  const raw = args.join(' ');
  if (!raw) throw new Error('A JSON payload is required.');
  return JSON.parse(raw);
};
const print = (value) =>
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

const queueCommands = {
  'get-case-for-research': 'get_cases_for_research',
  'get-case-for-narrative': 'get_cases_for_narrative',
  'get-case-for-codex-review': 'get_cases_for_codex_review',
  'get-revision-requests': 'get_revision_requests',
};

if (queueCommands[command]) {
  print(await rpc(queueCommands[command], { p_limit: Number(args[0] || 10) }));
} else if (command === 'transition') {
  const [caseKey, toStatus, actorAgent, ...reason] = args;
  if (!caseKey || !toStatus || !actorAgent)
    throw new Error('Usage: transition <case-key> <status> <agent> [reason]');
  print(
    await rpc('transition_case_status', {
      p_case_key: caseKey,
      p_to_status: toStatus,
      p_actor_agent: actorAgent,
      p_reason: reason.join(' ') || null,
    }),
  );
} else if (command === 'submit-review') {
  const payload = readJson();
  const review = await request('reviews', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      case_id: payload.case_id,
      narrative_id: payload.narrative_id || null,
      reviewer_agent: payload.reviewer_agent || 'codex',
      review_type: payload.review_type || 'OTHER',
      field_name: payload.field_name || null,
      severity: payload.severity || 'MEDIUM',
      status: payload.verdict === 'REVISE' ? 'OPEN' : 'RESOLVED',
      verdict: payload.verdict,
      comment: payload.summary,
      suggested_change: payload.suggested_change || null,
      findings: payload.findings || [],
      resolved_at:
        payload.verdict === 'REVISE' ? null : new Date().toISOString(),
    }),
  });
  if (payload.case_key) {
    await rpc('transition_case_status', {
      p_case_key: payload.case_key,
      p_to_status: 'CODEX_REVIEW',
      p_actor_agent: payload.reviewer_agent || 'codex',
      p_reason: 'Editorial review opened.',
    });
    const next =
      payload.verdict === 'APPROVE'
        ? 'APPROVED'
        : payload.verdict === 'REVISE'
          ? 'REVISION_REQUESTED'
          : payload.verdict === 'REJECT'
            ? 'REJECTED'
            : 'HOLD';
    await rpc('transition_case_status', {
      p_case_key: payload.case_key,
      p_to_status: next,
      p_actor_agent: payload.reviewer_agent || 'codex',
      p_reason: payload.summary,
    });
  }
  print(review);
} else if (command === 'submit-narrative-version') {
  print(await submitNarrativeVersion(readJson()));
} else {
  console.error(
    `Unknown command: ${command || '(none)'}\n\nCommands:\n  get-case-for-research [limit]\n  get-case-for-narrative [limit]\n  get-case-for-codex-review [limit]\n  get-revision-requests [limit]\n  transition <case-key> <status> <agent> [reason]\n  submit-review '<json>'\n  submit-narrative-version '<json>'`,
  );
  process.exit(1);
}
}
