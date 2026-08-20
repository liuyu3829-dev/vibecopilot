alter table public.thoughts
  add column if not exists captured_day date,
  add column if not exists report_included boolean not null default true,
  add column if not exists personal_tags jsonb not null default '[]'::jsonb;

update public.thoughts
set captured_day = (captured_at at time zone 'Asia/Shanghai')::date
where captured_day is null;

alter table public.thoughts
  alter column captured_day set not null;

create index if not exists thoughts_owner_day_idx
  on public.thoughts (owner_id, captured_day desc)
  where deleted_at is null;

alter table public.daily_reports
  add column if not exists evidence jsonb not null default '[]'::jsonb;

comment on column public.thoughts.captured_day is 'Asia/Shanghai calendar day used by the timeline and reports.';
comment on column public.thoughts.personal_tags is 'User-managed tags, kept separate from AI analysis tags.';
comment on column public.thoughts.report_included is 'Whether this thought is selected as source material for its daily report.';
comment on column public.daily_reports.evidence is 'Immutable source snapshot captured when the report was generated.';
