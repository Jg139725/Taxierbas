-- ============================================================
-- TAXI ERBAS – PAKET 13.9
-- Rechte, Bestätigungsstatus, Realtime
-- EINMAL in Supabase > SQL Editor > New Query ausführen.
-- ============================================================

-- ------------------------------------------------------------
-- A) FAHRER DÜRFEN KEINE FAHRTEN ANLEGEN
-- Alle vorhandenen INSERT-Policies auf rides werden entfernt.
-- Danach darf INSERT ausschließlich Admin / Disposition.
-- ------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rides'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.rides', p.policyname);
  end loop;
end $$;

create policy rides_insert_dispatch_only_13_9
on public.rides
for insert
to authenticated
with check (
  public.current_user_role() in ('admin','dispatcher')
);

-- Löschen ebenfalls ausschließlich Büro/Admin.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rides'
      and cmd = 'DELETE'
  loop
    execute format('drop policy if exists %I on public.rides', p.policyname);
  end loop;
end $$;

create policy rides_delete_dispatch_only_13_9
on public.rides
for delete
to authenticated
using (
  public.current_user_role() in ('admin','dispatcher')
);

-- ------------------------------------------------------------
-- B) BESTÄTIGUNGEN:
-- Büro/Admin sieht ALLE Bestätigungen.
-- Fahrer sieht nur seine eigene.
-- ------------------------------------------------------------

alter table public.ride_confirmations enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ride_confirmations'
      and cmd = 'SELECT'
  loop
    execute format(
      'drop policy if exists %I on public.ride_confirmations',
      p.policyname
    );
  end loop;
end $$;

create policy ride_confirmations_read_13_9
on public.ride_confirmations
for select
to authenticated
using (
  public.current_user_role() in ('admin','dispatcher')
  or driver_id = auth.uid()
);

-- Fahrer darf seine Bestätigung eintragen / aktualisieren.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ride_confirmations'
      and cmd in ('INSERT','UPDATE')
  loop
    execute format(
      'drop policy if exists %I on public.ride_confirmations',
      p.policyname
    );
  end loop;
end $$;

create policy ride_confirmations_insert_13_9
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

create policy ride_confirmations_update_13_9
on public.ride_confirmations
for update
to authenticated
using (driver_id = auth.uid())
with check (driver_id = auth.uid());

-- ------------------------------------------------------------
-- C) REALTIME SICHER AKTIVIEREN
-- ------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.rides;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.ride_confirmations;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- FERTIG
-- ============================================================
