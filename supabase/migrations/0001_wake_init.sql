-- Wake — initial schema (web app). Local-first mirror lives in the browser; this is the sync + auth source.
-- Every table is per-user with Row Level Security. Applied with the Supabase MCP / CLI.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  time_zone text,
  use_24h boolean not null default true,
  default_snooze_minutes int not null default 10 check (default_snooze_minutes between 1 and 120),
  default_vibration boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- alarms — JSON columns mirror @wake/domain Alarm so AudioPlan can grow without migrations
-- ---------------------------------------------------------------------------
create table if not exists public.alarms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Alarm',
  hour int not null check (hour between 0 and 23),
  minute int not null check (minute between 0 and 59),
  enabled boolean not null default true,
  recurrence jsonb not null default '{"type":"weekly","weekdays":[1,2,3,4,5]}'::jsonb,
  snooze jsonb not null default '{"enabled":true,"durationMinutes":10}'::jsonb,
  vibration jsonb not null default '{"enabled":true,"pattern":"default"}'::jsonb,
  audio_plan jsonb not null,
  fade_in jsonb not null default '{"enabled":false,"durationSeconds":0,"initialVolume":1,"finalVolume":1}'::jsonb,
  fallback_sound_id text not null default 'classic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alarms_user_idx on public.alarms (user_id, enabled);

alter table public.alarms enable row level security;

drop policy if exists "alarms: own rows" on public.alarms;
create policy "alarms: own rows" on public.alarms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- recordings — audio files live in the private storage bucket `recordings/<user_id>/<id>.webm`
-- ---------------------------------------------------------------------------
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text not null default 'audio/webm',
  duration_ms int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recordings_user_idx on public.recordings (user_id, created_at desc);

alter table public.recordings enable row level security;

drop policy if exists "recordings: own rows" on public.recordings;
create policy "recordings: own rows" on public.recordings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- spotify_connections — OAuth tokens, one row per user. Only server code touches refresh tokens.
-- ---------------------------------------------------------------------------
create table if not exists public.spotify_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  spotify_user_id text,
  display_name text,
  product text,
  country text,
  scope text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spotify_connections enable row level security;

-- Users may read non-secret status and delete their connection; tokens are written by server routes
-- acting as the user (RLS still applies) — never expose refresh_token to the browser (see the view below).
drop policy if exists "spotify: own row" on public.spotify_connections;
create policy "spotify: own row" on public.spotify_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace view public.spotify_connection_status
with (security_invoker = true) as
  select user_id, spotify_user_id, display_name, product, country, scope, connected_at, expires_at
  from public.spotify_connections;

-- ---------------------------------------------------------------------------
-- music_sources — recently used provider items (spec §31)
-- ---------------------------------------------------------------------------
create table if not exists public.music_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'spotify',
  provider_uri text not null,
  title text not null,
  subtitle text,
  artwork_url text,
  metadata jsonb,
  last_used_at timestamptz not null default now(),
  unique (user_id, provider, provider_uri)
);

alter table public.music_sources enable row level security;

drop policy if exists "music_sources: own rows" on public.music_sources;
create policy "music_sources: own rows" on public.music_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- alarm_history — reliability log (spec §41). No audio, no tokens.
-- ---------------------------------------------------------------------------
create table if not exists public.alarm_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  alarm_id uuid,
  scheduled_at timestamptz not null,
  fired_at timestamptz,
  stopped_at timestamptz,
  snooze_count int not null default 0,
  audio_source_used text,
  provider_attempted boolean,
  provider_succeeded boolean,
  provider_failure_reason text,
  platform text not null default 'web',
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists alarm_history_user_idx on public.alarm_history (user_id, scheduled_at desc);

alter table public.alarm_history enable row level security;

drop policy if exists "history: own rows" on public.alarm_history;
create policy "history: own rows" on public.alarm_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'alarms', 'recordings', 'spotify_connections']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- storage: private bucket for recordings, path-scoped to the owner
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 26214400, array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/x-m4a'])
on conflict (id) do nothing;

drop policy if exists "recordings bucket: read own" on storage.objects;
create policy "recordings bucket: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "recordings bucket: write own" on storage.objects;
create policy "recordings bucket: write own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "recordings bucket: update own" on storage.objects;
create policy "recordings bucket: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "recordings bucket: delete own" on storage.objects;
create policy "recordings bucket: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);
