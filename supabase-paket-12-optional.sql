-- TAXI ERBAS – PAKET 12 (OPTIONAL)
-- Nur ausführen, falls neue Fahrer nicht automatisch ohne Neuladen erscheinen sollen.

do $$
begin
  begin
    alter publication supabase_realtime add table public.profiles;
  exception when duplicate_object then null;
  end;
end $$;
