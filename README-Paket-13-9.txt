TAXI ERBAS – PAKET 13.9
RECHTE + BESTÄTIGUNG + AUTO-SYNC
================================

BEHEBT:

1. BÜRO SIEHT BESTÄTIGUNG NICHT
- Supabase-Leserechte werden eindeutig gesetzt.
- Admin und Disposition dürfen alle Fahrerbestätigungen lesen.
- Fahrer sieht nur seine eigene Bestätigung.
- Realtime für ride_confirmations wird abgesichert.
- Leitstelle zeigt pro Fahrer:
  ✓ Bestätigt
  • Noch offen
  ✕ Abgelehnt

2. FAHRER KANN NEUE FAHRT ANLEGEN
- Buttons werden für Fahrer vollständig ausgeblendet.
- Klick-Handler blockiert Fahrer zusätzlich.
- WICHTIG: Supabase selbst blockiert INSERT für Fahrer.
  Selbst wenn jemand den Browser-Code manipuliert, kann ein Fahrer keine Fahrt anlegen.

3. FAHRTEN ERSCHEINEN ERST NACH MANUELLEM NEULADEN
- Realtime bleibt aktiv.
- Bei Verbindungsabbruch automatische Neuverbindung.
- Zusätzlich automatischer Abgleich alle 5 Sekunden.
- Sofortiger Abgleich bei:
  Rückkehr zur Seite
  Safari-Fokus
  Internet wieder online
  Seiten-Wiederherstellung

4. ANMELDUNG BEIM NEULADEN
- Supabase persistSession bleibt aktiv.
- Anmeldung wird in localStorage gespeichert.
- sessionStorage dient als zusätzlicher Fallback für Reloads.
- Token wird automatisch erneuert.

INSTALLATION:

A) SUPABASE
1. Supabase öffnen.
2. SQL Editor.
3. + New query.
4. Kompletten Inhalt aus SUPABASE-Paket-13-9.sql einfügen.
5. Run.
6. Es muss Success erscheinen.

B) GITHUB
Danach ersetzen:
- portal.html
- assets/js/portal-live.js
- assets/js/supabase-config.js
- assets/css/portal.css

C) HANDYS
- Portal einmal komplett schließen und neu öffnen.
- Einmal normal anmelden.
- Nicht im privaten Safari-Modus verwenden.
- Danach sollte ein normaler Reload die Anmeldung erhalten.

TEST:
1. Büro weist einem Fahrer eine Fahrt zu.
2. Fahrerportal offen lassen.
3. Innerhalb weniger Sekunden muss die Fahrt erscheinen.
4. Fahrer bestätigt.
5. Im Büro muss innerhalb weniger Sekunden ✓ Bestätigt erscheinen.
6. Fahrer darf nirgends eine neue Fahrt erstellen können.
