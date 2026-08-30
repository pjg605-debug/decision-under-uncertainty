'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  RefreshCcw,
  Scale,
  Send,
  ShieldCheck,
} from 'lucide-react';

type ReviewCase = {
  case_key: string;
  title: string;
  status: string;
  updated_at: string;
  narratives: Array<{
    id: string;
    version: number;
    status: string;
    author_agent: string;
    revision_summary?: string;
    updated_at: string;
  }>;
  reviews: Array<{
    id: string;
    review_type: string;
    severity: string;
    verdict: string;
    status: string;
    comment: string;
    created_at: string;
  }>;
  research_gaps: Array<{
    id: string;
    severity: string;
    status: string;
    description: string;
  }>;
};

export default function ReviewDashboard() {
  const [token, setToken] = useState('');
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/review', {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load queue.');
      setCases(data.cases || []);
    } catch (value) {
      setError(
        value instanceof Error ? value.message : 'Unable to load queue.',
      );
    } finally {
      setBusy(false);
    }
  };
  const act = async (
    item: ReviewCase,
    action: 'approve' | 'request_revision',
  ) => {
    const narrative = [...item.narratives].sort(
      (a, b) => b.version - a.version,
    )[0];
    const summary = notes[item.case_key]?.trim();
    if (!narrative || !summary) {
      setError('Add a review note before submitting.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action,
          case_key: item.case_key,
          narrative_id: narrative.id,
          summary,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Review action failed.');
      setNotes((current) => ({ ...current, [item.case_key]: '' }));
      await load();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : 'Review action failed.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-primary/30 bg-primary/10">
              <Scale size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold">Decision / T0</p>
              <p className="text-[10px] uppercase tracking-[.18em] text-muted-foreground">
                Internal editorial desk
              </p>
            </div>
          </div>
          <a href="/" className="text-sm font-semibold text-primary">
            Return to product
          </a>
        </header>
        <section className="mt-8 rounded-3xl border bg-card p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Review queue</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                This route uses a dashboard token. Supabase service credentials
                stay on the server and are never sent to the browser.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Review dashboard token"
              className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <button
              disabled={!token || busy}
              onClick={load}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-40"
            >
              <RefreshCcw size={15} />
              {busy ? 'Working…' : 'Load queue'}
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </section>
        <section className="mt-6 grid gap-4">
          {cases.map((item) => {
            const narrative = [...item.narratives].sort(
              (a, b) => b.version - a.version,
            )[0];
            return (
              <article
                key={item.case_key}
                className="rounded-3xl border bg-card p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">
                      {item.case_key}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">{item.title}</h2>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1.5 text-[10px] font-semibold">
                    {item.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                      Current narrative
                    </p>
                    <p className="mt-2 font-semibold">
                      v{narrative?.version || '—'} ·{' '}
                      {narrative?.author_agent || 'none'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                      Open reviews
                    </p>
                    <p className="mt-2 font-semibold">
                      {
                        item.reviews.filter(
                          (review) => review.status === 'OPEN',
                        ).length
                      }
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-[10px] uppercase tracking-[.14em] text-muted-foreground">
                      Research gaps
                    </p>
                    <p className="mt-2 font-semibold">
                      {
                        item.research_gaps.filter(
                          (gap) => gap.status === 'OPEN',
                        ).length
                      }
                    </p>
                  </div>
                </div>
                {item.reviews.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {item.reviews.slice(-2).map((review) => (
                      <p
                        key={review.id}
                        className="rounded-xl border px-4 py-3 text-xs leading-5"
                      >
                        <strong>{review.verdict}</strong> ·{' '}
                        <span className="text-muted-foreground">{review.severity}</span> ·{' '}
                        {review.comment}
                      </p>
                    ))}
                  </div>
                )}
                <textarea
                  value={notes[item.case_key] || ''}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [item.case_key]: event.target.value,
                    }))
                  }
                  placeholder="Review note or requested revision"
                  className="mt-4 min-h-24 w-full rounded-xl border bg-background p-4 text-sm outline-none focus:border-primary"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busy || !narrative}
                    onClick={() => act(item, 'approve')}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    <CheckCircle2 size={15} />
                    Approve
                  </button>
                  <button
                    disabled={busy || !narrative}
                    onClick={() => act(item, 'request_revision')}
                    className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                  >
                    <Send size={15} />
                    Request revision
                  </button>
                </div>
              </article>
            );
          })}
          {!busy && cases.length === 0 && (
            <div className="grid min-h-48 place-items-center rounded-3xl border border-dashed text-center text-sm text-muted-foreground">
              Enter the internal token to load the editorial queue.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
