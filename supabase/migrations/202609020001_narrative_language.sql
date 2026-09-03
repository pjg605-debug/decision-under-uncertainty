begin;

-- Narratives must support independently authored Korean and English
-- versions per case -- not a canonical narrative plus translations. Before
-- this migration, `narratives` had no language dimension and `is_current`
-- was unique per case_id alone, so only one language could be "live" for a
-- case at a time. This adds a language column and rescopes both the
-- version-numbering and is_current uniqueness to (case_id, language).
--
-- The column is added nullable first so the UPDATE below can backfill the
-- 6 existing rows (all English MVP demo content) without violating a
-- not-null constraint that doesn't have data yet, then tightened to
-- `not null` with no default -- new inserts must state their language
-- explicitly; there is no silent fallback.
alter table public.narratives add column if not exists language text;

update public.narratives set language = 'en' where language is null;

alter table public.narratives alter column language set not null;
alter table public.narratives add constraint narratives_language_check check (language in ('en', 'ko'));

-- Replace (case_id, version) uniqueness with (case_id, language, version):
-- each language now has its own independent version sequence, so a Korean
-- revision does not consume or collide with an English version number.
alter table public.narratives drop constraint if exists narratives_case_id_version_key;
alter table public.narratives add constraint narratives_case_id_language_version_key unique (case_id, language, version);

-- Replace the one-current-per-case partial index with one-current-per
-- (case_id, language): a case can now have a current English narrative and
-- a current Korean narrative at the same time, each independently.
drop index if exists public.narratives_one_current_per_case;
create unique index narratives_one_current_per_case_language on public.narratives(case_id, language) where is_current;

create index if not exists narratives_case_language_idx on public.narratives(case_id, language, version desc);

comment on column public.narratives.language is 'Independently authored language of this narrative version (''en'' or ''ko''). Never a translation of the sibling-language row -- each language has its own version history and its own is_current flag.';

commit;
