import { ArrowRight, BookOpen, Clock } from 'lucide-react';
import ArticleHeader from '../../components/article-header';
import { fetchPublishedArticles } from '../../core/articles';

export const dynamic = 'force-dynamic';

export default async function ArticlesPage() {
  const articles = await fetchPublishedArticles();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ArticleHeader />
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:pt-20">
        <p className="eyebrow">Decision practice journal</p>
        <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-[-.04em] sm:text-6xl">
          돈과 감정이 함께 움직일 때,<br />판단 절차를 지키는 연습
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">
          행동경제학과 행동금융학의 연구를 거래·소비의 실제 순간에 연결합니다. 매 글마다 먼저 판단하고, 새로운 정보를 받은 뒤 다시 생각하며, 그날 적용할 작은 규칙을 만듭니다.
        </p>
      </section>
      <section className="border-y bg-card/55">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="eyebrow">누적 아카이브</p>
              <h2 className="mt-2 text-2xl font-semibold">현재 {articles.length}편</h2>
            </div>
            <BookOpen className="text-primary" size={24} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {articles.map((article, index) => (
              <a
                key={`${article.slug}-${article.version}`}
                href={`/articles/${article.slug}`}
                className="group rounded-[1.6rem] border bg-background p-6 transition hover:-translate-y-0.5 hover:border-primary"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
                  <span className="text-primary">{String(index + 1).padStart(2, '0')}</span>
                  <span>·</span><span>{article.category}</span><span>·</span><span>{article.difficulty}</span>
                </div>
                <h3 className="mt-4 text-balance text-2xl font-semibold leading-tight tracking-[-.025em]">{article.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{article.excerpt}</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><Clock size={13} /> {article.reading_minutes}분</span>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-primary">읽기 <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
