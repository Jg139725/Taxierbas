TAXI ERBAS – PAKET 13.8
MOBILE SYNC + LOGIN MERKEN
================================

BEHEBT:
1. Neue Fahrten erscheinen auf einem zweiten/neuen Handy zuverlässig.
   - Supabase Realtime
   - zusätzlich automatisches Nachladen alle 10 Sekunden
   - Nachladen beim Zurückkehren zur Seite
   - Nachladen beim Fokus auf Safari
   - Nachladen nach Wiederherstellung der Internetverbindung

2. Fahrer muss sich nach normalem Neuladen nicht erneut anmelden.
   - persistSession = true
   - localStorage explizit aktiviert
   - autoRefreshToken = true
   - ein kurzfristiger Netzfehler beim Laden führt NICHT mehr automatisch zum Logout

3. Kleiner Leitstellen-Fix:
   - Bestätigungsanzeige verwendet wieder die richtige Fahrt.

INSTALLATION:
1. portal.html ersetzen
2. assets/js/portal-live.js ersetzen
3. assets/js/supabase-config.js ersetzen
4. assets/css/portal.css ersetzen
5. Auf jedem Handy Portal einmal komplett neu laden.

WICHTIG AUF IPHONE:
- Nicht im privaten Safari-Modus verwenden.
- Nach dem Update einmal normal anmelden.
- Danach sollte ein normales Neuladen die Anmeldung behalten.

KEIN NEUER SUPABASE-SQL-CODE NÖTIG.
