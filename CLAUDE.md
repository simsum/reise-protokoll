# Hinweise für die Weiterentwicklung

Reise-Protokoll ist ein eigenständiges Tool (kein Teil von Foto-Protokoll, nur gleiche Technik): Reisetagebuch als PDF mit Vorlagen nach Reiseart. Diese Datei liest Claude automatisch, wenn im Projektordner gearbeitet wird.

## Arbeitsweise

- Sprache von Oberfläche, Kommentaren, Doku und Commit-Nachrichten: Deutsch.
- Quellcode in `src/` (`index.html`, `styles.css`, `js/*.js`). `npm run build` hängt die JS-Dateien nach Dateinamen sortiert zusammen und schreibt `dist/Reise-Protokoll.html` (eine einzelne Datei, funktioniert per Doppelklick).
- Vor jedem Commit `npm test` (baut automatisch, Playwright-Test in `test/e2e.mjs`, Bilder landen in `test/out/`, nicht eingecheckt).
- Version in `package.json` erhöhen, wenn sich etwas für Nutzer ändert.

## Aufbau (js-Dateien in Lade-Reihenfolge)

| Datei | Inhalt |
|---|---|
| `00-util` | Datum (ISO-Text, UTC), Zahlen, Geo, Farben, Download |
| `10-model` | Datenmodell `trip`, Ableitungen (`tripStats`), Route aus Tagen/Fotos, Zusammenfassungsvorschlag, Beispielreisen |
| `20-themes` | Farbschemata `THEMES`, Symbole `ICONS` (24×24, nur Linien) |
| `30-templates` | **Vorlagen** `TEMPLATES` (Registry, Beschreibung des Vertrags im Dateikopf) |
| `35-text` | Schrift-Metriken, `wrapAll`, `fitT`, `clean` (WinAnsi) |
| `40-layout` | Seitenmodell: `coverPage`, `dayPages`, `costPages`, `layoutTrip` |
| `50-render` | `pageHtml` (Vorschau) und `buildPdf` (pdf-lib) aus dem Seitenmodell |
| `60-map` | Karte: OSM-Kacheln + Route auf Canvas, OSRM, Schemakarte als Rückfall |
| `70-photos` | Foto: Original + Arbeitskopie, EXIF, HEIC, Drehen/Ausschnitt (`viewMarks`, `drawView`), Markierungs-Geometrie, Nominatim |
| `72-places` | Ort pro Foto: Nominatim (Zoom 18), Offline-Ortsliste (`data/orte.b64`, GeoNames CC BY 4.0), `placeMode` |
| `75-project` | Projektdaten im PDF: `cleanTrip()` (Prüfen), `collectAttachments()`, `readProjectPdf()` |
| `76-embed` | Einbetten: `compressOriginal()` (verkleinern, EXIF übernehmen), `renderPhotoPx()` (Bild in der gewählten dpi aus dem Original) |
| `78-weather` | Wetter aus Fotodaten: Bright Sky (DWD) → Open-Meteo, `deriveDayWeather()`, Warteschlange `queueWeather()` |
| `80-ui` | Reiter, Ereignisse, Speichern/Öffnen, Autosave (IndexedDB) |
| `90-main` | Start |

## Feste Regeln

- Vorschau und PDF entstehen **immer** aus dem Seitenmodell (`layoutTrip()` → `pageHtml()` / `buildPdf()`). Keine zweite Layout-Logik. Neue Zeichenoperation = in beiden Renderern ergänzen (Beschreibung am Anfang von `40-layout.js`).
- Texte werden mit den Metriken der PDF-Standardschriften gemessen (`tw()`), damit Umbrüche in Vorschau und PDF gleich sind. Jeder Text läuft durch `clean()` (Standardschriften kennen nur WinAnsi; z. B. „→“ wird „–“).
- **Vorlagen**: Es gibt eine Vorlage `reise` für alle Reisearten (früher `kurztrip` und `rundreise`; `migrateTrip()` stellt alte Daten und PDFs um, das frühere Reiseziel wird zum Ort der Tage). Teile eines Tages erscheinen nur, wenn sie befüllt sind (Streckenleiste nur mit km/Fahrzeit, Tagesplan, Highlights). **Neue Vorlage** = ein Eintrag in `TEMPLATES` (`dayFields`, `sections`, `info`, `dayHeader`, `strip`, optional `stats`); die Auswahl erscheint, sobald es mehr als eine gibt. Neue Tagesfelder zusätzlich in `newDay()` und `DAY_FIELDS` (80-ui). Die Deckseite ist für alle Vorlagen gleich aufgebaut (Dauer, Kennzahlen, Karte, Zusammenfassung).
- **Neues Farbschema** = ein Eintrag in `THEMES`.
- Die Deckseitenkarte ist nach dem Erzeugen ein festes Bild (`trip.mapImg`); Änderungen an der Route ändern sie nicht, der Reiter zeigt nur einen Hinweis (`mapStale`).
- Externe Bibliotheken nur als einzelnes UMD-Skript von cdnjs/jsDelivr (pdf-lib, exifr). Alles andere inline.
- **Projekt = PDF.** `buildPdf()` hängt `reise-protokoll-projekt.json` (alles außer Bilddaten), die Fotos (`0001 name.jpg`, Original oder Arbeitskopie), `karte.jpg` und `titelfoto.jpg` an. Gelesen wird mit `readProjectPdf()`. **Alles aus einem PDF ist unsicher** und läuft vor jeder Verwendung durch `cleanTrip()` (nur bekannte Felder, Typen, Bereiche, Aufzählungen, Längen; Bilder nie aus Textfeldern, nur aus Anhängen mit JPEG-Prüfung). Neue Felder in `newTrip()`/`newDay()` **und** in `cleanTrip()` aufnehmen, bei unverträglichen Änderungen `FORMAT` erhöhen und alte Formate weiter lesen. `test/projekt.mjs` enthält einen Test mit manipulierten Daten.
- Fotos: `file` (Original, bleibt unverändert) und `src` (Arbeitskopie, höchstens 1600 px). Markierungen liegen in Pixeln der Arbeitskopie (`bw` × `bh`), Drehung/Ausschnitt nur als Ansicht `vsrc`; gezeichnet wird immer über `photoView()`/`viewMarks()`. Beim Wiederöffnen wird die Arbeitskopie aus dem eingebetteten Foto neu berechnet, Markierungen werden bei abweichender Größe skaliert.

## Erkenntnisse

- Text-`y` im Seitenmodell ist die **Oberkante** der Zeile (CSS `line-height: 1`); das PDF setzt die Grundlinie bei `y + BASELINE × Größe`.
- pdf-lib: `drawSvgPath` skaliert auch die Linienbreite mit `scale`; Bilder werden mit Klippfad zugeschnitten (`pushGraphicsState` … `clip`).
- Kacheln kommen per `fetch` (damit 403 erkannt wird), Reihenfolge `tileSources()`: bei `file://` OSM.de → Esri → OSM (Hauptserver sperrt ohne Referer), sonst OSM → OSM.de → Esri (alle mit CORS `*`). Zusätzlich erkennt `looksBlocked()` die Sperrkachel (gelb-schwarz gestreift) am Bild, auch bei Status 200. `tile.openstreetmap.org` antwortet ohne Referer (Datei von der Festplatte) mit 403 und einer Fehlerkachel – nicht als `<img>` laden, sonst wird die Fehlerkachel in die Karte gemalt. CARTO (`basemaps.cartocdn.com`) ist nicht nutzbar (Schlüssel nötig, Wasserzeichen). Fehlen Kacheln insgesamt, entsteht automatisch die Schemakarte. Öffentliche Dienste (Kacheln, Nominatim max. 1 Anfrage/s, OSRM-Demo-Server) nur für gelegentliche Nutzung; Quellenangabe steht auf der Karte.
- Tests: Playwright ersetzt alle Netzzugriffe durch Testantworten (`test/e2e.mjs`: Oberfläche, Karte, Vorlagen; `test/projekt.mjs`: Mehrfach-Import, PDF-Roundtrip, manipulierte PDFs). PDFs lassen sich mit `pip install pymupdf` zu Bildern rendern, um das Layout zu prüfen.

## Windows

- Node und Git sind installiert. Playwright-Chromium liegt in `%LOCALAPPDATA%\ms-playwright` (`npx playwright install chromium`, falls es fehlt).
