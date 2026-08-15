TAXI ERBAS – PAKET 14.1
IPHONE LOGIN / RELOAD FIX
==========================

Dieses Paket ändert NUR den Login beim Neuladen.
Fahrer, Fahrzeuge, Fahrten, Kalender, Bestätigungen und Datenbank-Rechte bleiben wie in 14.0.

Was geändert wurde:
- Beim Reload wird NICHT sofort die Loginmaske gezeigt.
- Das Portal wartet auf Supabase INITIAL_SESSION.
- Supabase liest die gespeicherte Session aus localStorage.
- getSession() dient als zweiter Check.
- Ein kurzer Netzwerk-/Profilfehler meldet den Fahrer NICHT mehr ab.
- TOKEN_REFRESHED wird übernommen, ohne die Seite neu anzumelden.
- Beim normalen Login wird nicht mehr signOut() ausgeführt, nur weil Portaldaten kurz nicht laden.

Installation:
1. portal.html ersetzen
2. assets/js/portal-live.js ersetzen
3. assets/js/supabase-config.js ersetzen
4. assets/css/portal.css ersetzen
5. portal-sw.js ersetzen
6. portal.webmanifest ersetzen

KEIN SUPABASE SQL AUSFÜHREN.

iPhone-Test:
1. Nicht im privaten Safari-Modus.
2. Einmal anmelden.
3. Seite neu laden.
4. Login sollte erhalten bleiben.
5. Safari schließen, neu öffnen und nochmals testen.
