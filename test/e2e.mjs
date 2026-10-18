// End-to-End-Test: öffnet dist/Reise-Protokoll.html in Chromium, bedient die Oberfläche,
// erzeugt Karte und PDF und prüft das Ergebnis. Netzwerk wird komplett durch Testantworten ersetzt.
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "test/out");
mkdirSync(out, { recursive: true });

let failed = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FEHLT ") + msg); if (!c) failed++; };

/* kleines PNG (Kachel mit Raster) ohne Zusatzpakete */
function png(w, h, stripes) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3, edge = x % 128 === 0 || y % 128 === 0;
    raw[o] = edge ? 200 : 232; raw[o + 1] = edge ? 205 : 236; raw[o + 2] = edge ? 190 : 224;
    if (stripes && x < 40) { const yel = ((x + y) >> 3) % 2 === 0; raw[o] = yel ? 255 : 20; raw[o + 1] = yel ? 230 : 20; raw[o + 2] = yel ? 0 : 20; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1250 }, acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); }); // gesperrte Kacheln im Test sind gewollt

let blockOsm = false, blockDe = false, blockEsri = false, stripeDe = false;
const nm = (p) => join(root, "node_modules", p);
await page.route("**/*", async (r) => {
  const u = r.request().url();
  if (u.startsWith("file:")) return r.continue();
  if (u.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("pdf-lib/dist/pdf-lib.min.js")) });
  if (u.includes("exifr")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("exifr/dist/full.umd.js")) });
  if (u.includes("tile.openstreetmap.org") && blockOsm) return r.fulfill({ status: 403, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: png(256, 256) });
  if (u.includes("tile.openstreetmap.de") && blockDe) return r.abort();
  if (u.includes("tile.openstreetmap.de") && stripeDe) return r.fulfill({ contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: png(256, 256, true) });
  if (u.includes("arcgisonline.com") && blockEsri) return r.abort();
  if (/tile\.openstreetmap\.(org|de)|arcgisonline\.com/.test(u)) return r.fulfill({ contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: png(256, 256) });
  if (u.includes("router.project-osrm.org")) {
    const coords = decodeURIComponent(u.split("/driving/")[1].split("?")[0]).split(";").map((s) => s.split(",").map(Number));
    const legs = coords.slice(1).map(() => ({ distance: 150000, duration: 6300 }));
    return r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ routes: [{ distance: 150000 * legs.length, geometry: { coordinates: coords }, legs }] }) });
  }
  if (u.includes("nominatim")) return r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify([{ lat: "48.2082", lon: "16.3738", display_name: "Wien, Österreich", name: "Wien", address: { city: "Wien" } }]) });
  return r.abort();
});

await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => FM.ready && document.querySelectorAll("#pages .sheet").length > 0);

console.log("Beispiel Rundreise");
let n = await page.locator("#pages .sheet").count();
ok(n === 7, `7 Seiten (Deckseite, 5 Tage, Kosten): ${n}`);
ok((await page.locator("#pages .sheet").first().innerText()).includes("Alpenrundreise"), "Deckseite zeigt den Titel");
ok((await page.evaluate(() => S.trip.route.points.map((p) => p.name).join(">"))) === "München>Salzburg>Hallstatt>Wien>München", "Route aus Tagen: München>Salzburg>Hallstatt>Wien>München");
ok((await page.evaluate(() => tripStats(S.trip).km)) === 945, "Strecke 945 km aus den Tagen");

console.log("Karte");
await page.click('[data-tab="map"]');
await page.click("#mapBtn");
await page.waitForFunction(() => S.trip.mapImg && S.trip.mapImg.length > 1000, null, { timeout: 30000 });
ok(await page.evaluate(() => S.trip.mapImg.startsWith("data:image/jpeg")), "Karte als JPEG gespeichert");
ok(await page.locator(".mapimg").count() === 1, "Kartenvorschau im Reiter");
ok((await page.evaluate(() => S.trip.route.legs.length)) === 4, "Teilstrecken der Route vorhanden");
await page.click('[data-act="applyLegs"]');
ok((await page.evaluate(() => S.trip.days[0].km)) === "150", "km aus Route in Tag übernommen");

console.log("Kartenanbieter (aus der lokalen Datei: erst OSM.de, dann Esri, OSM zuletzt)");
const regen = async () => {
  await page.evaluate(() => { S.trip.mapImg = ""; S.trip.mapSource = ""; renderPanel(); });
  await page.click("#mapBtn");
  await page.waitForFunction(() => S.trip.mapImg, null, { timeout: 30000 });
  return page.evaluate(() => S.trip.mapSource);
};
ok((await regen()) === "osmde", "Datei von der Festplatte: zuerst OpenStreetMap.de");
blockDe = true;
ok((await regen()) === "esri", "OSM.de gesperrt: Esri");
ok((await page.evaluate(() => document.querySelector("#toast").textContent)).includes("gesperrt"), "Hinweis auf die Sperre");
blockEsri = true;
ok((await regen()) === "osm", "OSM.de und Esri gesperrt: OSM-Hauptserver als letzte Möglichkeit");
blockOsm = true;
ok((await regen()) === "", "alle gesperrt (403): Schemakarte statt Fehlkacheln");
blockOsm = false; blockEsri = false; blockDe = false; stripeDe = true;
ok((await regen()) === "esri", "Sperrkachel mit Status 200 (gelb-schwarz) wird am Bild erkannt");
stripeDe = false;

console.log("Vorlagen");
await page.click('[data-tab="trip"]');
await page.click('[data-act="tpl"][data-id="kurztrip"]');
await page.waitForTimeout(400);
ok((await page.evaluate(() => S.trip.template)) === "kurztrip", "Vorlage Kurztrip aktiv");
await page.click('[data-tab="trip"]');
await page.click('[data-act="tpl"][data-id="rundreise"]');

await page.evaluate(() => loadTrip(demoTrip("kurztrip")));
await page.waitForTimeout(400);
n = await page.locator("#pages .sheet").count();
ok(n === 5, `Beispiel Kurztrip: 5 Seiten: ${n}`);
{
  const [dk] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
  await dk.saveAs(join(out, "kurztrip.pdf"));
  ok((await PDFDocument.load(readFileSync(join(out, "kurztrip.pdf")))).getPageCount() === 5, "Kurztrip-PDF hat 5 Seiten");
}

console.log("Ortssuche");
await page.click('[data-tab="trip"]');
await page.fill('[data-k="startPlace.name"]', "Wien");
await page.click('[data-act="search"][data-key="startPlace"]');
await page.waitForSelector('[data-act="pick"]');
await page.click('[data-act="pick"]');
ok((await page.evaluate(() => S.trip.startPlace.lat)) === 48.2082, "Treffer übernommen (Koordinaten)");

console.log("Seiten und Texte");
await page.evaluate(() => { const t = S.trip; t.days[0].text = "Lorem ipsum dolor sit amet ".repeat(120); changed(); });
await page.waitForTimeout(500);
n = await page.locator("#pages .sheet").count();
ok(n >= 6, `langer Text erzeugt Folgeseite: ${n} Seiten`);

console.log("Fotos");
await page.evaluate(async () => {
  loadTrip(demoTrip("rundreise"));
  const mk = async (i) => {
    const cv = document.createElement("canvas"); cv.width = 1200; cv.height = i % 2 ? 900 : 800;
    const g = cv.getContext("2d"); g.fillStyle = `hsl(${i * 47},45%,60%)`; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#fff"; g.font = "120px sans-serif"; g.fillText("Foto " + (i + 1), 80, 300);
    return new File([await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8))], `foto${i}.jpg`, { type: "image/jpeg" });
  };
  await addPhotosToDay(S.trip.days[1].id, await Promise.all([0, 1, 2, 3, 4].map(mk)));
  await useCover(await mk(7));
});
await page.waitForTimeout(600);
n = await page.locator("#pages .sheet").count();
ok(n === 8, `5 Fotos an Tag 2 erzeugen eine Fotoseite: ${n} Seiten`);
ok((await page.evaluate(() => S.trip.days[1].photos.length)) === 5, "5 Fotos gespeichert");
ok(await page.evaluate(() => S.trip.coverPhoto.startsWith("data:image/jpeg")), "Titelfoto gesetzt");

console.log("PDF und Screenshots");
await page.click('[data-tab="map"]');
await page.click("#mapBtn");
await page.waitForFunction(() => S.trip.mapImg && S.trip.mapImg.length > 1000, null, { timeout: 30000 });
await page.waitForTimeout(500);
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
await dl.saveAs(join(out, "rundreise.pdf"));
const pdf = await PDFDocument.load(readFileSync(join(out, "rundreise.pdf")));
ok(pdf.getPageCount() === 8, `PDF hat 8 Seiten: ${pdf.getPageCount()}`);
{
  const { PDFName, PDFDict, PDFArray } = await import("pdf-lib");
  const uris = [];
  pdf.getPages().forEach((pg) => { const an = pg.node.lookupMaybe(PDFName.of("Annots"), PDFArray); if (an) for (let i = 0; i < an.size(); i++) { const d = an.lookupMaybe(i, PDFDict), act = d && d.lookupMaybe(PDFName.of("A"), PDFDict), u = act && act.get(PDFName.of("URI")); if (u && u.decodeText) uris.push(u.decodeText()); } });
  ok(uris.length === 8 && uris.every((u) => u === "https://github.com/simsum/reise-protokoll"), `Fußzeile mit Link zur GitHub-Seite auf allen ${uris.length} Seiten`);
  ok((await page.locator("#pages").innerText()).includes("github.com/simsum/reise-protokoll") && (await page.locator('#pages a[href="https://github.com/simsum/reise-protokoll"]').count()) === 8, "Link auch in der Vorschau");
  ok((await page.locator("#pages .sheet").first().innerText()).includes("Familie Mustermann"), "Reisende auf der Deckseite");
}
await page.evaluate(() => { $("#toast").hidden = true; });
await page.click('[data-tab="days"]');
await page.click("details.day summary");
await page.screenshot({ path: join(out, "oberflaeche.png") });
await page.locator("#pages .sheet").nth(0).screenshot({ path: join(out, "deckseite.png") });
await page.locator("#pages .sheet").nth(1).screenshot({ path: join(out, "tag1.png") });
await page.locator("#pages .sheet").nth(7).screenshot({ path: join(out, "kosten.png") });

ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
