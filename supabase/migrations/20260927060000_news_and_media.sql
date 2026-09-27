-- News articles managed from the admin area, plus a public media bucket for images
-- (news pictures now, badge artwork later). Additive only.

begin;

alter table public.news
  add column if not exists category     text,
  add column if not exists excerpt      text,
  add column if not exists image_url    text,
  add column if not exists is_featured  boolean not null default false,
  add column if not exists is_published boolean not null default true,
  add column if not exists updated_at   timestamptz default now();

create index if not exists news_published_idx on public.news (is_published, published_at desc);

-- The public only sees published articles; admins see drafts too.
drop policy if exists "Public can read news" on public.news;
create policy "Public can read news" on public.news
  for select to anon, authenticated
  using (is_published or (select private.is_admin()));

-- Public media bucket: anyone can view files, only the server (service role) uploads,
-- via the admin-only /api/admin/upload route.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
