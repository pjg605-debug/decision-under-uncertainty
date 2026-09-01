const FIELD = {
  slug: 'Slug',
  version: 'Version',
  status: 'Status',
  isCurrent: 'Is Current',
  title: 'Title',
  subtitle: 'Subtitle',
  excerpt: 'Excerpt',
  category: 'Category',
  tags: 'Tags JSON',
  readingMinutes: 'Reading Minutes',
  difficulty: 'Difficulty',
  heroKicker: 'Hero Kicker',
  contentBlocks: 'Content Blocks JSON',
  thoughtExperiment: 'Thought Experiment JSON',
  practice: 'Practice JSON',
  sourceNotes: 'Source Notes JSON',
  authorAgent: 'Author Agent',
  publishedAt: 'Published At',
  syncState: 'Sync State',
  supabaseId: 'Supabase ID',
  syncError: 'Last Sync Error',
};

const parseJson = (value, fallback) => {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const numberOr = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function airtableRecordToArticle(record) {
  const fields = record?.fields || {};
  const slug = String(fields[FIELD.slug] || '').trim();
  const title = String(fields[FIELD.title] || '').trim();
  if (!slug || !title) return null;

  return {
    id: String(fields[FIELD.supabaseId] || `airtable-${record.id}`),
    slug,
    version: numberOr(fields[FIELD.version], 1),
    title,
    subtitle: String(fields[FIELD.subtitle] || ''),
    excerpt: String(fields[FIELD.excerpt] || ''),
    category: String(fields[FIELD.category] || '행동경제학'),
    tags: parseJson(fields[FIELD.tags], []),
    reading_minutes: numberOr(fields[FIELD.readingMinutes], 5),
    difficulty: String(fields[FIELD.difficulty] || '입문'),
    hero_kicker: String(fields[FIELD.heroKicker] || ''),
    content_blocks: parseJson(fields[FIELD.contentBlocks], []),
    thought_experiment: parseJson(fields[FIELD.thoughtExperiment], {}),
    practice: parseJson(fields[FIELD.practice], {}),
    source_notes: parseJson(fields[FIELD.sourceNotes], []),
    author_agent: String(fields[FIELD.authorAgent] || 'airtable:failover'),
    published_at: String(fields[FIELD.publishedAt] || new Date(0).toISOString()),
  };
}

export function articleToAirtableFields(article, syncState = 'PENDING') {
  return {
    [FIELD.slug]: article.slug,
    [FIELD.version]: article.version,
    [FIELD.status]: article.status || 'PUBLISHED',
    [FIELD.isCurrent]: article.is_current ?? true,
    [FIELD.title]: article.title,
    [FIELD.subtitle]: article.subtitle,
    [FIELD.excerpt]: article.excerpt,
    [FIELD.category]: article.category,
    [FIELD.tags]: JSON.stringify(article.tags || []),
    [FIELD.readingMinutes]: article.reading_minutes,
    [FIELD.difficulty]: article.difficulty,
    [FIELD.heroKicker]: article.hero_kicker,
    [FIELD.contentBlocks]: JSON.stringify(article.content_blocks || []),
    [FIELD.thoughtExperiment]: JSON.stringify(article.thought_experiment || {}),
    [FIELD.practice]: JSON.stringify(article.practice || {}),
    [FIELD.sourceNotes]: JSON.stringify(article.source_notes || []),
    [FIELD.authorAgent]: article.author_agent || 'airtable:failover',
    [FIELD.publishedAt]: article.published_at || new Date().toISOString(),
    [FIELD.syncState]: syncState,
  };
}

async function airtableRequest({ token, baseId, tableId, path = '', method = 'GET', body, fetchImpl }) {
  const response = await fetchImpl(
    `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableId)}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Airtable request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.json();
}

export async function fetchAirtableArticleRecords(options) {
  const { token, baseId, tableId, fetchImpl = fetch, publishedOnly = true } = options;
  if (!token || !baseId || !tableId) return [];

  const records = [];
  let offset = '';
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (publishedOnly) {
      params.set('filterByFormula', "AND({Status}='PUBLISHED',{Is Current}=TRUE())");
      params.set('sort[0][field]', 'Published At');
      params.set('sort[0][direction]', 'desc');
    }
    if (offset) params.set('offset', offset);
    const page = await airtableRequest({
      token,
      baseId,
      tableId,
      path: `?${params}`,
      fetchImpl,
    });
    records.push(...(page.records || []));
    offset = page.offset || '';
  } while (offset);
  return records;
}

export async function fetchPublishedArticlesFromAirtable(options) {
  const records = await fetchAirtableArticleRecords({ ...options, publishedOnly: true });
  return records.map(airtableRecordToArticle).filter(Boolean);
}

export async function writeAirtableRecords(options, records) {
  const { token, baseId, tableId, fetchImpl = fetch } = options;
  const results = [];
  for (let index = 0; index < records.length; index += 10) {
    const chunk = records.slice(index, index + 10);
    const creates = chunk.filter((record) => !record.id).map((record) => ({ fields: record.fields }));
    const updates = chunk.filter((record) => record.id);
    if (creates.length) {
      const result = await airtableRequest({ token, baseId, tableId, method: 'POST', body: { records: creates, typecast: true }, fetchImpl });
      results.push(...(result.records || []));
    }
    if (updates.length) {
      const result = await airtableRequest({ token, baseId, tableId, method: 'PATCH', body: { records: updates, typecast: true }, fetchImpl });
      results.push(...(result.records || []));
    }
  }
  return results;
}

export { FIELD as AIRTABLE_ARTICLE_FIELDS };
