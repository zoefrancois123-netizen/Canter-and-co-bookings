create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "authenticated users can read app state" on public.app_state;
drop policy if exists "authenticated users can insert app state" on public.app_state;
drop policy if exists "authenticated users can update app state" on public.app_state;

create policy "authenticated users can read app state"
on public.app_state
for select
to authenticated
using (true);

create policy "authenticated users can insert app state"
on public.app_state
for insert
to authenticated
with check (true);

create policy "authenticated users can update app state"
on public.app_state
for update
to authenticated
using (true)
with check (true);
