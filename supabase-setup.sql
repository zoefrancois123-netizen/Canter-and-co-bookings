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

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  request jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

alter table public.booking_requests enable row level security;

drop policy if exists "public can create booking requests" on public.booking_requests;
drop policy if exists "authenticated users can read booking requests" on public.booking_requests;
drop policy if exists "authenticated users can update booking requests" on public.booking_requests;

create policy "public can create booking requests"
on public.booking_requests
for insert
to anon
with check (status = 'pending');

create policy "authenticated users can read booking requests"
on public.booking_requests
for select
to authenticated
using (true);

create policy "authenticated users can update booking requests"
on public.booking_requests
for update
to authenticated
using (true)
with check (true);
