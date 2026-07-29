TAXI ERBAS – PAKET 12
DISPONENTEN-LEITSTELLE
================================

NEU:
- professionelle Leitstellen-Startseite für Administrator und Disponent
- Fahrzeuge, offene Fahrten und Fahrer gleichzeitig sichtbar
- Live-Uhr und aktuelle Kennzahlen
- automatische Anzeige freier Fahrer
- Fahrerstatus wird aus den zugewiesenen Fahrten ermittelt:
  Frei / Zugewiesen / Unterwegs
- Fahrt direkt aus der Leitstelle zuweisen oder bearbeiten
- Fahrzeug direkt aus der Leitstelle öffnen
- responsive Darstellung für Computer, Tablet und Handy
- Fahrer sehen die Leitstelle nicht; sie erhalten weiterhin ihre eigene Ansicht

INSTALLATION:
1. ZIP entpacken.
2. Alle Dateien in das GitHub-Repository „Taxierbas“ hochladen.
3. Vorhandene Dateien ersetzen.
4. GitHub Pages abwarten.
5. Safari mit Cmd + Option + R neu laden.

FAHRER IN SUPABASE ANLEGEN:
1. Supabase > Authentication > Users.
2. „Add user“ auswählen.
3. E-Mail-Adresse und eigenes Passwort des Fahrers eintragen.
4. „Auto Confirm User“ aktivieren.
5. Benutzer erstellen.

Durch den vorhandenen Trigger wird automatisch ein Profil mit der Rolle „driver“
angelegt. Falls statt des richtigen Namens nur der Teil vor der E-Mail angezeigt wird,
im SQL Editor ausführen:

update public.profiles
set full_name = 'Vorname Nachname', role = 'driver', active = true
where id = 'UUID-DES-FAHRERS';

WICHTIG:
- Nur in Authentication einen Benutzer anzulegen reicht technisch für den Login.
- Für die richtige Namensanzeige muss full_name im Profil stimmen.
- Die Rolle muss „driver“ sein. Der vorhandene Trigger setzt diese Rolle automatisch.
- Niemals den Secret Key oder service_role Key in GitHub eintragen.

OPTIONAL:
Die Datei „supabase-paket-12-optional.sql“ aktiviert Live-Aktualisierungen für
neu angelegte oder geänderte Fahrerprofile. Ohne diesen Zusatz genügt „Daten neu laden“.

VORHANDENE DATEN:
Fahrzeuge, Fahrten, Benutzer und Supabase-Daten werden durch dieses Paket nicht gelöscht.
