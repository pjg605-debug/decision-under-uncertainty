begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.decision_cases (
  id uuid primary key default gen_random_uuid(),
  case_key text not null unique,
  title text not null,
  domain text not null check (domain in ('history','business','exploration','science','crisis')),
  subdomain text not null,
  actor text not null,
  actor_role text not null,
  date_or_period text not null,
  era text not null,
  location text not null,
  t0 text not null,
  context_summary text not null,
  actual_decision_key text not null,
  immediate_outcome text not null,
  long_term_outcome text not null,
  decision_quality text not null check (decision_quality in ('Strong','Reasonable','Weak','Unclear')),
  outcome_quality text not null check (outcome_quality in ('Good','Bad','Mixed')),
  popularity smallint not null default 50 check (popularity between 0 and 100),
  controversy_risk smallint not null default 0 check (controversy_risk between 0 and 100),
  context_compression smallint not null default 50 check (context_compression between 0 and 100),
  visualizability smallint not null default 50 check (visualizability between 0 and 100),
  source_disagreement smallint not null default 0 check (source_disagreement between 0 and 100),
  uncertainty_factors jsonb not null default '[]'::jsonb check (jsonb_typeof(uncertainty_factors) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  progressive jsonb check (progressive is null or jsonb_typeof(progressive) = 'object'),
  narrative_key text not null,
  status text not null default 'DISCOVERED' check (status in ('DISCOVERED','RESEARCHING','RESEARCH_DONE','NARRATIVE_DRAFTED','CODEX_REVIEW','REVISION_REQUESTED','REVISION_DONE','EDITOR_REVIEW','APPROVED','PROTOTYPE_READY','PUBLISHED','HOLD','REJECTED')),
  fame_score smallint not null default 50 check (fame_score between 0 and 100),
  research_priority smallint not null default 50 check (research_priority between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decision_options (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  option_key text not null check (option_key ~ '^[A-Z]$'),
  decision_key text not null,
  sort_order smallint not null check (sort_order > 0),
  label text not null,
  short_description text not null,
  upside text not null,
  downside text not null,
  known_tradeoffs jsonb not null default '[]'::jsonb check (jsonb_typeof(known_tradeoffs) = 'array'),
  created_at timestamptz not null default now(),
  unique (case_id, option_key),
  unique (case_id, decision_key),
  unique (case_id, sort_order)
);

create table public.case_information (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  information_type text not null check (information_type in ('KNOWN_AT_T0','UNKNOWN_AT_T0','PROGRESSIVE_EVIDENCE')),
  sequence smallint not null check (sequence > 0),
  content text not null,
  evidence_id uuid,
  created_at timestamptz not null default now(),
  unique (case_id, information_type, sequence)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  evidence_key text not null,
  source_type text not null,
  title text not null,
  author_or_institution text not null,
  publication_date text,
  url text,
  accessed_at date,
  citation text,
  evidence_class text not null check (evidence_class in ('FACT','CONTEMPORARY_BELIEF','STATED_RATIONALE','INFERENCE')),
  supported_claim text,
  source_quality smallint check (source_quality between 0 and 100),
  source_disagreement smallint check (source_disagreement between 0 and 100),
  created_at timestamptz not null default now(),
  unique (case_id, evidence_key)
);

alter table public.case_information add constraint case_information_evidence_fk foreign key (evidence_id) references public.evidence(id) on delete set null;

create table public.narratives (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  narrative_key text not null,
  version integer not null check (version > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','IN_REVIEW','REVISION_REQUESTED','APPROVED','ARCHIVED')),
  author_agent text not null,
  hook text not null,
  short_setup text not null,
  why_option_a_made_sense text not null,
  why_option_b_made_sense text not null,
  actual_decision_explanation text not null,
  outcome_story text not null,
  hindsight_analysis text not null,
  decision_principle text not null,
  longform_story text not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  quality_evaluations jsonb not null default '{}'::jsonb check (jsonb_typeof(quality_evaluations) = 'object'),
  revision_summary text,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, version)
);

create unique index narratives_one_current_per_case on public.narratives(case_id) where is_current;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  narrative_id uuid references public.narratives(id) on delete set null,
  reviewer_agent text not null,
  review_type text not null check (review_type in ('FACT_ERROR','HINDSIGHT_CONTAMINATION','WEAK_DILEMMA','UNFAIR_INFORMATION','EVIDENCE_WEAK','HOOK_WEAK','NARRATIVE_FLAT','TOO_LONG','UI_OVERFLOW','SCHEMA_ERROR','SOURCE_DISAGREEMENT','OTHER')),
  field_name text,
  severity text not null default 'MEDIUM' check (severity in ('LOW','MEDIUM','HIGH','BLOCKING')),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','DISMISSED')),
  verdict text check (verdict in ('APPROVE','REVISE','HOLD','REJECT')),
  comment text not null,
  suggested_change text,
  findings jsonb not null default '[]'::jsonb check (jsonb_typeof(findings) = 'array'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  narrative_id uuid not null references public.narratives(id) on delete cascade,
  triggered_by_review_id uuid references public.reviews(id) on delete set null,
  author_agent text not null,
  before_version integer,
  after_version integer not null,
  summary text not null,
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  created_at timestamptz not null default now()
);

create table public.case_scores (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.decision_cases(id) on delete cascade,
  curiosity smallint not null check (curiosity between 0 and 100),
  decision smallint not null check (decision between 0 and 100),
  stakes smallint not null check (stakes between 0 and 100),
  mystery smallint not null check (mystery between 0 and 100),
  explainability smallint not null check (explainability between 0 and 100),
  evidence smallint not null check (evidence between 0 and 100),
  player_fairness smallint check (player_fairness between 0 and 100),
  dilemma_balance smallint check (dilemma_balance between 0 and 100),
  context_compression smallint check (context_compression between 0 and 100),
  reveal_payoff smallint check (reveal_payoff between 0 and 100),
  scorer text not null default 'codex',
  scoring_version text not null default '1.0',
  shorts_potential smallint check (shorts_potential between 0 and 100),
  notes text,
  updated_at timestamptz not null default now()
);

create table public.shorts_variants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  narrative_id uuid references public.narratives(id) on delete set null,
  version integer not null check (version > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','IN_REVIEW','APPROVED','ARCHIVED')),
  author_agent text not null,
  duration_target text not null check (duration_target in ('20_25','30_40','45_60')),
  script text not null,
  storyboard jsonb not null default '[]'::jsonb check (jsonb_typeof(storyboard) = 'array'),
  hook_variant text not null,
  created_at timestamptz not null default now(),
  unique (case_id, version)
);

create table public.publication_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  shorts_variant_id uuid references public.shorts_variants(id) on delete set null,
  platform text not null,
  external_id text,
  published_at timestamptz,
  views bigint not null default 0 check (views >= 0),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  average_view_duration numeric(10,2),
  average_percentage_viewed numeric(6,2),
  stayed_to_watch numeric(6,2),
  subscribers_gained bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  run_type text not null,
  status text not null check (status in ('STARTED','SUCCEEDED','FAILED','CANCELLED')),
  case_id uuid references public.decision_cases(id) on delete set null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.status_transitions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_agent text not null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.research_claims (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  claim_key text not null,
  claim_text text not null,
  claim_class text not null check (claim_class in ('FACT','CONTEMPORARY_BELIEF','STATED_RATIONALE','INFERENCE')),
  evidence_keys jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_keys) = 'array'),
  status text not null default 'UNVERIFIED' check (status in ('UNVERIFIED','SUPPORTED','DISPUTED','REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, claim_key)
);

create table public.research_gaps (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.decision_cases(id) on delete cascade,
  gap_type text not null,
  description text not null,
  severity text not null default 'MEDIUM' check (severity in ('LOW','MEDIUM','HIGH','BLOCKING')),
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED','WONT_FIX')),
  assigned_agent text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index decision_cases_queue_idx on public.decision_cases(status, research_priority desc, created_at);
create index decision_options_case_idx on public.decision_options(case_id, sort_order);
create index case_information_case_idx on public.case_information(case_id, information_type, sequence);
create index evidence_case_idx on public.evidence(case_id, evidence_class);
create index narratives_case_idx on public.narratives(case_id, status, version desc);
create index reviews_queue_idx on public.reviews(status, verdict, created_at);
create index revisions_case_idx on public.revisions(case_id, created_at desc);
create index agent_runs_queue_idx on public.agent_runs(agent_name, status, started_at desc);
create index status_transitions_case_idx on public.status_transitions(case_id, created_at desc);
create index research_claims_case_idx on public.research_claims(case_id, status);
create index research_gaps_queue_idx on public.research_gaps(status, severity, created_at);
create index publication_results_case_idx on public.publication_results(case_id, published_at desc);

create trigger decision_cases_set_updated_at before update on public.decision_cases for each row execute function public.set_updated_at();
create trigger narratives_set_updated_at before update on public.narratives for each row execute function public.set_updated_at();
create trigger case_scores_set_updated_at before update on public.case_scores for each row execute function public.set_updated_at();
create trigger research_claims_set_updated_at before update on public.research_claims for each row execute function public.set_updated_at();
create trigger publication_results_set_updated_at before update on public.publication_results for each row execute function public.set_updated_at();

create or replace function public.valid_case_status_transition(from_status text, to_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select from_status = to_status or (from_status, to_status) in (
    ('DISCOVERED','RESEARCHING'), ('DISCOVERED','HOLD'), ('DISCOVERED','REJECTED'),
    ('RESEARCHING','RESEARCH_DONE'), ('RESEARCHING','HOLD'), ('RESEARCHING','REJECTED'),
    ('RESEARCH_DONE','NARRATIVE_DRAFTED'), ('RESEARCH_DONE','HOLD'), ('RESEARCH_DONE','REJECTED'),
    ('NARRATIVE_DRAFTED','CODEX_REVIEW'), ('NARRATIVE_DRAFTED','REVISION_REQUESTED'), ('NARRATIVE_DRAFTED','HOLD'),
    ('CODEX_REVIEW','REVISION_REQUESTED'), ('CODEX_REVIEW','APPROVED'), ('CODEX_REVIEW','HOLD'), ('CODEX_REVIEW','REJECTED'),
    ('REVISION_REQUESTED','REVISION_DONE'), ('REVISION_REQUESTED','HOLD'),
    ('REVISION_DONE','CODEX_REVIEW'), ('REVISION_DONE','EDITOR_REVIEW'), ('REVISION_DONE','APPROVED'), ('REVISION_DONE','REVISION_REQUESTED'), ('REVISION_DONE','HOLD'),
    ('CODEX_REVIEW','EDITOR_REVIEW'), ('EDITOR_REVIEW','APPROVED'), ('EDITOR_REVIEW','REVISION_REQUESTED'), ('EDITOR_REVIEW','REJECTED'),
    ('APPROVED','PROTOTYPE_READY'), ('APPROVED','REVISION_REQUESTED'), ('APPROVED','HOLD'),
    ('PROTOTYPE_READY','PUBLISHED'), ('PROTOTYPE_READY','REVISION_REQUESTED'), ('PUBLISHED','REVISION_REQUESTED'),
    ('HOLD','DISCOVERED'), ('HOLD','RESEARCHING'), ('HOLD','RESEARCH_DONE'), ('HOLD','NARRATIVE_DRAFTED'), ('HOLD','CODEX_REVIEW'),
    ('REJECTED','DISCOVERED')
  );
$$;

create or replace function public.enforce_case_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is distinct from new.status and not public.valid_case_status_transition(old.status, new.status) then
    raise exception 'invalid case status transition: % -> %', old.status, new.status using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.audit_case_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.status_transitions(case_id, from_status, to_status, actor_agent, reason)
    values (
      new.id,
      old.status,
      new.status,
      coalesce(nullif(current_setting('app.agent_name', true), ''), session_user),
      nullif(current_setting('app.transition_reason', true), '')
    );
  end if;
  return new;
end;
$$;

create trigger decision_cases_validate_status before update of status on public.decision_cases for each row execute function public.enforce_case_status_transition();
create trigger decision_cases_audit_status after update of status on public.decision_cases for each row execute function public.audit_case_status_transition();

create or replace function public.transition_case_status(p_case_key text, p_to_status text, p_actor_agent text, p_reason text default null)
returns public.decision_cases
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.decision_cases;
begin
  perform set_config('app.agent_name', p_actor_agent, true);
  perform set_config('app.transition_reason', coalesce(p_reason, ''), true);
  update public.decision_cases set status = p_to_status where case_key = p_case_key returning * into result;
  if result.id is null then raise exception 'unknown case_key: %', p_case_key using errcode = 'P0002'; end if;
  return result;
end;
$$;

create or replace function public.get_cases_for_research(p_limit integer default 10)
returns setof public.decision_cases
language sql
security definer
set search_path = ''
as $$ select * from public.decision_cases where status in ('DISCOVERED','RESEARCHING') order by research_priority desc, created_at limit greatest(1, least(p_limit, 100)); $$;

create or replace function public.get_cases_for_narrative(p_limit integer default 10)
returns setof public.decision_cases
language sql
security definer
set search_path = ''
as $$ select * from public.decision_cases where status = 'RESEARCH_DONE' order by research_priority desc, created_at limit greatest(1, least(p_limit, 100)); $$;

create or replace function public.get_cases_for_codex_review(p_limit integer default 10)
returns setof public.decision_cases
language sql
security definer
set search_path = ''
as $$ select * from public.decision_cases where status in ('NARRATIVE_DRAFTED','REVISION_DONE','CODEX_REVIEW') order by research_priority desc, updated_at limit greatest(1, least(p_limit, 100)); $$;

create or replace function public.get_revision_requests(p_limit integer default 10)
returns setof public.reviews
language sql
security definer
set search_path = ''
as $$ select * from public.reviews where status = 'OPEN' and verdict = 'REVISE' order by created_at limit greatest(1, least(p_limit, 100)); $$;

revoke all on function public.transition_case_status(text,text,text,text) from public, anon, authenticated;
revoke all on function public.get_cases_for_research(integer) from public, anon, authenticated;
revoke all on function public.get_cases_for_narrative(integer) from public, anon, authenticated;
revoke all on function public.get_cases_for_codex_review(integer) from public, anon, authenticated;
revoke all on function public.get_revision_requests(integer) from public, anon, authenticated;
grant execute on function public.transition_case_status(text,text,text,text) to service_role;
grant execute on function public.get_cases_for_research(integer) to service_role;
grant execute on function public.get_cases_for_narrative(integer) to service_role;
grant execute on function public.get_cases_for_codex_review(integer) to service_role;
grant execute on function public.get_revision_requests(integer) to service_role;

alter table public.decision_cases enable row level security;
alter table public.decision_options enable row level security;
alter table public.case_information enable row level security;
alter table public.evidence enable row level security;
alter table public.narratives enable row level security;
alter table public.reviews enable row level security;
alter table public.revisions enable row level security;
alter table public.case_scores enable row level security;
alter table public.shorts_variants enable row level security;
alter table public.publication_results enable row level security;
alter table public.agent_runs enable row level security;
alter table public.status_transitions enable row level security;
alter table public.research_claims enable row level security;
alter table public.research_gaps enable row level security;

revoke all on public.decision_cases, public.decision_options, public.case_information, public.evidence,
  public.narratives, public.reviews, public.revisions, public.case_scores, public.shorts_variants,
  public.publication_results, public.agent_runs, public.status_transitions, public.research_claims, public.research_gaps
  from anon, authenticated;
grant select on public.decision_cases, public.decision_options, public.case_information, public.evidence, public.narratives, public.case_scores, public.shorts_variants to anon, authenticated;

create policy approved_cases_are_public on public.decision_cases for select to anon, authenticated using (status in ('APPROVED','PROTOTYPE_READY','PUBLISHED'));
create policy approved_case_options_are_public on public.decision_options for select to anon, authenticated using (exists (select 1 from public.decision_cases c where c.id = case_id and c.status in ('APPROVED','PROTOTYPE_READY','PUBLISHED')));
create policy approved_case_information_is_public on public.case_information for select to anon, authenticated using (exists (select 1 from public.decision_cases c where c.id = case_id and c.status in ('APPROVED','PROTOTYPE_READY','PUBLISHED')));
create policy approved_case_evidence_is_public on public.evidence for select to anon, authenticated using (exists (select 1 from public.decision_cases c where c.id = case_id and c.status in ('APPROVED','PROTOTYPE_READY','PUBLISHED')));
create policy approved_narratives_are_public on public.narratives for select to anon, authenticated using (status = 'APPROVED' and is_current and exists (select 1 from public.decision_cases c where c.id = case_id and c.status in ('APPROVED','PROTOTYPE_READY','PUBLISHED')));
create policy approved_case_scores_are_public on public.case_scores for select to anon, authenticated using (exists (select 1 from public.decision_cases c where c.id = case_id and c.status in ('APPROVED','PROTOTYPE_READY','PUBLISHED')));
create policy approved_shorts_are_public on public.shorts_variants for select to anon, authenticated using (status = 'APPROVED' and exists (select 1 from public.decision_cases c where c.id = case_id and c.status in ('APPROVED','PROTOTYPE_READY','PUBLISHED')));

comment on table public.decision_cases is 'Canonical structured DecisionEvent facts and editorial workflow status.';
comment on table public.narratives is 'Versioned narrative prose; structured facts remain in decision_cases and child tables.';
comment on table public.reviews is 'Private review queue. No anon/authenticated grants or policies.';
comment on table public.agent_runs is 'Private automation audit trail. service_role only.';

commit;
