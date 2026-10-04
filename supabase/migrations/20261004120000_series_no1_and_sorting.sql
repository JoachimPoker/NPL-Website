-- 1. "Festival Leaderboard Winner" is retired: it almost always went to the Main Event winner.
--    In its place, "Series No.1": held by whoever is first on a series' all-time leaderboard
--    (GUKPT, UKPL, Goliath, ...), one award per series, moving whenever the leader changes.
-- 2. The all-time leaderboard (players list) can also be sorted by final tables and seasons.

begin;

update public.badge_definitions set is_active = false, updated_at = now() where condition_type = 'festival_champion';

insert into public.badge_definitions
  (key, name, description, icon, tier, category, condition_type, condition_value, kind, display_order, is_active)
values
  ('series_no1', 'Series No.1', 'Be first on a series'' all-time leaderboard. Held by whoever is top right now.', 'crown', 'gold', 'Other titles', 'alltime_leader', '{}', 'badge', 301, true)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon, category = excluded.category,
  condition_type = excluded.condition_type, kind = excluded.kind, display_order = excluded.display_order, is_active = true, updated_at = now();

create or replace function public.award_badges()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_awarded integer;
  v_updated integer;
  v_removed integer;
begin
  drop table if exists pg_temp._br, pg_temp._bst, pg_temp._bs, pg_temp._btop, pg_temp._bq;

  -- Series title definitions: one per series ("others" is the catch-all, so it has none).
  insert into public.badge_definitions
    (key, name, description, icon, tier, category, condition_type, condition_value, kind, series_id, display_order, is_active)
  select 'series_' || replace(s.slug, '-', '_'),
         s.name || ' Winner',
         case when s.has_festivals then 'Win the ' || s.name || ' Main Event.' else 'Win a ' || s.name || ' tournament.' end,
         'trophy', 'gold', 'Series titles', 'series_title', '{}'::jsonb, 'badge', s.id,
         100 + coalesce(s.sort_order, 0), coalesce(s.is_active, true)
  from public.series s
  where s.slug <> 'others'
    and not exists (select 1 from public.badge_definitions d where d.series_id = s.id)
  on conflict (key) do nothing;

  update public.badge_definitions d set is_active = false, updated_at = now()
  from public.series s
  where d.series_id = s.id and not coalesce(s.is_active, true) and d.is_active;

  -- Every counted result with what the ladders need.
  create temp table _br on commit drop as
  select r.player_id, r.event_id, r.finish_position as pos,
         coalesce(r.prize_amount, 0) as prize,
         coalesce(r.points, 0) + coalesce(r.penalty_points, 0) as pts,
         e.season_id, e.series_id, e.festival_id, e.casino, e.tournament_name,
         coalesce(e.is_high_roller, false) as hr,
         (coalesce(e.casino, '') ilike 'online' or coalesce(e.tournament_name, '') ~* '\monline\M') as online
  from public.results r
  join public.events e on e.id = r.event_id
  where not r.is_deleted and not e.is_deleted and r.player_id is not null;
  analyze _br;

  -- League top 10s of finished seasons.
  create temp table _bst on commit drop as
  select l.slug, se.year, st.player_id, st."position" as pos
  from public.seasons se
  join public.leagues l on l.season_id = se.id and l.slug in ('npl', 'hrl', 'lrl')
  cross join lateral public.league_standings(l.id) st
  where not coalesce(se.is_active, false) and st."position" <= 10;

  -- Lifetime numbers per player.
  create temp table _bs on commit drop as
  with base as (
    select player_id,
      count(*) filter (where pos = 1)                           as wins,
      count(*)                                                  as cashes,  -- every report row is a cash
      count(*) filter (where pos <= 9)                          as final_tables,
      count(distinct event_id)                                  as events_played,
      sum(prize)                                                as money,
      max(prize)                                                as biggest_cash,
      sum(pts)                                                  as points,
      count(distinct casino) filter (where not online)          as venues,
      count(distinct series_id) filter (where pos = 1)          as series_won,
      count(distinct festival_id)                               as festivals,
      count(*) filter (where hr)                                as hr_cashes,
      count(*) filter (where online)                            as online_cashes,
      count(distinct season_id)                                 as seasons
    from _br
    group by player_id
  ), per_season as (
    select player_id, max(n) as season_cashes
    from (select player_id, season_id, count(*) as n from _br group by player_id, season_id) x
    group by player_id
  ), top10 as (
    select player_id, count(*) as npl_top10_count from _bst where slug = 'npl' group by player_id
  )
  select base.*, coalesce(ps.season_cashes, 0) as season_cashes, coalesce(t.npl_top10_count, 0) as npl_top10_count
  from base
  left join per_season ps on ps.player_id = base.player_id
  left join top10 t on t.player_id = base.player_id;

  create temp table _bq (
    player_id bigint, badge_key text, badge_name text, season_year integer,
    event_id bigint, festival_id uuid, occasion text
  ) on commit drop;

  -- Achievements.
  insert into _bq (player_id, badge_key, badge_name)
  select s.player_id, d.key, d.name
  from public.badge_definitions d
  join _bs s on (case d.condition_type
      when 'wins'            then s.wins
      when 'cashes'          then s.cashes
      when 'final_tables'    then s.final_tables
      when 'events_played'   then s.events_played
      when 'money'           then s.money
      when 'biggest_cash'    then s.biggest_cash
      when 'points'          then s.points
      when 'venues'          then s.venues
      when 'series_won'      then s.series_won
      when 'festivals'       then s.festivals
      when 'hr_cashes'       then s.hr_cashes
      when 'online_cashes'   then s.online_cashes
      when 'seasons'         then s.seasons
      when 'season_cashes'   then s.season_cashes
      when 'npl_top10_count' then s.npl_top10_count
    end)::numeric >= coalesce((d.condition_value ->> 'min')::numeric, 1)
  where d.is_active and d.kind = 'achievement';

  -- Series titles: the festival's Main Event (set by hand in admin, or detected) ...
  insert into _bq
  select b.player_id, d.key || '@' || b.event_id, d.name, se.year, b.event_id, fs.id, fs.label
  from public.badge_definitions d
  join public.series s on s.id = d.series_id and s.has_festivals
  join public.festival_summary fs on fs.series_id = s.id and fs.main_event_id is not null
  join _br b on b.event_id = fs.main_event_id and b.pos = 1
  left join public.seasons se on se.id = fs.season_id
  where d.is_active and d.condition_type = 'series_title';

  -- ... or, for series of single tournaments, any win.
  insert into _bq
  select b.player_id, d.key || '@' || b.event_id, d.name, se.year, b.event_id, null, b.tournament_name
  from public.badge_definitions d
  join public.series s on s.id = d.series_id and not s.has_festivals
  join _br b on b.series_id = s.id and b.pos = 1
  left join public.seasons se on se.id = b.season_id
  where d.is_active and d.condition_type = 'series_title';

  -- High Roller wins, one per event.
  insert into _bq
  select b.player_id, d.key || '@' || b.event_id, d.name, se.year, b.event_id, b.festival_id, b.tournament_name
  from public.badge_definitions d
  join _br b on b.hr and b.pos = 1
  left join public.seasons se on se.id = b.season_id
  where d.is_active and d.condition_type = 'high_roller_win';

  -- Series No.1: whoever is first on each series' all-time leaderboard holds it, one award per series.
  -- It moves with the leaderboard: when someone else goes top, the award moves to them on the next import.
  create temp table _btop on commit drop as
  select s.id as series_id, s.slug, s.name, lb.player_id
  from public.series s
  cross join lateral public.leaderboard_for_series(s.id, 'all_time') lb
  where coalesce(s.is_active, true) and s.slug <> 'others' and lb."position" = 1;

  insert into _bq
  select t.player_id, d.key || '@' || t.slug, d.name, null, null, null, t.name
  from public.badge_definitions d
  cross join _btop t
  where d.is_active and d.condition_type = 'alltime_leader';

  -- League titles for finished seasons.
  insert into _bq
  select st.player_id, d.key || '@' || st.year, d.name || ' ' || st.year, st.year, null, null,
         case st.pos when 1 then 'Champion' when 2 then '2nd' when 3 then '3rd' else st.pos || 'th' end || ' · ' || st.year
  from public.badge_definitions d
  join _bst st on st.slug = case d.condition_type
       when 'season_rank_npl' then 'npl' when 'season_rank_hr' then 'hrl' when 'season_rank_lrl' then 'lrl' end
  where d.is_active and d.condition_type in ('season_rank_npl', 'season_rank_hr', 'season_rank_lrl')
    and st.pos between coalesce((d.condition_value ->> 'min_rank')::integer, 1)
                   and coalesce((d.condition_value ->> 'max_rank')::integer, 1);

  -- Apply: add new automatic awards, refresh their details, remove ones no longer earned.
  with up as (
    insert into public.player_badges as pb
      (player_id, badge_key, badge_name, season_year, event_id, festival_id, occasion, awarded_by)
    select distinct on (player_id, badge_key)
      player_id, badge_key, badge_name, season_year, event_id, festival_id, occasion, 'auto'
    from _bq
    order by player_id, badge_key
    on conflict (player_id, badge_key) do update set
      badge_name = excluded.badge_name, season_year = excluded.season_year, event_id = excluded.event_id,
      festival_id = excluded.festival_id, occasion = excluded.occasion
    where pb.awarded_by = 'auto'
      and (pb.badge_name, pb.season_year, pb.event_id, pb.festival_id, pb.occasion)
          is distinct from
          (excluded.badge_name, excluded.season_year, excluded.event_id, excluded.festival_id, excluded.occasion)
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted) into v_awarded, v_updated from up;

  with del as (
    delete from public.player_badges pb
    where pb.awarded_by = 'auto'
      and not exists (select 1 from _bq q where q.player_id = pb.player_id and q.badge_key = pb.badge_key)
    returning 1
  )
  select count(*) into v_removed from del;

  return jsonb_build_object('awarded', v_awarded, 'updated', v_updated, 'removed', v_removed,
                            'total', (select count(*) from public.player_badges));
end;
$$;

revoke execute on function public.award_badges() from public, anon, authenticated;
grant execute on function public.award_badges() to service_role;

revoke execute on function public.award_badges() from public, anon, authenticated;
grant execute on function public.award_badges() to service_role;

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
            when 'final_tables' then n.final_tables
            when 'seasons' then n.seasons
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

commit;

-- Recalculate now: festival leaderboard awards are removed, Series No.1 awards added.
select public.award_badges();
