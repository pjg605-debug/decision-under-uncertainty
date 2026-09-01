const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

declare const Deno: { env: { get(name: string): string | undefined } };

type JsonRecord = Record<string, unknown>;

type GeneratedBlock = {
  kind: 'heading' | 'paragraph' | 'callout' | 'quote' | 'list';
  text: string;
  title: string;
  items: string[];
};

type GeneratedArticle = {
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  category: string;
  tags: string[];
  reading_minutes: number;
  difficulty: '입문' | '중급' | '심화';
  content_blocks: GeneratedBlock[];
  thought_experiment: {
    title: string;
    prompt: string;
    choices: string[];
    reflection: string;
  };
  practice: {
    title: string;
    minutes: number;
    steps: string[];
    rule_template: string;
  };
  source_notes: Array<{
    title: string;
    authors: string;
    year: number;
    url: string;
    note: string;
  }>;
};

const articleSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'slug', 'title', 'subtitle', 'excerpt', 'category', 'tags',
    'reading_minutes', 'difficulty', 'content_blocks', 'thought_experiment',
    'practice', 'source_notes',
  ],
  properties: {
    slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    title: { type: 'string', minLength: 15, maxLength: 90 },
    subtitle: { type: 'string', minLength: 10, maxLength: 100 },
    excerpt: { type: 'string', minLength: 40, maxLength: 240 },
    category: {
      type: 'string',
      enum: ['행동경제학', '행동재무학', '행동금융학', '신경경제학', '소비자심리학', '경제심리학'],
    },
    tags: { type: 'array', minItems: 3, maxItems: 6, items: { type: 'string' } },
    reading_minutes: { type: 'integer', minimum: 6, maximum: 12 },
    difficulty: { type: 'string', enum: ['입문', '중급', '심화'] },
    content_blocks: {
      type: 'array',
      minItems: 10,
      maxItems: 18,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'text', 'title', 'items'],
        properties: {
          kind: { type: 'string', enum: ['heading', 'paragraph', 'callout', 'quote', 'list'] },
          text: { type: 'string' },
          title: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    thought_experiment: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'prompt', 'choices', 'reflection'],
      properties: {
        title: { type: 'string' },
        prompt: { type: 'string' },
        choices: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } },
        reflection: { type: 'string' },
      },
    },
    practice: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'minutes', 'steps', 'rule_template'],
      properties: {
        title: { type: 'string' },
        minutes: { type: 'integer', minimum: 5, maximum: 10 },
        steps: { type: 'array', minItems: 4, maxItems: 6, items: { type: 'string' } },
        rule_template: { type: 'string' },
      },
    },
    source_notes: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'authors', 'year', 'url', 'note'],
        properties: {
          title: { type: 'string' },
          authors: { type: 'string' },
          year: { type: 'integer', minimum: 1900, maximum: 2100 },
          url: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
  },
} as const;

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

function response(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function getSecretKey() {
  const named = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (named) {
    const parsed = JSON.parse(named) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

function slotKeyFrom(input: unknown) {
  const supplied = typeof input === 'string' ? Date.parse(input) : NaN;
  const timestamp = Number.isFinite(supplied) ? supplied : Date.now();
  return new Date(Math.floor(timestamp / SIX_HOURS_MS) * SIX_HOURS_MS).toISOString();
}

function extractOutputText(payload: JsonRecord) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as JsonRecord).content) ? (item as JsonRecord).content as unknown[] : [];
    for (const part of content) {
      if (part && typeof part === 'object' && typeof (part as JsonRecord).text === 'string') {
        return (part as JsonRecord).text as string;
      }
    }
  }
  throw new Error('OpenAI response did not contain article JSON.');
}

function normalizeBlocks(blocks: GeneratedBlock[]) {
  return blocks.map((block) => {
    if (block.kind === 'list') return { kind: block.kind, items: block.items };
    if (block.kind === 'callout') return { kind: block.kind, title: block.title, text: block.text };
    return { kind: block.kind, text: block.text };
  });
}

function validateArticle(article: GeneratedArticle) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) throw new Error('Invalid article slug.');
  if (!article.title || !article.subtitle || !article.excerpt) throw new Error('Missing article summary fields.');
  if (article.content_blocks.length < 10) throw new Error('Article is too short.');
  if (article.source_notes.length < 2) throw new Error('At least two research sources are required.');
  for (const source of article.source_notes) {
    const parsed = new URL(source.url);
    if (parsed.protocol !== 'https:') throw new Error(`Non-HTTPS source URL: ${source.url}`);
  }
}

async function supabaseRequest(path: string, key: string, init: RequestInit = {}) {
  const baseUrl = Deno.env.get('SUPABASE_URL');
  if (!baseUrl) throw new Error('SUPABASE_URL is not configured.');
  const result = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!result.ok) {
    const detail = (await result.text()).slice(0, 1000);
    throw new Error(`Supabase request failed (${result.status}): ${detail}`);
  }
  if (result.status === 204) return null;
  return await result.json();
}

async function finishRun(key: string, slotKey: string, status: 'SUCCEEDED' | 'FAILED', slug?: string, error?: string) {
  await supabaseRequest('/rest/v1/rpc/finish_article_generation_slot', key, {
    method: 'POST',
    body: JSON.stringify({
      p_slot_key: slotKey,
      p_status: status,
      p_article_slug: slug || null,
      p_error_message: error?.slice(0, 2000) || null,
    }),
  });
}

async function generateArticle(openAiKey: string, existing: unknown[]) {
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.4';
  const titles = existing.map((row) => {
    const item = row as JsonRecord;
    return { slug: item.slug, title: item.title, category: item.category, tags: item.tags };
  });
  const sequence = existing.length + 1;
  const apiResponse = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 7000,
      reasoning: { effort: 'medium' },
      tools: [{ type: 'web_search_preview', search_context_size: 'medium' }],
      tool_choice: 'auto',
      text: {
        verbosity: 'medium',
        format: { type: 'json_schema', name: 'judgment_training_article', strict: true, schema: articleSchema },
      },
      instructions: [
        '당신은 행동경제학과 행동재무학을 정확하면서도 읽기 쉽게 설명하는 한국어 편집자다.',
        '웹 검색을 사용해 논문, 학술지, 대학, 정부·공공기관 등 1차 또는 권위 있는 출처를 확인한다.',
        '출처 제목, 저자, 연도, URL을 실제 검색 결과와 일치시키며 존재하지 않는 연구를 만들지 않는다.',
        '투자 수익을 약속하거나 특정 자산의 매매를 권하지 않는다.',
        '독자가 자신의 판단 절차를 관찰하고 연습할 수 있는 글을 쓴다.',
      ].join(' '),
      input: [
        `판단 훈련 ${String(sequence).padStart(2, '0')}편을 작성하라.`,
        '주식·선물·옵션·가상자산 거래 또는 쇼핑·화폐 사용에서 나타나는 판단 오류를 하나 선택한다.',
        '행동경제학, 행동재무학, 행동금융학, 신경경제학, 소비자심리학, 경제심리학 중 가장 적절한 관점을 사용한다.',
        '도입 사례, 핵심 개념, 오류가 생기는 과정, 반례와 합리적 예외, 생각 실험, 5~10분 훈련, 자기 점검 질문을 포함한다.',
        'content_blocks에는 heading 3개 이상, paragraph 6개 이상, callout 1개, list 1개를 포함한다.',
        'source_notes에는 실제 확인한 연구 출처만 2~4개 포함하고 DOI 또는 원문 URL을 사용한다.',
        '아래 기존 글과 핵심 편향·사례·제목이 겹치지 않게 한다.',
        JSON.stringify(titles),
      ].join('\n'),
    }),
  });

  if (!apiResponse.ok) {
    throw new Error(`OpenAI request failed (${apiResponse.status}): ${(await apiResponse.text()).slice(0, 1000)}`);
  }
  const payload = await apiResponse.json() as JsonRecord;
  const article = JSON.parse(extractOutputText(payload)) as GeneratedArticle;
  validateArticle(article);
  return { article, sequence, model };
}

export default { fetch: async (request: Request) => {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed' });

  const expectedSecret = Deno.env.get('ARTICLE_CRON_SECRET_V2');
  if (!expectedSecret || request.headers.get('x-cron-secret') !== expectedSecret) {
    return response(401, { error: 'Unauthorized' });
  }

  const key = getSecretKey();
  const openAiKey = Deno.env.get('OPENAI_API_KEY') || '';
  if (!key) return response(500, { error: 'Supabase secret key is unavailable.' });
  if (!openAiKey) return response(503, { error: 'OPENAI_API_KEY is not configured.' });

  const body = await request.json().catch(() => ({})) as JsonRecord;
  const slotKey = slotKeyFrom(body.scheduled_at);
  let claimed = false;

  try {
    claimed = await supabaseRequest('/rest/v1/rpc/claim_article_generation_slot', key, {
      method: 'POST',
      body: JSON.stringify({ p_slot_key: slotKey }),
    }) as boolean;
    if (!claimed) return response(200, { ok: true, skipped: true, reason: 'slot_already_processed', slot_key: slotKey });

    const existing = await supabaseRequest(
      '/rest/v1/articles?status=eq.PUBLISHED&is_current=eq.true&select=slug,title,category,tags&order=published_at.desc&limit=100',
      key,
    ) as unknown[];
    const { article, sequence, model } = await generateArticle(openAiKey, existing);
    const existingSlugs = new Set(existing.map((row) => String((row as JsonRecord).slug)));
    const suffix = slotKey.slice(0, 13).replace(/[-T:]/g, '');
    const slug = existingSlugs.has(article.slug) ? `${article.slug}-${suffix}` : article.slug;
    const publishedAt = new Date().toISOString();

    await supabaseRequest('/rest/v1/articles', key, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        slug,
        version: 1,
        is_current: true,
        status: 'PUBLISHED',
        title: article.title,
        subtitle: article.subtitle,
        excerpt: article.excerpt,
        category: article.category,
        tags: article.tags,
        reading_minutes: article.reading_minutes,
        difficulty: article.difficulty,
        hero_kicker: `판단 훈련 ${String(sequence).padStart(2, '0')} · ${article.tags[0]}`,
        content_blocks: normalizeBlocks(article.content_blocks),
        thought_experiment: article.thought_experiment,
        practice: article.practice,
        source_notes: article.source_notes,
        author_agent: `supabase-edge:${model}`,
        published_at: publishedAt,
      }),
    });

    await finishRun(key, slotKey, 'SUCCEEDED', slug);
    return response(200, {
      ok: true,
      slot_key: slotKey,
      slug,
      url: `https://decision-under-uncertainty.pjg605.chatgpt.site/articles/${slug}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (claimed) await finishRun(key, slotKey, 'FAILED', undefined, message).catch(() => undefined);
    console.error(JSON.stringify({ slot_key: slotKey, error: message }));
    return response(500, { ok: false, slot_key: slotKey, error: message });
  }
} };
