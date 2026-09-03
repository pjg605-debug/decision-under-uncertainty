#!/usr/bin/env node
// Reads case drafts from content/pending-cases/*.json and creates a brand
// new decision_cases row (plus its options/case_information/evidence) via
// the import_pending_case() Postgres function, which does the whole insert
// in one transaction -- a mid-import failure leaves no partial case behind.
//
// This is the file-based, write-through-CI pattern already used for
// articles and narratives in this project (see
// scripts/submit-pending-narratives.mjs): Claude never holds a live
// SUPABASE_SERVICE_ROLE_KEY in an interactive session; it writes a file,
// commits, pushes, and a GitHub Actions workflow with that secret does the
// actual write, then this script reads the result back and verifies it
// before archiving the draft. On any mismatch or error, the file is left in
// place and the script exits non-zero -- fail closed.
//
// Case creation was previously not one of Claude's granted writes (see
// CLAUDE.md's former role boundary). This script is the mechanism for the
// expanded role agreed with the project owner on 2026-09-03: Claude may now
// discover/research/structure a case and land it at RESEARCH_DONE (or
// earlier); Codex still owns CODEX_REVIEW -> APPROVED -> PUBLISHED. This
// script cannot write narratives and cannot advance a case past
// RESEARCH_DONE -- it only creates the row.

import { readdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request, rpc } from './editorial-desk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pendingDir = path.join(__dirname, '..', 'content', 'pending-cases');
const processedDir = path.join(pendingDir, 'processed');

const REQUIRED_CASE_FIELDS = [
  'case_key',
  'title',
  'domain',
  'subdomain',
  'actor',
  'actor_role',
  'date_or_period',
  'era',
  'location',
  't0',
  'context_summary',
  'actual_decision_key',
  'immediate_outcome',
  'long_term_outcome',
  'decision_quality',
  'outcome_quality',
];

const VALID_DOMAINS = ['history', 'business', 'exploration', 'science', 'crisis'];
const VALID_DECISION_QUALITY = ['Strong', 'Reasonable', 'Weak', 'Unclear'];
const VALID_OUTCOME_QUALITY = ['Good', 'Bad', 'Mixed'];
const VALID_INFORMATION_TYPES = ['KNOWN_AT_T0', 'UNKNOWN_AT_T0'];
const VALID_EVIDENCE_CLASS = ['FACT', 'CONTEMPORARY_BELIEF', 'STATED_RATIONALE', 'INFERENCE'];
const VALID_IMPORT_STATUS = ['DISCOVERED', 'RESEARCHING', 'RESEARCH_DONE'];

export function validateDraft(draft, filename) {
  const missing = REQUIRED_CASE_FIELDS.filter((field) => !draft[field]);
  if (missing.length)
    throw new Error(`${filename}: missing required field(s): ${missing.join(', ')}`);
  if (!VALID_DOMAINS.includes(draft.domain))
    throw new Error(`${filename}: domain must be one of ${VALID_DOMAINS.join(', ')}, got ${JSON.stringify(draft.domain)}`);
  if (!VALID_DECISION_QUALITY.includes(draft.decision_quality))
    throw new Error(`${filename}: decision_quality must be one of ${VALID_DECISION_QUALITY.join(', ')}`);
  if (!VALID_OUTCOME_QUALITY.includes(draft.outcome_quality))
    throw new Error(`${filename}: outcome_quality must be one of ${VALID_OUTCOME_QUALITY.join(', ')}`);
  if (draft.status && !VALID_IMPORT_STATUS.includes(draft.status))
    throw new Error(`${filename}: status must be one of ${VALID_IMPORT_STATUS.join(', ')} at import time (later stages happen through the normal editorial review flow)`);

  if (!Array.isArray(draft.options) || draft.options.length < 2)
    throw new Error(`${filename}: options must be an array of at least 2 entries`);
  const decisionKeys = new Set();
  draft.options.forEach((option, index) => {
    const label = `${filename}: options[${index}]`;
    if (!/^[A-Z]$/.test(option.option_key || ''))
      throw new Error(`${label}.option_key must be a single uppercase letter`);
    if (!option.decision_key) throw new Error(`${label}.decision_key is required`);
    if (!Number.isInteger(option.sort_order) || option.sort_order <= 0)
      throw new Error(`${label}.sort_order must be a positive integer`);
    for (const field of ['label', 'short_description', 'upside', 'downside'])
      if (!option[field]) throw new Error(`${label}.${field} is required`);
    decisionKeys.add(option.decision_key);
  });
  if (!decisionKeys.has(draft.actual_decision_key))
    throw new Error(`${filename}: actual_decision_key ${JSON.stringify(draft.actual_decision_key)} does not match any option's decision_key`);

  if (!Array.isArray(draft.case_information) || draft.case_information.length < 2)
    throw new Error(`${filename}: case_information must be an array of at least 2 entries`);
  const hasKnown = draft.case_information.some((i) => i.information_type === 'KNOWN_AT_T0');
  const hasUnknown = draft.case_information.some((i) => i.information_type === 'UNKNOWN_AT_T0');
  if (!hasKnown || !hasUnknown)
    throw new Error(`${filename}: case_information must include at least one KNOWN_AT_T0 and one UNKNOWN_AT_T0 item`);
  draft.case_information.forEach((info, index) => {
    const label = `${filename}: case_information[${index}]`;
    if (!VALID_INFORMATION_TYPES.includes(info.information_type))
      throw new Error(`${label}.information_type must be one of ${VALID_INFORMATION_TYPES.join(', ')}`);
    if (!Number.isInteger(info.sequence) || info.sequence <= 0)
      throw new Error(`${label}.sequence must be a positive integer`);
    if (!info.content) throw new Error(`${label}.content is required`);
  });

  if (!Array.isArray(draft.evidence) || draft.evidence.length < 1)
    throw new Error(`${filename}: evidence must be a non-empty array`);
  draft.evidence.forEach((item, index) => {
    const label = `${filename}: evidence[${index}]`;
    for (const field of ['evidence_key', 'source_type', 'title', 'author_or_institution'])
      if (!item[field]) throw new Error(`${label}.${field} is required`);
    if (!VALID_EVIDENCE_CLASS.includes(item.evidence_class))
      throw new Error(`${label}.evidence_class must be one of ${VALID_EVIDENCE_CLASS.join(', ')}`);
  });
}

export async function importOne(filename) {
  const filePath = path.join(pendingDir, filename);
  const draft = JSON.parse(await readFile(filePath, 'utf8'));
  validateDraft(draft, filename);

  const existing = await request(
    `decision_cases?case_key=eq.${encodeURIComponent(draft.case_key)}&select=id`,
  );
  if (existing?.length)
    throw new Error(
      `${filename}: a decision_cases row for case_key=${draft.case_key} already exists -- refusing to import a duplicate.`,
    );

  const [inserted] = await rpc('import_pending_case', { p_payload: draft });

  const [caseRow] = await request(
    `decision_cases?id=eq.${encodeURIComponent(inserted.case_id)}&select=id,case_key,title,status`,
  );
  const options = await request(
    `decision_options?case_id=eq.${encodeURIComponent(inserted.case_id)}&select=id`,
  );
  const information = await request(
    `case_information?case_id=eq.${encodeURIComponent(inserted.case_id)}&select=id`,
  );
  const evidence = await request(
    `evidence?case_id=eq.${encodeURIComponent(inserted.case_id)}&select=id`,
  );

  if (!caseRow || caseRow.case_key !== draft.case_key || caseRow.title !== draft.title)
    throw new Error(`${filename}: read-back mismatch on decision_cases row after import.`);
  if (options.length !== draft.options.length)
    throw new Error(`${filename}: expected ${draft.options.length} options, found ${options.length} after import.`);
  if (information.length !== draft.case_information.length)
    throw new Error(`${filename}: expected ${draft.case_information.length} case_information rows, found ${information.length} after import.`);
  if (evidence.length !== draft.evidence.length)
    throw new Error(`${filename}: expected ${draft.evidence.length} evidence rows, found ${evidence.length} after import.`);

  return {
    case_key: draft.case_key,
    case_id: caseRow.id,
    status: caseRow.status,
    options: options.length,
    case_information: information.length,
    evidence: evidence.length,
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await runCli();
}

async function runCli() {
  let files;
  try {
    files = (await readdir(pendingDir)).filter((f) => f.endsWith('.json'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No content/pending-cases directory; nothing to do.');
      process.exit(0);
    }
    throw error;
  }
  if (!files.length) {
    console.log('No pending case drafts found.');
    process.exit(0);
  }

  const results = { ok: true, imported: [], errors: [] };
  for (const filename of files) {
    try {
      const result = await importOne(filename);
      results.imported.push(result);
      await rename(
        path.join(pendingDir, filename),
        path.join(processedDir, filename),
      );
    } catch (error) {
      results.ok = false;
      results.errors.push({
        filename,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  console.log(JSON.stringify(results, null, 2));
  if (!results.ok) process.exit(1);
}
