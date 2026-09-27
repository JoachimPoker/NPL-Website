-- Badges & achievements.
-- Catalogue in badge_definitions, awards in player_badges (both existing tables, additive changes).
-- award_badges() recalculates automatic badges from results (run after every import and from admin):
--   * lifetime ladders (wins, cashes, final tables, prize money, venues) and achievements
--   * season honours (NPL / HRL / LRL champion, podium, top 10) for seasons that have finished,
--     stored as "<key>@<year>" so a player can hold e.g. NPL Champion for several seasons
--   * automatic badges a player no longer qualifies for are removed; hand-awarded ones never are.

begin;

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
alter table public.badge_definitions drop constraint if exists badge_definitions_condition_type_check;
alter table public.badge_definitions add constraint badge_definitions_condition_type_check check (condition_type = any (array[
  'wins', 'cashes', 'money', 'final_tables', 'events_played', 'season_rank_npl', 'season_rank_hr',
  'season_superlative', 'alltime_leader', 'special',
  -- added for the website
  'season_rank_lrl', 'venues', 'high_roller_win', 'main_event_win', 'festival_champion', 'big_field_win', 'series_wins'
]));

create index if not exists player_badges_player_idx on public.player_badges (player_id);
create index if not exists player_badges_key_idx on public.player_badges (badge_key);

-- Awards from award_badges() are marked awarded_by = 'auto'; anything else was given by hand.
alter table public.player_badges alter column awarded_by set default 'auto';

-- Keep players.badge_count right on removal too (the old trigger only handled inserts).
create or replace function public.trigger_update_badge_count()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform update_player_badge_count(coalesce(new.player_id, old.player_id)::integer);
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Starter catalogue (edit in Admin -> Badges)
-- ---------------------------------------------------------------------------
insert into public.badge_definitions
  (key, name, description, icon, tier, category, condition_type, condition_value, rarity, display_order)
values
  -- Wins
  ('win_1',  'First Blood',   'Win a league event.',            'trophy', 'bronze', 'Wins', 'wins', '{"min": 1}',  'uncommon',  10),
  ('win_3',  'Hat-trick',     'Win 3 league events.',           'trophy', 'silver', 'Wins', 'wins', '{"min": 3}',  'rare',      11),
  ('win_5',  'Serial Winner', 'Win 5 league events.',           'trophy', 'gold',   'Wins', 'wins', '{"min": 5}',  'epic',      12),
  ('win_10', 'Dominator',     'Win 10 league events.',          'trophy', 'purple', 'Wins', 'wins', '{"min": 10}', 'mythic',    13),
  -- Cashes
  ('cash_1',  'In the Money',   'Cash in a league event.',      'coins', 'bronze', 'Cashes', 'cashes', '{"min": 1}',  'common',   20),
  ('cash_10', 'Regular Casher', 'Cash in 10 league events.',    'coins', 'silver', 'Cashes', 'cashes', '{"min": 10}', 'uncommon', 21),
  ('cash_25', 'Cash Machine',   'Cash in 25 league events.',    'coins', 'gold',   'Cashes', 'cashes', '{"min": 25}', 'rare',     22),
  ('cash_50', 'Money Maker',    'Cash in 50 league events.',    'coins', 'purple', 'Cashes', 'cashes', '{"min": 50}', 'epic',     23),
  -- Final tables (top 9)
  ('ft_1',  'Final Table',     'Reach a final table (top 9).',  'target', 'bronze', 'Final tables', 'final_tables', '{"min": 1}',  'common',    30),
  ('ft_5',  'Table Regular',   'Reach 5 final tables.',         'target', 'silver', 'Final tables', 'final_tables', '{"min": 5}',  'uncommon',  31),
  ('ft_15', 'FT Specialist',   'Reach 15 final tables.',        'target', 'gold',   'Final tables', 'final_tables', '{"min": 15}', 'rare',      32),
  ('ft_30', 'FT Legend',       'Reach 30 final tables.',        'target', 'purple', 'Final tables', 'final_tables', '{"min": 30}', 'legendary', 33),
  -- Prize money
  ('money_1k',   '£1K Club',   'Win £1,000 in league prize money.',   'gem', 'bronze', 'Prize money', 'money', '{"min": 1000}',   'common',    40),
  ('money_10k',  '£10K Club',  'Win £10,000 in league prize money.',  'gem', 'silver', 'Prize money', 'money', '{"min": 10000}',  'uncommon',  41),
  ('money_50k',  '£50K Club',  'Win £50,000 in league prize money.',  'gem', 'gold',   'Prize money', 'money', '{"min": 50000}',  'rare',      42),
  ('money_100k', '£100K Club', 'Win £100,000 in league prize money.', 'gem', 'purple', 'Prize money', 'money', '{"min": 100000}', 'legendary', 43),
  -- Travel
  ('venues_5',  'Tourist',      'Cash at 5 different venues.',  'map', 'bronze', 'Travel', 'venues', '{"min": 5}',  'uncommon', 50),
  ('venues_10', 'Globetrotter', 'Cash at 10 different venues.', 'map', 'silver', 'Travel', 'venues', '{"min": 10}', 'rare',     51),
  -- Achievements
  ('main_event_win',   'Main Event Champion', 'Win a festival Main Event.',                   'crown',    'gold',   'Achievements', 'main_event_win',    '{"min": 1}',          'rare', 60),
  ('high_roller_win',  'High Roller Winner',  'Win a High Roller event.',                     'gem',      'gold',   'Achievements', 'high_roller_win',   '{"min": 1}',          'rare', 61),
  ('festival_champion','Festival King',       'Top a festival leaderboard.',                  'star',     'gold',   'Achievements', 'festival_champion', '{"min": 1}',          'rare', 62),
  ('big_field_win',    'Giant Killer',        'Win an event with 100 or more players.',       'swords',   'purple', 'Achievements', 'big_field_win',     '{"min_field": 100}',  'epic', 63),
  ('series_wins_3',    'All-Rounder',         'Win events in 3 different series.',            'sparkles', 'silver', 'Achievements', 'series_wins',       '{"min": 3}',          'rare', 64),
  -- Season honours (awarded once a season has finished)
  ('npl_champion', 'NPL Champion',          'Finish 1st in the National Poker League.',  'crown',  'purple', 'Season honours', 'season_rank_npl', '{"max_rank": 1}',  'legendary', 70),
  ('npl_podium',   'NPL Podium',            'Finish top 3 in the National Poker League.', 'medal', 'gold',   'Season honours', 'season_rank_npl', '{"max_rank": 3}',  'epic',      71),
  ('npl_top10',    'NPL Top 10',            'Finish top 10 in the National Poker League.', 'shield', 'silver', 'Season honours', 'season_rank_npl', '{"max_rank": 10}', 'rare',      72),
  ('hrl_champion', 'High Roller Champion',  'Win the High Roller League.',               'crown',  'purple', 'Season honours', 'season_rank_hr',  '{"max_rank": 1}',  'legendary', 73),
  ('hrl_podium',   'High Roller Podium',    'Finish top 3 in the High Roller League.',   'medal',  'gold',   'Season honours', 'season_rank_hr',  '{"max_rank": 3}',  'epic',      74),
  ('lrl_champion', 'Low Roller Champion',   'Win the Low Roller League.',                'crown',  'gold',   'Season honours', 'season_rank_lrl', '{"max_rank": 1}',  'legendary', 75),
  ('lrl_podium',   'Low Roller Podium',     'Finish top 3 in the Low Roller League.',    'medal',  'silver', 'Season honours', 'season_rank_lrl', '{"max_rank": 3}',  'epic',      76),
  -- Special (awarded by hand)
  ('player_of_month', 'Player of the Month', 'Chosen by the league as Player of the Month.', 'star', 'gold', 'Special', 'special', '{}', 'rare', 90)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Award engine
-- ---------------------------------------------------------------------------
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
    count(*) filter (where r.prize_amount > 0)                                           as cashes,
    count(*) filter (where r.finish_position <= 9)                                       as final_tables,
    count(distinct r.event_id)                                                           as events_played,
    coalesce(sum(r.prize_amount), 0)                                                     as money,
    count(distinct e.casino) filter (where r.prize_amount > 0 and e.casino not ilike 'online') as venues,
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

-- How many players hold each badge (seasonal awards counted once per player).
create or replace view public.badge_stats with (security_invoker = on) as
select d.key,
       count(distinct pb.player_id) as holders,
       count(pb.id)                 as awards,
       max(pb.awarded_at)           as last_awarded
from public.badge_definitions d
left join public.player_badges pb on split_part(pb.badge_key, '@', 1) = d.key
group by d.key;

grant select on public.badge_stats to anon, authenticated, service_role;

commit;

-- Award everything earned so far.
select public.award_badges();
