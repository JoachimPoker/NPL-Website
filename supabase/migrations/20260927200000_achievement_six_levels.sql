-- Achievements get six levels: Bronze, Silver, Gold, Emerald, Diamond, Legendary.
-- (Legendary is stored as 'purple', as before.) Existing keys keep their threshold; two new,
-- harder levels are added per ladder. Thresholds stay editable in admin.

alter table public.badge_definitions drop constraint if exists badge_definitions_tier_check;
alter table public.badge_definitions add constraint badge_definitions_tier_check
  check (tier in ('bronze', 'silver', 'gold', 'emerald', 'diamond', 'purple'));

insert into public.badge_definitions
  (key, name, description, icon, tier, category, condition_type, condition_value, kind, display_order, is_active)
values
  ('cash_10',  'Regular Casher', 'Cash 10 times.',  'coins', 'bronze',  'Cashes', 'cashes', '{"min":10}',  'achievement', 100, true),
  ('cash_25',  'Cash Machine',   'Cash 25 times.',  'coins', 'silver',  'Cashes', 'cashes', '{"min":25}',  'achievement', 101, true),
  ('cash_50',  'Money Maker',    'Cash 50 times.',  'coins', 'gold',    'Cashes', 'cashes', '{"min":50}',  'achievement', 102, true),
  ('cash_100', 'Centurion',      'Cash 100 times.', 'coins', 'emerald', 'Cashes', 'cashes', '{"min":100}', 'achievement', 103, true),
  ('cash_150', 'Cash King',      'Cash 150 times.', 'coins', 'diamond', 'Cashes', 'cashes', '{"min":150}', 'achievement', 104, true),
  ('cash_250', 'Cash Legend',    'Cash 250 times.', 'coins', 'purple',  'Cashes', 'cashes', '{"min":250}', 'achievement', 105, true),

  ('win_1',  'First Blood',    'Win a tournament.',   'trophy', 'bronze',  'Wins', 'wins', '{"min":1}',  'achievement', 110, true),
  ('win_3',  'Hat-trick',      'Win 3 tournaments.',  'trophy', 'silver',  'Wins', 'wins', '{"min":3}',  'achievement', 111, true),
  ('win_5',  'Serial Winner',  'Win 5 tournaments.',  'trophy', 'gold',    'Wins', 'wins', '{"min":5}',  'achievement', 112, true),
  ('win_10', 'Dominator',      'Win 10 tournaments.', 'trophy', 'emerald', 'Wins', 'wins', '{"min":10}', 'achievement', 113, true),
  ('win_15', 'Unstoppable',    'Win 15 tournaments.', 'trophy', 'diamond', 'Wins', 'wins', '{"min":15}', 'achievement', 114, true),
  ('win_25', 'Winning Legend', 'Win 25 tournaments.', 'trophy', 'purple',  'Wins', 'wins', '{"min":25}', 'achievement', 115, true),

  ('ft_5',   'Table Regular',    'Make 5 final tables.',   'target', 'bronze',  'Final tables', 'final_tables', '{"min":5}',   'achievement', 120, true),
  ('ft_15',  'FT Specialist',    'Make 15 final tables.',  'target', 'silver',  'Final tables', 'final_tables', '{"min":15}',  'achievement', 121, true),
  ('ft_30',  'FT Veteran',       'Make 30 final tables.',  'target', 'gold',    'Final tables', 'final_tables', '{"min":30}',  'achievement', 122, true),
  ('ft_50',  'FT Master',        'Make 50 final tables.',  'target', 'emerald', 'Final tables', 'final_tables', '{"min":50}',  'achievement', 123, true),
  ('ft_75',  'FT Hall of Famer', 'Make 75 final tables.',  'target', 'diamond', 'Final tables', 'final_tables', '{"min":75}',  'achievement', 124, true),
  ('ft_100', 'FT Legend',        'Make 100 final tables.', 'target', 'purple',  'Final tables', 'final_tables', '{"min":100}', 'achievement', 125, true),

  ('money_10k',  '£10,000 Club',  'Win £10,000 in total.',    'gem', 'bronze',  'Career winnings', 'money', '{"min":10000}',   'achievement', 130, true),
  ('money_50k',  '£50,000 Club',  'Win £50,000 in total.',    'gem', 'silver',  'Career winnings', 'money', '{"min":50000}',   'achievement', 131, true),
  ('money_100k', '£100,000 Club', 'Win £100,000 in total.',   'gem', 'gold',    'Career winnings', 'money', '{"min":100000}',  'achievement', 132, true),
  ('money_250k', '£250,000 Club', 'Win £250,000 in total.',   'gem', 'emerald', 'Career winnings', 'money', '{"min":250000}',  'achievement', 133, true),
  ('money_500k', '£500,000 Club', 'Win £500,000 in total.',   'gem', 'diamond', 'Career winnings', 'money', '{"min":500000}',  'achievement', 134, true),
  ('money_1m',   'Millionaire',   'Win £1,000,000 in total.', 'gem', 'purple',  'Career winnings', 'money', '{"min":1000000}', 'achievement', 135, true),

  ('big_cash_5k',   'Big Score',     'Win £5,000 in one tournament.',   'sparkles', 'bronze',  'Biggest cash', 'biggest_cash', '{"min":5000}',   'achievement', 140, true),
  ('big_cash_10k',  'Big Hit',       'Win £10,000 in one tournament.',  'sparkles', 'silver',  'Biggest cash', 'biggest_cash', '{"min":10000}',  'achievement', 141, true),
  ('big_cash_25k',  'Huge Score',    'Win £25,000 in one tournament.',  'sparkles', 'gold',    'Biggest cash', 'biggest_cash', '{"min":25000}',  'achievement', 142, true),
  ('big_cash_50k',  'Monster Score', 'Win £50,000 in one tournament.',  'sparkles', 'emerald', 'Biggest cash', 'biggest_cash', '{"min":50000}',  'achievement', 143, true),
  ('big_cash_100k', 'Massive Score', 'Win £100,000 in one tournament.', 'sparkles', 'diamond', 'Biggest cash', 'biggest_cash', '{"min":100000}', 'achievement', 144, true),
  ('big_cash_250k', 'Life Changer',  'Win £250,000 in one tournament.', 'sparkles', 'purple',  'Biggest cash', 'biggest_cash', '{"min":250000}', 'achievement', 145, true),

  ('points_250',  'Points Scorer',    'Score 250 league points in your career.',   'star', 'bronze',  'League points', 'points', '{"min":250}',  'achievement', 150, true),
  ('points_500',  'Points Collector', 'Score 500 league points in your career.',   'star', 'silver',  'League points', 'points', '{"min":500}',  'achievement', 151, true),
  ('points_1000', 'Points Machine',   'Score 1,000 league points in your career.', 'star', 'gold',    'League points', 'points', '{"min":1000}', 'achievement', 152, true),
  ('points_2000', 'Points Master',    'Score 2,000 league points in your career.', 'star', 'emerald', 'League points', 'points', '{"min":2000}', 'achievement', 153, true),
  ('points_3000', 'Points Hoarder',   'Score 3,000 league points in your career.', 'star', 'diamond', 'League points', 'points', '{"min":3000}', 'achievement', 154, true),
  ('points_5000', 'Points Legend',    'Score 5,000 league points in your career.', 'star', 'purple',  'League points', 'points', '{"min":5000}', 'achievement', 155, true),

  ('venues_3',  'Day Tripper',  'Cash at 3 different venues.',  'map', 'bronze',  'Venues', 'venues', '{"min":3}',  'achievement', 160, true),
  ('venues_5',  'Tourist',      'Cash at 5 different venues.',  'map', 'silver',  'Venues', 'venues', '{"min":5}',  'achievement', 161, true),
  ('venues_10', 'Globetrotter', 'Cash at 10 different venues.', 'map', 'gold',    'Venues', 'venues', '{"min":10}', 'achievement', 162, true),
  ('venues_15', 'Road Warrior', 'Cash at 15 different venues.', 'map', 'emerald', 'Venues', 'venues', '{"min":15}', 'achievement', 163, true),
  ('venues_20', 'Nomad',        'Cash at 20 different venues.', 'map', 'diamond', 'Venues', 'venues', '{"min":20}', 'achievement', 164, true),
  ('venues_25', 'Grand Tourer', 'Cash at 25 different venues.', 'map', 'purple',  'Venues', 'venues', '{"min":25}', 'achievement', 165, true),

  ('series_won_2', 'Versatile',     'Win tournaments in 2 different series.', 'swords', 'bronze',  'Series won', 'series_won', '{"min":2}', 'achievement', 170, true),
  ('series_won_3', 'All-Rounder',   'Win tournaments in 3 different series.', 'swords', 'silver',  'Series won', 'series_won', '{"min":3}', 'achievement', 171, true),
  ('series_won_4', 'Multi-Talent',  'Win tournaments in 4 different series.', 'swords', 'gold',    'Series won', 'series_won', '{"min":4}', 'achievement', 172, true),
  ('series_won_5', 'Series Hunter', 'Win tournaments in 5 different series.', 'swords', 'emerald', 'Series won', 'series_won', '{"min":5}', 'achievement', 173, true),
  ('series_won_6', 'Series Master', 'Win tournaments in 6 different series.', 'swords', 'diamond', 'Series won', 'series_won', '{"min":6}', 'achievement', 174, true),
  ('series_won_8', 'Grand Slam',    'Win tournaments in 8 different series.', 'swords', 'purple',  'Series won', 'series_won', '{"min":8}', 'achievement', 175, true),

  ('festivals_5',  'Festival Goer',    'Cash in 5 different festivals.',  'calendar', 'bronze',  'Festivals', 'festivals', '{"min":5}',  'achievement', 180, true),
  ('festivals_10', 'Festival Regular', 'Cash in 10 different festivals.', 'calendar', 'silver',  'Festivals', 'festivals', '{"min":10}', 'achievement', 181, true),
  ('festivals_20', 'Festival Veteran', 'Cash in 20 different festivals.', 'calendar', 'gold',    'Festivals', 'festivals', '{"min":20}', 'achievement', 182, true),
  ('festivals_40', 'Festival Addict',  'Cash in 40 different festivals.', 'calendar', 'emerald', 'Festivals', 'festivals', '{"min":40}', 'achievement', 183, true),
  ('festivals_60', 'Festival Icon',    'Cash in 60 different festivals.', 'calendar', 'diamond', 'Festivals', 'festivals', '{"min":60}', 'achievement', 184, true),
  ('festivals_80', 'Festival Legend',  'Cash in 80 different festivals.', 'calendar', 'purple',  'Festivals', 'festivals', '{"min":80}', 'achievement', 185, true),

  ('hr_cash_1',  'High Roller',        'Cash in a High Roller.',   'crown', 'bronze',  'High Roller', 'hr_cashes', '{"min":1}',  'achievement', 190, true),
  ('hr_cash_5',  'High Stakes',        'Cash in 5 High Rollers.',  'crown', 'silver',  'High Roller', 'hr_cashes', '{"min":5}',  'achievement', 191, true),
  ('hr_cash_10', 'High Stakes Pro',    'Cash in 10 High Rollers.', 'crown', 'gold',    'High Roller', 'hr_cashes', '{"min":10}', 'achievement', 192, true),
  ('hr_cash_25', 'High Stakes Elite',  'Cash in 25 High Rollers.', 'crown', 'emerald', 'High Roller', 'hr_cashes', '{"min":25}', 'achievement', 193, true),
  ('hr_cash_40', 'Whale',              'Cash in 40 High Rollers.', 'crown', 'diamond', 'High Roller', 'hr_cashes', '{"min":40}', 'achievement', 194, true),
  ('hr_cash_60', 'High Stakes Legend', 'Cash in 60 High Rollers.', 'crown', 'purple',  'High Roller', 'hr_cashes', '{"min":60}', 'achievement', 195, true),

  ('online_1',  'Online Closer',  'Cash in an online closer.',  'zap', 'bronze',  'Online closers', 'online_cashes', '{"min":1}',  'achievement', 200, true),
  ('online_5',  'Closer Regular', 'Cash in 5 online closers.',  'zap', 'silver',  'Online closers', 'online_cashes', '{"min":5}',  'achievement', 201, true),
  ('online_10', 'Closer Pro',     'Cash in 10 online closers.', 'zap', 'gold',    'Online closers', 'online_cashes', '{"min":10}', 'achievement', 202, true),
  ('online_20', 'Closer Elite',   'Cash in 20 online closers.', 'zap', 'emerald', 'Online closers', 'online_cashes', '{"min":20}', 'achievement', 203, true),
  ('online_30', 'Closer Master',  'Cash in 30 online closers.', 'zap', 'diamond', 'Online closers', 'online_cashes', '{"min":30}', 'achievement', 204, true),
  ('online_50', 'Closer Legend',  'Cash in 50 online closers.', 'zap', 'purple',  'Online closers', 'online_cashes', '{"min":50}', 'achievement', 205, true),

  ('seasons_2',  'Returning Player', 'Cash in 2 different seasons.',  'shield', 'bronze',  'Seasons played', 'seasons', '{"min":2}',  'achievement', 210, true),
  ('seasons_3',  'Veteran',          'Cash in 3 different seasons.',  'shield', 'silver',  'Seasons played', 'seasons', '{"min":3}',  'achievement', 211, true),
  ('seasons_4',  'Stalwart',         'Cash in 4 different seasons.',  'shield', 'gold',    'Seasons played', 'seasons', '{"min":4}',  'achievement', 212, true),
  ('seasons_5',  'Lifer',            'Cash in 5 different seasons.',  'shield', 'emerald', 'Seasons played', 'seasons', '{"min":5}',  'achievement', 213, true),
  ('seasons_7',  'Institution',      'Cash in 7 different seasons.',  'shield', 'diamond', 'Seasons played', 'seasons', '{"min":7}',  'achievement', 214, true),
  ('seasons_10', 'League Legend',    'Cash in 10 different seasons.', 'shield', 'purple',  'Seasons played', 'seasons', '{"min":10}', 'achievement', 215, true),

  ('season_cash_10', 'Busy Season',   'Cash 10 times in one season.', 'flame', 'bronze',  'Cashes in a season', 'season_cashes', '{"min":10}', 'achievement', 220, true),
  ('season_cash_20', 'Grinder',       'Cash 20 times in one season.', 'flame', 'silver',  'Cashes in a season', 'season_cashes', '{"min":20}', 'achievement', 221, true),
  ('season_cash_30', 'Ironman',       'Cash 30 times in one season.', 'flame', 'gold',    'Cashes in a season', 'season_cashes', '{"min":30}', 'achievement', 222, true),
  ('season_cash_40', 'Relentless',    'Cash 40 times in one season.', 'flame', 'emerald', 'Cashes in a season', 'season_cashes', '{"min":40}', 'achievement', 223, true),
  ('season_cash_50', 'Workhorse',     'Cash 50 times in one season.', 'flame', 'diamond', 'Cashes in a season', 'season_cashes', '{"min":50}', 'achievement', 224, true),
  ('season_cash_60', 'Season Legend', 'Cash 60 times in one season.', 'flame', 'purple',  'Cashes in a season', 'season_cashes', '{"min":60}', 'achievement', 225, true),

  ('npl_top10_1',  'Top 10 Finisher', 'Finish a season in the NPL top 10.',   'medal', 'bronze',  'NPL top 10', 'npl_top10_count', '{"min":1}',  'achievement', 230, true),
  ('npl_top10_2',  'Top 10 Regular',  'Finish 2 seasons in the NPL top 10.',  'medal', 'silver',  'NPL top 10', 'npl_top10_count', '{"min":2}',  'achievement', 231, true),
  ('npl_top10_3',  'Top 10 Fixture',  'Finish 3 seasons in the NPL top 10.',  'medal', 'gold',    'NPL top 10', 'npl_top10_count', '{"min":3}',  'achievement', 232, true),
  ('npl_top10_5',  'Top 10 Mainstay', 'Finish 5 seasons in the NPL top 10.',  'medal', 'emerald', 'NPL top 10', 'npl_top10_count', '{"min":5}',  'achievement', 233, true),
  ('npl_top10_7',  'Top 10 Veteran',  'Finish 7 seasons in the NPL top 10.',  'medal', 'diamond', 'NPL top 10', 'npl_top10_count', '{"min":7}',  'achievement', 234, true),
  ('npl_top10_10', 'Top 10 Legend',   'Finish 10 seasons in the NPL top 10.', 'medal', 'purple',  'NPL top 10', 'npl_top10_count', '{"min":10}', 'achievement', 235, true)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon, tier = excluded.tier,
  category = excluded.category, condition_type = excluded.condition_type, condition_value = excluded.condition_value,
  kind = excluded.kind, display_order = excluded.display_order, is_active = true, updated_at = now();

-- Award the new levels now.
select public.award_badges();
