-- A photo per festival (set on its admin page) and per venue (set under Admin → Photos).
-- Both are optional; without one the site falls back to the series photo, then the general room photos.

alter table public.festivals add column if not exists image_url text;

-- Venues have no table of their own (they come from events.casino), so their photos are keyed by that name.
create table if not exists public.venue_images (
  casino     text primary key,
  url        text not null,
  updated_at timestamptz not null default now()
);

alter table public.venue_images enable row level security;

drop policy if exists "Venue images are public" on public.venue_images;
create policy "Venue images are public" on public.venue_images
  for select to anon, authenticated using (true);

drop policy if exists "Admins manage venue images" on public.venue_images;
create policy "Admins manage venue images" on public.venue_images
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.venue_images to anon, authenticated;
grant insert, update, delete on public.venue_images to authenticated;
grant all on public.venue_images to service_role;
