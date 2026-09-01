import type { Metadata } from 'next';
import { ExternalLink, FlaskConical, PenLine } from 'lucide-react';
import ArticleHeader from '../../../components/article-header';
import { fetchPublishedArticle } from '../../../core/articles';
import { getResearchSourceDetail } from '../../../core/research-source-details';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchPublishedArticle(slug);
  if (!article) return { title: '아티클을 찾을 수 없습니다 · Decision / T0' };
  return {
    title: `${article.title} · Decision / T0`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [],
    },
    twitter: { title: article.title, description: article.excerpt, images: [] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await fetchPublishedArticle(slug);
  if (!article) {
    return (
      <main className="min-h-screen bg-background">
        <ArticleHeader backToArchive />
        <div className="mx-auto max-w-3xl px-4 py-24">
          <h1 className="text-3xl font-semibold">아티클을 찾을 수 없습니다.</h1>
        </div>
      </main>
    );
  }
  const published = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'long',
    timeZone: 'Asia/Seoul',
  }).format(new Date(article.published_at));
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ArticleHeader backToArchive />
      <article>
        <header className="border-b bg-card/50">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
            <p className="font-mono text-xs uppercase tracking-[.2em] text-primary">
              {article.hero_kicker}
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-[-.045em] sm:text-6xl">
              {article.title}
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              {article.subtitle}
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{published}</span>
              <span>·</span>
              <span>{article.category}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border bg-background px-3 py-1 text-[11px]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
          <div className="space-y-6 text-[1.05rem] leading-8">
            {article.content_blocks.map((block, index) => {
              if (block.kind === 'heading')
                return (
                  <h2
                    key={index}
                    className="pt-7 text-3xl font-semibold leading-tight tracking-[-.03em]"
                  >
                    {block.text}
                  </h2>
                );
              if (block.kind === 'paragraph')
                return <p key={index}>{block.text}</p>;
              if (block.kind === 'quote')
                return (
                  <blockquote
                    key={index}
                    className="my-10 border-l-2 border-primary pl-6 text-xl font-medium leading-9 text-primary"
                  >
                    {block.text}
                  </blockquote>
                );
              if (block.kind === 'callout')
                return (
                  <aside
                    key={index}
                    className="my-10 rounded-2xl border border-primary/25 bg-primary/5 p-6"
                  >
                    <p className="eyebrow text-primary">{block.title}</p>
                    <p className="mt-3 leading-8">{block.text}</p>
                  </aside>
                );
              return (
                <ul key={index} className="grid gap-3 pl-1">
                  {block.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              );
            })}
          </div>
          <section className="mt-16 rounded-[1.7rem] border bg-card p-6 sm:p-8">
            <p className="eyebrow flex items-center gap-2 text-primary">
              <FlaskConical size={14} /> 사고 실험
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              {article.thought_experiment.title}
            </h2>
            <p className="mt-4 leading-7">
              {article.thought_experiment.prompt}
            </p>
            <ol className="mt-5 grid gap-2">
              {article.thought_experiment.choices.map((choice, i) => (
                <li
                  key={choice}
                  className="rounded-xl border bg-background p-4 text-sm"
                >
                  <b className="mr-2 text-primary">
                    {String.fromCharCode(65 + i)}.
                  </b>
                  {choice}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-muted-foreground">
              {article.thought_experiment.reflection}
            </p>
          </section>
          <section className="mt-6 rounded-[1.7rem] bg-foreground p-6 text-background sm:p-8">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] opacity-60">
              <PenLine size={13} /> Further inquiry
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              {article.practice.title}
            </h2>
            <ol className="mt-5 grid gap-3">
              {article.practice.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm leading-6">
                  <b className="text-primary">{i + 1}</b>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 rounded-xl bg-background/10 p-4 text-sm leading-6">
              검토 관점 · “{article.practice.rule_template}”
            </p>
          </section>
          <section className="mt-16 border-t pt-10">
            <p className="eyebrow">연구 근거</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              논문의 연구 방식과 결과, 이 글의 판단 장면에 적용할 범위를 구분해
              정리했습니다.
            </p>
            <div className="mt-5 grid gap-5">
              {article.source_notes.map((source) => {
                const detail = getResearchSourceDetail(source);
                return (
                  <article
                    key={source.url}
                    className="rounded-2xl border p-5 sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold leading-6">
                          {source.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {source.authors} · {source.year}
                        </p>
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${source.title} 원문 열기`}
                        className="rounded-full p-2 text-primary hover:bg-primary/10"
                      >
                        <ExternalLink size={15} />
                      </a>
                    </div>
                    {detail ? (
                      <dl className="mt-5 grid gap-4 text-sm leading-6">
                        <div>
                          <dt className="font-semibold text-primary">
                            어떤 연구인가
                          </dt>
                          <dd className="mt-1 text-muted-foreground">
                            {detail.study}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-primary">
                            무엇을 밝혔나
                          </dt>
                          <dd className="mt-1 text-muted-foreground">
                            {detail.finding}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-primary">
                            어디에 적용할까
                          </dt>
                          <dd className="mt-1 text-muted-foreground">
                            {detail.application}
                          </dd>
                        </div>
                        {detail.caution ? (
                          <div className="rounded-xl bg-muted/60 p-4">
                            <dt className="font-semibold">
                              해석할 때 주의할 점
                            </dt>
                            <dd className="mt-1 text-muted-foreground">
                              {detail.caution}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {source.note}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          <p className="mt-12 text-xs leading-5 text-muted-foreground">
            이 글은 행동과학 연구를 바탕으로 판단 문제를 탐구하는 교육
            자료입니다. 특정 금융상품의 매수·매도 또는 개인화된 투자 조언이
            아닙니다.
          </p>
        </div>
      </article>
    </main>
  );
}
