# Reise-Protokoll

Reisetagebuch als PDF. Man baut die Seiten jedes Tages aus frei wählbaren Kacheln (Foto, Wetter, Tagesplan …), trägt Tage, Notizen, Wetter, Kosten und Fotos ein und bekommt ein gestaltetes PDF. Die **Deckseite** zeigt immer eine Übersicht: Dauer, Kennzahlen, **Karte der Fahrstrecke** und Zusammenfassung.

**Direkt ausprobieren: https://simsum.github.io/reise-protokoll/** (GitHub Pages)

Das Tool ist eine einzige HTML-Datei ([`dist/Reise-Protokoll.html`](dist/Reise-Protokoll.html)) und läuft komplett im Browser. Es gibt keinen Server, Fotos werden nicht hochgeladen.

## Freies Layout aus Kacheln

Jede Seite eines Tages ist ein Raster aus 3 oder 4 Kacheln pro Reihe und 6 Reihen (Einstellung im Reiter „Reise“). Jede Kachel nimmt ein **Modul** auf, frei wählbar: Foto, Wetter, Unterkunft, Strecke, Tagesplan, Tagebuch, Highlights, Ausgaben, Karte (Strecke), Karte (Punkt), Kennzahlen, Notiz (freier Text mit Markdown), Wettersymbol (nur ein hübsches Symbol, immer 1×1, schmückt freie Flächen; „automatisch“ zeigt das Wetter des Tages, oder man wählt Sonne, Heiter, Bewölkt, Regen, Gewitter, Schnee, Nebel, Mond und Sterne, Regenbogen, Wind; die Farben folgen dem Farbschema) oder Leer (Platzhalter). Bearbeiten geht **direkt in der Vorschau** (oder im Reiter „Tage“ unter jedem Tag):

- **Anklicken** wählt eine Kachel; eine Werkzeugleiste über der Kachel bietet Modul, Foto, Größe und Reihenfolge. **Ziehen** verschiebt die Kachel an eine andere Stelle (auch auf eine andere Seite desselben Tages), die **Ecke unten rechts** ändert die Größe im Raster, ein Klick auf **freie Fläche** fügt eine Kachel ein. Escape hebt die Auswahl auf, Entf löscht die Kachel. **Doppelklick** springt dorthin, wo man den Inhalt bearbeitet (Foto-Editor, Textfeld des Tages, Reiter „Karte“ …). Beim Darüberfahren markieren gestrichelte Felder die **freien Plätze** der Seite.
- **Rückgängig / Wiederholen** (Pfeile oben in der Vorschau, Strg+Z / Strg+Y) gelten für den Seitenaufbau, auch für Löschen und Verschieben von Kacheln und Seiten.
- **Seitenleiste** über jeder Seite beim Darüberfahren: neue Seite danach, Seite verschieben oder löschen, **Aufbau-Vorschläge** (Tagesübersicht, Tagebuch groß, Panorama und Text, Fotoseite, zwei Panoramen) und der Pinsel.
- **Format übertragen** (🖌, wie in Excel): Der Aufbau einer Seite wird aufgenommen, dann klickt man Zielseiten an (oder „Auf alle Tage“: übertragen wird auf die Seite mit derselben Nummer jedes Tages). Fotokacheln bekommen die Fotos des Zieltags, Notiztexte werden nicht mitkopiert. Auch Vorschläge belegen ihre Fotoplätze sofort mit Fotos des Tages (nötigenfalls von anderen Seiten), freie Plätze der Seite werden mit noch nicht platzierten Fotos aufgefüllt, übrige Fotos kommen auf eine zusätzliche Seite, es geht keines verloren.
- **Ein Foto steht pro Tag nur einmal:** Wird es einer zweiten Kachel zugewiesen, verschwindet es an der ersten Stelle (die Kachel bleibt leer). Neue Fotos füllen zuerst freie Plätze vorhandener Seiten. Escape beendet den Pinsel.

Der Seitenaufbau im Detail:

- **Größe** per Knopf: 1×1, 2×1, 1×2, 2×2 oder ganze Breite (z. B. 4×1 für Panoramafotos), dazu Auswahlfelder für beliebige Breite und Höhe.
- **Reihenfolge** mit ↑ ↓: Die Kacheln werden der Reihe nach auf das erste freie Rechteck gesetzt, andere rücken nach. Eine kleine Seitenskizze zeigt, wo jede Kachel landet.
- **Mehrere Seiten pro Tag** mit „+ Seite“. Was nicht auf die Seite passt, läuft automatisch auf eine weitere Seite.
- Neue Tage bekommen einen Standardaufbau (Strecke, Wetter, Unterkunft, Ausgaben, Highlights, Tagesplan, Tagebuch). Hinzugefügte Fotos bekommen je eine Fotokachel (Querformat 2×2, Hochformat 1×2) mit allen Foto-Funktionen (Markieren, Drehen, Ausschnitt, Beschriftung).
- **Notizen mit Markdown und Schrift:** In der Werkzeugleiste einer Notiz wählst du die Schrift (Serif = Times, Sans = Helvetica/Arial, Mono = Courier; das sind PDF-Standardschriften, damit Vorschau und PDF gleich umbrechen) und setzt die Formatierung per Knopf oder von Hand: `# Überschrift` (bis `###`), `**fett**`, `*kursiv*`, `***beides***`, `` `Code` ``, `- Aufzählung`, `1. Nummerierung`, `> Zitat`, `---` Trennlinie. Links zeigen nur den Text.
- **Einheitliches Aussehen der grafischen Kacheln:** Fotos, Wettersymbole, Karte (Strecke), Karte (Punkt) und Karte (Tag) folgen derselben Einstellung „Aussehen der Fotos“ (Reiter „Reise“): Schatten mit abgerundeten Ecken, weißer Rand mit Schatten oder schlicht mit dünnem Rand.
- **Karte (Strecke) und Karte (Punkt):** „Karte (Strecke)“ zeigt wie bisher die Karte der Reise (Reiter „Karte“). „Karte (Punkt)“ zeigt einen Ausschnitt um eine selbst gewählte Position, zum Beispiel für einen Stellplatz oder eine Sehenswürdigkeit. Das Fenster öffnet sich beim Anlegen, per Doppelklick oder über den Knopf in der Leiste: Position suchen (Ortssuche), vom Ort des Tages, von einem Foto mit GPS oder vom Gerät übernehmen, die **Karte mit Maus oder Finger verschieben** (die Nadel in der Mitte zeigt die Position), mit Mausrad oder +/− zoomen, Beschriftung und Größe der Kachel wählen. „Übernehmen“ erzeugt das Kartenbild in Kachelgröße (aus OpenStreetMap-Kacheln, mit Quellenangabe auf der Karte); Nadel und Beschriftung sind scharfe Vektoren. Das Bild ist danach fest und steckt im Projekt-PDF (Anhang), funktioniert also offline.
- **Karte (Tag):** Dritte Kartenart: zeigt den Weg des Tages mit nummerierten Marken – Start (Ort des Vortags oder Startort), Fotos mit GPS in Aufnahmereihenfolge, Ort des Tages (nahe Punkte unter 150 m werden zusammengefasst). Das Fenster (wie bei „Karte (Punkt)“) passt den Ausschnitt beim Öffnen automatisch ein; „Auf den Tag einpassen“ stellt ihn nach dem Verschieben oder Zoomen wieder her. Das Bild wird beim Übernehmen erzeugt (Orte und Fotos danach geändert: Fenster erneut öffnen).
- **Wikipedia-Auszug:** Die Kachel „Wikipedia-Auszug“ öffnet ein Fenster. Man sucht (vorgeschlagen wird der Ort des Tages), wählt einen Treffer und bearbeitet vor dem Einfügen: Überschrift, Text (auf 1, 2, 3, 4 oder 6 Sätze kürzbar, frei änderbar) und **Kennzahlen aus Wikidata**: bei Städten Einwohner (mit Jahr), Fläche, Gegründet, Erste Erwähnung, Höhe, Land, Region, bei Bauwerken Baujahr, Höhe, Architekt, Schutzstatus. Jede Kennzahl lässt sich an- und abwählen, ändern oder neu anlegen. Die Vorschau im Fenster zeigt die Kachel in ihrer echten Größe. Die Quellenzeile (Wikipedia CC BY-SA 4.0, Wikidata CC0, Abrufdatum) steht immer auf der Kachel und verlinkt im PDF den Artikel. Der Auszug wird im Projekt gespeichert und funktioniert danach offline. Doppelklick auf die Kachel öffnet das Fenster erneut.
- **Sehenswürdigkeiten in der Nähe:** Im Fenster „In der Nähe suchen“ (Umkreis 1, 3, 5 oder 10 km) um den **Ort des Tages**, ein **Foto mit GPS** oder den **aktuellen Standort des Geräts** (das Gerät fragt nach Erlaubnis, geht nur aus einer Webseite mit https, nicht aus einer lokalen Datei). Die Liste zeigt bis zu 100 Artikel mit Kurzbeschreibung und Entfernung, **beliebteste zuerst** (Seitenaufrufe der letzten 30 Tage; so stehen Frauenkirche und Marienplatz vor Straßen und Behörden), umschaltbar auf „nächste zuerst“. Die Beliebtheit wird in Runden nachgeladen, das dauert einige Sekunden; bis dahin steht die Liste nach Entfernung. Ein Klick auf einen Treffer öffnet wie gewohnt Text und Kennzahlen zum Bearbeiten. Ist Wikipedia überlastet, wird die Suche zweimal automatisch wiederholt.
- Ein leeres Modul (z. B. ein Tag ohne Tagesplan) zeichnet nichts. Ist der Inhalt für die Kachel zu lang, wird die Schrift kleiner und dann gekürzt; oben in der Vorschau erscheint ein Hinweis.
- **Camper:** Beim Tag lässt sich die Unterkunft auf **Stellplatz** umschalten. Die Kachel „Unterkunft“ zeigt dann den Namen und immer alle sechs Merkmale (Wasser, WC, Duschen, Strom, WLAN, Sonstiges), je mit Haken (vorhanden) oder Kreuz (nicht vorhanden). Bei „Sonstiges“ steht der eigene Text auf der Kachel (z. B. „Hunde erlaubt“). Die Angaben bleiben beim Zurückschalten erhalten.
- Mehrere Tage am selben Ort: Ohne Ortsangabe gilt der Ort des Vortags.

Die Deckseite ist immer gleich aufgebaut: Dauer, Kennzahlen (Reiseziel oder Stationen, Strecke, Kosten, Fotos, Temperatur – was vorhanden ist), Karte der Fahrstrecke und Zusammenfassung. Dazu kommen bei Bedarf weitere Seiten je Tag sowie eine Kostenübersicht am Ende. Fünf Farbschemata (Meer, Herbst, Wald, Nacht, Mono).

Weitere Module und Farbschemata sind je ein Eintrag im Code, siehe [CLAUDE.md](CLAUDE.md).

## Ablauf

1. **Reise:** Titel, Reisende, Startort, Design und alle Foto-Optionen.
2. **Tage:** Tage anlegen (einzeln oder für einen Zeitraum) und ausfüllen. **Fotos hinzufügen** (Knopf oben, Ziehen auf die Seite oder die Fläche im Reiter) nimmt beliebig viele Fotos auf einmal: Die Tage entstehen aus den Aufnahmedaten, die Fotos werden nach Uhrzeit einsortiert, der Ort eines neuen Tages kommt aus dem GPS der Fotos. HEIC-Fotos (iPhone) werden umgewandelt. Schon vorhandene Fotos (gleiche Prüfsumme) werden übersprungen, vorhandene Doppelte lassen sich mit einem Knopf entfernen. Zu jedem Foto gibt es eine Bildunterschrift, Drehen, Ausschnitt und **Markieren** (Kreis, Pfeil, nummerierte Markierung mit Notiz). Das alles erscheint im PDF unter dem Foto.
3. **Karte:** Die Route entsteht automatisch aus Startort, Tagesorten und Foto-GPS und lässt sich von Hand ändern. „Karte erzeugen“ setzt ein Bild aus OpenStreetMap-Kacheln mit der Route zusammen (Straßenroute über OSRM oder Luftlinie). Das Bild ist danach fest. Orte lassen sich auch „nur für die Route“ einfügen (z. B. eine Brücke oder Passstraße): Sie lenken die Straßenroute, erscheinen aber weder auf der Karte noch in der Ortsliste unter der Karte. Alternativ ein eigenes Bild (Screenshot) hochladen. Die berechneten Kilometer und Fahrzeiten lassen sich in die Tage übernehmen.
   **Wetter:** Wetter und Temperaturspanne eines Tages werden automatisch aus den Fotodaten ermittelt (Aufnahmezeit und Ort jedes Fotos, wie im Foto-Protokoll). Von Hand geänderte Werte bleiben unangetastet, „neu ermitteln“ holt sie erneut. In der Wetterkachel steht (bei genug Platz, z. B. 2 Kacheln breit) eine Detailzeile (Wind mit Richtung und Böen, Niederschlag, Bewölkung, Luftfeuchte, Luftdruck, Quelle) als Mittelwerte der Fotodaten; wer möchte, schreibt dort einen eigenen Text. Optional steht außerdem die Wetterzeile des Fotos unter dem Bild.
4. **Zusammenfassung:** Vorschlag aus Tagen, Highlights, Kosten, Wetter und Fotos, jederzeit von Hand änderbar.
5. **PDF erstellen.** Im PDF stecken als Anhänge alle Einstellungen und Eingaben, die Fotos (Originale oder 1600-px-Kopien, wählbar), Karte und Titelfoto. Mit **PDF öffnen** (oder das PDF auf die Seite ziehen) lässt sich das PDF jederzeit wieder bearbeiten, auch mit allen Markierungen. Der Stand wird außerdem automatisch im Browser gesichert.

> Die Anhänge zeigen Adobe Acrobat, Foxit, PDF-XChange und Firefox an (Büroklammer neben dem Foto). Der PDF-Viewer von Chrome und Edge zeigt sie nicht an, zum Weiterbearbeiten stört das nicht. Wird das PDF in einem anderen Programm gespeichert oder gedruckt, gehen die Anhänge oft verloren. Die Bearbeitungsdaten stehen im Klartext im PDF, wer das nicht möchte, schaltet die Option „Bearbeitungsdaten und Fotos im PDF speichern“ aus.

## Foto-Optionen (wie im Foto-Protokoll)

Im Reiter „Reise“:

| Gruppe | Optionen |
|---|---|
| **Beschriftung unter den Bildern** | Fotonummer, Datum und Uhrzeit, Ort, GPS-Koordinaten (im PDF als Link zur Karte), Wetter zur Aufnahmezeit, Bildunterschrift, Notizen zu nummerierten Markierungen, Dateiname |
| **Fotos auf den Seiten** | Fotokacheln in frei wählbarer Größe (siehe Kachel-Layout). Aussehen: Schatten mit abgerundeten Ecken, weißer Rand mit Schatten oder schlicht. Bildauflösung 110 / 150 / 220 / 300 dpi (gerechnet aus dem Original) |
| **Voraussichtliche PDF-Größe** | Steht oben in der Vorschau neben der Seitenzahl („8 Seiten · PDF ca. 9,3 MB“) und ändert sich mit Fotos, Auflösung, Einbetten und Bearbeitungsdaten. Der Tooltip schlüsselt sie auf (Bilder auf den Seiten, eingebettete Fotos, Karte/Projektdaten, Seiten). Geschätzt aus den Fotogrößen, der gewählten dpi und den Einstellungen; bei Testfotos lag sie innerhalb weniger Prozent der echten Größe, bei echten Fotos kann sie etwas abweichen |
| **Originale & Qualität** | Originaldateien bitgenau einbetten (mit EXIF) oder auf 3200 / 2400 / 1600 px verkleinern (Aufnahmedatum und GPS bleiben in der Datei), Bearbeitungsdaten im PDF speichern, Prüfsummen-Seite (SHA-256) |
| **Ort und Wetter aus den Fotodaten** | Ort aus GPS: OpenStreetMap (Straße, Hausnummer) mit Rückfall auf eine eingebaute Ortsliste, nur offline oder aus; Wetter ermitteln ja/nein |

Zu jedem Foto lassen sich Bildunterschrift, Ort und Wetter von Hand ändern; Handeingaben werden nie überschrieben.

## Datenschutz und Netzwerk

- Alle Eingaben bleiben im Browser (IndexedDB) beziehungsweise in der Projektdatei.
- Ins Netz gehen nur: Wikipedia-Suche und Artikeltext ([de.wikipedia.org](https://de.wikipedia.org), nur der Suchbegriff bzw. Artikeltitel) und Kennzahlen aus [Wikidata](https://www.wikidata.org) (nur die Kennung des Artikels), nur wenn man die Kachel „Wikipedia-Auszug“ benutzt, außerdem Ortssuche und Ortsnamen aus GPS ([Nominatim](https://nominatim.org/), höchstens eine Anfrage pro Sekunde), Kartenkacheln ([OpenStreetMap](https://www.openstreetmap.org/copyright); aus einer lokalen Datei sperrt dieser Server immer, weil kein Referer mitgeschickt wird, deshalb nimmt das Tool dann zuerst OpenStreetMap.de und danach Esri; von GitHub Pages aus funktioniert der Hauptserver) und die Straßenroute ([OSRM](https://project-osrm.org/) Demo-Server) – jeweils nur Koordinaten bzw. Suchtext, nie Fotos. Ohne Internet bleibt das Tool bis auf Suche und Karte nutzbar; die Karte wird dann als Schemakarte gezeichnet.
- **Wetter** (Standard: an, abschaltbar im Reiter „Reise“): Für Fotos mit EXIF-Aufnahmezeit und GPS gehen **Koordinaten und Aufnahmedatum** pro Foto an [Bright Sky](https://brightsky.dev/) (Daten des Deutschen Wetterdienstes, Station im Umkreis von 30 km) oder sonst an [Open-Meteo](https://open-meteo.com/). Open-Meteo ist nach seinen Bedingungen nur für nicht kommerzielle Nutzung kostenlos. Das Wetter gilt für die nächste Station bzw. das Wettermodell, nicht für den genauen Standort. Fotos ohne EXIF-Zeit bekommen kein automatisches Wetter.
- Beim Öffnen werden pdf-lib (cdnjs) und exifr (jsDelivr) geladen, HEIC-Fotos laden bei Bedarf heic2any.

## Entwicklung

```bash
npm install
npx playwright install chromium
npm run build      # src/ → dist/Reise-Protokoll.html
npm test           # Build + Ende-zu-Ende-Test, Bilder in test/out/
```

Aufbau und Regeln stehen in [CLAUDE.md](CLAUDE.md).

## Ideen für später

- **Tipps fürs nächste Mal**: Abschnitt für Erkenntnisse (je Tag und/oder als eigene Seite am Ende)
- **Camper**: weitere Merkmale des Stellplatzes (z. B. Entsorgung, Hunde, Preis)
- Weitere Aufbau-Vorschläge (Städtereise, Wanderung, Strandurlaub), eigene Aufbauten speichern
- **Seitenformate** (A4, A5, A3, US Letter, Hoch- und Querformat)
- **Export als HTML-Datei und als Markdown-Datei** (Text, Fotos, Karte), zusätzlich zum PDF
- Eigene Schriften im PDF
