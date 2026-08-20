alter table public.daily_reports
  add column if not exists mode text not null default 'reflection' check (mode in ('reflection', 'essay')),
  add column if not exists markdown text not null default '';

update public.daily_reports
set markdown = '# ' || theme || E'\n\n' || narrative
where markdown = '';

alter table public.daily_reports
  drop constraint if exists daily_reports_owner_id_date_locale_key;

alter table public.daily_reports
  add constraint daily_reports_owner_id_date_locale_mode_key unique (owner_id, date, locale, mode);
