-- Upcoming events (entered in admin; the reports only contain past results), venue summaries,
-- and leaderboards computed in the database (the API returns at most 1,000 rows per request,
-- which cut off leaderboards for big festivals like Goliath).

begin;

-- ---------------------------------------------------------------------------
-- 1. Upcoming schedule
-- ---------------------------------------------------------------------------
create table if not exists public.upcoming_events (
  id           bigserial primary key,
  title        text not null,
  series_id    integer references public.series(id) on delete set null,
  casino       text,                      -- venue, matching events.casino where possible
  city         text,
  start_date   date not null,
  end_date     date,
  description  text,
  url          text,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists upcoming_events_dates_idx on public.upcoming_events (start_date, end_date);

alter table public.upcoming_events enable row level security;
drop policy if exists "Public can read published upcoming events" on public.upcoming_events;
create policy "Public can read published upcoming events" on public.upcoming_events
  for select to anon, authenticated using (is_published or (select private.is_admin()));
drop policy if exists "Admins can write upcoming events" on public.upcoming_events;
create policy "Admins can write upcoming events" on public.upcoming_events
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Service role full access upcoming_events" on public.upcoming_events;
create policy "Service role full access upcoming_events" on public.upcoming_events
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 2. Venues (from events.casino)
-- ---------------------------------------------------------------------------
create or replace view public.venue_summary with (security_invoker = on) as
select
  es.casino,
  count(*)                          as events,
  sum(es.entries)                   as cashes,
  sum(es.paid_out)                  as paid_out,
  min(es.start_date)                as first_event,
  max(es.start_date)                as last_event,
  count(distinct es.festival_id)    as festivals,
  count(distinct es.series_id)      as series
from public.event_summary es
where es.casino is not null
group by es.casino;

grant select on public.venue_summary to anon, authenticated, service_role;

-- Best players at one venue (career there): winnings, then wins.
create or replace function public.venue_top_players(p_casino text, p_limit integer default 10)
returns table (player_id bigint, display_name text, cashes bigint, wins bigint, final_tables bigint, money numeric)
language sql
stable
set search_path = ''
as $$
  select r.player_id,
         public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr),
         count(*),
         count(*) filter (where r.finish_position = 1),
         count(*) filter (where r.finish_position <= 9),
         coalesce(sum(r.prize_amount), 0)
  from public.results r
  join public.events e on e.id = r.event_id
  join public.players p on p.id = r.player_id
  where e.casino = p_casino and not e.is_deleted and not r.is_deleted
  group by r.player_id, p.forename, p.surname, p.display_name, p.gdpr
  order by coalesce(sum(r.prize_amount), 0) desc, count(*) filter (where r.finish_position = 1) desc, r.player_id
  limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- 3. Festival leaderboard (league points across the festival's events)
-- ---------------------------------------------------------------------------
create or replace function public.festival_leaderboard(p_festival_id uuid, p_limit integer default 25)
returns table (player_id bigint, display_name text, points numeric, events bigint, wins bigint, money numeric, best integer)
language sql
stable
set search_path = ''
as $$
  select r.player_id,
         public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr),
         round(sum(r.points + r.penalty_points), 2),
         count(*),
         count(*) filter (where r.finish_position = 1),
         coalesce(sum(r.prize_amount), 0),
         min(r.finish_position)
  from public.results r
  join public.events e on e.id = r.event_id
  join public.players p on p.id = r.player_id
  where e.festival_id = p_festival_id and not e.is_deleted and not r.is_deleted
  group by r.player_id, p.forename, p.surname, p.display_name, p.gdpr
  order by sum(r.points + r.penalty_points) desc, count(*) filter (where r.finish_position = 1) desc, min(r.finish_position), r.player_id
  limit greatest(p_limit, 1);
$$;

grant execute on function public.venue_top_players(text, integer) to anon, authenticated, service_role;
grant execute on function public.festival_leaderboard(uuid, integer) to anon, authenticated, service_role;

commit;
