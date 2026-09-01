begin;

create table if not exists public.ai_project_briefs (
  brief_key text primary key,
  revision integer not null check (revision > 0),
  status text not null check (status in ('PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE')),
  title text not null,
  objective text not null,
  constraints jsonb not null check (jsonb_typeof(constraints) = 'array'),
  target_architecture jsonb not null check (jsonb_typeof(target_architecture) = 'object'),
  current_state jsonb not null check (jsonb_typeof(current_state) = 'object'),
  next_actions jsonb not null check (jsonb_typeof(next_actions) = 'array'),
  acceptance_criteria jsonb not null check (jsonb_typeof(acceptance_criteria) = 'array'),
  github_document text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ai_project_briefs_set_updated_at on public.ai_project_briefs;
create trigger ai_project_briefs_set_updated_at
before update on public.ai_project_briefs
for each row execute function public.duu_set_updated_at();

alter table public.ai_project_briefs enable row level security;
revoke all on public.ai_project_briefs from anon, authenticated;

insert into public.ai_project_briefs (
  brief_key,
  revision,
  status,
  title,
  objective,
  constraints,
  target_architecture,
  current_state,
  next_actions,
  acceptance_criteria,
  github_document,
  updated_by
)
values (
  'judgment-training-article-automation',
  1,
  'PLANNED',
  '판단 훈련 아티클 완전 서버 자동 발행',
  'GitHub Actions가 매일 네 번 실행 시점에 새 한국어 판단 훈련 글을 작성·검증하고 Supabase에 즉시 저장 및 공개한다.',
  jsonb_build_array(
    'OpenAI API 또는 다른 유료 추론 API를 사용하지 않는다.',
    'ChatGPT/Codex 예약 작업을 제작 타이머로 사용하지 않는다.',
    '미리 작성된 대기열을 정상 발행 경로로 사용하지 않는다.',
    '비용 가능성이 생기면 활성화 전에 사용자 승인을 받는다.',
    '검증 실패 시 발행하지 않는다.',
    '투자 권유나 수익 약속을 하지 않는다.'
  ),
  jsonb_build_object(
    'timer', 'GitHub Actions: Asia/Seoul 03:00, 09:00, 15:00, 21:00',
    'generation', 'public repository standard runner에서 실행되는 무과금 오픈소스 한국어 지원 모델',
    'validation', jsonb_build_array('schema', 'recent-topic duplication', 'source catalog', 'citation URL', 'financial safety'),
    'storage', 'Supabase public.articles',
    'authentication', 'GitHub OIDC preferred; otherwise paired GitHub/Supabase secret',
    'publication', 'six-hour slot idempotency claim 후 단일 트랜잭션 삽입',
    'website', 'https://decision-under-uncertainty.pjg605.chatgpt.site/articles'
  ),
  jsonb_build_object(
    'live_site', true,
    'first_article_live', true,
    'openai_edge_function', 'deployed previously; fails with credit_balance_exhausted',
    'supabase_openai_cron', 'may still be active; verify and disable',
    'queue_publisher_local_commit', '3ac8e2a; conflicts with current goal',
    'queue_publisher_github_commit', '9e23d45; default branch workflow must be replaced',
    'codex_daily_draft_timer', 'may be active; remove or pause',
    'slack', 'not configured; destination missing'
  ),
  jsonb_build_array(
    'Live audit of GitHub Actions, Supabase cron/functions, Codex automations, and relevant tables.',
    'Disable unpaid OpenAI cron and contradictory daily ChatGPT draft timer.',
    'Replace queued publisher with scheduled at-run open-source generation.',
    'Add verified topic/source catalog and strict structured validation.',
    'Add secure idempotent Supabase publish endpoint.',
    'Perform dry run, then one controlled live end-to-end publication.',
    'Update GitHub and Supabase handoff evidence.'
  ),
  jsonb_build_array(
    'Four KST server schedules exist.',
    'No active production path uses OPENAI_API_KEY or a paid inference API.',
    'No ChatGPT/Codex timer or prewritten queue is required.',
    'Each scheduled run writes its own article and publishes at most once.',
    'Malformed, duplicate, unsafe, or citation-invalid output fails closed.',
    'A controlled run is visible in Supabase and on the live article route.',
    'Tests and production build pass.',
    'Actual zero-cost status and remaining risks are recorded.'
  ),
  'AI_HANDOFF.md',
  'codex'
)
on conflict (brief_key) do update
set revision = excluded.revision,
    status = excluded.status,
    title = excluded.title,
    objective = excluded.objective,
    constraints = excluded.constraints,
    target_architecture = excluded.target_architecture,
    current_state = excluded.current_state,
    next_actions = excluded.next_actions,
    acceptance_criteria = excluded.acceptance_criteria,
    github_document = excluded.github_document,
    updated_by = excluded.updated_by;

comment on table public.ai_project_briefs is
  'Service-role-only canonical briefs for AI agents taking over this project.';

commit;
