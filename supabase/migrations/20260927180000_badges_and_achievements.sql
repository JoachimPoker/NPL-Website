-- Badges and achievements, split in two.
--
--   Badges       = titles, earned each time you win something: "GUKPT Winner" (the series'
--                  Main Event, or any tournament for single-event series), NPL/HRL/LRL
--                  champion and podium per season, High Roller wins, festival leaderboard
--                  wins, and hand-awarded specials. Repeat wins are separate awards
--                  ("series_gukpt@<event id>") with the occasion stored for display.
--   Achievements = number milestones in four levels (bronze / silver / gold / legendary),
--                  thresholds editable in admin (condition_value.min).
--
-- Series title badges are created automatically for every series (except the "others"
-- catch-all) the first time award_badges() runs after the series exists.
-- Existing awards are copied to archived_player_badges before everything is recalculated.

-- 1. Schema -----------------------------------------------------------------------------

alter table public.badge_definitions
  add column if not exists kind text not null default 'achievement',
  add column if not exists series_id integer references public.series(id) on delete cascade;

alter table public.badge_definitions drop constraint if exists badge_definitions_kind_check;
alter table public.badge_definitions
  add constraint badge_definitions_kind_check check (kind in ('badge', 'achievement'));

create unique index if not exists badge_definitions_series_uq
  on public.badge_definitions (series_id) where series_id is not null;

alter table public.badge_definitions drop constraint if exists badge_definitions_condition_type_check;
alter table public.badge_definitions add constraint badge_definitions_condition_type_check check (condition_type in (
  -- achievements
  'wins', 'cashes', 'final_tables', 'events_played', 'money', 'biggest_cash', 'points', 'venues',
  'series_won', 'festivals', 'hr_cashes', 'online_cashes', 'seasons', 'season_cashes', 'npl_top10_count',
  -- badges
  'series_title', 'season_rank_npl', 'season_rank_hr', 'season_rank_lrl', 'high_roller_win', 'festival_champion', 'special',
  -- retired (kept so old rows stay valid)
  'main_event_win', 'big_field_win', 'series_wins', 'season_superlative', 'alltime_leader'
));

alter table public.player_badges
  add column if not exists event_id bigint references public.events(id) on delete set null,
  add column if not exists festival_id uuid references public.festivals(id) on delete set null,
  add column if not exists occasion text;

comment on column public.player_badges.occasion is 'Where a title was won, e.g. "GUKPT Luton · Aug 2026" or "2nd · 2025".';

-- A festival's Main Event can be set by hand in admin; otherwise it is detected.
alter table public.festivals
  add column if not exists main_event_id bigint references public.events(id) on delete set null;

create or replace view public.festival_summary with (security_invoker = on) as
 SELECT f.id,
    f.label,
    f.season_id,
    f.series_id,
    f.casino,
    f.city,
    f.start_date,
    f.end_date,
    t.events,
    t.entries,
    t.paid_out,
    m.id AS main_event_id,
    m.name AS main_event_name,
    m.winner_id AS main_event_winner_id,
    m.winner_name AS main_event_winner,
    m.winner_prize AS main_event_prize
   FROM ((public.festivals f
     JOIN LATERAL ( SELECT count(*) AS events,
            sum(es.entries) AS entries,
            sum(es.paid_out) AS paid_out
           FROM public.event_summary es
          WHERE (es.festival_id = f.id)) t ON ((t.events > 0)))
     LEFT JOIN LATERAL ( SELECT es.id,
            es.name,
            es.winner_id,
            es.winner_name,
            es.winner_prize
           FROM public.event_summary es
          WHERE (es.festival_id = f.id)
          ORDER BY coalesce(es.id = f.main_event_id, false) DESC,
                   ((es.name ~* '\mmain event\M'::text) AND (es.name !~* '\mmini\M'::text)) DESC,
                   es.paid_out DESC
         LIMIT 1) m ON (true));

-- 2. Archive the current awards --------------------------------------------------------

insert into public.archived_player_badges (player_id, badge_key, player_name, awarded_at)
select pb.player_id, pb.badge_key, concat_ws(' ', p.forename, p.surname), pb.awarded_at
from public.player_badges pb
join public.players p on p.id = pb.player_id;

-- 3. Definitions -----------------------------------------------------------------------

-- Achievements: four levels each. Existing keys are reused where the meaning is the same.
insert into public.badge_definitions
  (key, name, description, icon, tier, category, condition_type, condition_value, kind, display_order, is_active)
values
  ('cash_10',  'Regular Casher', 'Cash 10 times.',  'coins', 'bronze', 'Cashes', 'cashes', '{"min":10}',  'achievement', 100, true),
  ('cash_25',  'Cash Machine',   'Cash 25 times.',  'coins', 'silver', 'Cashes', 'cashes', '{"min":25}',  'achievement', 101, true),
  ('cash_50',  'Money Maker',    'Cash 50 times.',  'coins', 'gold',   'Cashes', 'cashes', '{"min":50}',  'achievement', 102, true),
  ('cash_100', 'Centurion',      'Cash 100 times.', 'coins', 'purple', 'Cashes', 'cashes', '{"min":100}', 'achievement', 103, true),

  ('win_1',  'First Blood',   'Win a tournament.',   'trophy', 'bronze', 'Wins', 'wins', '{"min":1}',  'achievement', 110, true),
  ('win_3',  'Hat-trick',     'Win 3 tournaments.',  'trophy', 'silver', 'Wins', 'wins', '{"min":3}',  'achievement', 111, true),
  ('win_5',  'Serial Winner', 'Win 5 tournaments.',  'trophy', 'gold',   'Wins', 'wins', '{"min":5}',  'achievement', 112, true),
  ('win_10', 'Dominator',     'Win 10 tournaments.', 'trophy', 'purple', 'Wins', 'wins', '{"min":10}', 'achievement', 113, true),

  ('ft_5',  'Table Regular',    'Make 5 final tables.',  'target', 'bronze', 'Final tables', 'final_tables', '{"min":5}',  'achievement', 120, true),
  ('ft_15', 'FT Specialist',    'Make 15 final tables.', 'target', 'silver', 'Final tables', 'final_tables', '{"min":15}', 'achievement', 121, true),
  ('ft_30', 'FT Legend',        'Make 30 final tables.', 'target', 'gold',   'Final tables', 'final_tables', '{"min":30}', 'achievement', 122, true),
  ('ft_50', 'FT Hall of Famer', 'Make 50 final tables.', 'target', 'purple', 'Final tables', 'final_tables', '{"min":50}', 'achievement', 123, true),

  ('money_10k',  '£10,000 Club',  'Win £10,000 in total.',  'gem', 'bronze', 'Career winnings', 'money', '{"min":10000}',  'achievement', 130, true),
  ('money_50k',  '£50,000 Club',  'Win £50,000 in total.',  'gem', 'silver', 'Career winnings', 'money', '{"min":50000}',  'achievement', 131, true),
  ('money_100k', '£100,000 Club', 'Win £100,000 in total.', 'gem', 'gold',   'Career winnings', 'money', '{"min":100000}', 'achievement', 132, true),
  ('money_250k', '£250,000 Club', 'Win £250,000 in total.', 'gem', 'purple', 'Career winnings', 'money', '{"min":250000}', 'achievement', 133, true),

  ('big_cash_5k',   'Big Score',     'Win £5,000 in one tournament.',   'sparkles', 'bronze', 'Biggest cash', 'biggest_cash', '{"min":5000}',   'achievement', 140, true),
  ('big_cash_25k',  'Huge Score',    'Win £25,000 in one tournament.',  'sparkles', 'silver', 'Biggest cash', 'biggest_cash', '{"min":25000}',  'achievement', 141, true),
  ('big_cash_100k', 'Massive Score', 'Win £100,000 in one tournament.', 'sparkles', 'gold',   'Biggest cash', 'biggest_cash', '{"min":100000}', 'achievement', 142, true),
  ('big_cash_250k', 'Life Changer',  'Win £250,000 in one tournament.', 'sparkles', 'purple', 'Biggest cash', 'biggest_cash', '{"min":250000}', 'achievement', 143, true),

  ('points_250',  'Points Scorer',    'Score 250 league points in your career.',   'star', 'bronze', 'League points', 'points', '{"min":250}',  'achievement', 150, true),
  ('points_500',  'Points Collector', 'Score 500 league points in your career.',   'star', 'silver', 'League points', 'points', '{"min":500}',  'achievement', 151, true),
  ('points_1000', 'Points Machine',   'Score 1,000 league points in your career.', 'star', 'gold',   'League points', 'points', '{"min":1000}', 'achievement', 152, true),
  ('points_2000', 'Points Legend',    'Score 2,000 league points in your career.', 'star', 'purple', 'League points', 'points', '{"min":2000}', 'achievement', 153, true),

  ('venues_3',  'Day Tripper',  'Cash at 3 different venues.',  'map', 'bronze', 'Venues', 'venues', '{"min":3}',  'achievement', 160, true),
  ('venues_5',  'Tourist',      'Cash at 5 different venues.',  'map', 'silver', 'Venues', 'venues', '{"min":5}',  'achievement', 161, true),
  ('venues_10', 'Globetrotter', 'Cash at 10 different venues.', 'map', 'gold',   'Venues', 'venues', '{"min":10}', 'achievement', 162, true),
  ('venues_15', 'Road Warrior', 'Cash at 15 different venues.', 'map', 'purple', 'Venues', 'venues', '{"min":15}', 'achievement', 163, true),

  ('series_won_2', 'Versatile',     'Win tournaments in 2 different series.', 'swords', 'bronze', 'Series won', 'series_won', '{"min":2}', 'achievement', 170, true),
  ('series_won_3', 'All-Rounder',   'Win tournaments in 3 different series.', 'swords', 'silver', 'Series won', 'series_won', '{"min":3}', 'achievement', 171, true),
  ('series_won_5', 'Series Hunter', 'Win tournaments in 5 different series.', 'swords', 'gold',   'Series won', 'series_won', '{"min":5}', 'achievement', 172, true),
  ('series_won_8', 'Grand Slam',    'Win tournaments in 8 different series.', 'swords', 'purple', 'Series won', 'series_won', '{"min":8}', 'achievement', 173, true),

  ('festivals_5',  'Festival Goer',    'Cash in 5 different festivals.',  'calendar', 'bronze', 'Festivals', 'festivals', '{"min":5}',  'achievement', 180, true),
  ('festivals_10', 'Festival Regular', 'Cash in 10 different festivals.', 'calendar', 'silver', 'Festivals', 'festivals', '{"min":10}', 'achievement', 181, true),
  ('festivals_20', 'Festival Veteran', 'Cash in 20 different festivals.', 'calendar', 'gold',   'Festivals', 'festivals', '{"min":20}', 'achievement', 182, true),
  ('festivals_40', 'Festival Legend',  'Cash in 40 different festivals.', 'calendar', 'purple', 'Festivals', 'festivals', '{"min":40}', 'achievement', 183, true),

  ('hr_cash_1',  'High Roller',        'Cash in a High Roller.',      'crown', 'bronze', 'High Roller', 'hr_cashes', '{"min":1}',  'achievement', 190, true),
  ('hr_cash_5',  'High Stakes',        'Cash in 5 High Rollers.',     'crown', 'silver', 'High Roller', 'hr_cashes', '{"min":5}',  'achievement', 191, true),
  ('hr_cash_10', 'High Stakes Pro',    'Cash in 10 High Rollers.',    'crown', 'gold',   'High Roller', 'hr_cashes', '{"min":10}', 'achievement', 192, true),
  ('hr_cash_25', 'High Stakes Legend', 'Cash in 25 High Rollers.',    'crown', 'purple', 'High Roller', 'hr_cashes', '{"min":25}', 'achievement', 193, true),

  ('online_1',  'Online Closer',  'Cash in an online closer.',     'zap', 'bronze', 'Online closers', 'online_cashes', '{"min":1}',  'achievement', 200, true),
  ('online_5',  'Closer Regular', 'Cash in 5 online closers.',     'zap', 'silver', 'Online closers', 'online_cashes', '{"min":5}',  'achievement', 201, true),
  ('online_10', 'Closer Pro',     'Cash in 10 online closers.',    'zap', 'gold',   'Online closers', 'online_cashes', '{"min":10}', 'achievement', 202, true),
  ('online_20', 'Closer Legend',  'Cash in 20 online closers.',    'zap', 'purple', 'Online closers', 'online_cashes', '{"min":20}', 'achievement', 203, true),

  ('seasons_2', 'Returning Player', 'Cash in 2 different seasons.', 'shield', 'bronze', 'Seasons played', 'seasons', '{"min":2}', 'achievement', 210, true),
  ('seasons_3', 'Veteran',          'Cash in 3 different seasons.', 'shield', 'silver', 'Seasons played', 'seasons', '{"min":3}', 'achievement', 211, true),
  ('seasons_4', 'Stalwart',         'Cash in 4 different seasons.', 'shield', 'gold',   'Seasons played', 'seasons', '{"min":4}', 'achievement', 212, true),
  ('seasons_5', 'Lifer',            'Cash in 5 different seasons.', 'shield', 'purple', 'Seasons played', 'seasons', '{"min":5}', 'achievement', 213, true),

  ('season_cash_10', 'Busy Season', 'Cash 10 times in one season.', 'flame', 'bronze', 'Cashes in a season', 'season_cashes', '{"min":10}', 'achievement', 220, true),
  ('season_cash_20', 'Grinder',     'Cash 20 times in one season.', 'flame', 'silver', 'Cashes in a season', 'season_cashes', '{"min":20}', 'achievement', 221, true),
  ('season_cash_30', 'Ironman',     'Cash 30 times in one season.', 'flame', 'gold',   'Cashes in a season', 'season_cashes', '{"min":30}', 'achievement', 222, true),
  ('season_cash_40', 'Relentless',  'Cash 40 times in one season.', 'flame', 'purple', 'Cashes in a season', 'season_cashes', '{"min":40}', 'achievement', 223, true),

  ('npl_top10_1', 'Top 10 Finisher', 'Finish a season in the NPL top 10.',  'medal', 'bronze', 'NPL top 10', 'npl_top10_count', '{"min":1}', 'achievement', 230, true),
  ('npl_top10_2', 'Top 10 Regular',  'Finish 2 seasons in the NPL top 10.', 'medal', 'silver', 'NPL top 10', 'npl_top10_count', '{"min":2}', 'achievement', 231, true),
  ('npl_top10_3', 'Top 10 Fixture',  'Finish 3 seasons in the NPL top 10.', 'medal', 'gold',   'NPL top 10', 'npl_top10_count', '{"min":3}', 'achievement', 232, true),
  ('npl_top10_5', 'Top 10 Legend',   'Finish 5 seasons in the NPL top 10.', 'medal', 'purple', 'NPL top 10', 'npl_top10_count', '{"min":5}', 'achievement', 233, true),

  -- Badges: league titles (champion = 1st, podium = 2nd or 3rd), per finished season.
  ('npl_champion', 'NPL Champion',          'Win the National Poker League season.', 'crown', 'purple', 'League titles', 'season_rank_npl', '{"min_rank":1,"max_rank":1}', 'badge', 10, true),
  ('npl_podium',   'NPL Podium',            'Finish 2nd or 3rd in the National Poker League.', 'medal', 'gold', 'League titles', 'season_rank_npl', '{"min_rank":2,"max_rank":3}', 'badge', 11, true),
  ('hrl_champion', 'High Roller Champion',  'Win the High Roller League season.', 'crown', 'purple', 'League titles', 'season_rank_hr', '{"min_rank":1,"max_rank":1}', 'badge', 12, true),
  ('hrl_podium',   'High Roller Podium',    'Finish 2nd or 3rd in the High Roller League.', 'medal', 'gold', 'League titles', 'season_rank_hr', '{"min_rank":2,"max_rank":3}', 'badge', 13, true),
  ('lrl_champion', 'Low Roller Champion',   'Win the Low Roller League season.', 'crown', 'purple', 'League titles', 'season_rank_lrl', '{"min_rank":1,"max_rank":1}', 'badge', 14, true),
  ('lrl_podium',   'Low Roller Podium',     'Finish 2nd or 3rd in the Low Roller League.', 'medal', 'gold', 'League titles', 'season_rank_lrl', '{"min_rank":2,"max_rank":3}', 'badge', 15, true),

  -- Badges: other titles.
  ('high_roller_win',   'High Roller Winner',          'Win a High Roller event.',   'crown',  'gold', 'Other titles', 'high_roller_win',   '{}', 'badge', 300, true),
  ('festival_champion', 'Festival Leaderboard Winner', 'Top a festival leaderboard.', 'star',   'gold', 'Other titles', 'festival_champion', '{}', 'badge', 301, true),
  ('player_of_month',   'Player of the Month',         'Awarded by hand.',            'award',  'gold', 'Special',      'special',           '{}', 'badge', 400, true)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon, tier = excluded.tier,
  category = excluded.category, condition_type = excluded.condition_type, condition_value = excluded.condition_value,
  kind = excluded.kind, display_order = excluded.display_order, is_active = true, updated_at = now();

-- Retired: replaced by series titles and the new achievement ladders.
update public.badge_definitions set is_active = false, updated_at = now()
where key in ('main_event_win', 'big_field_win', 'series_wins_3', 'npl_top10', 'ft_1', 'money_1k');

-- 4. The award engine -------------------------------------------------------------------

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

  -- Festival leaderboard winners, one per festival.
  create temp table _btop on commit drop as
  select distinct on (festival_id) festival_id, player_id
  from (select festival_id, player_id, sum(pts) as p from _br where festival_id is not null group by festival_id, player_id) x
  order by festival_id, p desc, player_id;

  insert into _bq
  select t.player_id, d.key || '@' || t.festival_id, d.name, se.year, null, t.festival_id, f.label
  from public.badge_definitions d
  cross join _btop t
  join public.festivals f on f.id = t.festival_id
  left join public.seasons se on se.id = f.season_id
  where d.is_active and d.condition_type = 'festival_champion';

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

-- 5. Recalculate everything now ---------------------------------------------------------
select public.award_badges();
