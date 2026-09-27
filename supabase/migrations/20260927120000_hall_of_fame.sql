-- Hall of Fame: season podiums for every league, and all-time records.
-- Read-only, public, run with the caller's permissions; names masked without GDPR consent.

begin;

-- Top 3 of every league in every season (the active season shows current leaders).
create or replace function public.hall_of_fame_podiums()
returns table (
  season_id integer, season_name text, year integer, is_active boolean,
  league_slug text, league_label text, "position" bigint,
  player_id bigint, display_name text, total_points numeric
)
language sql
stable
set search_path = ''
as $$
  select se.id, se.name, se.year, coalesce(se.is_active, false),
         l.slug, l.label, st."position", st.player_id, st.display_name, st.total_points
  from public.seasons se
  join public.leagues l on l.season_id = se.id
  cross join lateral public.league_standings(l.id) st
  where st."position" <= 3
  order by se.year desc,
           case l.slug when 'npl' then 1 when 'hrl' then 2 when 'lrl' then 3 else 4 end,
           st."position";
$$;

-- All-time records, top p_limit per record.
create or replace function public.hall_of_fame_records(p_limit integer default 5)
returns table (
  record text, rank bigint, player_id bigint, display_name text,
  value numeric, detail text, event_id bigint
)
language sql
stable
set search_path = ''
as $$
  with res as (
    select r.player_id, r.event_id, r.finish_position, r.prize_amount, e.tournament_name, e.start_date
    from public.results r
    join public.events e on e.id = r.event_id
    where not r.is_deleted and not e.is_deleted and r.player_id is not null
  ),
  per_player as (
    select player_id,
           count(*) filter (where finish_position = 1) as wins,
           count(*) filter (where finish_position <= 9) as final_tables,
           count(*)                                    as cashes,
           coalesce(sum(prize_amount), 0)              as money
    from res group by player_id
  ),
  main_events as (
    select main_event_winner_id as player_id, count(*) as n
    from public.festival_summary where main_event_winner_id is not null
    group by main_event_winner_id
  ),
  metrics as (
    select 'most_wins' as record, player_id, wins::numeric as value, null::text as detail, null::bigint as event_id from per_player where wins > 0
    union all
    select 'most_final_tables', player_id, final_tables, null, null from per_player where final_tables > 0
    union all
    select 'most_cashes', player_id, cashes, null, null from per_player
    union all
    select 'most_money', player_id, money, null, null from per_player where money > 0
    union all
    select 'most_main_events', player_id, n, null, null from main_events
    union all
    select 'most_badges', p.id, p.badge_count, null, null from public.players p where coalesce(p.badge_count, 0) > 0
    union all
    select 'biggest_cash', player_id, prize_amount,
           tournament_name || ' · ' || to_char(start_date, 'Mon YYYY'), event_id
    from res where prize_amount > 0
  ),
  ranked as (
    select m.*, row_number() over (partition by m.record order by m.value desc, m.player_id) as rank
    from metrics m
  )
  select k.record, k.rank, k.player_id,
         public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr),
         k.value, k.detail, k.event_id
  from ranked k
  join public.players p on p.id = k.player_id
  where k.rank <= p_limit
  order by k.record, k.rank;
$$;

grant execute on function public.hall_of_fame_podiums() to anon, authenticated, service_role;
grant execute on function public.hall_of_fame_records(integer) to anon, authenticated, service_role;

commit;
