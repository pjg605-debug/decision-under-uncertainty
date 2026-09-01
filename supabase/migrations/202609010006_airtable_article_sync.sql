begin;

create or replace function public.sync_airtable_article(p_article jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  target_slug text := nullif(trim(p_article->>'slug'), '');
  target_version integer := coalesce((p_article->>'version')::integer, 1);
begin
  if target_slug is null or nullif(trim(p_article->>'title'), '') is null then
    raise exception 'Airtable article requires slug and title';
  end if;

  update public.articles
  set is_current = false
  where slug = target_slug and is_current = true;

  insert into public.articles (
    slug, version, is_current, status, title, subtitle, excerpt, category, tags,
    reading_minutes, difficulty, hero_kicker, content_blocks, thought_experiment,
    practice, source_notes, author_agent, published_at
  ) values (
    target_slug,
    target_version,
    true,
    'PUBLISHED',
    p_article->>'title',
    coalesce(p_article->>'subtitle', ''),
    coalesce(p_article->>'excerpt', ''),
    coalesce(p_article->>'category', '행동경제학'),
    array(select jsonb_array_elements_text(coalesce(p_article->'tags', '[]'::jsonb))),
    greatest(1, coalesce((p_article->>'reading_minutes')::integer, 5)),
    coalesce(p_article->>'difficulty', '입문'),
    coalesce(p_article->>'hero_kicker', ''),
    coalesce(p_article->'content_blocks', '[]'::jsonb),
    coalesce(p_article->'thought_experiment', '{}'::jsonb),
    coalesce(p_article->'practice', '{}'::jsonb),
    coalesce(p_article->'source_notes', '[]'::jsonb),
    coalesce(p_article->>'author_agent', 'airtable:failover-sync'),
    coalesce((p_article->>'published_at')::timestamptz, now())
  )
  on conflict (slug, version) do update set
    is_current = true,
    status = 'PUBLISHED',
    title = excluded.title,
    subtitle = excluded.subtitle,
    excerpt = excluded.excerpt,
    category = excluded.category,
    tags = excluded.tags,
    reading_minutes = excluded.reading_minutes,
    difficulty = excluded.difficulty,
    hero_kicker = excluded.hero_kicker,
    content_blocks = excluded.content_blocks,
    thought_experiment = excluded.thought_experiment,
    practice = excluded.practice,
    source_notes = excluded.source_notes,
    author_agent = excluded.author_agent,
    published_at = excluded.published_at
  returning id into target_id;

  return target_id;
end;
$$;

revoke all on function public.sync_airtable_article(jsonb) from public, anon, authenticated;
grant execute on function public.sync_airtable_article(jsonb) to service_role;

comment on function public.sync_airtable_article(jsonb) is
  'Idempotently promotes one Airtable failover article into the versioned Supabase article archive.';

commit;
