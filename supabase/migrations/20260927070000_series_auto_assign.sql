-- Series & festivals, detected automatically.
--   * Each series has a name pattern (Postgres regex, case-insensitive) matched against tournament names.
--   * Festivals = events of one series at one casino with no more than 6 days between them
--     (only for series that run festivals; 25/50, G200/G300 etc. are single events).
--   * Events without a brand in their name ("Event 7 - Main Event") join the festival running at
--     the same casino on the same dates.
--   * Anything an admin sets by hand is locked and never changed by auto-assign.
-- auto_assign_series() runs after every import and from the admin Series page.

begin;

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
alter table public.series
  add column if not exists match_pattern text,
  add column if not exists has_festivals boolean not null default true,
  add column if not exists logo_url      text,
  add column if not exists sort_order    integer not null default 100;

alter table public.events
  add column if not exists series_locked   boolean not null default false,
  add column if not exists festival_locked boolean not null default false;

alter table public.festivals
  add column if not exists casino        text,
  add column if not exists is_auto       boolean not null default true,
  add column if not exists label_locked  boolean not null default false;

create index if not exists festivals_auto_idx on public.festivals (series_id, casino, start_date);

-- ---------------------------------------------------------------------------
-- 2. Starter series (edit names/patterns in Admin -> Series)
-- ---------------------------------------------------------------------------
insert into public.series (name, slug, description, match_pattern, has_festivals, sort_order) values
  ('GUKPT',                'gukpt',            'Grosvenor UK Poker Tour',
     '^(#\d+\s*)?GUKPT\M|^Online\W+(Closer\W+)?GUKPT\M|^Online\W+Grand Final', true, 10),
  ('Goliath',              'goliath',          'Goliath, Coventry',
     '^Goliath\M|^Online\W+(Closer\W+)?Goliath\M', true, 10),
  ('UKPL',                 'ukpl',             'UK Poker League',
     '^UKPL\M|^Online\W+(Closer\W+)?UKPL\M', true, 10),
  ('888poker LIVE',        '888poker-live',    '888poker LIVE festivals',
     '^888\s*poker\M|^888\s*Live\M', true, 10),
  ('UK Open',              'uk-open',          'UK Open',
     '^UK Open\M|^Online\W+(Closer\W+)?(-\s*)?UK Open\M', true, 10),
  ('Behemoth',             'behemoth',         'Behemoth',             '^Behemoth\M', true, 10),
  ('Mini Fest',            'mini-fest',        'Mini Fest',            'Mini Fest\M', true, 20),
  ('Summer Fest',          'summer-fest',      'Summer Fest',          'Summer Fest\M', true, 20),
  ('Yorkshire Open',       'yorkshire-open',   'Yorkshire Open',       '^Yorkshire Open\M', true, 10),
  ('Southern Poker Open',  'southern-poker-open', 'Southern Poker Open', '^Southern Poker Open\M', true, 10),
  ('25th Anniversary',     '25th-anniversary', '25th Anniversary festival', '^25th Anniversary\M', true, 10),
  ('25/50',                '25-50',            '25/50 tournaments',    '\m25/(25|50)\M', false, 30),
  ('G200 / G300',          'g-series',         'G200 and G300 tournaments', '^G[0-9]00\M', false, 30),
  ('Easter Beast',         'easter-beast',     'Easter Beast',         '^Easter Beast\M', false, 30),
  ('Summer Sizzler',       'summer-sizzler',   'Summer Sizzler',       'Summer Sizzler\M', false, 30),
  ('Victoria Deepstack',   'victoria-deepstack', 'The Victoria Deepstack', '^The Victoria Deepstack', false, 30),
  ('NPL Online',           'npl-online',       'National Poker League online events', '^NPL\M|^Online NPL\M', false, 30)
-- A series you already created keeps its name/description; it only gains a pattern if it has none.
on conflict (slug) do update set
  match_pattern = excluded.match_pattern,
  has_festivals = excluded.has_festivals,
  sort_order    = excluded.sort_order
where public.series.match_pattern is null;

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
-- True when p is a valid Postgres regex (used to validate patterns typed in admin).
create or replace function public.is_valid_regex(p text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform '' ~* p;
  return true;
exception when others then
  return false;
end;
$$;
grant execute on function public.is_valid_regex(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Auto-assign
-- ---------------------------------------------------------------------------
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
         null::integer as cluster
  from public.events e
  where not e.is_deleted and e.start_date is not null
    and (p_season_id is null or e.season_id = p_season_id);

  -- Festivals: same season + series + casino, at most 6 days between consecutive events.
  create temp table _aa_clusters on commit drop as
  with base as (
    select a.* from _aa_events a join public.series s on s.id = a.sid
    where s.has_festivals and coalesce(a.casino, '') not ilike 'online'
  ), gaps as (
    select base.*, case when d - lag(d) over w > 6 or lag(d) over w is null then 1 else 0 end as starts_new
    from base window w as (partition by season_id, sid, casino order by d, id)
  ), numbered as (
    select gaps.*, sum(starts_new) over (partition by season_id, sid, casino order by d, id) as g from gaps
  )
  select row_number() over (order by season_id, sid, casino, g)::integer as cluster,
         season_id, sid, casino, min(d) as start_d, max(d) as end_d, array_agg(id) as ids,
         null::uuid as festival_id
  from numbered group by season_id, sid, casino, g;

  update _aa_events a set cluster = c.cluster
  from _aa_clusters c where a.id = any(c.ids);

  -- Unbranded events at the same casino within 3 days of a festival join it (and its series).
  -- Repeat so a festival grows through a run of unbranded events ("Event 4", "Event 5", ...).
  loop
    update _aa_events a set cluster = c.cluster, sid = c.sid
    from _aa_clusters c
    where a.sid is null and not a.series_locked and a.cluster is null
      and a.season_id = c.season_id and a.casino = c.casino
      and a.d between c.start_d - 3 and c.end_d + 3;
    get diagnostics v_joined = row_count;

    update _aa_clusters c set start_d = x.start_d, end_d = x.end_d
    from (select cluster, min(d) start_d, max(d) end_d from _aa_events where cluster is not null group by cluster) x
    where c.cluster = x.cluster;

    exit when v_joined = 0;
  end loop;

  -- Reuse an existing auto festival for the same series/casino with overlapping dates.
  update _aa_clusters c set festival_id = (
    select f.id from public.festivals f
    where f.series_id = c.sid and f.casino = c.casino and f.is_auto
      and f.season_id is not distinct from c.season_id
      and daterange(f.start_date, f.end_date, '[]') && daterange(c.start_d - 2, c.end_d + 2, '[]')
    order by abs(f.start_date - c.start_d), f.created_at
    limit 1
  );

  with ins as (
    insert into public.festivals (label, start_date, end_date, city, keywords, season_id, series_id, casino, is_auto)
    select s.name || ' ' || c.casino || ' · ' || to_char(c.start_d, 'Mon YYYY'),
           c.start_d, c.end_d, c.casino, '[]'::jsonb, c.season_id, c.sid, c.casino, true
    from _aa_clusters c join public.series s on s.id = c.sid
    where c.festival_id is null
    returning id, series_id, casino, season_id, start_date
  )
  update _aa_clusters c set festival_id = ins.id
  from ins
  where c.festival_id is null and ins.series_id = c.sid and ins.casino = c.casino
    and ins.season_id is not distinct from c.season_id and ins.start_date = c.start_d;
  get diagnostics v_festivals_new = row_count;

  -- Keep auto festival dates in step with their events.
  update public.festivals f set start_date = c.start_d, end_date = c.end_d, updated_at = now()
  from _aa_clusters c
  where f.id = c.festival_id and (f.start_date, f.end_date) is distinct from (c.start_d, c.end_d);

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
    select a.id, c.festival_id
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

commit;

-- Assign everything now.
select public.auto_assign_series(null);
