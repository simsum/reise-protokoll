# Drittanbieter-Hinweise

Reise-Protokoll selbst steht unter der [MIT-Lizenz](LICENSE). Das Tool nutzt die folgenden Bibliotheken, Daten und Dienste Dritter.

## In `dist/Reise-Protokoll.html` enthalten

### Ortsliste (GeoNames)

Die eingebaute Offline-Ortsliste (`data/orte.b64`, erzeugt mit `npm run build:orte`) stammt aus dem npm-Paket [`cities.json`](https://github.com/lutangar/cities.json) und damit aus den Daten von [GeoNames](https://www.geonames.org/). Die Daten wurden gekürzt und umkodiert (nur Orte mit Name, Land und Koordinaten).

- Lizenz: [Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- Quelle: GeoNames, https://www.geonames.org/

## Zur Laufzeit aus dem Netz geladen (nicht Teil des Repositorys)

| Bibliothek | Version | Lizenz | Quelle |
|---|---|---|---|
| pdf-lib (inkl. `@pdf-lib/standard-fonts`, `@pdf-lib/upng`) | 1.17.1 | MIT | https://github.com/Hopding/pdf-lib |
| pako (Abhängigkeit von pdf-lib) | 1.0.x | MIT und Zlib | https://github.com/nodeca/pako |
| exifr | 7.1.3 | MIT | https://github.com/MikeKovarik/exifr |
| heic2any (nur bei HEIC-Fotos) | 0.0.4 | MIT | https://github.com/alexcorvi/heic2any |

## Kartendaten und Dienste

- Kartenkacheln und Ortssuche: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende ([ODbL](https://opendatacommons.org/licenses/odbl/)). Kacheln von OpenStreetMap, OpenStreetMap.de (FOSSGIS) oder Esri; Suche und Adressen über Nominatim; Straßenrouten über [OSRM](https://project-osrm.org/) (Demo-Server). Es werden nur Koordinaten bzw. Suchtexte übertragen.
- Wetter (Koordinaten und Aufnahmedatum): bei einer Station in Deutschland Messdaten des [Deutschen Wetterdienstes](https://www.dwd.de/) (Datenbasis: Deutscher Wetterdienst) über [Bright Sky](https://brightsky.dev/), sonst [Open-Meteo](https://open-meteo.com/) (für nicht kommerzielle Nutzung kostenlos).
