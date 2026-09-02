begin;

do $$
declare
  v_case_id uuid;
  v_narrative_v1 uuid;
  v_narrative_v2 uuid;
  v_review_id uuid;
  v_status text;
begin
  insert into public.decision_cases (
    case_key,title,domain,subdomain,actor,actor_role,date_or_period,era,location,t0,context_summary,
    actual_decision_key,immediate_outcome,long_term_outcome,decision_quality,outcome_quality,
    uncertainty_factors,metadata,narrative_key,status
  ) values (
    'integration-workflow-test','Integration workflow test','history','test','Test actor','Test role','test','test','test','test','test context',
    'a','test immediate','test long-term','Unclear','Mixed','[]'::jsonb,'{}'::jsonb,'integration-workflow-test','RESEARCH_DONE'
  ) returning id into v_case_id;

  insert into public.narratives (
    case_id,narrative_key,language,version,status,author_agent,hook,short_setup,why_option_a_made_sense,
    why_option_b_made_sense,actual_decision_explanation,outcome_story,hindsight_analysis,
    decision_principle,longform_story,evidence_refs,quality_evaluations,is_current
  ) values (
    v_case_id,'integration-workflow-test','en',1,'DRAFT','claude','hook','setup','why a','why b','actual','outcome','analysis','principle','longform','[]'::jsonb,'{}'::jsonb,true
  ) returning id into v_narrative_v1;

  perform public.transition_case_status('integration-workflow-test','NARRATIVE_DRAFTED','claude','v1 submitted');
  perform public.transition_case_status('integration-workflow-test','CODEX_REVIEW','codex','review opened');

  insert into public.reviews (case_id,narrative_id,reviewer_agent,review_type,field_name,severity,status,verdict,comment,suggested_change,findings)
  values (v_case_id,v_narrative_v1,'codex','HINDSIGHT_CONTAMINATION','outcome_story','HIGH','OPEN','REVISE','Clarify the outcome boundary.','Keep T0 facts separate from revealed outcome facts.','[]'::jsonb)
  returning id into v_review_id;
  update public.narratives set status='REVISION_REQUESTED',is_current=false where id=v_narrative_v1;
  perform public.transition_case_status('integration-workflow-test','REVISION_REQUESTED','codex','revision requested');

  insert into public.narratives (
    case_id,narrative_key,language,version,status,author_agent,hook,short_setup,why_option_a_made_sense,
    why_option_b_made_sense,actual_decision_explanation,outcome_story,hindsight_analysis,
    decision_principle,longform_story,evidence_refs,quality_evaluations,is_current,revision_summary
  ) values (
    v_case_id,'integration-workflow-test','en',2,'IN_REVIEW','claude','hook','setup','why a','why b','actual','revised outcome','analysis','principle','longform','[]'::jsonb,'{}'::jsonb,true,'Outcome boundary clarified.'
  ) returning id into v_narrative_v2;
  insert into public.revisions (case_id,narrative_id,triggered_by_review_id,author_agent,before_version,after_version,summary,changes)
  values (v_case_id,v_narrative_v2,v_review_id,'claude',1,2,'Revision submitted.','[]'::jsonb);
  perform public.transition_case_status('integration-workflow-test','REVISION_DONE','claude','v2 submitted');
  perform public.transition_case_status('integration-workflow-test','CODEX_REVIEW','codex','v2 review opened');
  update public.narratives set status='APPROVED' where id=v_narrative_v2;
  update public.reviews set status='RESOLVED',resolved_at=now() where id=v_review_id;
  perform public.transition_case_status('integration-workflow-test','APPROVED','codex','v2 approved');

  select status into v_status from public.decision_cases where id=v_case_id;
  if v_status <> 'APPROVED' then raise exception 'expected APPROVED, got %', v_status; end if;
  if (select count(*) from public.narratives where case_id=v_case_id) <> 2 then raise exception 'expected two narrative versions'; end if;
  if (select count(*) from public.revisions where case_id=v_case_id) <> 1 then raise exception 'expected one revision'; end if;
  if (select status from public.reviews where id=v_review_id) <> 'RESOLVED' then raise exception 'expected resolved review'; end if;
end;
$$;

rollback;
