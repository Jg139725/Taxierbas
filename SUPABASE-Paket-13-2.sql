-- Taxi Erbas Paket 13.2
alter table public.rides
add column if not exists ride_mode text not null default 'single';

create table if not exists public.ride_passengers (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  sort_order integer not null default 0,
  name text not null,
  phone text,
  pickup text not null,
  destination text not null,
  created_at timestamptz not null default now()
);

create index if not exists ride_passengers_ride_idx
on public.ride_passengers(ride_id,sort_order);

alter table public.ride_passengers enable row level security;

drop policy if exists ride_passengers_read on public.ride_passengers;
create policy ride_passengers_read
on public.ride_passengers
for select
to authenticated
using (
  public.current_user_role() in ('admin','dispatcher')
  or exists (
    select 1
    from public.rides r
    where r.id=ride_passengers.ride_id
      and (
        r.assigned_driver=auth.uid()
        or auth.uid()=any(coalesce(r.assigned_drivers,'{}'::uuid[]))
      )
  )
);

drop policy if exists ride_passengers_insert on public.ride_passengers;
create policy ride_passengers_insert
on public.ride_passengers
for insert
to authenticated
with check (public.current_user_role() in ('admin','dispatcher'));

drop policy if exists ride_passengers_update on public.ride_passengers;
create policy ride_passengers_update
on public.ride_passengers
for update
to authenticated
using (public.current_user_role() in ('admin','dispatcher'))
with check (public.current_user_role() in ('admin','dispatcher'));

drop policy if exists ride_passengers_delete on public.ride_passengers;
create policy ride_passengers_delete
on public.ride_passengers
for delete
to authenticated
using (public.current_user_role() in ('admin','dispatcher'));
