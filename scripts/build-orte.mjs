// Erzeugt data/orte.b64 – die eingebaute Offline-Ortsliste.
// Quelle: Paket "cities.json" (GeoNames, Orte ab ca. 1000 Einwohnern sowie Verwaltungssitze, CC BY 4.0).
// Format: gzip-komprimiertes TSV, Base64-kodiert. Zeilen nach Breitengrad sortiert,
// Koordinaten in Tausendstel Grad als Differenz zur Vorzeile: dLat \t dLon \t Name \t Ländercode
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cities = require("cities.json");
cities.sort((a, b) => a.lat - b.lat);
let pl = 0, pg = 0;
const lines = cities.map((c) => {
  const la = Math.round(c.lat * 1e3), lg = Math.round(c.lng * 1e3);
  const row = `${la - pl}\t${lg - pg}\t${c.name.replace(/[\t\n]/g, " ")}\t${c.country}`;
  pl = la; pg = lg;
  return row;
});
const gz = gzipSync(lines.join("\n"), { level: 9 });
writeFileSync(new URL("../data/orte.b64", import.meta.url), gz.toString("base64"));
console.log(`${cities.length} Orte, ${(gz.length / 1e6).toFixed(2)} MB komprimiert`);
