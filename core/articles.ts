import bundledArticleData from '../data/articles/bundled-articles.json';
import { fetchPublishedArticlesFromAirtable } from './airtable-articles.mjs';

export type ArticleBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'callout'; title: string; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: string[] };

export type ArticleSource = {
  title: string;
  authors: string;
  year: number;
  url: string;
  note: string;
};

export type Article = {
  id: string;
  slug: string;
  version: number;
  title: string;
  subtitle: string;
  excerpt: string;
  category: string;
  tags: string[];
  reading_minutes: number;
  difficulty: '입문' | '중급' | '심화';
  hero_kicker: string;
  content_blocks: ArticleBlock[];
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
  source_notes: ArticleSource[];
  published_at: string;
};

export const fallbackArticles: Article[] = [
  {
    id: 'local-loss-recovery-reference-point-v1',
    slug: 'loss-recovery-reference-point',
    version: 1,
    title: '손실을 되찾고 싶은 순간, 당신은 시장이 아니라 어제를 거래한다',
    subtitle: '본전이라는 기준점이 현재의 판단을 점령하는 방식',
    excerpt:
      '손실 상태에서 우리는 미래 전망보다 최초 매입가격에 더 강하게 붙잡힐 수 있습니다. 본전의 감정과 시장 정보를 분리하는 세 가지 질문을 연습합니다.',
    category: '행동금융학',
    tags: ['손실회피', '기준점', '처분효과', '복수매매'],
    reading_minutes: 8,
    difficulty: '입문',
    hero_kicker: '판단 훈련 01 · 손실과 기준점',
    content_blocks: [
      {
        kind: 'paragraph',
        text: '계좌의 숫자가 붉게 변한 날에는 평소보다 훨씬 설득력 있는 이야기가 떠오릅니다. “조금만 더 버티면 본전이 온다.” 그 문장은 전망처럼 들리지만, 때로는 과거의 숫자에서 벗어나지 못한 마음의 표현입니다.',
      },
      { kind: 'heading', text: '오후 2시 37분의 화면' },
      {
        kind: 'paragraph',
        text: '민수는 오전에 지수선물 포지션을 열었습니다. 전날의 하락이 과도했고 장 초반 반등이 이어질 것이라는 판단이었습니다. 그러나 시장은 반대로 움직였습니다. 손실이 커지자 그는 처음 정한 철회 가격을 지우고 계약 수를 한 번 더 늘렸습니다. 평균 진입가격이 낮아졌다는 사실이 잠시 안도감을 주었습니다.',
      },
      {
        kind: 'paragraph',
        text: '이때 판단 대상은 앞으로의 시장이어야 합니다. 하지만 실제 머릿속의 기준점은 현재 가격이 아니라 최초 진입가격입니다. 시장에는 민수의 본전이 아무 의미가 없지만, 민수에게는 모든 의미가 있습니다.',
      },
      {
        kind: 'callout',
        title: 'T0에서 잠깐 멈추기',
        text: '지금 포지션이 전혀 없다면 같은 가격과 같은 규모로 새로 진입하시겠습니까? 답을 고른 뒤 확신도를 0~100%로 적어보세요.',
      },
      { kind: 'heading', text: '본전은 왜 특별하게 느껴질까' },
      {
        kind: 'paragraph',
        text: '전망이론은 사람들이 최종 부의 크기만으로 선택을 평가하지 않고, 하나의 기준점을 중심으로 이익과 손실을 다르게 경험한다고 설명합니다. 같은 금액이라도 손실 쪽 변화는 더 강하게 느껴질 수 있습니다. 매입가격, 어제의 고점, 한때 기록했던 평가이익이 기준점이 되면 현재 가격은 그 자체가 아니라 “얼마나 되찾았는가”로 읽히기 시작합니다.',
      },
      {
        kind: 'paragraph',
        text: '이와 연결되는 처분효과는 이익이 난 자산을 비교적 빨리 팔고 손실이 난 자산은 오래 보유하려는 경향을 가리킵니다. 다만 모든 손실 보유가 편향은 아닙니다. 세금, 거래비용, 포트폴리오 재조정, 새로운 정보가 합리적인 이유가 될 수 있습니다. 중요한 것은 보유 이유가 현재의 증거인지, 손실을 확정하기 싫은 감정인지 구분하는 일입니다.',
      },
      {
        kind: 'quote',
        text: '감정이 있다는 사실이 문제가 아니라, 감정이 새로운 시장 정보인 것처럼 판단 과정에 들어오는 순간이 문제다.',
      },
      { kind: 'heading', text: '판단을 다시 시작하는 세 가지 질문' },
      {
        kind: 'list',
        items: [
          '지금 포지션이 전혀 없다면 같은 가격에 새로 진입할 것인가?',
          '최초 진입가격을 볼 수 없다면 어떤 정보로 보유 여부를 판단할 것인가?',
          '이 손실이 친구의 계좌에서 발생했다면 같은 선택을 권할 것인가?',
        ],
      },
      {
        kind: 'paragraph',
        text: '첫 질문은 보유를 수동적인 상태가 아니라 매 순간 다시 이루어지는 선택으로 바꿉니다. 두 번째 질문은 기준점을 가리고 가격 추세, 변동성, 유동성, 손실 한도, 최초 가설을 반증한 사건을 다시 보게 합니다. 세 번째 질문은 심리적 거리를 만들어 자기합리화를 약하게 합니다.',
      },
      { kind: 'heading', text: '좋은 결정은 손실을 피하는 결정이 아니다' },
      {
        kind: 'paragraph',
        text: '계획대로 손실을 제한한 직후 가격이 반등할 수 있습니다. 반대로 규칙을 어긴 물타기가 큰 수익으로 끝날 수도 있습니다. 전자는 나쁜 결과를 낳은 좋은 절차일 수 있고, 후자는 좋은 결과를 낳은 위험한 절차일 수 있습니다. 결과만으로 평가하면 우연히 보상받은 규칙 위반을 실력으로 학습하게 됩니다.',
      },
      {
        kind: 'paragraph',
        text: '합리적인 판단의 목표는 미래를 완벽하게 맞히는 데 있지 않습니다. 틀릴 수 있음을 전제로 손실의 크기를 제한하고, 어떤 정보가 들어오면 생각을 바꿀지 미리 정하는 데 있습니다. 확신은 강도이고 근거는 구조입니다. 둘은 같은 것이 아닙니다.',
      },
    ],
    thought_experiment: {
      title: '새 정보가 도착했다',
      prompt:
        '손실 직후 시장 변동성이 두 배로 상승했고, 최초 반등 근거였던 지표도 예상과 반대로 발표됐습니다. 반면 가격은 장기 지지 구간에 접근했습니다. 처음 선택을 유지할까요, 변경할까요?',
      choices: ['기존 계획대로 손실을 제한한다', '포지션을 유지한다', '규모를 줄이고 판단을 보류한다'],
      reflection: '어떤 정보가 선택을 바꾸는 데 가장 큰 영향을 주었는지 한 문장으로 적어보세요.',
    },
    practice: {
      title: '오늘의 7분 훈련',
      minutes: 7,
      steps: [
        '최근 손실이 난 거래나 만족스럽지 않았던 구매 한 건을 고릅니다.',
        '당시의 기준점이 매입가격, 할인 전 가격, 최고 평가금액 중 무엇이었는지 적습니다.',
        '그 숫자를 가리고 현재 시점에서 다시 선택합니다.',
        '결과와 무관하게 지키고 싶은 규칙을 한 문장으로 만듭니다.',
      ],
      rule_template: '본전을 기준으로 기다리지 않고, 최초 가설이 깨진 정보를 기준으로 다시 판단한다.',
    },
    source_notes: [
      {
        title: 'Prospect Theory: An Analysis of Decision under Risk',
        authors: 'Daniel Kahneman, Amos Tversky',
        year: 1979,
        url: 'https://doi.org/10.2307/1914185',
        note: '위험하의 선택을 기준점, 이익과 손실의 비대칭적 평가로 설명한 고전 연구.',
      },
      {
        title: 'The Disposition to Sell Winners Too Early and Ride Losers Too Long',
        authors: 'Hersh Shefrin, Meir Statman',
        year: 1985,
        url: 'https://doi.org/10.1111/j.1540-6261.1985.tb05002.x',
        note: '처분효과를 정신회계, 후회회피, 자기통제와 함께 설명한 행동재무 연구.',
      },
      {
        title: 'Reference point adaptation: Tests in the domain of security trading',
        authors: 'Hal R. Arkes, David Hirshleifer, Danling Jiang, Sonya Lim',
        year: 2008,
        url: 'https://doi.org/10.1016/j.obhdp.2007.04.005',
        note: '증권거래 맥락에서 이익과 손실 뒤 기준점 적응의 비대칭성을 실험한 연구.',
      },
    ],
    published_at: '2026-09-01T00:00:00+09:00',
  },
];

const normalizeArticle = (row: Record<string, unknown>): Article => ({
  ...(row as unknown as Article),
  tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  content_blocks: Array.isArray(row.content_blocks)
    ? (row.content_blocks as ArticleBlock[])
    : [],
  source_notes: Array.isArray(row.source_notes)
    ? (row.source_notes as ArticleSource[])
    : [],
});

const bundledArticles = (bundledArticleData as unknown as Record<string, unknown>[]).map(
  normalizeArticle,
);

export async function fetchPublishedArticles(): Promise<Article[]> {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';
  const sourceMode = process.env.ARTICLE_SOURCE_MODE || 'auto';
  const airtable = {
    token: process.env.AIRTABLE_TOKEN || '',
    baseId: process.env.AIRTABLE_BASE_ID || '',
    tableId: process.env.AIRTABLE_ARTICLES_TABLE_ID || '',
  };
  const supabaseArticles: Article[] = [];
  const airtableArticles: Article[] = [];

  if (sourceMode !== 'airtable' && url && key) {
    try {
      const response = await fetch(
        `${url.replace(/\/$/, '')}/rest/v1/articles?status=eq.PUBLISHED&is_current=eq.true&select=*&order=published_at.desc`,
        {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: 'no-store',
        },
      );
      if (!response.ok) throw new Error(`Supabase articles request failed (${response.status}).`);
      const rows = await response.json();
      if (Array.isArray(rows)) supabaseArticles.push(...rows.map(normalizeArticle));
    } catch {
      // Airtable or bundled content remains available during a Supabase outage.
    }
  }

  if (sourceMode !== 'supabase' && airtable.token && airtable.baseId && airtable.tableId) {
    try {
      airtableArticles.push(...(await fetchPublishedArticlesFromAirtable(airtable)));
    } catch {
      // Bundled content is the final fail-closed reader fallback.
    }
  }

  const merged = new Map<string, Article>();
  for (const article of fallbackArticles) merged.set(article.slug, article);
  for (const article of bundledArticles) merged.set(article.slug, article);
  for (const article of airtableArticles) merged.set(article.slug, article);
  for (const article of supabaseArticles) merged.set(article.slug, article);
  const articles = [...merged.values()].sort(
    (left, right) => Date.parse(right.published_at) - Date.parse(left.published_at),
  );
  return articles;
}

export async function fetchPublishedArticle(slug: string): Promise<Article | undefined> {
  const articles = await fetchPublishedArticles();
  return articles.find((article) => article.slug === slug);
}
