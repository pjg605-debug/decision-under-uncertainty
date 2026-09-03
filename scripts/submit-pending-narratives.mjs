#!/usr/bin/env node
// Reads narrative drafts from content/pending-narratives/*.json, submits
// each through the same submitNarrativeVersion() the rest of Claude's
// tooling uses (scripts/editorial-desk.mjs / scripts/claude-desk.mjs), reads
// the inserted row back, and verifies every field round-tripped correctly
// before treating it as safe. On any mismatch or error, the file is left in
// place (not archived) and the script exits non-zero -- fail closed, same
// contract as scripts/ingest-pending-articles.mjs on the main branch.
//
// Each draft is one case_key + one language. Narratives are independently
// authored per language, never a translation of the other -- see
// CODEX_INTEGRATION_HANDOFF.md's "bilingual narratives must be
// independently authored" section (main branch) and the "Bilingual
// narratives" section of CLAUDE_DB_INTEGRATION_HANDOFF.md.

import { readdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request, submitNarrativeVersion } from './editorial-desk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pendingDir = path.join(__dirname, '..', 'content', 'pending-narratives');
const processedDir = path.join(pendingDir, 'processed');

const REQUIRED_NARRATIVE_FIELDS = [
  'language',
  'hook',
  'short_setup',
  'why_option_a_made_sense',
  'why_option_b_made_sense',
  'actual_decision_explanation',
  'outcome_story',
  'hindsight_analysis',
  'decision_principle',
  'longform_story',
];

export function validateDraft(draft, filename) {
  if (!draft.case_key) throw new Error(`${filename}: missing case_key`);
  if (!draft.narrative || typeof draft.narrative !== 'object')
    throw new Error(`${filename}: missing narrative object`);
  const missing = REQUIRED_NARRATIVE_FIELDS.filter(
    (field) => !draft.narrative[field],
  );
  if (missing.length)
    throw new Error(
      `${filename}: narrative missing required field(s): ${missing.join(', ')}`,
    );
}

// Deep-compares only the content fields actually sent -- ignores
// server-generated columns (id, case_id, version, created_at, etc.), same
// approach as scripts/ingest-pending-articles.mjs on main.
export function findMismatch(sent, stored, keyPath = '') {
  if (typeof sent !== typeof stored) return `${keyPath}: type ${typeof sent} vs ${typeof stored}`;
  if (Array.isArray(sent)) {
    if (!Array.isArray(stored) || sent.length !== stored.length)
      return `${keyPath}: array length ${sent.length} vs ${Array.isArray(stored) ? stored.length : 'not an array'}`;
    for (let i = 0; i < sent.length; i += 1) {
      const mismatch = findMismatch(sent[i], stored[i], `${keyPath}[${i}]`);
      if (mismatch) return mismatch;
    }
    return null;
  }
  if (sent && typeof sent === 'object') {
    for (const key of Object.keys(sent)) {
      const mismatch = findMismatch(sent[key], stored[key], keyPath ? `${keyPath}.${key}` : key);
      if (mismatch) return mismatch;
    }
    return null;
  }
  if (sent !== stored) return `${keyPath}: "${sent}" vs "${stored}"`;
  return null;
}

export async function submitOne(filename) {
  const filePath = path.join(pendingDir, filename);
  const draft = JSON.parse(await readFile(filePath, 'utf8'));
  validateDraft(draft, filename);

  const [caseRow] = await request(
    `decision_cases?case_key=eq.${encodeURIComponent(draft.case_key)}&select=id,case_key`,
  );
  if (!caseRow)
    throw new Error(
      `${filename}: no decision_cases row for case_key=${draft.case_key} -- ` +
        `creating a new case row is not one of Claude's granted writes; ask Codex to create it first.`,
    );

  const payload = {
    case_id: caseRow.id,
    case_key: draft.case_key,
    author_agent: 'claude',
    summary: draft.summary || `${draft.narrative.language} narrative submitted.`,
    triggered_by_review_id: draft.triggered_by_review_id || undefined,
    changes: draft.changes || [],
    narrative: draft.narrative,
  };

  const inserted = await submitNarrativeVersion(payload);
  const row = inserted[0];

  const [readBack] = await request(`narratives?id=eq.${row.id}&select=*`);
  for (const field of Object.keys(draft.narrative)) {
    const mismatch = findMismatch(draft.narrative[field], readBack[field], field);
    if (mismatch) {
      throw new Error(
        `${filename}: content mismatch after insert (id=${row.id}) -- ${mismatch}. ` +
          `Row left in place; not archiving the source file.`,
      );
    }
  }

  await rename(filePath, path.join(processedDir, filename));
  return {
    case_key: draft.case_key,
    language: draft.narrative.language,
    version: row.version,
    id: row.id,
  };
}

async function main() {
  const entries = await readdir(pendingDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name);
  if (!files.length) {
    console.log(JSON.stringify({ ok: true, submitted: [], message: 'no pending narratives' }));
    return;
  }

  const results = [];
  const errors = [];
  for (const filename of files) {
    try {
      results.push(await submitOne(filename));
    } catch (error) {
      errors.push({ filename, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(JSON.stringify({ ok: errors.length === 0, submitted: results, errors }, null, 2));
  if (errors.length) process.exit(1);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
