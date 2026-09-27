-- Tighten RLS on project utgmttloxscwvjiboymh.
-- Run in the Supabase SQL editor, or with `supabase db push`.

-- Admin check based on the JWT's app_metadata (only settable server-side,
-- unlike user_metadata which any user can change for themselves).
create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' -> 'roles') ? 'admin'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- badge_definitions: public catalogue, writes via service role only
alter table public.badge_definitions enable row level security;
create policy "Public can read badge definitions" on public.badge_definitions
  for select to anon, authenticated using (true);
create policy "Service role full access badge definitions" on public.badge_definitions
  for all to service_role using (true) with check (true);

-- badge_progress: public (like player_badges), writes via service role only
alter table public.badge_progress enable row level security;
create policy "Public can read badge progress" on public.badge_progress
  for select to anon, authenticated using (true);
create policy "Service role full access badge progress" on public.badge_progress
  for all to service_role using (true) with check (true);
create index if not exists badge_progress_player_id_idx on public.badge_progress (player_id);

-- achievements / milestones: RLS was on with no policies (unreadable by anyone)
create policy "Public can read achievements" on public.achievements
  for select to anon, authenticated using (true);
create policy "Service role full access achievements" on public.achievements
  for all to service_role using (true) with check (true);
create policy "Public can read milestones" on public.milestones
  for select to anon, authenticated using (true);
create policy "Service role full access milestones" on public.milestones
  for all to service_role using (true) with check (true);

-- jobs: was open to any signed-in user (and /signup is public); restrict to admins
drop policy if exists "Allow authenticated users to insert jobs" on public.jobs;
drop policy if exists "Allow authenticated users to update jobs" on public.jobs;
drop policy if exists "Allow authenticated users to view jobs" on public.jobs;
create policy "Admins can read jobs" on public.jobs
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can insert jobs" on public.jobs
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update jobs" on public.jobs
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Service role full access jobs" on public.jobs
  for all to service_role using (true) with check (true);

-- archived badges: was readable by any signed-in user; restrict to admins
drop policy if exists "Authenticated users can view archived_badges" on public.archived_badges;
create policy "Admins can view archived_badges" on public.archived_badges
  for select to authenticated using ((select private.is_admin()));
drop policy if exists "Authenticated users can view archived_player_badges" on public.archived_player_badges;
create policy "Admins can view archived_player_badges" on public.archived_player_badges
  for select to authenticated using ((select private.is_admin()));

-- players: hide date_of_birth, card_number and membership_number from the
-- public and signed-in roles. RLS is row-level, so this uses column privileges.
-- Note: `select *` on players will now fail for these roles; list columns explicitly.
revoke select on public.players from anon, authenticated;
grant select (
  id, forename, surname, full_name, gdpr, home_casino, created_at, updated_at,
  lifetime_wins, lifetime_cashes, lifetime_money_won, lifetime_final_tables,
  lifetime_events_played, badge_count
) on public.players to anon, authenticated;
