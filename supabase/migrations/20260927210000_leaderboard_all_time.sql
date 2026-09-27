-- All-time leaderboard: every result since records began, per player.
--   p_league: 'npl' = every result, 'hrl' = High Roller events, 'lrl' = buy-ins of £300 or less
--   p_sort:   'points' (default), 'money', 'wins' or 'cashes'
-- Every result counts (no best-N cap). Names are masked the same way as league_standings, and
-- players without GDPR consent are never returned by a name search.

create or replace function public.leaderboard_all_time(
  p_league text default 'npl',
  p_sort text default 'points',
  p_search text default null
)
returns table (
  player_id bigint, display_name text, "position" bigint, total_points numeric,
  cashes bigint, wins bigint, final_tables bigint, money numeric, seasons bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with r as (
    select r.player_id, e.season_id, r.finish_position,
           coalesce(r.points, 0) + coalesce(r.penalty_points, 0) as pts,
           coalesce(r.prize_amount, 0) as prize
    from public.results r
    join public.events e on e.id = r.event_id
    where not r.is_deleted and not e.is_deleted and r.player_id is not null
      and (
        coalesce(p_league, 'npl') = 'npl'
        or (p_league = 'hrl' and coalesce(e.is_high_roller, false))
        or (p_league = 'lrl' and coalesce(e.buy_in, 0) <= 300)
      )
  ),
  agg as (
    select r.player_id,
      sum(r.pts) as total_points,
      count(*) as cashes,
      count(*) filter (where r.finish_position = 1) as wins,
      count(*) filter (where r.finish_position <= 9) as final_tables,
      sum(r.prize) as money,
      count(distinct r.season_id) as seasons
    from r
    group by r.player_id
  ),
  named as (
    select a.*,
      public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr) as display_name,
      coalesce(p.gdpr, false) as consent
    from agg a
    join public.players p on p.id = a.player_id
  ),
  ranked as (
    select n.*,
      row_number() over (
        order by
          case coalesce(p_sort, 'points')
            when 'money'  then n.money
            when 'wins'   then n.wins
            when 'cashes' then n.cashes
            else n.total_points
          end desc,
          n.total_points desc, n.money desc, n.player_id
      ) as "position"
    from named n
  )
  select player_id, display_name, "position", round(total_points, 2), cashes, wins, final_tables, money, seasons
  from ranked
  where p_search is null or (consent and display_name ilike '%' || p_search || '%')
  order by "position";
$$;

grant execute on function public.leaderboard_all_time(text, text, text) to anon, authenticated, service_role;
