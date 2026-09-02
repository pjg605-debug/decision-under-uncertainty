#!/usr/bin/env node
// Reads article drafts from content/pending-articles/*.json, inserts each
// as a new DRAFT row in Supabase, reads the row back, and verifies every
// content field round-tripped byte-for-byte before treating it as safe.
// On any mismatch or error, the file is left in place (not archived) and
// the script exits non-zero -- fail closed, per this project's own rule
// that a missed slot beats a corrupted or fabricated article.
//
// This never touches `status` beyond DRAFT and never sets `is_current`,
// so nothing this script does is user-visible until a human/editorial
// step (or the existing publish-next-article Edge Function) promotes it.

import { readdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSupabaseServiceKey, supabaseAuthHeaders } from '../core/supabase-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pendingDir = path.join(__dirname, '..', 'content', 'pending-articles');
const processedDir = path.join(pendingDir, 'processed');

// validateDraft/findMismatch are pure and exported for testing; everything
// that needs live Supabase credentials is created lazily inside main() so
// importing this module never requires SUPABASE_URL/SUPABASE_SECRET_KEY
// to be set.
function makeRequest(baseUrl, serviceKey) {
  return async (path_, init = {}) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/${path_}`, {
      ...init,
      headers: {
        ...supabaseAuthHeaders(serviceKey),
        'content-type': 'application/json',
        ...init.headers,
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${text}`);
    return text ? JSON.parse(text) : null;
  };
}

const REQUIRED_FIELDS = [
  'slug', 'title', 'subtitle', 'excerpt', 'category', 'tags',
  'reading_minutes', 'difficulty', 'hero_kicker', 'content_blocks',
  'thought_experiment', 'practice', 'source_notes',
];

function validateDraft(draft, filename) {
  const missing = REQUIRED_FIELDS.filter((field) => draft[field] === undefined);
  if (missing.length) throw new Error(`${filename}: missing required field(s): ${missing.join(', ')}`);
  if (!Array.isArray(draft.content_blocks) || draft.content_blocks.length < 10)
    throw new Error(`${filename}: content_blocks must be an array of at least 10 blocks`);
  if (!Array.isArray(draft.practice?.steps) || draft.practice.steps.length < 4)
    throw new Error(`${filename}: practice.steps must have at least 4 steps`);
  if (!Array.isArray(draft.source_notes) || draft.source_notes.length < 2)
    throw new Error(`${filename}: source_notes must cite at least 2 sources`);
  for (const source of draft.source_notes) {
    if (!source.url || !source.url.startsWith('https://'))
      throw new Error(`${filename}: every source_notes entry needs an https:// url`);
  }
  const bannedPhrases = ['특정 종목을 매수', '수익을 보장', '반드시 오릅니다', '무조건 사세요'];
  const flatText = JSON.stringify(draft);
  for (const phrase of bannedPhrases) {
    if (flatText.includes(phrase))
      throw new Error(`${filename}: contains disallowed individualized-advice phrase "${phrase}"`);
  }
}

async function nextVersion(request, slug) {
  const existing = await request(
    `articles?slug=eq.${encodeURIComponent(slug)}&select=version&order=version.desc&limit=1`,
  );
  return (existing?.[0]?.version || 0) + 1;
}

// Deep-compares only the content fields we actually sent -- ignores
// server-generated columns (id, created_at, updated_at, version if
// server-assigned, etc.) so this checks for corruption, not for an
// exact row-shape match.
function findMismatch(sent, stored, keyPath = '') {
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

async function ingestOne(request, filename) {
  const filePath = path.join(pendingDir, filename);
  const draft = JSON.parse(await readFile(filePath, 'utf8'));
  validateDraft(draft, filename);

  const version = await nextVersion(request, draft.slug);
  const payload = {
    slug: draft.slug,
    version,
    is_current: false,
    status: 'DRAFT',
    title: draft.title,
    subtitle: draft.subtitle,
    excerpt: draft.excerpt,
    category: draft.category,
    tags: draft.tags,
    reading_minutes: draft.reading_minutes,
    difficulty: draft.difficulty,
    hero_kicker: draft.hero_kicker,
    content_blocks: draft.content_blocks,
    thought_experiment: draft.thought_experiment,
    practice: draft.practice,
    source_notes: draft.source_notes,
    author_agent: draft.author_agent || 'claude',
  };

  const inserted = await request('articles', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  const row = inserted[0];

  const [readBack] = await request(`articles?id=eq.${row.id}&select=*`);
  for (const field of Object.keys(payload)) {
    const mismatch = findMismatch(payload[field], readBack[field], field);
    if (mismatch) {
      throw new Error(
        `${filename}: content mismatch after insert (id=${row.id}) -- ${mismatch}. ` +
          `Row left in DRAFT with is_current=false; not archiving the source file.`,
      );
    }
  }

  await rename(filePath, path.join(processedDir, filename));
  return { slug: draft.slug, version, id: row.id };
}

async function main() {
  const baseUrl = process.env.SUPABASE_URL;
  const serviceKey = resolveSupabaseServiceKey();
  if (!baseUrl || !serviceKey) {
    console.error('SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.');
    process.exit(1);
    return;
  }
  const request = makeRequest(baseUrl, serviceKey);

  const entries = await readdir(pendingDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name);
  if (!files.length) {
    console.log(JSON.stringify({ ok: true, ingested: [], message: 'no pending drafts' }));
    return;
  }

  const results = [];
  const errors = [];
  for (const filename of files) {
    try {
      results.push(await ingestOne(request, filename));
    } catch (error) {
      errors.push({ filename, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(JSON.stringify({ ok: errors.length === 0, ingested: results, errors }, null, 2));
  if (errors.length) process.exit(1);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { validateDraft, findMismatch, makeRequest, nextVersion, ingestOne, main };
