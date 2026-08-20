alter table public.daily_reports
  drop constraint if exists daily_reports_mode_check;

alter table public.daily_reports
  add constraint daily_reports_mode_check
  check (mode in ('reflection', 'essay', 'short_essay', 'post'));

comment on column public.daily_reports.mode is 'New reports use short_essay or post. reflection and essay are preserved for legacy snapshots.';
