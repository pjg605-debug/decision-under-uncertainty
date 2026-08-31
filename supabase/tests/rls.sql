begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'decision_cases','decision_options','case_information','evidence','narratives','reviews','revisions',
    'case_scores','shorts_variants','publication_results','agent_runs','status_transitions','research_claims','research_gaps'
  ] loop
    if not (select relrowsecurity from pg_class where oid=format('public.%I',table_name)::regclass) then
      raise exception 'RLS is disabled on %', table_name;
    end if;
  end loop;
  if not has_table_privilege('anon','public.decision_cases','select') then raise exception 'anon must read approved cases'; end if;
  if has_table_privilege('anon','public.decision_cases','insert') then raise exception 'anon must not insert cases'; end if;
  if has_table_privilege('anon','public.reviews','select') then raise exception 'anon must not read reviews'; end if;
  if has_table_privilege('authenticated','public.agent_runs','select') then raise exception 'authenticated must not read agent runs'; end if;
end;
$$;

set local role anon;
do $$
begin
  if exists (select 1 from public.decision_cases where status not in ('APPROVED','PROTOTYPE_READY','PUBLISHED')) then
    raise exception 'anon can see a non-approved case';
  end if;
  if exists (select 1 from public.narratives where status <> 'APPROVED' or not is_current) then
    raise exception 'anon can see a non-current or non-approved narrative';
  end if;
end;
$$;
reset role;

rollback;
