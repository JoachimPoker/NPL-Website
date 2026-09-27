-- Penalties: a report can list a player twice in one tournament, the extra row carrying
-- negative points. results allows one row per player per tournament, so the importer folds
-- those rows into penalty_points on the player's result, and every total subtracts them.

begin;

alter table public.results        add column if not exists penalty_points numeric not null default 0;
alter table public.import_staging add column if not exists penalty_points numeric not null default 0;

-- League standings: same rules as before (season, filters, best-N, bonuses) plus penalties.
-- Ranking: total points, then wins, then best single result.
create or replace function public.league_standings(p_league_id integer, p_search text default null)
returns table (
  player_id bigint, display_name text, "position" bigint, total_points numeric,
  total_count bigint, used_count bigint, wins bigint, top3_count bigint, top9_count bigint,
  best_single numeric, lowest_counted numeric, average_all numeric, average_used numeric
)
language sql
stable
set search_path = ''
as $$
  with lg as (
    select l.*,
      coalesce((select sum(b.points_value) from public.league_bonuses b
                where b.league_id = l.id and b.bonus_type = 'participation_after_cap'), 0) as extra_pts
    from public.leagues l where l.id = p_league_id
  ),
  ev as (
    select e.id from public.events e, lg
    where e.season_id = lg.season_id
      and not e.is_deleted
      and (lg.filter_is_high_roller is not true or e.is_high_roller)
      and (coalesce(lg.max_buy_in, lg.filter_max_buyin) is null or e.buy_in <= coalesce(lg.max_buy_in, lg.filter_max_buyin))
      and (lg.filter_min_buyin is null or e.buy_in >= lg.filter_min_buyin)
  ),
  r as (
    select r.player_id, r.points, r.penalty_points, r.finish_position,
      row_number() over (partition by r.player_id order by r.points desc, r.id) as rn
    from public.results r join ev on ev.id = r.event_id
    where not r.is_deleted and r.player_id is not null
  ),
  agg as (
    select r.player_id,
      count(*) as total_count,
      count(*) filter (where lg.scoring_method <> 'capped' or r.rn <= lg.scoring_cap) as used_count,
      coalesce(sum(r.points) filter (where lg.scoring_method <> 'capped' or r.rn <= lg.scoring_cap), 0) as used_pts,
      sum(r.points) as all_pts,
      coalesce(sum(r.penalty_points), 0) as penalty_pts,
      min(r.points) filter (where lg.scoring_method <> 'capped' or r.rn <= lg.scoring_cap) as lowest_counted,
      max(r.points) as best_single,
      count(*) filter (where r.finish_position = 1) as wins,
      count(*) filter (where r.finish_position <= 3) as top3_count,
      count(*) filter (where r.finish_position <= 9) as top9_count,
      max(lg.scoring_method) as scoring_method, max(lg.scoring_cap) as scoring_cap, max(lg.extra_pts) as extra_pts
    from r, lg
    group by r.player_id
  ),
  scored as (
    select a.*,
      a.used_pts + a.penalty_pts
        + case when a.scoring_method = 'capped'
               then greatest(a.total_count - a.scoring_cap, 0) * a.extra_pts else 0 end as total_points,
      public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr) as display_name
    from agg a join public.players p on p.id = a.player_id
  ),
  ranked as (
    select s.*, row_number() over (order by s.total_points desc, s.wins desc, s.best_single desc, s.player_id) as "position"
    from scored s
  )
  select player_id, display_name, "position", round(total_points, 2),
    total_count, used_count, wins, top3_count, top9_count,
    best_single, lowest_counted,
    round(all_pts / nullif(total_count, 0), 2),
    round(used_pts / nullif(used_count, 0), 2)
  from ranked
  where p_search is null or display_name ilike '%' || p_search || '%'
  order by "position";
$$;

-- Series leaderboard: plain points total across the series' events, minus penalties.
create or replace function public.leaderboard_for_series(p_series_id integer, p_scope text default 'season')
returns table (player_id bigint, display_name text, "position" bigint, total_points numeric,
               events_played bigint, wins bigint, final_tables bigint)
language sql
stable
set search_path = ''
as $$
  with agg as (
    select r.player_id,
      sum(r.points + r.penalty_points) as total_points,
      count(*) as events_played,
      count(*) filter (where r.finish_position = 1) as wins,
      count(*) filter (where r.finish_position <= 9) as final_tables
    from public.results r
    join public.events e on e.id = r.event_id
    where e.series_id = p_series_id
      and not e.is_deleted and not r.is_deleted and r.player_id is not null
      and (p_scope = 'all_time'
           or e.season_id = (select id from public.seasons where is_active order by year desc limit 1))
    group by r.player_id
  )
  select a.player_id,
    public.display_name_for(p.forename, p.surname, p.display_name, p.gdpr),
    row_number() over (order by a.total_points desc, a.wins desc, a.player_id),
    round(a.total_points, 2), a.events_played, a.wins, a.final_tables
  from agg a join public.players p on p.id = a.player_id
  order by 3;
$$;

-- Importer: now stores penalty_points (see 20260927020000_report_importer.sql for the full design).
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
                                       prize_amount, penalty_points, raw_hash, import_batch_id, is_deleted)
      select player_id, tournament_id, v_season.id, finish_position, prize_position, points, prize_amount, penalty_points,
             tournament_id || ':' || player_id || ':' || occ, p_batch_id, false
      from public.import_staging where batch_id = p_batch_id
      on conflict (raw_hash) where raw_hash is not null do update set
        player_id = excluded.player_id, event_id = excluded.event_id, season_id = excluded.season_id,
        finish_position = excluded.finish_position, prize_position = excluded.prize_position,
        points = excluded.points, prize_amount = excluded.prize_amount, penalty_points = excluded.penalty_points,
        import_batch_id = excluded.import_batch_id, is_deleted = false, updated_at = now()
      where (r.season_id, r.finish_position, r.prize_position, r.points, r.prize_amount, r.penalty_points, r.is_deleted)
            is distinct from
            (excluded.season_id, excluded.finish_position, excluded.prize_position, excluded.points,
             excluded.prize_amount, excluded.penalty_points, false)
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

revoke execute on function public.import_season_report(uuid, boolean) from public, anon, authenticated;
grant execute on function public.import_season_report(uuid, boolean) to service_role;

commit;
