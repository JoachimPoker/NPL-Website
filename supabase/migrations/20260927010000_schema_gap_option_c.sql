-- Option C: additive schema changes so the website code works against this project.
-- Nothing existing is renamed or dropped. Safe to re-run (idempotent where possible).
-- Depends on 20260927000000_tighten_rls_policies.sql (private.is_admin()).

begin;

-- ---------------------------------------------------------------------------
-- 1. New columns on existing tables
-- ---------------------------------------------------------------------------
alter table public.players
  add column if not exists display_name text,
  add column if not exists avatar_url  text,
  add column if not exists bio         text;

-- players uses column-level SELECT grants (see previous migration); expose the new public columns.
grant select (display_name, avatar_url, bio) on public.players to anon, authenticated;

alter table public.seasons
  add column if not exists start_date date,
  add column if not exists end_date   date,
  add column if not exists method     text,
  add column if not exists cap_x      integer;

update public.seasons set
  start_date = coalesce(start_date, make_date(year, 1, 1)),
  end_date   = coalesce(end_date,   make_date(year, 12, 31)),
  method     = coalesce(method, case when npl_rule like 'top%' then 'BEST_X' else 'ALL' end),
  cap_x      = coalesce(cap_x,  case when npl_rule like 'top20%' then 20 else 0 end);

-- ---------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------
create table if not exists public.series (
  id          serial primary key,
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.festivals (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  start_date  date not null,
  end_date    date not null,
  city        text,
  keywords    jsonb not null default '[]'::jsonb,
  season_id   integer references public.seasons(id) on delete set null,
  series_id   integer references public.series(id)  on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists festivals_series_id_idx on public.festivals (series_id);
create index if not exists festivals_season_id_idx on public.festivals (season_id);

create table if not exists public.import_batches (
  id              uuid primary key default gen_random_uuid(),
  filename        text not null,
  imported_at     timestamptz not null default now(),
  imported_by     text,
  uploaded_by     text,
  note            text,
  row_count       integer,
  processed_count integer,
  snapshot_date   date,
  status          text,
  created_at      timestamptz default now()
);

alter table public.events
  add column if not exists series_id   integer references public.series(id)   on delete set null,
  add column if not exists festival_id uuid    references public.festivals(id) on delete set null,
  add column if not exists is_deleted  boolean not null default false,
  add column if not exists city        text,
  add column if not exists search_text text;
create index if not exists events_series_id_idx   on public.events (series_id);
create index if not exists events_festival_id_idx on public.events (festival_id);
create index if not exists events_season_id_idx   on public.events (season_id);

alter table public.results
  add column if not exists is_deleted      boolean not null default false,
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null,
  add column if not exists raw_hash        text;
create index if not exists results_event_id_idx        on public.results (event_id);
create index if not exists results_player_id_idx       on public.results (player_id);
create index if not exists results_import_batch_id_idx on public.results (import_batch_id);

create table if not exists public.leagues (
  id                    serial primary key,
  season_id             integer references public.seasons(id) on delete cascade,
  slug                  text not null,
  label                 text not null,
  scoring_method        text not null default 'total' check (scoring_method in ('total', 'capped')),
  scoring_cap           integer,
  filter_is_high_roller boolean,
  filter_min_buyin      numeric,
  filter_max_buyin      numeric,
  max_buy_in            numeric,
  created_at            timestamptz default now(),
  unique (season_id, slug)
);

create table if not exists public.league_bonuses (
  id           serial primary key,
  league_id    integer references public.leagues(id) on delete cascade,
  bonus_type   text not null,  -- 'participation_after_cap' | 'back_to_back_wins'
  points_value numeric not null,
  created_at   timestamptz default now()
);
create index if not exists league_bonuses_league_id_idx on public.league_bonuses (league_id);

create table if not exists public.leaderboard_positions (
  id            bigserial primary key,
  league        text not null,
  player_id     bigint references public.players(id) on delete cascade,
  points        numeric not null,
  position      integer not null,
  snapshot_date date,
  created_at    timestamptz default now()
);
create index if not exists leaderboard_positions_player_idx on public.leaderboard_positions (player_id, snapshot_date);
create index if not exists leaderboard_positions_league_idx on public.leaderboard_positions (league, snapshot_date);

create table if not exists public.player_aliases (
  id         uuid primary key default gen_random_uuid(),
  player_id  bigint not null references public.players(id) on delete cascade,
  alias      text not null,
  alias_norm text,
  created_at timestamptz not null default now(),
  unique (player_id, alias)
);
create index if not exists player_aliases_alias_norm_idx on public.player_aliases (alias_norm);

create table if not exists public.player_searches (
  id         bigserial primary key,
  player_id  bigint references public.players(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists player_searches_created_idx on public.player_searches (created_at, player_id);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
-- Public-readable, admin/service-writable
do $$
declare t text;
begin
  foreach t in array array['series','festivals','leagues','league_bonuses','leaderboard_positions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Public can read %1$s" on public.%1$I', t);
    execute format('create policy "Public can read %1$s" on public.%1$I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "Admins can write %1$s" on public.%1$I', t);
    execute format('create policy "Admins can write %1$s" on public.%1$I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('drop policy if exists "Service role full access %1$s" on public.%1$I', t);
    execute format('create policy "Service role full access %1$s" on public.%1$I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;

-- Admin-only
do $$
declare t text;
begin
  foreach t in array array['player_aliases','import_batches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Admins can manage %1$s" on public.%1$I', t);
    execute format('create policy "Admins can manage %1$s" on public.%1$I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('drop policy if exists "Service role full access %1$s" on public.%1$I', t);
    execute format('create policy "Service role full access %1$s" on public.%1$I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;

-- player_searches: anyone can log a profile view; counts are public (used for "trending")
alter table public.player_searches enable row level security;
drop policy if exists "Anyone can log a player search" on public.player_searches;
create policy "Anyone can log a player search" on public.player_searches
  for insert to anon, authenticated with check (player_id is not null);
drop policy if exists "Public can read player searches" on public.player_searches;
create policy "Public can read player searches" on public.player_searches
  for select to anon, authenticated using (true);
drop policy if exists "Service role full access player_searches" on public.player_searches;
create policy "Service role full access player_searches" on public.player_searches
  for all to service_role using (true) with check (true);

-- Existing tables: let signed-in admins write (previously service role only)
do $$
declare t text;
begin
  foreach t in array array['players','events','results','seasons','news','season_prizes'] loop
    execute format('drop policy if exists "Admins can write %1$s" on public.%1$I', t);
    execute format('create policy "Admins can write %1$s" on public.%1$I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Seed leagues per season (rules as given by the league organisers)
-- ---------------------------------------------------------------------------
insert into public.leagues (season_id, slug, label, scoring_method, scoring_cap, filter_is_high_roller, max_buy_in)
select s.id, v.slug, v.label, v.method, v.cap, v.hr, v.maxbuy
from public.seasons s
join (values
  -- 2024: NPL all results; HRL all high roller events
  (2024, 'npl', 'National Poker League', 'total',  null::int, null::boolean, null::numeric),
  (2024, 'hrl', 'High Roller League',    'total',  null,      true,          null),
  -- 2025: NPL best 20 results; HRL all high roller events
  (2025, 'npl', 'National Poker League', 'capped', 20,        null,          null),
  (2025, 'hrl', 'High Roller League',    'total',  null,      true,          null),
  -- 2026: NPL best 20 + 2 pts per extra result; HRL all high roller; LRL buy-in <= 300
  (2026, 'npl', 'National Poker League', 'capped', 20,        null,          null),
  (2026, 'hrl', 'High Roller League',    'total',  null,      true,          null),
  (2026, 'lrl', 'Low Roller League',     'total',  null,      null,          300)
) as v(yr, slug, label, method, cap, hr, maxbuy) on v.yr = s.year
on conflict (season_id, slug) do nothing;

insert into public.league_bonuses (league_id, bonus_type, points_value)
select l.id, 'participation_after_cap', 2
from public.leagues l join public.seasons s on s.id = l.season_id
where s.year = 2026 and l.slug = 'npl'
  and not exists (select 1 from public.league_bonuses b where b.league_id = l.id and b.bonus_type = 'participation_after_cap');

-- ---------------------------------------------------------------------------
-- 5. Functions
-- ---------------------------------------------------------------------------
-- Public display name, masked to initials when the player has not given GDPR consent.
create or replace function public.display_name_for(p_forename text, p_surname text, p_display_name text, p_consent boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_consent, false) then
      coalesce(nullif(trim(p_display_name), ''), nullif(trim(concat_ws(' ', p_forename, p_surname)), ''), 'Anonymous')
    else
      coalesce(nullif(trim(concat_ws(' ',
        upper(left(nullif(trim(p_forename), ''), 1)) || '.',
        upper(left(nullif(trim(p_surname),  ''), 1)) || '.')), ''), 'Anonymous')
  end;
$$;

-- Full standings for one league (season + event filter + scoring rules + bonuses).
-- Ranking: total points, then wins, then best single result.
create or replace function public.league_standings(p_league_id integer, p_search text default null)
returns table (
  player_id bigint, display_name text, "position" bigint, total_points numeric,
  total_count bigint, used_count bigint, wins bigint, top3_count bigint, top9_count bigint,
  best_single numeric, lowest_counted numeric, average_all numeric, average_used numeric
)
language sql
stable
set search_path = ''
as $$
  with lg as (
    select l.*,
      coalesce((select sum(b.points_value) from public.league_bonuses b
                where b.league_id = l.id and b.bonus_type = 'participation_after_cap'), 0) as extra_pts
    from public.leagues l where l.id = p_league_id
  ),
  ev as (
    select e.id from public.events e, lg
    where e.season_id = lg.season_id
      and not e.is_deleted
      and (lg.filter_is_high_roller is not true or e.is_high_roller)
      and (coalesce(lg.max_buy_in, lg.filter_max_buyin) is null or e.buy_in <= coalesce(lg.max_buy_in, lg.filter_max_buyin))
      and (lg.filter_min_buyin is null or e.buy_in >= lg.filter_min_buyin)
  ),
  r as (
    select r.player_id, r.points, r.finish_position,
      row_number() over (partition by r.player_id order by r.points desc, r.id) as rn
    from public.results r join ev on ev.id = r.event_id
    where not r.is_deleted and r.player_id is not null
  ),
  agg as (
    select r.player_id,
      count(*) as total_count,
      count(*) filter (where lg.scoring_method <> 'capped' or r.rn <= lg.scoring_cap) as used_count,
      coalesce(sum(r.points) filter (where lg.scoring_method <> 'capped' or r.rn <= lg.scoring_cap), 0) as used_pts,
      sum(r.points) as all_pts,
      min(r.points) filter (where lg.scoring_method <> 'capped' or r.rn <= lg.scoring_cap) as lowest_counted,
      max(r.points) as best_single,
      count(*) filter (where r.finish_position = 1) as wins,
      count(*) filter (where r.finish_position <= 3) as top3_count,
      count(*) filter (where r.finish_position <= 9) as top9_count,
      max(lg.scoring_method) as scoring_method, max(lg.scoring_cap) as scoring_cap, max(lg.extra_pts) as extra_pts
    from r, lg
    group by r.player_id
  ),
  scored as (
    select a.*,
      a.used_pts + case when a.scoring_method = 'capped'
                        then greatest(a.total_count - a.scoring_cap, 0) * a.extra_pts else 0 end as total_points,
      public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr) as display_name
    from agg a join public.players p on p.id = a.player_id
  ),
  ranked as (
    select s.*, row_number() over (order by s.total_points desc, s.wins desc, s.best_single desc, s.player_id) as "position"
    from scored s
  )
  select player_id, display_name, "position", round(total_points, 2),
    total_count, used_count, wins, top3_count, top9_count,
    best_single, lowest_counted,
    round(all_pts / nullif(total_count, 0), 2),
    round(used_pts / nullif(used_count, 0), 2)
  from ranked
  where p_search is null or display_name ilike '%' || p_search || '%'
  order by "position";
$$;

-- Used by the leaderboard snapshot job.
create or replace function public.get_league_leaderboard(p_league_id integer)
returns table (player_id bigint, display_name text, "position" bigint, total_points numeric, events_played bigint, wins bigint)
language sql
stable
set search_path = ''
as $$
  select s.player_id, s.display_name, s.position, s.total_points, s.total_count, s.wins
  from public.league_standings(p_league_id) s;
$$;

-- Season leaderboard used by the public site. The league (and its rules) is found from the
-- season covering p_from..p_to and the league slug; p_method / p_cap are kept for
-- compatibility but the league's own configuration is authoritative.
create or replace function public.leaderboard_season(
  p_from date, p_to date, p_league text, p_method text default null, p_cap integer default null,
  p_search text default null, p_limit integer default 100, p_offset integer default 0
)
returns table (
  player_id bigint, display_name text, "position" bigint, total_points numeric,
  total_count bigint, used_count bigint, wins bigint, top3_count bigint, top9_count bigint,
  best_single numeric, lowest_counted numeric, average_all numeric, average_used numeric
)
language sql
stable
set search_path = ''
as $$
  select s.*
  from public.league_standings(
    (select l.id from public.leagues l join public.seasons se on se.id = l.season_id
     where l.slug = lower(p_league) and se.start_date <= p_to and se.end_date >= p_from
     order by se.start_date desc limit 1),
    nullif(trim(p_search), '')
  ) s
  order by s.position
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

-- Series leaderboard: plain points total across the series' events.
-- p_scope = 'season' (active season only) or 'all_time'.
create or replace function public.leaderboard_for_series(p_series_id integer, p_scope text default 'season')
returns table (player_id bigint, display_name text, "position" bigint, total_points numeric,
               events_played bigint, wins bigint, final_tables bigint)
language sql
stable
set search_path = ''
as $$
  with agg as (
    select r.player_id,
      sum(r.points) as total_points,
      count(*) as events_played,
      count(*) filter (where r.finish_position = 1) as wins,
      count(*) filter (where r.finish_position <= 9) as final_tables
    from public.results r
    join public.events e on e.id = r.event_id
    where e.series_id = p_series_id
      and not e.is_deleted and not r.is_deleted and r.player_id is not null
      and (p_scope = 'all_time'
           or e.season_id = (select id from public.seasons where is_active order by year desc limit 1))
    group by r.player_id
  )
  select a.player_id,
    public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr),
    row_number() over (order by a.total_points desc, a.wins desc, a.player_id),
    round(a.total_points, 2), a.events_played, a.wins, a.final_tables
  from agg a join public.players p on p.id = a.player_id
  order by 3;
$$;

-- Biggest climbers between the two most recent snapshots of a league.
create or replace function public.rpc_biggest_gainers_week(p_league text)
returns table (player_id bigint, display_name text, from_pos integer, to_pos integer, delta integer)
language sql
stable
set search_path = ''
as $$
  with dates as (
    select distinct snapshot_date from public.leaderboard_positions
    where league = p_league and snapshot_date is not null
    order by snapshot_date desc limit 2
  ),
  latest as (select max(snapshot_date) d from dates),
  prev   as (select min(snapshot_date) d from dates having count(*) = 2)
  select n.player_id,
    public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr),
    o.position, n.position, o.position - n.position
  from public.leaderboard_positions n
  join public.leaderboard_positions o
    on o.player_id = n.player_id and o.league = n.league and o.snapshot_date = (select d from prev)
  join public.players p on p.id = n.player_id
  where n.league = p_league and n.snapshot_date = (select d from latest)
    and o.position > n.position
  order by o.position - n.position desc, n.position
  limit 10;
$$;

-- Most-viewed player profiles in the last 30 days.
create or replace function public.rpc_trending_players_last30()
returns table (player_id bigint, display_name text, hits bigint)
language sql
stable
set search_path = ''
as $$
  select s.player_id,
    public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr),
    count(*) as hits
  from public.player_searches s
  join public.players p on p.id = s.player_id
  where s.created_at >= now() - interval '30 days'
  group by s.player_id, p.forename, p.surname, p.display_name, p.gdpr
  order by hits desc
  limit 10;
$$;

grant execute on function
  public.display_name_for(text, text, text, boolean),
  public.league_standings(integer, text),
  public.get_league_leaderboard(integer),
  public.leaderboard_season(date, date, text, text, integer, text, integer, integer),
  public.leaderboard_for_series(integer, text),
  public.rpc_biggest_gainers_week(text),
  public.rpc_trending_players_last30()
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Fix existing functions
-- ---------------------------------------------------------------------------
-- Referenced results.tournament_id / position / prize, which don't exist.
create or replace function public.update_player_lifetime_stats(p_player_id integer)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.players set
    lifetime_events_played = (select count(distinct event_id) from public.results where player_id = p_player_id and not is_deleted),
    lifetime_wins          = (select count(*) from public.results where player_id = p_player_id and not is_deleted and finish_position = 1),
    lifetime_cashes        = (select count(*) from public.results where player_id = p_player_id and not is_deleted and prize_amount > 0),
    lifetime_money_won     = (select coalesce(sum(prize_amount), 0) from public.results where player_id = p_player_id and not is_deleted),
    lifetime_final_tables  = (select count(*) from public.results where player_id = p_player_id and not is_deleted and finish_position <= 9)
  where id = p_player_id;
end;
$$;

-- Security advisor: pin search_path (bodies reference unqualified public tables).
alter function public.update_player_badge_count(integer) set search_path = public;
alter function public.trigger_update_badge_count() set search_path = public;

commit;
