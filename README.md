# Reise-Protokoll

Reisetagebuch als PDF. Man wählt eine Vorlage nach Reiseart, trägt Tage, Notizen, Wetter, Kosten und Fotos ein und bekommt ein gestaltetes PDF. Die **Deckseite** zeigt immer eine Übersicht: Dauer, Kennzahlen, **Karte der Fahrstrecke** und Zusammenfassung.

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
2. **Tage:** Tage anlegen (einzeln oder für einen Zeitraum). Fotos auf die Fläche ziehen: Sie werden nach Aufnahmedatum den Tagen zugeordnet, fehlende Tage entstehen dabei, der Ort kommt aus dem GPS der Fotos.
3. **Karte:** Die Route entsteht automatisch aus Startort, Tagesorten und Foto-GPS und lässt sich von Hand ändern. „Karte erzeugen“ setzt ein Bild aus OpenStreetMap-Kacheln mit der Route zusammen (Straßenroute über OSRM oder Luftlinie). Das Bild ist danach fest. Alternativ ein eigenes Bild (Screenshot) hochladen. Die berechneten Kilometer und Fahrzeiten lassen sich in die Tage übernehmen.
4. **Zusammenfassung:** Vorschlag aus Tagen, Highlights, Kosten, Wetter und Fotos, jederzeit von Hand änderbar.
5. **PDF erstellen** oder **Speichern** (Projektdatei `.reise.json` mit Fotos und Karte). Der Stand wird außerdem automatisch im Browser gesichert.

## Datenschutz und Netzwerk

- Alle Eingaben bleiben im Browser (IndexedDB) beziehungsweise in der Projektdatei.
- Ins Netz gehen nur: Ortssuche und Ortsnamen aus GPS ([Nominatim](https://nominatim.org/), höchstens eine Anfrage pro Sekunde), Kartenkacheln ([OpenStreetMap](https://www.openstreetmap.org/copyright)) und die Straßenroute ([OSRM](https://project-osrm.org/) Demo-Server) – jeweils nur Koordinaten bzw. Suchtext, nie Fotos. Ohne Internet bleibt das Tool bis auf Suche und Karte nutzbar; die Karte wird dann als Schemakarte gezeichnet.
- Beim Öffnen werden pdf-lib (cdnjs) und exifr (jsDelivr) geladen.

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
- Projektdaten im PDF einbetten, damit sich ein PDF wieder öffnen lässt
- Fotos mit Bildunterschrift, Kartenausschnitt pro Tag
