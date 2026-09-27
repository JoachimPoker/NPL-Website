-- League logos. Leagues are stored per season (public.leagues), but a league's logo is the same
-- every year, so it lives here once per league slug (npl, hrl, lrl).

create table if not exists public.league_brands (
  slug       text primary key,
  name       text not null,
  logo_url   text,
  updated_at timestamptz not null default now()
);

insert into public.league_brands (slug, name) values
  ('npl', 'National Poker League'),
  ('hrl', 'High Roller League'),
  ('lrl', 'Low Roller League')
on conflict (slug) do nothing;

alter table public.league_brands enable row level security;

drop policy if exists "League brands are public" on public.league_brands;
create policy "League brands are public" on public.league_brands
  for select to anon, authenticated using (true);

drop policy if exists "Admins manage league brands" on public.league_brands;
create policy "Admins manage league brands" on public.league_brands
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.league_brands to anon, authenticated;
grant insert, update, delete on public.league_brands to authenticated;
grant all on public.league_brands to service_role;
