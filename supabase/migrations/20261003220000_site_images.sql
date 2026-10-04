-- Site photos that admins can replace (/admin/images), and an optional photo per series.
-- Each row overrides one photo spot on the site; a missing row means the built-in default photo is used.

create table if not exists public.site_images (
  key        text primary key,
  url        text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_images enable row level security;

drop policy if exists "Site images are public" on public.site_images;
create policy "Site images are public" on public.site_images
  for select to anon, authenticated using (true);

drop policy if exists "Admins manage site images" on public.site_images;
create policy "Admins manage site images" on public.site_images
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

grant select on public.site_images to anon, authenticated;
grant insert, update, delete on public.site_images to authenticated;
grant all on public.site_images to service_role;

-- A photo for each series: used on its page and on its festivals' strips.
alter table public.series add column if not exists image_url text;
