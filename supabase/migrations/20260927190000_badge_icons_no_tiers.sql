-- Badges (titles) get their own icon each and no tier; tiers are for achievements only.
-- The tier column stays (it's required), set to one value for every badge so they all
-- share the same medal.

update public.badge_definitions b set icon = v.icon, tier = 'gold', updated_at = now()
from (values
  ('npl_champion',           'crown'),
  ('npl_podium',             'medal'),
  ('hrl_champion',           'gem'),
  ('hrl_podium',             'diamond'),
  ('lrl_champion',           'shield'),
  ('lrl_podium',             'shield-check'),
  ('series_g200',            'spade'),
  ('series_g300',            'club'),
  ('series_25_50',           'dice'),
  ('series_mini_fest',       'sparkles'),
  ('series_gukpt',           'trophy'),
  ('series_ukpl',            'landmark'),
  ('series_888poker_live',   'zap'),
  ('series_goliath',         'mountain'),
  ('series_uk_open',         'flag'),
  ('series_behemoth',        'flame'),
  ('series_season_specials', 'gift'),
  ('high_roller_win',        'coins'),
  ('festival_champion',      'star'),
  ('player_of_month',        'calendar')
) as v(key, icon)
where b.key = v.key;

-- Any other badge (e.g. added later) keeps its icon but loses its tier too.
update public.badge_definitions set tier = 'gold', updated_at = now()
where kind = 'badge' and tier <> 'gold';
