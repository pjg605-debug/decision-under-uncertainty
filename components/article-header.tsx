import { ArrowLeft, Scale } from 'lucide-react';

export default function ArticleHeader({ backToArchive = false }: { backToArchive?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/30 bg-primary/10">
            <Scale size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold">Decision / T0</p>
            <p className="hidden text-[9px] uppercase tracking-[.19em] text-muted-foreground sm:block">Judgment under uncertainty</p>
          </div>
        </a>
        <a
          href={backToArchive ? '/articles' : '/'}
          className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-xs font-semibold"
        >
          <ArrowLeft size={14} /> {backToArchive ? '아티클 목록' : '판단 훈련으로'}
        </a>
      </div>
    </header>
  );
}
