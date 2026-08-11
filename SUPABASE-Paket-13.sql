-- ============================================================
-- TAXI ERBAS – PAKET 13
-- Einzelfahrt / Mehrpersonenfahrt
-- EINMAL in Supabase > SQL Editor ausführen.
-- ============================================================

alter table public.rides
add column if not exists ride_mode text not null default 'single';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rides_ride_mode_check'
  ) then
    alter table public.rides
    add constraint rides_ride_mode_check
    check (ride_mode in ('single','group'));
  end if;
end $$;

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
on public.ride_passengers(ride_id, sort_order);

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
    where r.id = ride_passengers.ride_id
      and (
        r.assigned_driver = auth.uid()
        or auth.uid() = any(r.assigned_drivers)
      )
  )
);

drop policy if exists ride_passengers_insert_dispatch on public.ride_passengers;
create policy ride_passengers_insert_dispatch
on public.ride_passengers
for insert
to authenticated
with check (
  public.current_user_role() in ('admin','dispatcher')
);

drop policy if exists ride_passengers_update_dispatch on public.ride_passengers;
create policy ride_passengers_update_dispatch
on public.ride_passengers
for update
to authenticated
using (
  public.current_user_role() in ('admin','dispatcher')
)
with check (
  public.current_user_role() in ('admin','dispatcher')
);

drop policy if exists ride_passengers_delete_dispatch on public.ride_passengers;
create policy ride_passengers_delete_dispatch
on public.ride_passengers
for delete
to authenticated
using (
  public.current_user_role() in ('admin','dispatcher')
);

-- Fahrer dürfen weiterhin nur Status und Notiz einer Fahrt ändern.
create or replace function public.protect_driver_ride_update()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.current_user_role()='driver' then
    if old.assigned_driver is distinct from auth.uid()
       and not (auth.uid()=any(old.assigned_drivers)) then
      raise exception 'Diese Fahrt ist diesem Fahrer nicht zugewiesen.';
    end if;

    if new.customer_name is distinct from old.customer_name
      or new.customer_phone is distinct from old.customer_phone
      or new.pickup is distinct from old.pickup
      or new.destination is distinct from old.destination
      or new.ride_date is distinct from old.ride_date
      or new.ride_time is distinct from old.ride_time
      or new.assigned_driver is distinct from old.assigned_driver
      or new.assigned_drivers is distinct from old.assigned_drivers
      or new.driver_name is distinct from old.driver_name
      or new.driver_names is distinct from old.driver_names
      or new.vehicle_id is distinct from old.vehicle_id
      or new.vehicle_name is distinct from old.vehicle_name
      or new.ride_type is distinct from old.ride_type
      or new.series_id is distinct from old.series_id
      or new.ride_mode is distinct from old.ride_mode then
      raise exception 'Fahrer dürfen nur Status und Notiz ändern.';
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  begin
    alter publication supabase_realtime
    add table public.ride_passengers;
  exception
    when duplicate_object then null;
  end;
end $$;

-- Fertig.
