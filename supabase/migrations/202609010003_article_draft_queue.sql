begin;

create or replace function public.publish_next_draft_article()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.articles%rowtype;
begin
  select * into target
  from public.articles
  where status = 'DRAFT' and is_current = false
  order by created_at asc, id asc
  for update skip locked
  limit 1;

  if target.id is null then
    return null;
  end if;

  update public.articles
  set is_current = false
  where slug = target.slug and is_current = true and id <> target.id;

  update public.articles
  set status = 'PUBLISHED',
      is_current = true,
      published_at = now()
  where id = target.id;

  return jsonb_build_object(
    'id', target.id,
    'slug', target.slug,
    'title', target.title,
    'published_at', now()
  );
end;
$$;

revoke all on function public.publish_next_draft_article() from public, anon, authenticated;
grant execute on function public.publish_next_draft_article() to service_role;

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

comment on function public.publish_next_draft_article() is
  'Atomically publishes the oldest queued draft. Called by the GitHub schedule through an authenticated Edge Function.';

commit;
