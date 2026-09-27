-- Weekly report importer.
-- Each RawPlayerData report is the complete set of results for one season so far, so an
-- import makes the season match the report: new rows are added, changed rows updated and
-- rows no longer in the report soft-deleted (is_deleted = true, restorable).
-- Flow: the website parses the file, stages rows in import_staging, previews with
-- import_season_report(batch, dry_run => true), then applies with dry_run => false.

begin;

-- ---------------------------------------------------------------------------
-- 1. Schema additions
-- ---------------------------------------------------------------------------
-- Admin can pin an event's High Roller flag so imports stop recomputing it from the name.
alter table public.events
  add column if not exists is_high_roller_locked boolean not null default false;

-- Season year the player's details (name, GDPR, etc.) were last taken from, so importing an
-- older season never overwrites newer details.
alter table public.players
  add column if not exists details_year integer;

alter table public.import_batches
  add column if not exists season_id integer references public.seasons(id) on delete set null,
  add column if not exists summary   jsonb;

-- Snapshots are per season so week-to-week movement never compares across seasons.
alter table public.leaderboard_positions
  add column if not exists season_id integer references public.seasons(id) on delete cascade;
create index if not exists leaderboard_positions_season_idx
  on public.leaderboard_positions (season_id, league, snapshot_date);

-- Stable row key for results: "<tournament_id>:<player_id>:<occurrence>".
create unique index if not exists results_raw_hash_key on public.results (raw_hash) where raw_hash is not null;
create index if not exists results_season_id_idx on public.results (season_id);

create table if not exists public.import_staging (
  id                bigserial primary key,
  batch_id          uuid not null references public.import_batches(id) on delete cascade,
  player_id         bigint not null,
  forename          text,
  surname           text,
  full_name         text,
  date_of_birth     date,
  card_number       bigint,
  membership_number bigint,
  gdpr              boolean,
  tournament_id     bigint not null,
  casino            text,
  tournament_name   text,
  start_date        timestamp,
  buy_in            numeric,
  points            numeric not null,
  finish_position   integer,
  prize_position    integer,
  prize_amount      numeric,
  web_sync_site_id  integer,
  occ               integer not null default 0
);
create index if not exists import_staging_batch_idx on public.import_staging (batch_id);
-- Server (service role) only: RLS on with no policies for anon/authenticated.
alter table public.import_staging enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Leaderboard snapshot for every league in a season
-- ---------------------------------------------------------------------------
create or replace function public.take_season_snapshot(p_season_id integer, p_date date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  l record;
  c integer;
  n integer := 0;
begin
  for l in select id, slug from public.leagues where season_id = p_season_id loop
    delete from public.leaderboard_positions
    where season_id = p_season_id and league = l.slug and snapshot_date = p_date;

    insert into public.leaderboard_positions (season_id, league, player_id, points, "position", snapshot_date)
    select p_season_id, l.slug, s.player_id, s.total_points, s."position", p_date
    from public.league_standings(l.id) s;

    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The importer
-- ---------------------------------------------------------------------------
create or replace function public.import_season_report(p_batch_id uuid, p_dry_run boolean default true)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_season   public.seasons%rowtype;
  v_rows     integer;
  v_snapshot date;
  v_summary  jsonb;
  v_p_new integer; v_p_upd integer;
  v_e_new integer; v_e_upd integer; v_e_del integer;
  v_r_new integer; v_r_upd integer; v_r_del integer;
  v_removed  jsonb;
  v_new_events jsonb;
  v_positions integer := 0;
begin
  select s.* into v_season
  from public.import_batches b join public.seasons s on s.id = b.season_id
  where b.id = p_batch_id;
  if not found then
    raise exception 'Import batch % not found or has no season', p_batch_id;
  end if;

  select count(*), max(start_date)::date into v_rows, v_snapshot
  from public.import_staging where batch_id = p_batch_id;
  if v_rows = 0 then
    raise exception 'Import batch % has no staged rows', p_batch_id;
  end if;

  begin
    -- Players -----------------------------------------------------------------
    with src as (
      select distinct on (player_id) player_id, forename, surname, full_name, date_of_birth,
             card_number, membership_number, gdpr
      from public.import_staging where batch_id = p_batch_id
      order by player_id, start_date desc nulls last
    ), up as (
      insert into public.players as p (id, forename, surname, full_name, date_of_birth, card_number,
                                       membership_number, gdpr, details_year)
      select player_id, forename, surname, full_name, date_of_birth, card_number, membership_number,
             coalesce(gdpr, false), v_season.year
      from src
      on conflict (id) do update set
        forename = excluded.forename, surname = excluded.surname, full_name = excluded.full_name,
        date_of_birth = excluded.date_of_birth, card_number = excluded.card_number,
        membership_number = excluded.membership_number, gdpr = excluded.gdpr,
        details_year = excluded.details_year, updated_at = now()
      where coalesce(p.details_year, 0) <= excluded.details_year
        and (p.forename, p.surname, p.full_name, p.date_of_birth, p.card_number, p.membership_number, p.gdpr)
            is distinct from
            (excluded.forename, excluded.surname, excluded.full_name, excluded.date_of_birth,
             excluded.card_number, excluded.membership_number, excluded.gdpr)
      returning (xmax = 0) as inserted
    )
    select count(*) filter (where inserted), count(*) filter (where not inserted) into v_p_new, v_p_upd from up;

    -- Events ------------------------------------------------------------------
    with src as (
      select distinct on (tournament_id) tournament_id, casino, tournament_name, start_date, buy_in, web_sync_site_id
      from public.import_staging where batch_id = p_batch_id
      order by tournament_id, start_date nulls last
    ), up as (
      insert into public.events as e (id, season_id, casino, tournament_name, start_date, buy_in, web_sync_site_id,
                                      is_high_roller, is_low_roller, is_deleted, search_text)
      select tournament_id, v_season.id, casino, tournament_name, start_date, buy_in, web_sync_site_id,
             coalesce(tournament_name ~* 'high\s*roller', false),
             coalesce(buy_in <= 300, false),
             false,
             lower(concat_ws(' ', tournament_name, casino))
      from src
      on conflict (id) do update set
        season_id = excluded.season_id, casino = excluded.casino, tournament_name = excluded.tournament_name,
        start_date = excluded.start_date, buy_in = excluded.buy_in, web_sync_site_id = excluded.web_sync_site_id,
        is_high_roller = case when e.is_high_roller_locked then e.is_high_roller else excluded.is_high_roller end,
        is_low_roller = excluded.is_low_roller, is_deleted = false, search_text = excluded.search_text,
        updated_at = now()
      where (e.season_id, e.casino, e.tournament_name, e.start_date, e.buy_in, e.web_sync_site_id,
             e.is_low_roller, e.is_deleted, e.search_text)
            is distinct from
            (excluded.season_id, excluded.casino, excluded.tournament_name, excluded.start_date, excluded.buy_in,
             excluded.web_sync_site_id, excluded.is_low_roller, false, excluded.search_text)
         or (not e.is_high_roller_locked and e.is_high_roller is distinct from excluded.is_high_roller)
      returning e.id, e.tournament_name, e.start_date, e.casino, e.is_high_roller, (xmax = 0) as inserted
    )
    select count(*) filter (where inserted), count(*) filter (where not inserted),
           coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', tournament_name, 'start_date', start_date,
                                                 'casino', casino, 'is_high_roller', is_high_roller)
                              order by start_date) filter (where inserted), '[]'::jsonb)
      into v_e_new, v_e_upd, v_new_events
    from up;

    with gone as (
      update public.events e set is_deleted = true, updated_at = now()
      where e.season_id = v_season.id and not e.is_deleted
        and not exists (select 1 from public.import_staging s where s.batch_id = p_batch_id and s.tournament_id = e.id)
      returning 1
    )
    select count(*) into v_e_del from gone;

    -- Results -----------------------------------------------------------------
    -- Give rows imported before this importer existed the same key the report uses.
    update public.results r set raw_hash = k.key
    from (
      select r2.id,
             r2.event_id || ':' || r2.player_id || ':' ||
             (row_number() over (partition by r2.event_id, r2.player_id order by r2.finish_position nulls last, r2.id) - 1) as key
      from public.results r2
      where r2.raw_hash is null and r2.event_id is not null and r2.player_id is not null
        and (r2.season_id = v_season.id
             or r2.event_id in (select distinct tournament_id from public.import_staging where batch_id = p_batch_id))
    ) k
    where r.id = k.id;

    with up as (
      insert into public.results as r (player_id, event_id, season_id, finish_position, prize_position, points,
                                       prize_amount, raw_hash, import_batch_id, is_deleted)
      select player_id, tournament_id, v_season.id, finish_position, prize_position, points, prize_amount,
             tournament_id || ':' || player_id || ':' || occ, p_batch_id, false
      from public.import_staging where batch_id = p_batch_id
      on conflict (raw_hash) where raw_hash is not null do update set
        player_id = excluded.player_id, event_id = excluded.event_id, season_id = excluded.season_id,
        finish_position = excluded.finish_position, prize_position = excluded.prize_position,
        points = excluded.points, prize_amount = excluded.prize_amount,
        import_batch_id = excluded.import_batch_id, is_deleted = false, updated_at = now()
      where (r.season_id, r.finish_position, r.prize_position, r.points, r.prize_amount, r.is_deleted)
            is distinct from
            (excluded.season_id, excluded.finish_position, excluded.prize_position, excluded.points,
             excluded.prize_amount, false)
      returning (xmax = 0) as inserted
    )
    select count(*) filter (where inserted), count(*) filter (where not inserted) into v_r_new, v_r_upd from up;

    with gone as (
      update public.results r set is_deleted = true, updated_at = now()
      where r.season_id = v_season.id and not r.is_deleted
        and not exists (
          select 1 from public.import_staging s
          where s.batch_id = p_batch_id and r.raw_hash = s.tournament_id || ':' || s.player_id || ':' || s.occ)
      returning r.id, r.event_id, r.player_id, r.points, r.finish_position
    )
    select count(*),
           coalesce(jsonb_agg(jsonb_build_object(
             'result_id', g.id, 'event', e.tournament_name, 'player_id', g.player_id,
             'player', concat_ws(' ', p.forename, p.surname), 'position', g.finish_position, 'points', g.points)
             order by e.start_date, g.finish_position) filter (where g.id is not null), '[]'::jsonb)
      into v_r_del, v_removed
    from gone g
    left join public.events e on e.id = g.event_id
    left join public.players p on p.id = g.player_id;

    -- Season dates follow the report (seasons don't align with calendar years). ---
    update public.seasons s set
      start_date = d.first_day,
      end_date   = case when s.is_active then greatest(s.end_date, d.last_day) else d.last_day end
    from (
      select min(start_date)::date as first_day, max(start_date)::date as last_day
      from public.events where season_id = v_season.id and not is_deleted
    ) d
    where s.id = v_season.id and d.first_day is not null;

    -- Lifetime stats for everyone in this season ------------------------------
    update public.players p set
      lifetime_events_played = x.events_played, lifetime_wins = x.wins, lifetime_cashes = x.cashes,
      lifetime_money_won = x.money, lifetime_final_tables = x.final_tables
    from (
      select r.player_id,
        count(distinct r.event_id) as events_played,
        count(*) filter (where r.finish_position = 1) as wins,
        count(*) filter (where r.prize_amount > 0) as cashes,
        coalesce(sum(r.prize_amount), 0) as money,
        count(*) filter (where r.finish_position <= 9) as final_tables
      from public.results r
      where not r.is_deleted
        and r.player_id in (select player_id from public.results where season_id = v_season.id)
      group by r.player_id
    ) x
    where p.id = x.player_id;

    -- Leaderboard snapshot, dated by the report's latest event ------------------
    if v_snapshot is not null then
      v_positions := public.take_season_snapshot(v_season.id, v_snapshot);
    end if;

    v_summary := jsonb_build_object(
      'season', jsonb_build_object('id', v_season.id, 'name', v_season.name, 'year', v_season.year),
      'rows', v_rows,
      'snapshot_date', v_snapshot,
      'players', jsonb_build_object('new', v_p_new, 'updated', v_p_upd),
      'events',  jsonb_build_object('new', v_e_new, 'updated', v_e_upd, 'removed', v_e_del),
      'results', jsonb_build_object('new', v_r_new, 'updated', v_r_upd, 'removed', v_r_del),
      'new_events', v_new_events,
      'removed_results', v_removed,
      'snapshot_positions', v_positions
    );

    if p_dry_run then
      -- Roll back everything above; the summary variable survives.
      raise exception using errcode = 'NPL01', message = 'dry run';
    end if;
  exception when sqlstate 'NPL01' then
    update public.import_batches set summary = v_summary || '{"dry_run": true}'::jsonb, status = 'previewed'
    where id = p_batch_id;
    return v_summary || '{"dry_run": true}'::jsonb;
  end;

  update public.import_batches set
    summary = v_summary, status = 'completed', row_count = v_rows, processed_count = v_rows,
    snapshot_date = v_snapshot
  where id = p_batch_id;
  delete from public.import_staging where batch_id = p_batch_id;

  return v_summary;
end;
$$;

-- Only the server (service role) may run imports or snapshots.
revoke execute on function public.import_season_report(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.take_season_snapshot(integer, date) from public, anon, authenticated;
grant execute on function public.import_season_report(uuid, boolean) to service_role;
grant execute on function public.take_season_snapshot(integer, date) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Leaderboard lookups that depend on snapshots / season dates
-- ---------------------------------------------------------------------------
-- Pick the season containing p_from (season ranges now follow the reports and can start in December).
create or replace function public.leaderboard_season(
  p_from date, p_to date, p_league text, p_method text default null, p_cap integer default null,
  p_search text default null, p_limit integer default 100, p_offset integer default 0
)
returns table (
  player_id bigint, display_name text, "position" bigint, total_points numeric,
  total_count bigint, used_count bigint, wins bigint, top3_count bigint, top9_count bigint,
  best_single numeric, lowest_counted numeric, average_all numeric, average_used numeric
)
language sql
stable
set search_path = ''
as $$
  select s.*
  from public.league_standings(
    (select l.id from public.leagues l join public.seasons se on se.id = l.season_id
     where l.slug = lower(p_league)
       and se.start_date <= p_from and se.end_date >= p_from
     order by se.start_date desc limit 1),
    nullif(trim(p_search), '')
  ) s
  order by s."position"
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

-- Biggest climbers between the two most recent snapshots of the active season.
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
    and o."position" > n."position"
  order by o."position" - n."position" desc, n."position"
  limit 10;
$$;

-- Staging cleanup: previews that were never applied are dropped after a day.
delete from public.import_staging st
using public.import_batches b
where b.id = st.batch_id and b.created_at < now() - interval '1 day';

commit;
