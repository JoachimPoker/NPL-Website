-- Festivals can now be created by hand (Admin -> Festivals). Automatic detection keeps running
-- after each import, but:
--   * a hand-made festival (is_auto = false) claims unlocked events of its series at its venue
--     within its dates, so later imports join it instead of making a duplicate;
--   * events set by hand (festival_locked) are never moved, as before;
--   * hand-made festivals are never renamed, re-dated or deleted by detection, as before.

create or replace function public.auto_assign_series(p_season_id integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series_changed   integer;
  v_festival_changed integer;
  v_festivals_new    integer;
  v_festivals_gone   integer;
  v_unassigned       integer;
  v_joined           integer;
begin
  drop table if exists pg_temp._aa_events, pg_temp._aa_clusters;

  -- Events in scope with their pattern-matched series.
  create temp table _aa_events on commit drop as
  select e.id, e.season_id, e.casino, e.start_date::date as d, e.tournament_name,
         e.series_locked, e.festival_locked, e.festival_id as cur_festival,
         case when e.series_locked then e.series_id
              else (select s.id from public.series s
                    where s.is_active and coalesce(s.match_pattern, '') <> ''
                      and e.tournament_name ~* s.match_pattern
                    order by s.sort_order, s.id limit 1)
         end as sid,
         null::integer as cluster,
         null::uuid as manual_fest
  from public.events e
  where not e.is_deleted and e.start_date is not null
    and (p_season_id is null or e.season_id = p_season_id);

  -- Festivals created by hand (is_auto = false) claim unlocked events of their series at their
  -- venue within their dates; those events are left out of automatic grouping.
  update _aa_events a set manual_fest = f.id
  from public.festivals f
  where not f.is_auto and not a.festival_locked
    and a.sid = f.series_id and a.casino is not distinct from f.casino
    and a.d between f.start_date and f.end_date;

  -- Festivals: same season + series + casino, at most 6 days between consecutive events.
  create temp table _aa_clusters on commit drop as
  with base as (
    select a.* from _aa_events a join public.series s on s.id = a.sid
    where s.has_festivals and coalesce(a.casino, '') not ilike 'online' and a.manual_fest is null
  ), gaps as (
    select base.*, case when d - lag(d) over w > 6 or lag(d) over w is null then 1 else 0 end as starts_new
    from base window w as (partition by season_id, sid, casino order by d, id)
  ), numbered as (
    select gaps.*, sum(starts_new) over (partition by season_id, sid, casino order by d, id) as g from gaps
  )
  select row_number() over (order by season_id, sid, casino, g)::integer as cluster,
         season_id, sid, casino, min(d) as start_d, max(d) as end_d, array_agg(id) as ids,
         null::uuid as festival_id, null::text as label
  from numbered group by season_id, sid, casino, g
  having count(*) >= 2;  -- a single event isn't a festival

  update _aa_events a set cluster = c.cluster
  from _aa_clusters c where a.id = any(c.ids);

  -- Unbranded events at the same casino within 3 days of a festival join it (and its series).
  -- Repeat so a festival grows through a run of unbranded events ("Event 4", "Event 5", ...).
  loop
    update _aa_events a set cluster = c.cluster, sid = c.sid
    from _aa_clusters c
    where a.sid is null and not a.series_locked and a.cluster is null and a.manual_fest is null
      and a.season_id = c.season_id and a.casino is not distinct from c.casino
      and a.d between c.start_d - 3 and c.end_d + 3;
    get diagnostics v_joined = row_count;

    update _aa_clusters c set start_d = x.start_d, end_d = x.end_d
    from (select cluster, min(d) start_d, max(d) end_d from _aa_events where cluster is not null group by cluster) x
    where c.cluster = x.cluster;

    exit when v_joined = 0;
  end loop;

  -- Everything still unclaimed goes to the "others" series (if it exists and is active), and
  -- gets festivals of its own the same way.
  update _aa_events a set sid = o.id
  from public.series o
  where o.slug = 'others' and o.is_active and a.sid is null and not a.series_locked;

  insert into _aa_clusters (cluster, season_id, sid, casino, start_d, end_d, ids)
  with base as (
    select a.* from _aa_events a join public.series s on s.id = a.sid
    where s.slug = 'others' and s.has_festivals and a.cluster is null and a.manual_fest is null
      and coalesce(a.casino, '') not ilike 'online'
  ), gaps as (
    select base.*, case when d - lag(d) over w > 6 or lag(d) over w is null then 1 else 0 end as starts_new
    from base window w as (partition by season_id, casino order by d, id)
  ), numbered as (
    select gaps.*, sum(starts_new) over (partition by season_id, casino order by d, id) as g from gaps
  )
  select (select coalesce(max(cluster), 0) from _aa_clusters) + row_number() over (order by season_id, casino, g)::integer,
         season_id, min(sid), casino, min(d), max(d), array_agg(id)
  from numbered group by season_id, casino, g
  having count(*) >= 2;  -- a lone one-off event isn't a festival

  update _aa_events a set cluster = c.cluster
  from _aa_clusters c where a.cluster is null and a.id = any(c.ids);

  -- Festival name: the most common tournament-name prefix ("GUKPT Luton - Event 7" -> "GUKPT Luton",
  -- "Yorkshire Open #5 - PLO" -> "Yorkshire Open"), falling back to series + casino, plus the month.
  update _aa_clusters c set label = coalesce(
    (select x.p from (
        select trim(regexp_replace(a.tournament_name, '(\s+[-–]\s|\s*#\d|:\s|\s+Event\s+\d).*$', '')) as p
        from _aa_events a where a.cluster = c.cluster
      ) x
     where length(x.p) >= 4 and x.p !~ '^[\d\s]+$' and x.p !~* '^(event|online)\M'
     group by x.p order by count(*) desc, length(x.p), x.p limit 1),
    (select s.name from public.series s where s.id = c.sid) || ' ' || c.casino
  ) || ' · ' || to_char(c.start_d, 'Mon YYYY')
  where c.label is null;  -- every cluster; the WHERE is required when called through the API (pg_safeupdate)

  -- Reuse an existing auto festival for the same series/casino with overlapping dates.
  update _aa_clusters c set festival_id = (
    select f.id from public.festivals f
    where f.series_id = c.sid and f.casino is not distinct from c.casino and f.is_auto
      and f.season_id is not distinct from c.season_id
      and daterange(f.start_date, f.end_date, '[]') && daterange(c.start_d - 2, c.end_d + 2, '[]')
    order by abs(f.start_date - c.start_d), f.created_at
    limit 1
  )
  where c.festival_id is null;  -- every cluster, see above

  with ins as (
    insert into public.festivals (label, start_date, end_date, city, keywords, season_id, series_id, casino, is_auto)
    select c.label, c.start_d, c.end_d, c.casino, '[]'::jsonb, c.season_id, c.sid, c.casino, true
    from _aa_clusters c
    where c.festival_id is null
    returning id, series_id, casino, season_id, start_date
  )
  update _aa_clusters c set festival_id = ins.id
  from ins
  where c.festival_id is null and ins.series_id = c.sid and ins.casino is not distinct from c.casino
    and ins.season_id is not distinct from c.season_id and ins.start_date = c.start_d;
  get diagnostics v_festivals_new = row_count;

  -- Keep auto festival dates (and names, unless renamed by hand) in step with their events.
  update public.festivals f set
    start_date = c.start_d, end_date = c.end_d,
    label = case when f.label_locked then f.label else c.label end,
    updated_at = now()
  from _aa_clusters c
  where f.id = c.festival_id
    and ((f.start_date, f.end_date) is distinct from (c.start_d, c.end_d)
         or (not f.label_locked and f.label is distinct from c.label));

  -- Apply series.
  with upd as (
    update public.events e set series_id = a.sid, updated_at = now()
    from _aa_events a
    where e.id = a.id and not a.series_locked and e.series_id is distinct from a.sid
    returning 1
  )
  select count(*) into v_series_changed from upd;

  -- Apply festivals (events outside any festival lose an auto festival, never a manual one).
  with target as (
    select a.id, coalesce(a.manual_fest, c.festival_id) as festival_id
    from _aa_events a left join _aa_clusters c on c.cluster = a.cluster
    where not a.festival_locked
  ), upd as (
    update public.events e set festival_id = t.festival_id, updated_at = now()
    from target t
    where e.id = t.id and e.festival_id is distinct from t.festival_id
      and (t.festival_id is not null
           or e.festival_id is null
           or exists (select 1 from public.festivals f where f.id = e.festival_id and f.is_auto))
    returning 1
  )
  select count(*) into v_festival_changed from upd;

  -- Drop auto festivals that no longer have events.
  with gone as (
    delete from public.festivals f
    where f.is_auto and (p_season_id is null or f.season_id = p_season_id)
      and not exists (select 1 from public.events e where e.festival_id = f.id)
    returning 1
  )
  select count(*) into v_festivals_gone from gone;

  select count(*) into v_unassigned from _aa_events where sid is null;

  return jsonb_build_object(
    'events_checked', (select count(*) from _aa_events),
    'series_changed', v_series_changed,
    'festival_changed', v_festival_changed,
    'festivals_created', v_festivals_new,
    'festivals_removed', v_festivals_gone,
    'events_without_series', v_unassigned
  );
end;
$$;

revoke execute on function public.auto_assign_series(integer) from public, anon, authenticated;
grant execute on function public.auto_assign_series(integer) to service_role;
