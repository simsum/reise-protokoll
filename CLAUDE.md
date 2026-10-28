# Hinweise für die Weiterentwicklung

Reise-Protokoll ist ein eigenständiges Tool (kein Teil von Foto-Protokoll, nur gleiche Technik): Reisetagebuch als PDF; die Seiten jedes Tages sind ein frei belegbares Kachelraster. Diese Datei liest Claude automatisch, wenn im Projektordner gearbeitet wird.

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
| `30-module` | **Module** `MODULES` (Kachel-Inhalte, Vertrag im Dateikopf), `packTiles()` (Raster), Tageshilfen (`parsePlan`, `routeInfo`) |
| `35-text` | Schrift-Metriken, `wrapAll`, `fitT`, `clean` (WinAnsi) |
| `36-markdown` | Markdown für Notiz-Kacheln: `mdInline`, `mdBlocks`, `mdWrap` (Läufe mit gemischten Schriften), `drawMd`; Schriftfamilien `FAMILIES` (Serif/Times, Sans/Helvetica, Mono/Courier, je R/B/I/BI) |
| `37-symbols` | Wettersymbole für die Kachel „Wettersymbol“: `SYMBOLS`, `drawSymbol()` (gefüllte Pfade im 100×100-Raster in Schemafarben); Module mit `fixed: [w, h]` (feste Größe) erzwingt `packTiles()` |
| `40-layout` | Seitenmodell: `coverPage`, `dayPages` (Kopf + Kachelraster, Überlauf auf Folgeseiten), `costPages`, `layoutTrip` |
| `50-render` | `pageHtml` (Vorschau) und `buildPdf` (pdf-lib) aus dem Seitenmodell |
| `60-map` | Karte: OSM-Kacheln + Route auf Canvas, OSRM, Schemakarte als Rückfall |
| `70-photos` | Foto: Original + Arbeitskopie, EXIF, HEIC, Drehen/Ausschnitt (`viewMarks`, `drawView`), Markierungs-Geometrie, Nominatim |
| `72-places` | Ort pro Foto: Nominatim (Zoom 18), Offline-Ortsliste (`data/orte.b64`, GeoNames CC BY 4.0), `placeMode` |
| `75-project` | Projektdaten im PDF: `cleanTrip()` (Prüfen), `collectAttachments()`, `readProjectPdf()` |
| `76-embed` | Einbetten: `compressOriginal()` (verkleinern, EXIF übernehmen), `renderPhotoPx()` (Bild in der gewählten dpi aus dem Original) |
| `78-weather` | Wetter aus Fotodaten: Bright Sky (DWD) → Open-Meteo, `deriveDayWeather()`, Warteschlange `queueWeather()` |
| `79-wikipedia` | Kachel „Wikipedia-Auszug“: `wpSearch`/`wpArticle` (MediaWiki-API), `wdFacts` (Wikidata: Einwohner, Fläche …, Rang- und Stichtagsregeln), `wpNearby` (Umkreissuche `list=geosearch`, höchstens 10 km und 100 Treffer; Beliebtheit = Seitenaufrufe über `prop=pageviews` in Blöcken zu 50 Titeln mit Fortsetzung `pvipcontinue`; nicht `generator=geosearch` mit Fortsetzung, das wiederholt die Suche und löst `cirrussearch-too-busy-error` aus), `wpJson` (wiederholt bei „too busy“), `wpTidy`/`wpCut` (Text aufbereiten, Sätze kürzen), `wikiDraw`, `validWpUrl` (nur diese Adressen werden im PDF verlinkt) |
| `80-ui` | Reiter, Ereignisse, Speichern/Öffnen, Autosave (IndexedDB) |
| `82-preview` | Kacheln in der Vorschau bearbeiten: Rahmen über der Seite (`tileOverlay`, Maße aus `pg.meta`), Auswahl, Ziehen, Größe, Werkzeugleiste `#tb`, Seitenleiste `.pbar` (Seite, Vorschläge `LAYOUTS`, Pinsel), Doppelklick `editTile()` (nur Oberfläche, nicht im PDF) |
| `84-undo` | Rückgängig/Wiederholen des Seitenaufbaus: `changed()` ruft `trackLayout()`; gesichert wird nur `cols` und `pages` (Änderungen innerhalb 600 ms = ein Schritt), Stapel wird in `loadTrip()` geleert |
| `86-wikidialog` | Wikipedia-Fenster: Suche, Trefferwahl, Bearbeiten von Überschrift, Text und Kennzahlen, Vorschau in echter Kachelgröße, „Übernehmen“ schreibt `tile.wp` |
| `87-mapdialog` | Fenster „Karte (Punkt)“ und „Karte (Tag)“: Position wählen (Suche, Ort/Foto/Gerät), Karte verschieben und zoomen, Kartenbild in Kachelgröße erzeugen (`tile.pt`, `tile.ptImg`) |
| `90-main` | Start |

## Feste Regeln

- Vorschau und PDF entstehen **immer** aus dem Seitenmodell (`layoutTrip()` → `pageHtml()` / `buildPdf()`). Keine zweite Layout-Logik. Neue Zeichenoperation = in beiden Renderern ergänzen (Beschreibung am Anfang von `40-layout.js`).
- Texte werden mit den Metriken der PDF-Standardschriften gemessen (`tw()`), damit Umbrüche in Vorschau und PDF gleich sind. Jeder Text läuft durch `clean()` (Standardschriften kennen nur WinAnsi; z. B. „→“ wird „–“).
- **Kacheln statt Vorlagen**: Ein Tag hat `pages[]`, eine Seite `tiles[]` (`{id, mod, w, h, photo?, text?}`), das Raster hat `trip.cols` (3 oder 4) Spalten und `GRID_ROWS` (6) Zeilen. Es gibt keine Positionen im Modell: `packTiles()` setzt die Kacheln der Reihe nach auf das erste freie Rechteck (Breite und Höhe werden begrenzt), was nicht passt, läuft in `dayPages()` auf eine zusätzliche Seite. Ein leeres Modul zeichnet nichts; passt der Inhalt nicht, wird die Schrift kleiner, dann gekürzt, und `warns` bekommt einen Hinweis. **Neues Modul** = ein Eintrag in `MODULES` (`name`, `size(cols)`, `draw(pg, c, tile, r)`). Neue Tagesfelder zusätzlich in `newDay()`, `cleanTrip()` und `DAY_FIELDS`/`DAY_ORDER` (80-ui). Fotos bekommen beim Hinzufügen eine Fotokachel (`addPhotoTiles()`), beim Entfernen verschwindet sie (`pruneTiles()`). **Aufbau übertragen**: `applyLayout(d, page, tiles, cols)` (10-model) wendet Vorschläge (`LAYOUTS` in 30-module) und das Pinsel-Format auf eine Seite an: Fotokacheln bekommen die Fotos des Tages der Reihe nach, Fotos ohne Kachel werden angehängt, Notiztext wird nicht kopiert. Ein Foto steht pro Tag nur auf einer Kachel (`setTilePhoto()`, `cleanTrip()` bereinigt Duplikate); `fillFree()` füllt freie Zellen mit Fotokacheln passend zum Seitenverhältnis. `layoutTrip()` liefert pro Tagesseite `pg.meta` (Raster, Kachelmaße, `pageIdx`, `spill`) für die Bedienung in der Vorschau. Die Deckseite ist fest aufgebaut (Dauer, Kennzahlen, Karte, Zusammenfassung). Alte Daten (Vorlagen, `stripN`) werden nicht mehr umgestellt; `FORMAT` 2, Dateien ohne `pages` bekommen den Standardaufbau.
- **Neues Farbschema** = ein Eintrag in `THEMES`.
- Die Deckseitenkarte ist nach dem Erzeugen ein festes Bild (`trip.mapImg`); Änderungen an der Route ändern sie nicht, der Reiter zeigt nur einen Hinweis (`mapStale`).
- Externe Bibliotheken nur als einzelnes UMD-Skript von cdnjs/jsDelivr (pdf-lib, exifr). Alles andere inline.
- **Projekt = PDF.** `buildPdf()` hängt `reise-protokoll-projekt.json` (alles außer Bilddaten), die Fotos (`0001 name.jpg`, Original oder Arbeitskopie), `karte.jpg` und `titelfoto.jpg` an. Gelesen wird mit `readProjectPdf()`. **Alles aus einem PDF ist unsicher** und läuft vor jeder Verwendung durch `cleanTrip()` (nur bekannte Felder, Typen, Bereiche, Aufzählungen, Längen; Bilder nie aus Textfeldern, nur aus Anhängen mit JPEG-Prüfung). Neue Felder in `newTrip()`/`newDay()` **und** in `cleanTrip()` aufnehmen, bei unverträglichen Änderungen `FORMAT` erhöhen und alte Formate weiter lesen. `test/projekt.mjs` enthält einen Test mit manipulierten Daten.
- Fotos: `file` (Original, bleibt unverändert) und `src` (Arbeitskopie, höchstens 1600 px). Markierungen liegen in Pixeln der Arbeitskopie (`bw` × `bh`), Drehung/Ausschnitt nur als Ansicht `vsrc`; gezeichnet wird immer über `photoView()`/`viewMarks()`. Beim Wiederöffnen wird die Arbeitskopie aus dem eingebetteten Foto neu berechnet, Markierungen werden bei abweichender Größe skaliert.

## Erkenntnisse

- Text-`y` im Seitenmodell ist die **Oberkante** der Zeile (CSS `line-height: 1`); das PDF setzt die Grundlinie bei `y + BASELINE × Größe`.
- pdf-lib: `drawSvgPath` skaliert auch die Linienbreite mit `scale`; Bilder werden mit Klippfad zugeschnitten (`pushGraphicsState` … `clip`).
- Kacheln kommen per `fetch` (damit 403 erkannt wird), Reihenfolge `tileSources()`: bei `file://` OSM.de → Esri → OSM (Hauptserver sperrt ohne Referer), sonst OSM → OSM.de → Esri (alle mit CORS `*`). Zusätzlich erkennt `looksBlocked()` die Sperrkachel (gelb-schwarz gestreift) am Bild, auch bei Status 200. `tile.openstreetmap.org` antwortet ohne Referer (Datei von der Festplatte) mit 403 und einer Fehlerkachel – nicht als `<img>` laden, sonst wird die Fehlerkachel in die Karte gemalt. CARTO (`basemaps.cartocdn.com`) ist nicht nutzbar (Schlüssel nötig, Wasserzeichen). Fehlen Kacheln insgesamt, entsteht automatisch die Schemakarte. Öffentliche Dienste (Kacheln, Nominatim max. 1 Anfrage/s, OSRM-Demo-Server) nur für gelegentliche Nutzung; Quellenangabe steht auf der Karte.
- **Grafische Kacheln** (Foto, Wettersymbol, Karte Strecke/Punkt) zeichnen ihren Rahmen über `frameFor()` (30-module): Schatten, weißer Rand oder schlicht gemäß `trip.photoStyle`, gleiche Maße wie `photoBlock()`. Eine neue grafische Kachel nutzt `frameFor()` und zeichnet in den Innenraum (`f.x/y/w/h`, `f.rad`, `plainEdge()`); `test/grafikstile.mjs` prüft alle.
- **Karte (Punkt)**: Das Modul `punktkarte` (die Strecken-Karte heißt weiter `karte`, damit alte Daten gelten) speichert `tile.pt` {lat, lon, zoom, name, credit} und das Bild `tile.ptImg` (JPEG-Datenadresse, `ptW`/`ptH` in Pixel). `paintPointMap()` (60-map) malt den Ausschnitt: Maßstab 1 pt = 1 Ansichtspunkt, Leinwand 2 Pixel je pt, Kacheln der Stufe zoom + 1 (scharf), Kachelzwischenspeicher `pmCache`; Nadel (`drawPin`), Beschriftung und Quelle zeichnet die Kachel als Vektoren. Das Bild gehört wie Karte und Titelfoto **nicht** in die JSON, sondern als Anhang `kachelkarte-<Kachel-ID>.jpg` (`jsonOfTrip` setzt `hasImg`, `readProjectPdf` holt es zurück, `cleanTile` prüft Position, Zoom, Längen und die Kennung).
- **Karte (Tag)**: Modul `tageskarte` nutzt dasselbe Fenster, dieselben Felder (`tile.pt`, `tile.ptImg`) und denselben Anhang wie `punktkarte`; gezeichnet wird beides von `drawPtMap()` (30-module), bei der Tageskarte ohne Nadel. `dayMapPoints(t, i)` (Start, Fotos nach Uhrzeit, Ort), `fitDayMap()` (Mitte und Zoom) und `drawDayOverlay()` (Weg und Nummern **ins Bild** gemalt) stehen in 60-map. Ändern sich Orte oder Fotos, bleibt das Bild, bis das Fenster neu bestätigt wird.
- **PDF-Größe**: `pdfEstimate(t, pages)` (80-ui) schätzt aus dem Seitenmodell (Bildoperationen nach dpi, 0,25 Byte/Pixel JPEG, höchstens Originalgröße), den eingebetteten Fotos (`embed`), Karte/Titelfoto und Projektdaten. `renderPreview()` zeigt sie neben der Seitenzahl. Ändert sich, wie `buildPdf()`/`collectAttachments()` Bilder oder Anhänge schreiben, muss die Schätzung mit (`test/groesse.mjs` vergleicht mit dem echten PDF).
- **Android/Touch** (gleiche Lösung wie im Foto-Protokoll v0.7.1): Beim Tippen darf weder die Seitenleiste neu aufgebaut werden (sonst flackert die Bildschirmtastatur) noch ständig die Vorschau. Auf Geräten mit `(pointer: coarse)` zeigt `schedulePreview()` die Vorschau erst beim Verlassen des Feldes (`focusout`); Auswahlfelder, Knöpfe und Kachel-Aktionen aktualisieren sofort. Neue Eingabefelder dürfen beim Tippen kein `renderPanel()` auslösen (`test/touch.mjs`).
- Tests: Playwright ersetzt alle Netzzugriffe durch Testantworten (`test/e2e.mjs`: Oberfläche, Karte, Kacheln; `test/projekt.mjs`: Mehrfach-Import, PDF-Roundtrip, manipulierte PDFs). PDFs lassen sich mit `pip install pymupdf` zu Bildern rendern, um das Layout zu prüfen.

## Windows

- Node und Git sind installiert. Playwright-Chromium liegt in `%LOCALAPPDATA%\ms-playwright` (`npx playwright install chromium`, falls es fehlt).
