// Manueller Test mit echtem Netz (nicht Teil von `npm test`): Ortssuche, Straßenroute, Kartenkacheln.
// Aufruf: node test/netz.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "test/out");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1250 } })).newPage();
const errors = [], reqs = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("response", (r) => { const u = r.url(); if (/nominatim|osrm|tile\.openstreetmap|arcgisonline/.test(u)) reqs.push(r.status() + " " + u.slice(0, 90)); });

let failed = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FEHLT ") + msg); if (!c) failed++; };

await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready, null, { timeout: 30000 });
await page.evaluate(() => { const t = newTrip("rundreise"); t.title = "Netztest"; loadTrip(t, true); });

console.log("Ortssuche (Nominatim)");
await page.click('[data-tab="trip"]');
await page.fill('[data-k="startPlace.name"]', "München");
await page.click('[data-act="search"][data-key="startPlace"]');
await page.waitForSelector('[data-act="pick"]', { timeout: 20000 });
const first = await page.locator('[data-act="pick"]').first().innerText();
console.log("  Treffer:", first.replace(/\s+/g, " "));
await page.locator('[data-act="pick"]').first().click();
const sp = await page.evaluate(() => S.trip.startPlace);
ok(Math.abs(sp.lat - 48.14) < 0.3 && Math.abs(sp.lon - 11.58) < 0.3, `München gefunden: ${sp.name} ${sp.lat?.toFixed(3)}, ${sp.lon?.toFixed(3)}`);

console.log("Tage mit Orten");
await page.evaluate(async () => {
  const t = S.trip;
  for (const [i, n] of ["Salzburg", "Wien"].entries()) {
    const r = (await searchPlace(n))[0];
    const d = newDay(addDays("2026-05-14", i)); d.place = { name: r.name, lat: r.lat, lon: r.lon }; t.days.push(d);
  }
  t.roundTrip = true; changed();
});
const pts = await page.evaluate(() => S.trip.route.points.map((p) => p.name));
ok(pts.length === 4, `Route: ${pts.join(" > ")}`);

console.log("Karte (Kacheln + OSRM)");
await page.click('[data-tab="map"]');
await page.click("#mapBtn");
await page.waitForFunction(() => S.trip.mapImg, null, { timeout: 90000 }).catch(() => {});
const info = await page.evaluate(() => ({ img: S.trip.mapImg.length, km: S.trip.route.km, legs: S.trip.route.legs, status: document.querySelector("#mapStatus")?.textContent, toast: document.querySelector("#toast")?.textContent }));
console.log("  ", JSON.stringify(info));
ok(info.img > 20000, `Karte erzeugt (${(info.img / 1024).toFixed(0)} KB)`);
ok(info.km > 600 && info.km < 1000, `Straßenroute: ${info.km && info.km.toFixed(0)} km`);
ok(/Karte erzeugt/.test(info.toast || ""), `Karte mit Hintergrund: ${await page.evaluate(() => S.trip.mapSource)} (Hinweis: „${info.toast}“)`);
await page.evaluate(() => { document.querySelector("#toast").hidden = true; });
await page.locator(".mapimg").screenshot({ path: join(out, "netz-karte.png") });

console.log("Ersatzanbieter (OSM von Hand ausgeblendet)");
console.log("  Quelle der ersten Karte:", await page.evaluate(() => S.trip.mapSource));
for (const id of ["osmde", "esri", "osm"]) {
  await page.evaluate((id) => { tileForce = id; S.trip.mapImg = ""; S.trip.mapSource = ""; renderPanel(); }, id);
  await page.click("#mapBtn");
  await page.waitForFunction(() => S.trip.mapImg, null, { timeout: 90000 }).catch(() => {});
  const src = await page.evaluate(() => S.trip.mapSource);
  if (id === "osm") console.log(`  Hauptserver aus der lokalen Datei: ${src === "osm" ? "liefert Kacheln" : "gesperrt (erwartet)"}`);
  else ok(src === id, `Karte von ${id} erzeugt`);
  await page.evaluate(() => { document.querySelector("#toast").hidden = true; });
  await page.locator(".mapimg").screenshot({ path: join(out, `netz-karte-${id}.png`) });
}
await page.evaluate(() => { tileForce = ""; });

console.log("Angefragte Dienste:\n  " + [...new Set(reqs.map((r) => r.replace(/\/\d+\/\d+\.png/, "/z/x/y.png")))].join("\n  "));
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
process.exit(failed ? 1 : 0);
