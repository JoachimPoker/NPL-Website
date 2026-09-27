-- 1. Biggest gainers: only climbs that finish inside the top 100, so the list isn't dominated by
--    players jumping between positions 3,000 and 600.
-- 2. Name search in league standings skips players without GDPR consent.

begin;

create or replace function public.rpc_biggest_gainers_week(p_league text)
returns table (player_id bigint, display_name text, from_pos integer, to_pos integer, delta integer)
language sql
stable
set search_path = ''
as $$
  with season as (select id from public.seasons where is_active order by year desc limit 1),
  dates as (
    select distinct snapshot_date from public.leaderboard_positions
    where league = p_league and season_id = (select id from season) and snapshot_date is not null
    order by snapshot_date desc limit 2
  ),
  latest as (select max(snapshot_date) d from dates),
  prev   as (select min(snapshot_date) d from dates having count(*) = 2)
  select n.player_id,
    public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr),
    o."position", n."position", o."position" - n."position"
  from public.leaderboard_positions n
  join public.leaderboard_positions o
    on o.player_id = n.player_id and o.league = n.league and o.season_id = n.season_id
   and o.snapshot_date = (select d from prev)
  join public.players p on p.id = n.player_id
  where n.league = p_league and n.season_id = (select id from season)
    and n.snapshot_date = (select d from latest)
    and n."position" <= 100
    and o."position" > n."position"
  order by o."position" - n."position" desc, n."position"
  limit 10;
$$;

-- League standings: same rules as before (season, filters, best-N, bonuses, penalties).
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
    select r.player_id, r.points, r.penalty_points, r.finish_position,
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
      coalesce(sum(r.penalty_points), 0) as penalty_pts,
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
      a.used_pts + a.penalty_pts
        + case when a.scoring_method = 'capped'
               then greatest(a.total_count - a.scoring_cap, 0) * a.extra_pts else 0 end as total_points,
      public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr) as display_name,
      coalesce(p.gdpr, false) as consent
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
  -- Players without GDPR consent are never returned by a name search.
  where p_search is null or (consent and display_name ilike '%' || p_search || '%')
  order by "position";
$$;

commit;
