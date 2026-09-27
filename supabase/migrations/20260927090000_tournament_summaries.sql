-- Read-only summaries for the public Tournaments pages: one row per event (entries, prize money
-- paid, winner) and one per festival (totals + its Main Event). Views run with the caller's
-- permissions (security_invoker), so the normal public-read RLS applies and player names are
-- masked by display_name_for() when there's no GDPR consent.

create or replace view public.event_summary with (security_invoker = on) as
select
  e.id,
  e.season_id,
  e.series_id,
  e.festival_id,
  e.tournament_name as name,
  e.casino,
  e.start_date,
  e.buy_in,
  e.is_high_roller,
  coalesce(r.entries, 0)    as entries,
  coalesce(r.paid_out, 0)   as paid_out,
  w.player_id               as winner_id,
  w.winner_name,
  w.points                  as winner_points,
  w.prize_amount            as winner_prize
from public.events e
left join lateral (
  select count(*) as entries, sum(x.prize_amount) as paid_out
  from public.results x
  where x.event_id = e.id and not x.is_deleted
) r on true
left join lateral (
  select x.player_id, x.points, x.prize_amount,
         public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr) as winner_name
  from public.results x
  join public.players p on p.id = x.player_id
  where x.event_id = e.id and not x.is_deleted and x.finish_position = 1
  order by x.points desc
  limit 1
) w on true
where not e.is_deleted;

create or replace view public.festival_summary with (security_invoker = on) as
select
  f.id,
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
  m.id          as main_event_id,
  m.name        as main_event_name,
  m.winner_id   as main_event_winner_id,
  m.winner_name as main_event_winner,
  m.winner_prize as main_event_prize
from public.festivals f
join lateral (
  select count(*) as events, sum(es.entries) as entries, sum(es.paid_out) as paid_out
  from public.event_summary es where es.festival_id = f.id
) t on t.events > 0
left join lateral (
  -- The festival's Main Event: named "Main Event" (not a Mini Main), else the biggest prize pool.
  select es.id, es.name, es.winner_id, es.winner_name, es.winner_prize
  from public.event_summary es
  where es.festival_id = f.id
  order by (es.name ~* '\mmain event\M' and es.name !~* '\mmini\M') desc, es.paid_out desc
  limit 1
) m on true;

grant select on public.event_summary, public.festival_summary to anon, authenticated, service_role;
