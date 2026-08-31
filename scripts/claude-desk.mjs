#!/usr/bin/env node
// Claude-side convenience wrapper over the shared Supabase editorial desk.
// Reuses scripts/editorial-desk.mjs's `request`/`rpc` helpers rather than
// re-implementing Supabase REST/RPC plumbing. See CLAUDE.md and
// CLAUDE_DB_INTEGRATION_HANDOFF.md for the full contract this follows.

import { request, rpc, submitNarrativeVersion } from './editorial-desk.mjs';

const CLAUDE_AGENT_NAME = 'claude';

const args = process.argv.slice(2);
const command = args.shift();

const print = (value) =>
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

const summarizeCase = (row) => ({
  case_key: row.case_key,
  title: row.title,
  status: row.status,
  research_priority: row.research_priority,
  updated_at: row.updated_at,
});

const summarizeReview = (row) => ({
  review_id: row.id,
  case_id: row.case_id,
  narrative_id: row.narrative_id,
  reviewer_agent: row.reviewer_agent,
  review_type: row.review_type,
  severity: row.severity,
  comment: row.comment,
  created_at: row.created_at,
});

async function cmdQueue(limit = 10) {
  const [research, narrative, revision] = await Promise.all([
    rpc('get_cases_for_research', { p_limit: Number(limit) }),
    rpc('get_cases_for_narrative', { p_limit: Number(limit) }),
    rpc('get_revision_requests', { p_limit: Number(limit) }),
  ]);
  return {
    RESEARCH_QUEUE: { count: research.length, cases: research.map(summarizeCase) },
    NARRATIVE_QUEUE: { count: narrative.length, cases: narrative.map(summarizeCase) },
    REVISION_QUEUE: { count: revision.length, reviews: revision.map(summarizeReview) },
  };
}

// Full read-only bundle for one case, scoped by case_key, per the "Claude
// reads" list in CLAUDE_DB_INTEGRATION_HANDOFF.md: the case row, options,
// T0 known/unknown information, evidence, research claims/gaps, every
// narrative version, and any reviews attached to those narratives.
async function cmdCase(caseKey) {
  if (!caseKey) throw new Error('Usage: case <case-key>');
  const [caseRow] = await request(
    `decision_cases?case_key=eq.${encodeURIComponent(caseKey)}&select=*`,
  );
  if (!caseRow) throw new Error(`No decision_cases row for case_key=${caseKey}`);

  const [options, information, evidence, claims, gaps, narratives] =
    await Promise.all([
      request(
        `decision_options?case_id=eq.${caseRow.id}&order=sort_order.asc`,
      ),
      request(
        `case_information?case_id=eq.${caseRow.id}&order=information_type.asc,sequence.asc`,
      ),
      request(`evidence?case_id=eq.${caseRow.id}`),
      request(`research_claims?case_id=eq.${caseRow.id}`),
      request(`research_gaps?case_id=eq.${caseRow.id}`),
      request(`narratives?case_id=eq.${caseRow.id}&order=version.desc`),
    ]);

  const narrativeIds = narratives.map((n) => n.id);
  const reviews = narrativeIds.length
    ? await request(
        `reviews?case_id=eq.${caseRow.id}&order=created_at.desc`,
      )
    : [];

  const currentNarrative = narratives.find((n) => n.is_current) || null;

  return {
    case: caseRow,
    options,
    known_at_t0: information.filter(
      (i) => i.information_type === 'KNOWN_AT_T0',
    ),
    unknown_at_t0: information.filter(
      (i) => i.information_type === 'UNKNOWN_AT_T0',
    ),
    progressive_evidence: information.filter(
      (i) => i.information_type === 'PROGRESSIVE_EVIDENCE',
    ),
    evidence,
    research_claims: claims,
    research_gaps: gaps,
    narrative_version_count: narratives.length,
    current_narrative: currentNarrative,
    all_narrative_versions: narratives.map((n) => ({
      version: n.version,
      status: n.status,
      author_agent: n.author_agent,
      is_current: n.is_current,
      created_at: n.created_at,
    })),
    reviews,
    workflow_state: caseRow.status,
  };
}

// Claude's own workflow transitions are limited to claiming and finishing
// research; narrative/revision transitions happen inside
// submitNarrativeVersion (draft/revise below), and every other transition
// (review states, approval, publication) belongs to Codex or an editor
// per CLAUDE_DB_INTEGRATION_HANDOFF.md. Rejecting anything else here is a
// second guard on top of the DB's own transition_case_status validation.
const CLAUDE_ALLOWED_TRANSITIONS = new Set(['RESEARCHING', 'RESEARCH_DONE']);

async function cmdTransition(caseKey, toStatus, reason) {
  if (!caseKey || !toStatus)
    throw new Error('Usage: transition <case-key> <status> [reason]');
  if (!CLAUDE_ALLOWED_TRANSITIONS.has(toStatus)) {
    throw new Error(
      `Refusing: '${toStatus}' is not a transition Claude is assigned. ` +
        `Claude may only set ${[...CLAUDE_ALLOWED_TRANSITIONS].join(' or ')} directly ` +
        `(narrative/revision transitions happen automatically via draft-narrative/revise-narrative). ` +
        `Anything else (review, approval, publication, HOLD/REJECTED) is Codex's or an editor's call.`,
    );
  }
  return rpc('transition_case_status', {
    p_case_key: caseKey,
    p_to_status: toStatus,
    p_actor_agent: CLAUDE_AGENT_NAME,
    p_reason: reason || null,
  });
}

// Both narrative commands hardcode author_agent so a narrative version can
// never be inserted under a false attribution (Codex's or a human editor's
// name) from this script, regardless of what a caller passes in JSON.
async function cmdDraftNarrative(payload) {
  if (payload.triggered_by_review_id)
    throw new Error(
      'Use revise-narrative for a payload with triggered_by_review_id, not draft-narrative.',
    );
  return submitNarrativeVersion({ ...payload, author_agent: CLAUDE_AGENT_NAME });
}

async function cmdReviseNarrative(payload) {
  if (!payload.triggered_by_review_id)
    throw new Error(
      'revise-narrative requires triggered_by_review_id (the reviews.id this responds to). Use draft-narrative for a first version.',
    );
  return submitNarrativeVersion({ ...payload, author_agent: CLAUDE_AGENT_NAME });
}

async function cmdAgentRun(payload) {
  if (!payload.run_type) throw new Error('agent-run payload needs run_type.');
  return request('agent_runs', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      agent_name: CLAUDE_AGENT_NAME,
      run_type: payload.run_type,
      status: payload.status || 'STARTED',
      case_id: payload.case_id || null,
      input: payload.input || null,
      output: payload.output || null,
      error_message: payload.error_message || null,
      started_at: payload.started_at || new Date().toISOString(),
      completed_at: payload.completed_at || null,
    }),
  });
}

async function main() {
  const readJson = () => {
    const raw = args.join(' ');
    if (!raw) throw new Error('A JSON payload is required.');
    return JSON.parse(raw);
  };

  if (command === 'queue') {
    print(await cmdQueue(args[0]));
  } else if (command === 'case') {
    print(await cmdCase(args[0]));
  } else if (command === 'claim-research') {
    print(await cmdTransition(args[0], 'RESEARCHING', args.slice(1).join(' ')));
  } else if (command === 'complete-research') {
    print(await cmdTransition(args[0], 'RESEARCH_DONE', args.slice(1).join(' ')));
  } else if (command === 'draft-narrative') {
    print(await cmdDraftNarrative(readJson()));
  } else if (command === 'revise-narrative') {
    print(await cmdReviseNarrative(readJson()));
  } else if (command === 'agent-run') {
    print(await cmdAgentRun(readJson()));
  } else {
    console.error(
      `Unknown command: ${command || '(none)'}\n\n` +
        `Read:\n` +
        `  queue [limit]                     RESEARCH_QUEUE, NARRATIVE_QUEUE, REVISION_QUEUE\n` +
        `  case <case-key>                   Full read-only bundle for one case\n\n` +
        `Write (all attributed to author_agent/actor_agent = 'claude'):\n` +
        `  claim-research <case-key> [reason]     DISCOVERED -> RESEARCHING\n` +
        `  complete-research <case-key> [reason]  RESEARCHING -> RESEARCH_DONE\n` +
        `  draft-narrative '<json>'          First narrative version (no triggered_by_review_id)\n` +
        `  revise-narrative '<json>'         New version responding to a review (requires triggered_by_review_id)\n` +
        `  agent-run '<json>'                Audit row in agent_runs (needs run_type)\n\n` +
        `Payload shapes match scripts/editorial-desk.mjs's submit-narrative-version; see CLAUDE_DB_INTEGRATION_HANDOFF.md.`,
    );
    process.exit(1);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await main();
}

export {
  cmdQueue,
  cmdCase,
  cmdTransition,
  cmdDraftNarrative,
  cmdReviseNarrative,
  cmdAgentRun,
  CLAUDE_ALLOWED_TRANSITIONS,
  CLAUDE_AGENT_NAME,
};
