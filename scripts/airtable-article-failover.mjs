import { readFile } from 'node:fs/promises';
import {
  AIRTABLE_ARTICLE_FIELDS,
  articleToAirtableFields,
  airtableRecordToArticle,
  fetchAirtableArticleRecords,
  writeAirtableRecords,
} from '../core/airtable-articles.mjs';

const command = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const migrationPath = new URL(
  '../supabase/migrations/202609010005_publish_ten_judgment_articles.sql',
  import.meta.url,
);

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const airtable = () => ({
  token: requireEnv('AIRTABLE_TOKEN'),
  baseId: requireEnv('AIRTABLE_BASE_ID'),
  tableId: requireEnv('AIRTABLE_ARTICLES_TABLE_ID'),
});

const readBatch = async () => {
  const sql = await readFile(migrationPath, 'utf8');
  const marker = '$articles$';
  const start = sql.indexOf(marker) + marker.length;
  const end = sql.indexOf(marker, start);
  if (start < marker.length || end < 0) throw new Error('Article JSON batch marker not found.');
  return JSON.parse(sql.slice(start, end));
};

async function seedAirtable() {
  const articles = await readBatch();
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, article_count: articles.length }));
    return;
  }

  const options = airtable();
  const existing = await fetchAirtableArticleRecords({ ...options, publishedOnly: false });
  const byKey = new Map(
    existing.map((record) => [
      `${String(record.fields[AIRTABLE_ARTICLE_FIELDS.slug])}@${String(record.fields[AIRTABLE_ARTICLE_FIELDS.version])}`,
      record,
    ]),
  );
  const writes = articles.map((article) => {
    const previous = byKey.get(`${article.slug}@${article.version}`);
    return {
      ...(previous ? { id: previous.id } : {}),
      fields: articleToAirtableFields(
        {
          ...article,
          status: 'PUBLISHED',
          is_current: true,
          author_agent: 'codex:airtable-failover-batch-01',
          published_at: article.published_at || new Date().toISOString(),
        },
        previous?.fields[AIRTABLE_ARTICLE_FIELDS.syncState] || 'PENDING',
      ),
    };
  });
  const result = await writeAirtableRecords(options, writes);
  console.log(JSON.stringify({ ok: true, written: result.length }));
}

async function syncToSupabase() {
  const options = airtable();
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const records = await fetchAirtableArticleRecords({ ...options, publishedOnly: true });
  const pending = records.filter(
    (record) => record.fields[AIRTABLE_ARTICLE_FIELDS.syncState] !== 'SYNCED',
  );
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, pending: pending.length }));
    return;
  }

  let synced = 0;
  for (const record of pending) {
    const article = airtableRecordToArticle(record);
    if (!article) continue;
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_airtable_article`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_article: article }),
    });
    if (!response.ok) {
      const detail = await response.text();
      await writeAirtableRecords(options, [
        {
          id: record.id,
          fields: {
            [AIRTABLE_ARTICLE_FIELDS.syncState]: 'ERROR',
            [AIRTABLE_ARTICLE_FIELDS.syncError]: detail.slice(0, 900),
          },
        },
      ]);
      throw new Error(`Supabase sync failed for ${article.slug} (${response.status}).`);
    }
    const supabaseId = await response.json();
    await writeAirtableRecords(options, [
      {
        id: record.id,
        fields: {
          [AIRTABLE_ARTICLE_FIELDS.syncState]: 'SYNCED',
          [AIRTABLE_ARTICLE_FIELDS.supabaseId]: String(supabaseId).replaceAll('"', ''),
          [AIRTABLE_ARTICLE_FIELDS.syncError]: '',
        },
      },
    ]);
    synced += 1;
  }
  console.log(JSON.stringify({ ok: true, synced }));
}

if (command === 'seed') await seedAirtable();
else if (command === 'sync-to-supabase') await syncToSupabase();
else throw new Error('Usage: airtable-article-failover.mjs <seed|sync-to-supabase> [--dry-run]');
