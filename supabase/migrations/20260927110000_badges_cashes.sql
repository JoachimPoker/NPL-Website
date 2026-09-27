-- Every row in the weekly report is a cash: points are only given for cashing, and online
-- closers pay points but no prize money. So:
--   * "In the Money" (cash in any event) is dropped: everyone in the reports has it.
--   * Cash and venue badges count every result, not only results with prize money.

begin;

delete from public.player_badges where badge_key = 'cash_1';
delete from public.badge_definitions where key = 'cash_1';

update public.badge_definitions set description = 'Win an event where 100 or more players cashed.'
where key = 'big_field_win';

create or replace function public.award_badges()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_awarded integer;
  v_removed integer;
begin
  drop table if exists pg_temp._bq, pg_temp._bs, pg_temp._bev, pg_temp._bme, pg_temp._bft;

  -- Players per event, festival Main Events, and festival leaderboard winners (computed once).
  create temp table _bev on commit drop as
  select event_id, count(*) as n from public.results where not is_deleted group by event_id;

  create temp table _bme on commit drop as
  select main_event_id as id from public.festival_summary where main_event_id is not null;

  create temp table _bft on commit drop as
  select player_id, count(*) as n
  from (
    select distinct on (e.festival_id) e.festival_id, r.player_id
    from public.results r join public.events e on e.id = r.event_id
    where not r.is_deleted and not e.is_deleted and e.festival_id is not null
    group by e.festival_id, r.player_id
    order by e.festival_id, sum(r.points + r.penalty_points) desc, r.player_id
  ) tops
  group by player_id;

  -- Lifetime stats per player.
  create temp table _bs on commit drop as
  select r.player_id,
    count(*) filter (where r.finish_position = 1)                                        as wins,
    count(*)                                                                             as cashes,  -- every report row is a cash (points are only for cashing)
    count(*) filter (where r.finish_position <= 9)                                       as final_tables,
    count(distinct r.event_id)                                                           as events_played,
    coalesce(sum(r.prize_amount), 0)                                                     as money,
    count(distinct e.casino) filter (where e.casino not ilike 'online')                  as venues,
    count(*) filter (where r.finish_position = 1 and e.is_high_roller)                   as high_roller_win,
    count(*) filter (where r.finish_position = 1 and e.id in (select id from _bme))      as main_event_win,
    count(distinct e.series_id) filter (where r.finish_position = 1)                     as series_wins,
    coalesce(max(ev.n) filter (where r.finish_position = 1), 0)                          as biggest_win_field,
    coalesce(max(ft.n), 0)                                                               as festival_champion
  from public.results r
  join public.events e on e.id = r.event_id
  join _bev ev on ev.event_id = r.event_id
  left join _bft ft on ft.player_id = r.player_id
  where not r.is_deleted and not e.is_deleted and r.player_id is not null
  group by r.player_id;

  create temp table _bq (player_id bigint, badge_key text, badge_name text, season_year integer) on commit drop;

  -- Lifetime ladders and achievements.
  insert into _bq
  select s.player_id, d.key, d.name, null
  from public.badge_definitions d
  join _bs s on
    case d.condition_type
      when 'wins'              then s.wins
      when 'cashes'            then s.cashes
      when 'final_tables'      then s.final_tables
      when 'events_played'     then s.events_played
      when 'money'             then s.money
      when 'venues'            then s.venues
      when 'high_roller_win'   then s.high_roller_win
      when 'main_event_win'    then s.main_event_win
      when 'series_wins'       then s.series_wins
      when 'festival_champion' then s.festival_champion
    end >= coalesce((d.condition_value ->> 'min')::numeric, 1)
  where d.is_active and d.condition_type in
    ('wins', 'cashes', 'final_tables', 'events_played', 'money', 'venues',
     'high_roller_win', 'main_event_win', 'series_wins', 'festival_champion');

  insert into _bq
  select s.player_id, d.key, d.name, null
  from public.badge_definitions d
  join _bs s on s.biggest_win_field >= coalesce((d.condition_value ->> 'min_field')::integer, 100)
  where d.is_active and d.condition_type = 'big_field_win';

  -- Season honours, for seasons that have finished.
  insert into _bq
  select st.player_id, d.key || '@' || se.year, d.name || ' ' || se.year, se.year
  from public.badge_definitions d
  join public.seasons se on not coalesce(se.is_active, false)
  join public.leagues l on l.season_id = se.id and l.slug = case d.condition_type
       when 'season_rank_npl' then 'npl' when 'season_rank_hr' then 'hrl' when 'season_rank_lrl' then 'lrl' end
  cross join lateral public.league_standings(l.id) st
  where d.is_active and d.condition_type in ('season_rank_npl', 'season_rank_hr', 'season_rank_lrl')
    and st."position" <= coalesce((d.condition_value ->> 'max_rank')::integer, 1);

  -- Apply: add new automatic badges, remove automatic ones no longer earned.
  with ins as (
    insert into public.player_badges (player_id, badge_key, badge_name, season_year, awarded_by)
    select distinct on (player_id, badge_key) player_id, badge_key, badge_name, season_year, 'auto' from _bq
    on conflict (player_id, badge_key) do nothing
    returning 1
  )
  select count(*) into v_awarded from ins;

  with del as (
    delete from public.player_badges pb
    where pb.awarded_by = 'auto'
      and not exists (select 1 from _bq q where q.player_id = pb.player_id and q.badge_key = pb.badge_key)
    returning 1
  )
  select count(*) into v_removed from del;

  return jsonb_build_object('awarded', v_awarded, 'removed', v_removed,
                            'total', (select count(*) from public.player_badges));
end;
$$;


revoke execute on function public.award_badges() from public, anon, authenticated;
grant execute on function public.award_badges() to service_role;

commit;

select public.award_badges();
