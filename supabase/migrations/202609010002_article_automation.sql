begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.article_generation_runs (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null unique,
  status text not null check (status in ('RUNNING', 'SUCCEEDED', 'FAILED')),
  attempts integer not null default 1 check (attempts > 0),
  article_slug text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists article_generation_runs_set_updated_at on public.article_generation_runs;
create trigger article_generation_runs_set_updated_at
before update on public.article_generation_runs
for each row execute function public.duu_set_updated_at();

alter table public.article_generation_runs enable row level security;
revoke all on public.article_generation_runs from anon, authenticated;

create or replace function public.claim_article_generation_slot(p_slot_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  insert into public.article_generation_runs (slot_key, status)
  values (p_slot_key, 'RUNNING')
  on conflict (slot_key) do update
    set status = 'RUNNING',
        attempts = public.article_generation_runs.attempts + 1,
        article_slug = null,
        error_message = null,
        started_at = now(),
        finished_at = null
    where public.article_generation_runs.status = 'FAILED'
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

create or replace function public.finish_article_generation_slot(
  p_slot_key text,
  p_status text,
  p_article_slug text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('SUCCEEDED', 'FAILED') then
    raise exception 'Invalid article generation status: %', p_status;
  end if;

  update public.article_generation_runs
  set status = p_status,
      article_slug = p_article_slug,
      error_message = left(p_error_message, 2000),
      finished_at = now()
  where slot_key = p_slot_key and status = 'RUNNING';
end;
$$;

revoke all on function public.claim_article_generation_slot(text) from public, anon, authenticated;
revoke all on function public.finish_article_generation_slot(text, text, text, text) from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'generate-judgment-article-every-6-hours';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'generate-judgment-article-every-6-hours',
  '0 */6 * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'article_generator_url'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'article_generator_cron_secret'
        )
      ),
      body := jsonb_build_object('scheduled_at', now()),
      timeout_milliseconds := 120000
    ) as request_id;
  $cron$
);

comment on table public.article_generation_runs is
  'Idempotency and audit log for the six-hour behavioral article generator.';

commit;
