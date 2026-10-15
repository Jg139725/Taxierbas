-- Gezielte Ergänzung für Release 14.5. Bestehende SQL-Pakete nicht erneut ausführen.
-- Erst nach Reaktivierung des Taxi-Erbas-Projekts anwenden und RLS testen.
begin;
create table public.portal_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  phone text not null default '' check (length(phone) <= 100),
  pickup text not null default '' check (length(pickup) <= 500),
  destination text not null default '' check (length(destination) <= 500),
  created_at timestamptz not null default now()
);
alter table public.portal_customers enable row level security;
revoke all on public.portal_customers from anon, authenticated;
grant select, insert, update on public.portal_customers to authenticated;
create policy portal_customers_office_read on public.portal_customers
for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','dispatcher')));
create policy portal_customers_office_insert on public.portal_customers
for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','dispatcher')));
create policy portal_customers_office_update on public.portal_customers
for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','dispatcher')))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','dispatcher')));
commit;
-- Kontrolle: als aktiver Disponent speichern/lesen/ändern; als Fahrer und anonym
-- darf kein Kundenzugriff möglich sein. Keine echten Kundendaten für Testdaten nutzen.
