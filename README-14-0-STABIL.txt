TAXI ERBAS – PAKET 14.0 STABIL / RETTUNG
=============================================

Dieses Paket basiert wieder auf der letzten stabilen Portal-Version.
Die problematischen Auth-/Datenänderungen aus 13.9 wurden NICHT übernommen.

WIEDERHERGESTELLT:
- Fahrer erscheinen wieder in der Leitstelle.
- Fahrzeuge erscheinen wieder.
- Fahreransicht mit seinen Fahrzeugen/Fahrten bleibt erhalten.
- Navigation/Google Maps bleibt erhalten.
- Fahrtbestätigung bleibt erhalten.

GEFIXT:
1. LOGIN
- persistSession + localStorage.
- Kein eigener neuer Storage-Key.
- Bei einem kurzen Daten-/Netzfehler wird die Session NICHT mehr gelöscht.
- Normaler Reload soll angemeldet bleiben.

2. AUTOMATISCHE AKTUALISIERUNG
- Supabase Realtime.
- Zusätzlich alle 8 Sekunden Hintergrund-Abgleich.
- Aktualisierung beim Zurückkehren zu Safari / App.
- Aktualisierung wenn Internet wieder da ist.

3. FAHRER DARF NICHT ANLEGEN
- Fahrt/Fahrzeug/Wiederholung Buttons für Fahrer weg.
- JavaScript blockiert zusätzlich.
- Supabase SQL blockiert das Anlegen neuer Fahrten serverseitig.

4. BÜRO SIEHT BESTÄTIGUNG
Direkt an der Fahrt:
- ✓ Bestätigt
- • Noch offen
- ✕ Abgelehnt

5. BENACHRICHTIGUNGEN
- Fehlerhafte notifyRide-Funktion repariert.
- Bei neuer/änderter zugewiesener Fahrt wird eine Benachrichtigung ausgelöst,
  wenn das Portal aktiv ist und Benachrichtigungen erlaubt sind.
- Service Worker cached KEINE Website-Dateien mehr, damit keine alten Versionen hängen bleiben.

IPHONE:
Für iPhone-Benachrichtigungen das Portal über Safari:
Teilen → Zum Home-Bildschirm hinzufügen
und anschließend aus dem Home-Bildschirm öffnen.

INSTALLATION – WICHTIG IN DIESER REIHENFOLGE:

A) SUPABASE
1. SQL Editor → New query
2. SUPABASE-14-0-STABIL.sql komplett einfügen
3. Run → Success

B) GITHUB ERSETZEN
1. portal.html
2. assets/js/portal-live.js
3. assets/js/supabase-config.js
4. assets/css/portal.css
5. portal-sw.js
6. portal.webmanifest

C) DANACH
- Portal einmal komplett schließen
- Safari neu öffnen
- Seite einmal hart neu laden
- EINMAL neu anmelden
- Danach Reload testen

Hinweis:
Echte Push-Nachrichten bei komplett geschlossener Web-App brauchen zusätzlich
einen Web-Push-Versanddienst/Backend. Dieses Paket stabilisiert zunächst die
Benachrichtigungen bei laufender bzw. aktiver Portal-Web-App.
