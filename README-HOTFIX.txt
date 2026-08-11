TAXI ERBAS – PAKET 13.3 HOTFIX

Dieser Hotfix behebt ausschließlich:
- „+ Neue Fahrt“ öffnet kein Fenster
- mögliche Mischung aus alter portal.html und neuer portal-live.js
- Browser lädt jetzt ausdrücklich Version 13.3

INSTALLATION:
1. In GitHub ersetzen:
   - portal.html
   - assets/js/portal-live.js
2. assets/css/portal.css ebenfalls ersetzen, falls du Paket 13.2 noch nicht vollständig hochgeladen hattest.
3. Danach auf der Portal-Seite Cmd + Option + R drücken.

SUPABASE:
Wenn SUPABASE-Paket-13-2.sql bereits mit Success ausgeführt wurde,
musst du SQL NICHT erneut ausführen.

TEST:
Nach dem Neuladen auf „+ Neue Fahrt“ klicken.
Es muss sofort das Fenster mit:
- Einzelfahrt
- Mehrpersonenfahrt
erscheinen.
