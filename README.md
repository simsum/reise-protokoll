# Reise-Protokoll

Reisetagebuch als PDF. Man wählt eine Vorlage nach Reiseart, trägt Tage, Notizen, Wetter, Kosten und Fotos ein und bekommt ein gestaltetes PDF. Die **Deckseite** zeigt immer eine Übersicht: Dauer, Kennzahlen, **Karte der Fahrstrecke** und Zusammenfassung.

**Direkt ausprobieren: https://simsum.github.io/reise-protokoll/** (GitHub Pages)

Das Tool ist eine einzige HTML-Datei ([`dist/Reise-Protokoll.html`](dist/Reise-Protokoll.html)) und läuft komplett im Browser. Es gibt keinen Server, Fotos werden nicht hochgeladen.

## Vorlagen

| Vorlage | Für | Tagesseite |
|---|---|---|
| **Kurztrip** | ein Ziel, wenige Tage | Zeitleiste mit Uhrzeiten („09:30 Frühstück“), dazu Notizen |
| **Rundreise** | mehrere Tage an einem oder an verschiedenen Orten | Streckenleiste (von – nach, Kilometer, Fahrzeit), Tagebuch, Unterkunft |

Beide Vorlagen haben dieselbe Deckseite (optional mit Titelfoto) und denselben Grundaufbau der Tagesseite: Datum und Tagesnummer, Kästen für Wetter, Unterkunft und Tageskosten, Textbereich mit optionalen Schreiblinien, Highlights, Ausgaben, Fotostreifen. Dazu kommen bei Bedarf Fortsetzungs- und Fotoseiten sowie eine Kostenübersicht am Ende. Fünf Farbschemata (Meer, Herbst, Wald, Nacht, Mono).

Weitere Vorlagen und Farbschemata sind je ein Eintrag im Code, siehe [CLAUDE.md](CLAUDE.md).

## Ablauf

1. **Reise:** Vorlage, Titel, Reisende, Startort, Design.
2. **Tage:** Tage anlegen (einzeln oder für einen Zeitraum) und ausfüllen. **Fotos hinzufügen** (Knopf oben, Ziehen auf die Seite oder die Fläche im Reiter) nimmt beliebig viele Fotos auf einmal: Die Tage entstehen aus den Aufnahmedaten, die Fotos werden nach Uhrzeit einsortiert, der Ort eines neuen Tages kommt aus dem GPS der Fotos. HEIC-Fotos (iPhone) werden umgewandelt. Zu jedem Foto gibt es eine Bildunterschrift, Drehen, Ausschnitt und **Markieren** (Kreis, Pfeil, nummerierte Markierung mit Notiz). Das alles erscheint im PDF unter dem Foto.
3. **Karte:** Die Route entsteht automatisch aus Startort, Tagesorten und Foto-GPS und lässt sich von Hand ändern. „Karte erzeugen“ setzt ein Bild aus OpenStreetMap-Kacheln mit der Route zusammen (Straßenroute über OSRM oder Luftlinie). Das Bild ist danach fest. Alternativ ein eigenes Bild (Screenshot) hochladen. Die berechneten Kilometer und Fahrzeiten lassen sich in die Tage übernehmen.
   **Wetter:** Wetter und Temperaturspanne eines Tages werden automatisch aus den Fotodaten ermittelt (Aufnahmezeit und Ort jedes Fotos, wie im Foto-Protokoll). Von Hand geänderte Werte bleiben unangetastet, „neu ermitteln“ holt sie erneut. Auf der Tagesseite steht unter den Infokästen eine Detailzeile (Wind mit Richtung und Böen, Niederschlag, Bewölkung, Luftfeuchte, Luftdruck, Quelle) als Mittelwerte der Fotodaten; wer möchte, schreibt dort einen eigenen Text. Optional steht außerdem die Wetterzeile des Fotos unter dem Bild.
4. **Zusammenfassung:** Vorschlag aus Tagen, Highlights, Kosten, Wetter und Fotos, jederzeit von Hand änderbar.
5. **PDF erstellen.** Im PDF stecken als Anhänge alle Einstellungen und Eingaben, die Fotos (Originale oder 1600-px-Kopien, wählbar), Karte und Titelfoto. Mit **PDF öffnen** (oder das PDF auf die Seite ziehen) lässt sich das PDF jederzeit wieder bearbeiten, auch mit allen Markierungen. Der Stand wird außerdem automatisch im Browser gesichert.

> Die Anhänge zeigen Adobe Acrobat, Foxit, PDF-XChange und Firefox an (Büroklammer neben dem Foto). Der PDF-Viewer von Chrome und Edge zeigt sie nicht an, zum Weiterbearbeiten stört das nicht. Wird das PDF in einem anderen Programm gespeichert oder gedruckt, gehen die Anhänge oft verloren. Die Bearbeitungsdaten stehen im Klartext im PDF, wer das nicht möchte, schaltet die Option „Bearbeitungsdaten und Fotos im PDF speichern“ aus.

## Datenschutz und Netzwerk

- Alle Eingaben bleiben im Browser (IndexedDB) beziehungsweise in der Projektdatei.
- Ins Netz gehen nur: Ortssuche und Ortsnamen aus GPS ([Nominatim](https://nominatim.org/), höchstens eine Anfrage pro Sekunde), Kartenkacheln ([OpenStreetMap](https://www.openstreetmap.org/copyright); aus einer lokalen Datei sperrt dieser Server immer, weil kein Referer mitgeschickt wird, deshalb nimmt das Tool dann zuerst OpenStreetMap.de und danach Esri; von GitHub Pages aus funktioniert der Hauptserver) und die Straßenroute ([OSRM](https://project-osrm.org/) Demo-Server) – jeweils nur Koordinaten bzw. Suchtext, nie Fotos. Ohne Internet bleibt das Tool bis auf Suche und Karte nutzbar; die Karte wird dann als Schemakarte gezeichnet.
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

- Weitere Vorlagen (Städtereise mit Tagesplan, Wanderung, Strandurlaub)
- Wetter automatisch zum Tag und Ort abrufen (Open-Meteo)
- Eigene Schriften im PDF, Seitenformate (A5, Querformat)
- Fotos mit Bildunterschrift, Kartenausschnitt pro Tag
