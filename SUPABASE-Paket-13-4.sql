-- ============================================================
-- TAXI ERBAS – PAKET 13.4
-- Fahrer sehen eigene Fahrten + Fahrtbestätigung
-- EINMAL im Supabase SQL Editor ausführen.
-- ============================================================

-- 1. Bestätigung pro Fahrer und Fahrt
create table if not exists public.ride_confirmations (
  ride_id uuid not null references public.rides(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','confirmed','declined')),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (ride_id, driver_id)
);

alter table public.ride_confirmations enable row level security;

drop policy if exists ride_confirmations_read on public.ride_confirmations;
create policy ride_confirmations_read
on public.ride_confirmations
for select
to authenticated
using (
  public.current_user_role() in ('admin','dispatcher')
  or driver_id = auth.uid()
);

drop policy if exists ride_confirmations_driver_insert on public.ride_confirmations;
create policy ride_confirmations_driver_insert
on public.ride_confirmations
for insert
to authenticated
with check (
  driver_id = auth.uid()
  and exists (
    select 1
    from public.rides r
    where r.id = ride_confirmations.ride_id
      and (
        r.assigned_driver = auth.uid()
        or auth.uid() = any(coalesce(r.assigned_drivers,'{}'::uuid[]))
      )
  )
);

drop policy if exists ride_confirmations_driver_update on public.ride_confirmations;
create policy ride_confirmations_driver_update
on public.ride_confirmations
for update
to authenticated
using (
  driver_id = auth.uid()
)
with check (
  driver_id = auth.uid()
);

-- 2. Fahrer müssen auch Fahrten sehen, bei denen sie NICHT der erste Fahrer sind.
drop policy if exists rides_read on public.rides;
drop policy if exists rides_select on public.rides;
drop policy if exists "rides_read" on public.rides;
drop policy if exists "rides_select" on public.rides;

create policy "rides_read_13_4"
on public.rides
for select
to authenticated
using (
  public.current_user_role() in ('admin','dispatcher')
  or assigned_driver = auth.uid()
  or auth.uid() = any(coalesce(assigned_drivers,'{}'::uuid[]))
);

-- 3. Fahrer dürfen Status ihrer eigenen zugewiesenen Fahrt ändern.
drop policy if exists "rides_update_driver_13_4" on public.rides;
create policy "rides_update_driver_13_4"
on public.rides
for update
to authenticated
using (
  public.current_user_role() in ('admin','dispatcher')
  or assigned_driver = auth.uid()
  or auth.uid() = any(coalesce(assigned_drivers,'{}'::uuid[]))
)
with check (
  public.current_user_role() in ('admin','dispatcher')
  or assigned_driver = auth.uid()
  or auth.uid() = any(coalesce(assigned_drivers,'{}'::uuid[]))
);

-- 4. Mehrpersonen-Daten ebenfalls für zugewiesene Fahrer lesbar.
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
        or auth.uid() = any(coalesce(r.assigned_drivers,'{}'::uuid[]))
      )
  )
);

-- 5. Realtime
do $$
begin
  begin
    alter publication supabase_realtime
    add table public.ride_confirmations;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
