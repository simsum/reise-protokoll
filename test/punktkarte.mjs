// Test: Kachel „Karte (Punkt)“ (Position wählen, verschieben, zoomen, Kartenbild, Projektdatei, PDF). Kacheln und Suche sind Testantworten.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "test/out");
mkdirSync(out, { recursive: true });
let failed = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FEHLT ") + msg); if (!c) failed++; };

/* Kachelbild mit Raster und Farbe je Kachelnummer (damit man sieht, ob die richtigen Kacheln liegen) */
function png(w, h, hue) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3, edge = x % 64 === 0 || y % 64 === 0;
    raw[o] = edge ? 120 : 200 - hue % 50; raw[o + 1] = edge ? 130 : 215 - (hue * 3) % 40; raw[o + 2] = edge ? 120 : 190 + (hue * 7) % 40;
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

let tileReqs = 0, tilesDown = false;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1250 }, acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const nm = (p) => join(root, "node_modules", p);
const cors = { "access-control-allow-origin": "*" };
await page.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith("file:")) return r.continue();
  if (u.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("pdf-lib/dist/pdf-lib.min.js")) });
  if (u.includes("exifr")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("exifr/dist/full.umd.js")) });
  if (/tile\.openstreetmap\.(org|de)|arcgisonline\.com/.test(u)) {
    if (tilesDown) return r.abort();
    tileReqs++; const m = u.match(/(\d+)\/(\d+)\/(\d+)/);
    return r.fulfill({ contentType: "image/png", headers: cors, body: png(256, 256, m ? +m[2] * 7 + +m[3] : 0) });
  }
  if (u.includes("nominatim")) return r.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify([{ lat: "47.8095", lon: "13.055", display_name: "Salzburg, Österreich", name: "Salzburg", address: { city: "Salzburg" } }]) });
  return r.abort();
});
await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready && document.querySelectorAll("#pages .sheet").length > 0);
await page.evaluate(() => { S.trip.capWeather = false; S.trip.placeMode = "off"; });

console.log("Module und Kartenrenderer");
ok(await page.evaluate(() => MODULES.karte.name === "Karte (Strecke)" && MODULES.punktkarte.name === "Karte (Punkt)"), "zwei Kartenmodule: „Karte (Strecke)“ wie gehabt und „Karte (Punkt)“");
ok(await page.evaluate(() => { const c = mapProj(48.1374, 11.5755, 17), b = mapInv(c.x, c.y, 17); return Math.abs(b.lat - 48.1374) < 1e-7 && Math.abs(b.lon - 11.5755) < 1e-7; }), "Umrechnung Koordinaten ↔ Kartenpunkte stimmt in beide Richtungen");
tileReqs = 0;
const pa = await page.evaluate(async () => { const cv = document.createElement("canvas"); cv.width = 506; cv.height = 432; const r = await paintPointMap(cv, 48.1374, 11.5755, 15, THEMES.meer); const g = cv.getContext("2d").getImageData(250, 200, 1, 1).data; return { ...r, w: cv.width, px: [...g] }; });
const first = tileReqs;
ok(pa.mode === "osm" && pa.source === "osmde" && pa.credit.includes("OpenStreetMap") && first >= 4 && first <= 12, `Karte aus ${first} Kacheln gemalt (aus lokaler Datei zuerst OSM.de), Quelle: ${pa.credit}`);
await page.evaluate(async () => { const cv = document.createElement("canvas"); cv.width = 506; cv.height = 432; await paintPointMap(cv, 48.1374, 11.5755, 15, THEMES.meer); });
ok(tileReqs === first, "dieselben Kacheln werden aus dem Zwischenspeicher genommen (Verschieben bleibt flüssig)");
tilesDown = true;
const sc = await page.evaluate(async () => { const cv = document.createElement("canvas"); cv.width = 300; cv.height = 200; return paintPointMap(cv, 10.5, 20.5, 6, THEMES.meer); });
ok(sc.mode === "schema" && sc.credit.startsWith("Schemakarte"), "ohne Kacheln: Schemakarte statt Fehler");
tilesDown = false;

console.log("Fenster");
await page.evaluate(() => {
  const d = S.trip.days[0]; d.place = { name: "München", lat: 48.1374, lon: 11.5755 };
  d.photos.push(normPhoto({ id: "ph1", name: "a.jpg", src: "data:image/jpeg;base64,/9j/4AAQ", bw: 10, bh: 10, gps: { lat: 48.2, lon: 11.6 }, place: "Schwabing" }));
  d.pages = [newPage([tileOf("strecke", 4)])]; changed(); renderPreview();
});
await page.waitForTimeout(400);
const sheet = page.locator("#pages .sheet").nth(1);
await sheet.scrollIntoViewIfNeeded();
const grid = await sheet.locator(".ov").boundingBox();
await page.mouse.click(grid.x + grid.width * 0.5, grid.y + grid.height * 0.5);
await page.locator('#tb [data-tb="add"]').selectOption("punktkarte");
ok(await page.locator("#pm").isVisible(), "neue Punktkarte öffnet das Fenster");
await page.waitForFunction(() => /OpenStreetMap/.test(document.querySelector("#pmStatus").textContent));
ok(await page.locator("#pmName").inputValue() === "München", "Beschriftung vorbelegt mit dem Ort des Tages");
const st0 = await page.evaluate(() => ({ lat: pmd.lat, lon: pmd.lon, z: pmd.z, w: document.querySelector("#pmCv").width, h: document.querySelector("#pmCv").height, r: tileRectPt(pmd.w, pmd.h) }));
ok(st0.lat === 48.1374 && st0.lon === 11.5755 && st0.z === 15 && st0.w === Math.round(st0.r.w * 2) && st0.h === Math.round(st0.r.h * 2), `Start auf dem Ort des Tages, Zoom 15, Karte in 2-facher Auflösung der Kachel (${st0.w} × ${st0.h} px)`);
ok((await page.locator("#pmCoord").innerText()).includes("48,13740") === false && (await page.locator("#pmCoord").innerText()).includes("48.13740° N"), "Koordinaten werden angezeigt");
ok((await page.locator("#pmPos option").allInnerTexts()).join("|") === "Ort des Tages: München|Foto 1: Schwabing|Aktueller Standort des Geräts", "Positionen zur Auswahl: Ort, Foto mit GPS, Gerät");
await page.locator("#pmZp").click();
await page.waitForFunction(() => pmd.z === 16 && document.querySelector("#pmZ").textContent === "16");
await page.locator("#pmZm").click(); await page.locator("#pmZm").click();
await page.waitForFunction(() => pmd.z === 14);
ok(true, "Zoom mit + und −");
{
  const b = await page.locator("#pmMap").boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 50, y + 30, { steps: 5 }); await page.mouse.move(x + 100, y + 60, { steps: 5 });
  ok((await page.locator("#pmCv").evaluate((c) => c.style.transform)).includes("translate("), "beim Ziehen folgt die Karte sofort dem Zeiger");
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector("#pmCv").style.transform === "");
  const st1 = await page.evaluate(() => ({ lat: pmd.lat, lon: pmd.lon }));
  const dLon = 11.5755 - st1.lon, dLat = st1.lat - 48.1374;
  ok(dLon > 0.003 && dLon < 0.05 && dLat > 0.001 && dLat < 0.03, `Karte nach rechts-unten gezogen: Position wandert nach Westen und Norden (Δlon ${dLon.toFixed(4)}°, Δlat ${dLat.toFixed(4)}°)`);
}
await page.locator("#pmQ").fill("Salzburg"); await page.locator("#pmGo").click();
await page.waitForSelector("#pmHits button");
await page.locator("#pmHits button").first().click();
await page.waitForFunction(() => Math.abs(pmd.lat - 47.8095) < 1e-6);
ok(await page.locator("#pmName").inputValue() === "Salzburg" && await page.evaluate(() => pmd.z >= 14), "Suche: Treffer setzt Position und Beschriftung");
await page.locator("#pmPos").selectOption("1"); await page.locator("#pmPosGo").click();
await page.waitForFunction(() => Math.abs(pmd.lat - 48.2) < 1e-6);
ok(await page.locator("#pmName").inputValue() === "Schwabing", "Position von einem Foto übernehmen");
await page.locator("#pmQ").fill("Salzburg"); await page.locator("#pmGo").click();
await page.waitForSelector("#pmHits button"); await page.locator("#pmHits button").first().click();
await page.waitForFunction(() => Math.abs(pmd.lat - 47.8095) < 1e-6);
await page.locator('#pmSizes button[data-w="2"][data-h="1"]').click();
await page.waitForFunction(() => { const c = document.querySelector("#pmCv"); return c.width / c.height > 2 && pmd.h === 1; });
ok(true, "Größe 2×1: Kartenausschnitt passt sich an");
await page.screenshot({ path: join(out, "punktkarte-fenster.png") });
await page.locator("#pmOk").click();
await page.waitForFunction(() => document.querySelector("#pm").hidden);
const tile = await page.evaluate(() => { const t = S.trip.days[0].pages[0].tiles.find((x) => x.mod === "punktkarte"); const r = tileRectPt(2, 1); return t && { w: t.w, h: t.h, pt: t.pt, img: t.ptImg && t.ptImg.slice(0, 23), len: t.ptImg && t.ptImg.length, ptW: t.ptW, ptH: t.ptH, rw: Math.round(r.w * 2), id: t.id }; });
ok(tile && tile.w === 2 && tile.h === 1 && tile.pt.name === "Salzburg" && Math.abs(tile.pt.lat - 47.8095) < 1e-6 && tile.img === "data:image/jpeg;base64," && tile.ptW === tile.rw && tile.pt.credit.includes("OpenStreetMap"), `Kachel enthält Position, Beschriftung, Quelle und ein Kartenbild (${Math.round(tile.len / 1024)} KB)`);
await page.waitForTimeout(400);
const ops = await page.evaluate(() => { const pg = layoutTrip(S.trip).pages[1]; return { img: pg.ops.some((o) => o.k === "img" && o.src.startsWith("data:image/jpeg")), pin: pg.ops.some((o) => o.k === "path" && o.d.startsWith("M50 100C50 100") && o.fill === THEMES.meer.accent2), txt: pg.ops.filter((o) => o.k === "t").map((o) => o.text) }; });
ok(ops.img && ops.pin && ops.txt.includes("Salzburg") && ops.txt.some((x) => x.includes("OpenStreetMap")), "Seite zeigt Kartenbild, Nadel, Beschriftung und Quellenangabe");
await sheet.screenshot({ path: join(out, "punktkarte-seite.png") });

console.log("Bearbeiten und Abbrechen");
const bb = await sheet.locator(`.tl[data-id="${tile.id}"]`).boundingBox();
await page.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2);
ok(await page.locator("#pm").isVisible() && await page.locator("#pmName").inputValue() === "Salzburg" && await page.evaluate(() => Math.abs(pmd.lat - 47.8095) < 1e-6 && pmd.z >= 14), "Doppelklick öffnet das Fenster mit der gespeicherten Position");
await page.locator("#pmName").fill("Verworfen"); await page.locator("#pmPos").selectOption("1"); await page.locator("#pmPosGo").click();
await page.locator("#pmCancel").click();
ok(await page.evaluate(() => { const t = S.trip.days[0].pages[0].tiles.find((x) => x.mod === "punktkarte"); return t.pt.name === "Salzburg" && Math.abs(t.pt.lat - 47.8095) < 1e-6; }), "Abbrechen ändert nichts");
await page.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.keyboard.press("Escape");
ok(await page.locator("#pm").isHidden() && await page.evaluate(() => S.trip.days[0].pages[0].tiles.some((x) => x.mod === "punktkarte")), "Escape schließt das Fenster, die Kachel bleibt");
await page.click('[data-tab="days"]');
await page.evaluate(() => { S.open.add(S.trip.days[0].id); renderPanel(); });
ok(await page.locator('details.day[open] [data-act="pmOpen"]').count() === 1 && (await page.locator("details.day[open] .tile small").allInnerTexts()).some((t) => t.includes("Salzburg") && t.includes("Zoom")), "Seitenleiste: Knopf und Zusammenfassung");

console.log("Projekt und PDF");
const pr = await page.evaluate(async () => {
  const t = S.trip, x = t.days[0].pages[0].tiles.find((q) => q.mod === "punktkarte"), atts = await collectAttachments(t), att = atts.find((a) => a.name === `kachelkarte-${x.id}.jpg`);
  const j = jsonOfTrip(t, new Map(), new Map()), jt = j.trip.days[0].pages[0].tiles.find((q) => q.id === x.id);
  const { pages } = layoutTrip(t), bytes = await buildPdf(pages, { title: "x" }, atts), back = await readProjectPdf(new File([bytes], "p.pdf", { type: "application/pdf" })), bt = back.trip.days[0].pages[0].tiles.find((q) => q.mod === "punktkarte");
  const e1 = pdfEstimate(t, pages).extra; const keep = x.ptImg; x.ptImg = ""; const e2 = pdfEstimate(t, layoutTrip(t).pages).extra; x.ptImg = keep;
  return { att: !!att && att.mime === "image/jpeg" && att.bytes.length > 1000, json: jt.hasImg === true && !("ptImg" in jt) && jt.pt.name === "Salzburg", back: bt && bt.pt.name === "Salzburg" && bt.ptImg === keep && bt.ptW === x.ptW && !("hasImg" in bt) && !("ptKey" in bt), size: e1 - e2 > keep.length * 0.7 };
});
ok(pr.att, "Kartenbild liegt als Anhang „kachelkarte-…jpg“ im PDF");
ok(pr.json, "Projektdaten: Position und Beschriftung, aber kein Bild im Text (nur Kennzeichen „hasImg“)");
ok(pr.back, "PDF wieder öffnen: Position, Beschriftung und Kartenbild sind identisch zurück");
ok(pr.size, "Größenschätzung zählt das Kartenbild als Anhang mit");
const evil = await page.evaluate(() => { const t = cleanTrip({ app: "Reise-Protokoll", trip: { days: [{ pages: [{ tiles: [
  { id: "ok_1", mod: "punktkarte", pt: { lat: 999, lon: 5 } }, { id: "ok_2", mod: "punktkarte", pt: { lat: 10, lon: 20, zoom: 99, name: "n".repeat(500), credit: "c".repeat(500) }, ptW: 99999, ptH: -3, hasImg: true },
  { id: "../x", mod: "punktkarte", pt: { lat: 1, lon: 2 }, hasImg: true }, { id: "ok_4", mod: "punktkarte", pt: "kaputt" }] }] }] } }).days[0].pages[0].tiles; return t; });
ok(evil[0].pt === undefined && evil[1].pt.zoom === 18 && evil[1].pt.name.length === 120 && evil[1].pt.credit.length === 120 && evil[1].ptW === 0 && evil[1].ptH === 0 && evil[1].hasImg === true && evil[1].ptKey === "ok_2" && !evil[2].hasImg && evil[3].pt === undefined, "manipulierte Daten werden bereinigt (Koordinaten, Zoom, Längen, Bildkennung)");
ok(await page.evaluate(() => { const x = copyTiles([{ mod: "punktkarte", w: 2, h: 2, pt: { lat: 1, lon: 2, zoom: 3 }, ptImg: "data:x" }])[0]; return x.mod === "punktkarte" && !x.pt && !x.ptImg; }), "Format übertragen kopiert Position und Bild nicht");
ok(await page.evaluate(() => { const T = THEMES.meer, pg = new Pg(T), w = []; MODULES.punktkarte.draw(pg, { t: S.trip, T, i: 0, warns: w }, { pt: { lat: 1, lon: 2, zoom: 5, name: "x", credit: "" } }, { x: 0, y: 0, w: 200, h: 150 }); return w.length === 1 && /fehlt das Kartenbild/.test(w[0]) && pg.ops.some((o) => o.k === "t" && /fehlt/.test(o.text)); }), "Punktkarte ohne Bild: Platzhalter und Hinweis");
ok(await page.evaluate(() => { const T = THEMES.meer, pg = new Pg(T); MODULES.punktkarte.draw(pg, { t: S.trip, T, i: 0, warns: [] }, {}, { x: 0, y: 0, w: 200, h: 150 }); return pg.ops.length === 0; }), "Punktkarte ohne Position zeichnet nichts");
{
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
  const f = join(out, "punktkarte.pdf"); await dl.saveAs(f);
  ok((await PDFDocument.load(readFileSync(f))).getPageCount() >= 2, "PDF mit Punktkarte erstellt");
}
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
