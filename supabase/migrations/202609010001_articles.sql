begin;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version integer not null check (version > 0),
  is_current boolean not null default false,
  status text not null default 'DRAFT' check (status in ('DRAFT','IN_REVIEW','APPROVED','PUBLISHED','ARCHIVED')),
  title text not null,
  subtitle text not null,
  excerpt text not null,
  category text not null,
  tags text[] not null default '{}',
  reading_minutes integer not null default 5 check (reading_minutes > 0),
  difficulty text not null default '입문' check (difficulty in ('입문','중급','심화')),
  hero_kicker text not null,
  content_blocks jsonb not null check (jsonb_typeof(content_blocks) = 'array'),
  thought_experiment jsonb not null check (jsonb_typeof(thought_experiment) = 'object'),
  practice jsonb not null check (jsonb_typeof(practice) = 'object'),
  source_notes jsonb not null default '[]'::jsonb check (jsonb_typeof(source_notes) = 'array'),
  author_agent text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, version)
);

create unique index if not exists articles_one_current_version_idx on public.articles(slug) where is_current;
create index if not exists articles_public_archive_idx on public.articles(status, is_current, published_at desc);
create trigger articles_set_updated_at before update on public.articles for each row execute function public.duu_set_updated_at();

alter table public.articles enable row level security;
revoke all on public.articles from anon, authenticated;
grant select on public.articles to anon, authenticated;
create policy published_articles_are_public on public.articles for select to anon, authenticated using (status = 'PUBLISHED' and is_current);

comment on table public.articles is 'Versioned long-form behavioral decision practice articles. Published current versions are public.';

commit;
