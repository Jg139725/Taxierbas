TAXI ERBAS – PAKET 13.4
FAHRERANSICHT & FAHRTBESTÄTIGUNG
================================

BEHEBT:
- Fahrer sehen unter „Fahrten“ nur ihre eigenen zugewiesenen Fahrten.
- Auch der 2., 3. usw. Fahrer einer Mehrpersonenfahrt sieht die Fahrt.
- Fahrer muss eine neu zugewiesene Fahrt zuerst bestätigen.
- Button „Fahrt bestätigen“.
- Optional „Ablehnen“.
- Erst nach Bestätigung kann der Fahrer den Fahrtstatus ändern.
- Disposition/Admin kann weiterhin alle Fahrten sehen.

INSTALLATION:
1. SUPABASE-Paket-13-4.sql in Supabase > SQL Editor ausführen.
2. Danach in GitHub ersetzen:
   - portal.html
   - assets/js/portal-live.js
   - assets/css/portal.css
3. GitHub Pages aktualisieren lassen.
4. Portal mit Cmd + Option + R neu laden.

TEST:
1. Als Admin/Disposition eine Fahrt Rafael oder einem anderen Fahrer zuweisen.
2. Ausloggen.
3. Mit diesem Fahrer einloggen.
4. „Fahrten“ öffnen.
5. Die Fahrt muss sichtbar sein.
6. „Fahrt bestätigen“ drücken.
7. Danach Status z.B. auf „Unterwegs“ ändern.
