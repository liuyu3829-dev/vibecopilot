create extension if not exists pgcrypto;

create table if not exists public.thoughts (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  transcript text not null check (length(trim(transcript)) > 0),
  source text not null check (source in ('manual','voice','desktop_orb')),
  language text not null check (language in ('cn','en')),
  captured_at timestamptz not null,
  updated_at timestamptz not null,
  summary text,
  tags jsonb not null default '[]'::jsonb,
  analysis_status text not null default 'pending' check (analysis_status in ('pending','complete','failed')),
  deleted_at timestamptz
);
create index if not exists thoughts_owner_captured_idx on public.thoughts (owner_id, captured_at desc) where deleted_at is null;

create table if not exists public.daily_reports (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  locale text not null check (locale in ('zh-CN','en')),
  theme text not null,
  narrative text not null,
  insights jsonb not null default '[]'::jsonb,
  source_thought_count integer not null check (source_thought_count >= 0),
  generated_at timestamptz not null,
  unique(owner_id, date, locale)
);

alter table public.thoughts enable row level security;
alter table public.daily_reports enable row level security;
create policy "thoughts belong to authenticated owner" on public.thoughts for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "reports belong to authenticated owner" on public.daily_reports for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create table if not exists public.desktop_pairings (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique, expires_at timestamptz not null, used_at timestamptz
);
create table if not exists public.desktop_sessions (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique, created_at timestamptz not null default now(), revoked_at timestamptz
);
alter table public.desktop_pairings enable row level security;
alter table public.desktop_sessions enable row level security;
