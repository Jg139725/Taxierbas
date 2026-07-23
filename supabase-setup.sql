-- ============================================================
-- TAXI ERBAS – SUPABASE LIVE-SYSTEM
-- Im Supabase SQL Editor vollständig einfügen und auf RUN klicken.
-- ============================================================

create extension if not exists pgcrypto;

-- 1. MITARBEITERPROFILE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Neuer Mitarbeiter',
  role text not null default 'driver'
    check (role in ('admin', 'dispatcher', 'driver')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Jeder neu angelegte Auth-Benutzer erhält automatisch ein Fahrerprofil.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'driver'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Hilfsfunktion für sichere Rollenprüfung in RLS-Regeln.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

grant execute on function public.current_user_role() to authenticated;

-- 2. FAHRZEUGE
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text not null unique,
  location text not null default 'Betriebshof',
  status text not null default 'Verfügbar'
    check (status in ('Verfügbar', 'Unterwegs', 'Werkstatt', 'Nicht verfügbar')),
  fuel_level text not null default 'Voll'
    check (fuel_level in ('Voll', '¾ voll', 'Halbvoll', '¼ voll', 'Reserve')),
  cleanliness text not null default 'Sauber'
    check (cleanliness in ('Sauber', 'Leicht verschmutzt', 'Reinigung erforderlich')),
  mileage integer not null default 0 check (mileage >= 0),
  current_driver_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. FAHRTEN
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text,
  pickup text not null,
  destination text not null,
  ride_date date not null,
  ride_time time not null,
  assigned_driver uuid references public.profiles(id) on delete set null,
  driver_name text,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  vehicle_name text,
  status text not null default 'Offen'
    check (status in ('Offen', 'Zugewiesen', 'Unterwegs', 'Abgeschlossen')),
  ride_type text not null default 'Taxifahrt'
    check (ride_type in ('Taxifahrt', 'Krankenfahrt', 'Flughafentransfer', 'Schülerfahrt')),
  note text,
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Zeitstempel automatisch aktualisieren.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute procedure public.set_updated_at();

drop trigger if exists rides_set_updated_at on public.rides;
create trigger rides_set_updated_at
before update on public.rides
for each row execute procedure public.set_updated_at();

-- Fahrer dürfen bei einer Fahrt nur Status und Notiz ändern.
create or replace function public.protect_driver_ride_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'driver' then
    if old.assigned_driver is distinct from auth.uid() then
      raise exception 'Diese Fahrt ist nicht diesem Fahrer zugewiesen.';
    end if;

    if new.customer_name is distinct from old.customer_name
       or new.customer_phone is distinct from old.customer_phone
       or new.pickup is distinct from old.pickup
       or new.destination is distinct from old.destination
       or new.ride_date is distinct from old.ride_date
       or new.ride_time is distinct from old.ride_time
       or new.assigned_driver is distinct from old.assigned_driver
       or new.driver_name is distinct from old.driver_name
       or new.vehicle_id is distinct from old.vehicle_id
       or new.vehicle_name is distinct from old.vehicle_name
       or new.ride_type is distinct from old.ride_type
       or new.created_by is distinct from old.created_by then
      raise exception 'Fahrer dürfen nur Status und Notiz ändern.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rides_protect_driver_update on public.rides;
create trigger rides_protect_driver_update
before update on public.rides
for each row execute procedure public.protect_driver_ride_update();

-- 4. ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.rides enable row level security;

-- Alte Policies sicher entfernen, falls das Skript erneut ausgeführt wird.
drop policy if exists "profiles_read" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "vehicles_read_authenticated" on public.vehicles;
drop policy if exists "vehicles_insert_dispatch" on public.vehicles;
drop policy if exists "vehicles_update_authenticated" on public.vehicles;
drop policy if exists "vehicles_delete_dispatch" on public.vehicles;
drop policy if exists "rides_read_by_role" on public.rides;
drop policy if exists "rides_insert_dispatch" on public.rides;
drop policy if exists "rides_update_by_role" on public.rides;
drop policy if exists "rides_delete_dispatch" on public.rides;

create policy "profiles_read"
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or public.current_user_role() in ('admin', 'dispatcher')
);

create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "vehicles_read_authenticated"
on public.vehicles for select
to authenticated
using (true);

create policy "vehicles_insert_dispatch"
on public.vehicles for insert
to authenticated
with check (public.current_user_role() in ('admin', 'dispatcher'));

-- Fahrer dürfen den Fahrzeugzustand aktualisieren.
create policy "vehicles_update_authenticated"
on public.vehicles for update
to authenticated
using (true)
with check (true);

create policy "vehicles_delete_dispatch"
on public.vehicles for delete
to authenticated
using (public.current_user_role() in ('admin', 'dispatcher'));

create policy "rides_read_by_role"
on public.rides for select
to authenticated
using (
  public.current_user_role() in ('admin', 'dispatcher')
  or assigned_driver = (select auth.uid())
);

create policy "rides_insert_dispatch"
on public.rides for insert
to authenticated
with check (public.current_user_role() in ('admin', 'dispatcher'));

create policy "rides_update_by_role"
on public.rides for update
to authenticated
using (
  public.current_user_role() in ('admin', 'dispatcher')
  or assigned_driver = (select auth.uid())
)
with check (
  public.current_user_role() in ('admin', 'dispatcher')
  or assigned_driver = (select auth.uid())
);

create policy "rides_delete_dispatch"
on public.rides for delete
to authenticated
using (public.current_user_role() in ('admin', 'dispatcher'));

-- 5. REALTIME
-- Tabellen zur Realtime-Publikation hinzufügen.
do $$
begin
  begin
    alter publication supabase_realtime add table public.rides;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.vehicles;
  exception when duplicate_object then null;
  end;
end $$;

-- 6. INDEXE
create index if not exists rides_date_time_idx
  on public.rides (ride_date, ride_time);

create index if not exists rides_driver_idx
  on public.rides (assigned_driver);

create index if not exists rides_vehicle_idx
  on public.rides (vehicle_id);

-- ============================================================
-- NACH DEM AUSFÜHREN:
-- 1. Authentication > Users: deinen ersten Benutzer anlegen.
-- 2. Danach unten die UUID einsetzen und ausführen:
--
-- update public.profiles
-- set full_name = 'Justin Grundei', role = 'admin'
-- where id = 'HIER-DIE-USER-UUID-EINSETZEN';
--
-- Weitere Rollen:
-- role = 'dispatcher'
-- role = 'driver'
-- ============================================================
