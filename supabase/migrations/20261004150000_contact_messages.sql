-- Messages from the public contact form (name removal, corrections, questions), read in /admin/messages.
-- Anyone can send one; only admins can read, update or delete them.

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  topic       text not null check (topic in ('privacy', 'correction', 'accessibility', 'other')),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 200 and email like '%@%'),
  player_link text check (player_link is null or char_length(player_link) <= 300),
  message     text not null check (char_length(message) between 1 and 4000),
  handled_at  timestamptz,
  handled_by  text
);

create index if not exists contact_messages_open_idx on public.contact_messages (created_at desc) where handled_at is null;

alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can send a message" on public.contact_messages;
create policy "Anyone can send a message" on public.contact_messages
  for insert to anon, authenticated with check (handled_at is null and handled_by is null);

drop policy if exists "Admins read messages" on public.contact_messages;
create policy "Admins read messages" on public.contact_messages
  for select to authenticated using ((select private.is_admin()));

drop policy if exists "Admins update messages" on public.contact_messages;
create policy "Admins update messages" on public.contact_messages
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Admins delete messages" on public.contact_messages;
create policy "Admins delete messages" on public.contact_messages
  for delete to authenticated using ((select private.is_admin()));

grant insert on public.contact_messages to anon, authenticated;
grant select, update, delete on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
