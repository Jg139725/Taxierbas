# Portal Release 14.5 – vorbereiteter Entwurf

- Tagesliste als echte PDF-Datei über Fahrten oder den Kalendertag herunterladen. Vollständiger gewählter Tag einschließlich Gruppenpersonen; Fahrer erhalten nur eigene zugewiesene Fahrten.
- Kunden zentral mit Name, Telefon, Abholadresse und üblichem Ziel anlegen/bearbeiten. Übernahme in Einzel-, Gruppen- und Wiederholungsfahrten. Zugriff nur aktive Admins/Disponenten.
- Mehrere der angezeigten Fahrten auswählen und gemeinsam entfernen. Serientermine werden mit der vorhandenen RPC einzeln ausgesetzt, die Serie bleibt bestehen. Fehler werden gemeldet.
- Wiederholungsfahrten mit lesbaren Routen, Zeitraum, Wochentagen und responsiven Karten.
- Fahrten zeigt die letzten 20 nach Anlagezeit, neueste zuerst. Bestehende automatische Synchronisierung bleibt bestehen; Kalender/Tagesexport werden nicht auf 20 begrenzt.

## Vor Freigabe

Das Supabase-Projekt Taxi-Erbas (hhuliziurzwqcocuhtiq) ist pausiert. Live-Abfrage am 15.10.2026 endete im Timeout. Keine Datenbankänderungen ausgeführt.

1. Bestehendes Projekt im Supabase-Dashboard reaktivieren.
2. Bestehende Profile/Rollenregeln prüfen. Gezielte Ergänzung SUPABASE-KUNDEN-14-5.sql einmalig ausführen; alte Setup-Pakete nicht wiederholen. SQL ist vorbereitet, noch nicht gegen die Live-Datenbank validiert.
3. Als aktiver Disponent und Admin: Testkunden anlegen, bearbeiten und in alle drei Fahrtarten übernehmen. Als Fahrer, inaktiver Benutzer und anonym muss Kundenzugriff gesperrt sein. Vorhandene Fahrerrechte für Fahrten unverändert prüfen.
4. Auf Handy und Desktop mit echten Rollen testen: Tages-PDF, Auswahl inkl. Serienausnahme, Synchronisierung zweier Geräte und Kalender.
5. Erst anschließend Branch übernehmen und Website freigeben.

## Bereits geprüft

JavaScript-Syntax, Diff-Whitespace, 20er-Sortierung ohne Mutation der Ausgangsliste, paginierte Abfrage mit 1.201 Datensätzen sowie PDF mit 27 Fahrten, Gruppenperson und sehr langem Hinweis (5 Seiten). Erste PDF-Seite visuell geprüft. Browser- und Live-RLS-Tests stehen aus.

PDF-Bibliothek: jsPDF 2.5.2, lokal mitgeliefert; Lizenzhinweise im Bibliothekskopf beibehalten.
