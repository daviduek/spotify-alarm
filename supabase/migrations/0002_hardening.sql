-- 0002 — security & integrity hardening (audit 2026-09-07)
--
-- 1. Spotify tokens are no longer readable by the browser role. Reads/writes of access_token /
--    refresh_token happen only through the server (service role). The browser keeps column-level
--    SELECT on non-secret columns (used by `spotify_connection_status` and the app pages) and DELETE
--    (disconnect). INSERT/UPDATE are server-only.
-- 2. alarm_history: one row per occurrence (client id), no client DELETE, FK to alarms, value checks.
-- 3. alarms: DB-level checks matching the zod schema so rows can never become invisible to the app.
-- 4. profiles: no client DELETE.

-- ---------------------------------------------------------------------------
-- 1. spotify_connections
-- ---------------------------------------------------------------------------
drop policy if exists "spotify: own row" on public.spotify_connections;

create policy "spotify: read own status" on public.spotify_connections
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "spotify: disconnect own" on public.spotify_connections
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.spotify_connections from anon, authenticated;
grant select (user_id, spotify_user_id, display_name, product, country, scope, connected_at, expires_at, updated_at)
  on public.spotify_connections to authenticated;
grant delete on public.spotify_connections to authenticated;

comment on table public.spotify_connections is
  'Spotify OAuth tokens per user. Token columns are NOT granted to the browser role; the web server (service role) is the only reader/writer.';

-- ---------------------------------------------------------------------------
-- 2. alarm_history
-- ---------------------------------------------------------------------------
drop policy if exists "history: own rows" on public.alarm_history;

create policy "history: read own" on public.alarm_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "history: insert own" on public.alarm_history
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "history: update own" on public.alarm_history
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke delete on public.alarm_history from anon, authenticated;

alter table public.alarm_history
  drop constraint if exists alarm_history_alarm_id_fkey,
  add constraint alarm_history_alarm_id_fkey foreign key (alarm_id) references public.alarms (id) on delete set null;

alter table public.alarm_history
  drop constraint if exists alarm_history_platform_check,
  add constraint alarm_history_platform_check check (platform in ('web', 'ios', 'android'));

alter table public.alarm_history
  drop constraint if exists alarm_history_audio_source_check,
  add constraint alarm_history_audio_source_check
    check (audio_source_used is null or audio_source_used in ('fallback', 'local', 'recording', 'music'));

create index if not exists alarm_history_alarm_idx on public.alarm_history (alarm_id);

-- ---------------------------------------------------------------------------
-- 3. alarms — shape checks mirroring packages/domain zod schemas
-- ---------------------------------------------------------------------------
alter table public.alarms
  drop constraint if exists alarms_name_len_check,
  add constraint alarms_name_len_check check (char_length(name) between 1 and 60);

alter table public.alarms
  drop constraint if exists alarms_time_check,
  add constraint alarms_time_check check (hour between 0 and 23 and minute between 0 and 59);

alter table public.alarms
  drop constraint if exists alarms_recurrence_check,
  add constraint alarms_recurrence_check check (
    jsonb_typeof(recurrence) = 'object'
    and (recurrence->>'type') in ('once', 'weekly')
    and ((recurrence->>'type') = 'once' or (jsonb_typeof(recurrence->'weekdays') = 'array' and jsonb_array_length(recurrence->'weekdays') >= 1))
  );

alter table public.alarms
  drop constraint if exists alarms_audio_plan_check,
  add constraint alarms_audio_plan_check check (
    jsonb_typeof(audio_plan) = 'object'
    and jsonb_typeof(audio_plan->'steps') = 'array'
    and jsonb_array_length(audio_plan->'steps') >= 1
  );

-- ---------------------------------------------------------------------------
-- 4. profiles — users may read/update, never delete (row is owned by the auth.users cascade)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: own row" on public.profiles;
drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

revoke delete on public.profiles from anon, authenticated;
