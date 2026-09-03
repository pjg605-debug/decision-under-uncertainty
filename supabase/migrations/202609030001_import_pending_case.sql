begin;

-- Backs the file-based case-import pipeline (content/pending-cases/*.json ->
-- scripts/import-pending-case.mjs -> this function), the same
-- write-through-CI pattern already used for articles and narratives in this
-- project. Everything is inserted in one transaction so a mid-import
-- failure (a bad option, a malformed evidence row) leaves no partial case
-- behind -- either the whole case lands, or none of it does.
--
-- Case creation was previously not one of Claude's granted writes (see
-- CLAUDE.md's former role boundary); this function is the mechanism for the
-- expanded role agreed with the project owner on 2026-09-03 (Claude:
-- discovery -> research -> structured data -> RESEARCH_DONE; Codex retains
-- CODEX_REVIEW -> APPROVED -> PUBLISHED). It intentionally cannot write
-- narratives, cannot approve/publish, and refuses outright if the case_key
-- already exists -- it can only create a new case at RESEARCH_DONE or
-- earlier, never touch an existing one.
create or replace function public.import_pending_case(p_payload jsonb)
returns table (case_id uuid, case_key text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_id uuid;
  v_case_key text := p_payload->>'case_key';
  v_status text := coalesce(p_payload->>'status', 'RESEARCH_DONE');
  v_option jsonb;
  v_info jsonb;
  v_evidence jsonb;
begin
  if v_case_key is null or v_case_key = '' then
    raise exception 'case_key is required';
  end if;
  if v_status not in ('DISCOVERED', 'RESEARCHING', 'RESEARCH_DONE') then
    raise exception 'import_pending_case may only create a case at DISCOVERED, RESEARCHING, or RESEARCH_DONE -- got %; later stages (CODEX_REVIEW onward) are reached through transition_case_status by the normal editorial flow, not at import time', v_status;
  end if;
  if exists (select 1 from public.decision_cases where case_key = v_case_key) then
    raise exception 'decision_cases row already exists for case_key=%; import refused to avoid a duplicate or silent overwrite' , v_case_key using errcode = '23505';
  end if;

  insert into public.decision_cases (
    case_key, title, domain, subdomain, actor, actor_role, date_or_period, era,
    location, t0, context_summary, actual_decision_key, immediate_outcome,
    long_term_outcome, decision_quality, outcome_quality, popularity,
    controversy_risk, context_compression, visualizability, source_disagreement,
    uncertainty_factors, metadata, narrative_key, status, fame_score, research_priority
  )
  values (
    v_case_key,
    p_payload->>'title',
    p_payload->>'domain',
    p_payload->>'subdomain',
    p_payload->>'actor',
    p_payload->>'actor_role',
    p_payload->>'date_or_period',
    p_payload->>'era',
    p_payload->>'location',
    p_payload->>'t0',
    p_payload->>'context_summary',
    p_payload->>'actual_decision_key',
    p_payload->>'immediate_outcome',
    p_payload->>'long_term_outcome',
    p_payload->>'decision_quality',
    p_payload->>'outcome_quality',
    coalesce((p_payload->>'popularity')::smallint, 50),
    coalesce((p_payload->>'controversy_risk')::smallint, 0),
    coalesce((p_payload->>'context_compression')::smallint, 50),
    coalesce((p_payload->>'visualizability')::smallint, 50),
    coalesce((p_payload->>'source_disagreement')::smallint, 0),
    coalesce(p_payload->'uncertainty_factors', '[]'::jsonb),
    coalesce(p_payload->'metadata', '{}'::jsonb),
    coalesce(p_payload->>'narrative_key', v_case_key),
    v_status,
    coalesce((p_payload->>'fame_score')::smallint, 50),
    coalesce((p_payload->>'research_priority')::smallint, 50)
  )
  returning id into v_case_id;

  for v_option in select * from jsonb_array_elements(coalesce(p_payload->'options', '[]'::jsonb))
  loop
    insert into public.decision_options (
      case_id, option_key, decision_key, sort_order, label, short_description, upside, downside, known_tradeoffs
    ) values (
      v_case_id,
      v_option->>'option_key',
      v_option->>'decision_key',
      (v_option->>'sort_order')::smallint,
      v_option->>'label',
      v_option->>'short_description',
      v_option->>'upside',
      v_option->>'downside',
      coalesce(v_option->'known_tradeoffs', '[]'::jsonb)
    );
  end loop;

  for v_info in select * from jsonb_array_elements(coalesce(p_payload->'case_information', '[]'::jsonb))
  loop
    insert into public.case_information (case_id, information_type, sequence, content)
    values (v_case_id, v_info->>'information_type', (v_info->>'sequence')::smallint, v_info->>'content');
  end loop;

  for v_evidence in select * from jsonb_array_elements(coalesce(p_payload->'evidence', '[]'::jsonb))
  loop
    insert into public.evidence (
      case_id, evidence_key, source_type, title, author_or_institution,
      publication_date, url, citation, evidence_class, supported_claim
    ) values (
      v_case_id,
      v_evidence->>'evidence_key',
      v_evidence->>'source_type',
      v_evidence->>'title',
      v_evidence->>'author_or_institution',
      v_evidence->>'publication_date',
      v_evidence->>'url',
      v_evidence->>'citation',
      v_evidence->>'evidence_class',
      v_evidence->>'supported_claim'
    );
  end loop;

  insert into public.status_transitions (case_id, from_status, to_status, actor_agent, reason)
  values (v_case_id, null, v_status, 'claude', 'Imported from research pilot via import_pending_case');

  return query select v_case_id, v_case_key, v_status;
end;
$$;

revoke all on function public.import_pending_case(jsonb) from public, anon, authenticated;
grant execute on function public.import_pending_case(jsonb) to service_role;

commit;
