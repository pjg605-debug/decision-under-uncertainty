begin;

do $$
declare
  v_case_id uuid;
  v_en_v1 uuid;
  v_en_v2 uuid;
  v_ko_v1 uuid;
  v_ko_v2 uuid;
  v_ko_v3 uuid;
  v_count integer;
  v_current_en boolean;
  v_current_ko boolean;
  v_rejected boolean;
begin
  insert into public.decision_cases (
    case_key,title,domain,subdomain,actor,actor_role,date_or_period,era,location,t0,context_summary,
    actual_decision_key,immediate_outcome,long_term_outcome,decision_quality,outcome_quality,
    uncertainty_factors,metadata,narrative_key,status
  ) values (
    'bilingual-narrative-test','Bilingual narrative test','history','test','Test actor','Test role','test','test','test','test','test context',
    'a','test immediate','test long-term','Unclear','Mixed','[]'::jsonb,'{}'::jsonb,'bilingual-narrative-test','RESEARCH_DONE'
  ) returning id into v_case_id;

  -- en v1 and ko v1 both draftable for the same case: independently
  -- authored, not a translation pair, and each gets version 1 (its own
  -- sequence, not a shared case-wide counter).
  insert into public.narratives (
    case_id,narrative_key,language,version,status,author_agent,hook,short_setup,why_option_a_made_sense,
    why_option_b_made_sense,actual_decision_explanation,outcome_story,hindsight_analysis,
    decision_principle,longform_story,evidence_refs,quality_evaluations,is_current
  ) values (
    v_case_id,'bilingual-narrative-test','en',1,'APPROVED','claude','en hook v1','en setup','en why a','en why b','en actual','en outcome','en analysis','en principle','en longform','[]'::jsonb,'{}'::jsonb,true
  ) returning id into v_en_v1;

  insert into public.narratives (
    case_id,narrative_key,language,version,status,author_agent,hook,short_setup,why_option_a_made_sense,
    why_option_b_made_sense,actual_decision_explanation,outcome_story,hindsight_analysis,
    decision_principle,longform_story,evidence_refs,quality_evaluations,is_current
  ) values (
    v_case_id,'bilingual-narrative-test','ko',1,'APPROVED','claude','ko hook v1','ko setup','ko why a','ko why b','ko actual','ko outcome','ko analysis','ko principle','ko longform','[]'::jsonb,'{}'::jsonb,true
  ) returning id into v_ko_v1;

  -- Both languages simultaneously current for the same case.
  select is_current into v_current_en from public.narratives where id = v_en_v1;
  select is_current into v_current_ko from public.narratives where id = v_ko_v1;
  if not (v_current_en and v_current_ko) then
    raise exception 'expected en v1 and ko v1 to both be is_current=true simultaneously';
  end if;

  -- A duplicate (case_id, language, version) must be rejected.
  v_rejected := false;
  begin
    insert into public.narratives (
      case_id,narrative_key,language,version,status,author_agent,hook,short_setup,why_option_a_made_sense,
      why_option_b_made_sense,actual_decision_explanation,outcome_story,hindsight_analysis,
      decision_principle,longform_story,evidence_refs,quality_evaluations,is_current
    ) values (
      v_case_id,'bilingual-narrative-test','en',1,'DRAFT','claude','dup','dup','dup','dup','dup','dup','dup','dup','dup','[]'::jsonb,'{}'::jsonb,false
    );
  exception when unique_violation then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'expected duplicate (case_id, language, version) to be rejected';
  end if;

  -- A second is_current=true row for the SAME (case_id, language) must be
  -- rejected -- language-scoped uniqueness, not just case-scoped.
  v_rejected := false;
  begin
    insert into public.narratives (
      case_id,narrative_key,language,version,status,author_agent,hook,short_setup,why_option_a_made_sense,
      why_option_b_made_sense,actual_decision_explanation,outcome_story,hindsight_analysis,
      decision_principle,longform_story,evidence_refs,quality_evaluations,is_current
    ) values (
      v_case_id,'bilingual-narrative-test','en',99,'DRAFT','claude','x','x','x','x','x','x','x','x','x','[]'::jsonb,'{}'::jsonb,true
    );
  exception when unique_violation then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'expected a second is_current=true row for the same (case_id, language) to be rejected';
  end if;

  -- Promote en v2: unset only en's previous current row (mirrors the
  -- app/api/review/route.ts approval fix -- scoped by language, not by
  -- case_id alone), then insert en v2 as current. ko v1 must stay untouched.
  update public.narratives set is_current = false where id = v_en_v1;
  insert into public.narratives (
    case_id,narrative_key,language,version,status,author_agent,hook,short_setup,why_option_a_made_sense,
    why_option_b_made_sense,actual_decision_explanation,outcome_story,hindsight_analysis,
    decision_principle,longform_story,evidence_refs,quality_evaluations,is_current
  ) values (
    v_case_id,'bilingual-narrative-test','en',2,'APPROVED','claude','en hook v2','en setup','en why a','en why b','en actual','en outcome','en analysis','en principle','en longform','[]'::jsonb,'{}'::jsonb,true
  ) returning id into v_en_v2;

  select is_current into v_current_ko from public.narratives where id = v_ko_v1;
  if not v_current_ko then
    raise exception 'expected ko v1 to remain is_current=true after en v2 was promoted';
  end if;
  if (select is_current from public.narratives where id = v_en_v1) then
    raise exception 'expected en v1 to no longer be is_current after en v2 was promoted';
  end if;

  -- Symmetric check: promote ko v2 then ko v3, en v2 must stay untouched
  -- throughout, and ko's version sequence is independent of en's (en is at
  -- v2, ko reaches v3 -- both legal, per-language counters).
  update public.narratives set is_current = false where id = v_ko_v1;
  insert into public.narratives (
    case_id,narrative_key,language,version,status,author_agent,hook,short_setup,why_option_a_made_sense,
    why_option_b_made_sense,actual_decision_explanation,outcome_story,hindsight_analysis,
    decision_principle,longform_story,evidence_refs,quality_evaluations,is_current
  ) values (
    v_case_id,'bilingual-narrative-test','ko',2,'ARCHIVED','claude','ko hook v2','ko setup','ko why a','ko why b','ko actual','ko outcome','ko analysis','ko principle','ko longform','[]'::jsonb,'{}'::jsonb,false
  ) returning id into v_ko_v2;
  insert into public.narratives (
    case_id,narrative_key,language,version,status,author_agent,hook,short_setup,why_option_a_made_sense,
    why_option_b_made_sense,actual_decision_explanation,outcome_story,hindsight_analysis,
    decision_principle,longform_story,evidence_refs,quality_evaluations,is_current
  ) values (
    v_case_id,'bilingual-narrative-test','ko',3,'APPROVED','claude','ko hook v3','ko setup','ko why a','ko why b','ko actual','ko outcome','ko analysis','ko principle','ko longform','[]'::jsonb,'{}'::jsonb,true
  ) returning id into v_ko_v3;

  if (select is_current from public.narratives where id = v_en_v2) is not true then
    raise exception 'expected en v2 to remain is_current=true after ko v2/v3 were inserted';
  end if;
  if (select version from public.narratives where id = v_en_v2) <> 2 then
    raise exception 'expected en to still be at version 2 (independent per-language sequence)';
  end if;
  if (select version from public.narratives where id = v_ko_v3) <> 3 then
    raise exception 'expected ko to have reached version 3 independently of en';
  end if;

  select count(*) into v_count from public.narratives where case_id = v_case_id;
  if v_count <> 5 then
    raise exception 'expected 5 narrative rows total (en v1,v2 + ko v1,v2,v3), got %', v_count;
  end if;

  raise notice 'bilingual narrative checks passed';
end;
$$;

rollback;
