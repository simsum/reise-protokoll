// Test: Kachel „Karte (Tag)“ (Orte des Tages, Einpassen, Kartenbild mit Weg, Projektdatei, PDF). Kacheln sind Testantworten.
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

function png(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3, e = x % 64 === 0 || y % 64 === 0; raw[o] = e ? 120 : 215; raw[o + 1] = e ? 130 : 225; raw[o + 2] = e ? 120 : 205; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

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
  if (/tile\.openstreetmap\.(org|de)|arcgisonline\.com/.test(u)) return r.fulfill({ contentType: "image/png", headers: cors, body: png(256, 256) });
  return r.abort();
});
await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready && document.querySelectorAll("#pages .sheet").length > 0);
await page.evaluate(() => { S.trip.capWeather = false; S.trip.placeMode = "off"; });

console.log("Orte des Tages");
const pts = await page.evaluate(() => {
  const t = S.trip;
  t.startPlace = { name: "Zuhause", lat: 48.1374, lon: 11.5755 };
  const d = t.days[0]; d.place = { name: "Salzburg", lat: 47.8095, lon: 13.055 };
  d.photos.push(
    normPhoto({ id: "pa", name: "a.jpg", src: "data:image/jpeg;base64,/9j/4AAQ", bw: 10, bh: 10, gps: { lat: 47.9, lon: 12.2 }, time: "11:00:00" }),
    normPhoto({ id: "pb", name: "b.jpg", src: "data:image/jpeg;base64,/9j/4AAQ", bw: 10, bh: 10, gps: { lat: 47.95, lon: 11.9 }, time: "09:30:00" }),
    normPhoto({ id: "pc", name: "c.jpg", src: "data:image/jpeg;base64,/9j/4AAQ", bw: 10, bh: 10, gps: { lat: 47.9501, lon: 11.9001 }, time: "09:31:00" }),
  );
  return dayMapPoints(t, 0).map((p) => [p.name, +p.lat.toFixed(2)]);
});
ok(JSON.stringify(pts) === JSON.stringify([["Zuhause", 48.14], ["", 47.95], ["", 47.9], ["Salzburg", 47.81]]), "Start, Fotos nach Uhrzeit (nahe zusammengefasst), Ort des Tages: " + JSON.stringify(pts));
const fit = await page.evaluate(() => { const r = tileRectPt(2, 2), f = fitDayMap(dayMapPoints(S.trip, 0), r.w, r.h), a = mapProj(48.1374, 11.5755, f.zoom + 1), b = mapProj(47.8095, 13.055, f.zoom + 1); return { z: f.zoom, w: Math.abs(b.x - a.x) / 2, h: Math.abs(b.y - a.y) / 2, r }; });
ok(fit.w <= fit.r.w - 68 + 1 && fit.h <= fit.r.h - 68 + 1 && fit.z >= 5 && fit.z <= 9, `Einpassen: Zoom ${fit.z}, Orte passen in die Kachel`);
ok(await page.evaluate(() => fitDayMap([], 200, 200) === null), "ohne Orte: kein Ausschnitt");

console.log("Fenster");
await page.evaluate(() => { S.trip.days[0].pages = [newPage([tileOf("strecke", 4)])]; changed(); renderPreview(); });
await page.waitForTimeout(400);
const sheet = page.locator("#pages .sheet").nth(1);
await sheet.scrollIntoViewIfNeeded();
const grid = await sheet.locator(".ov").boundingBox();
await page.mouse.click(grid.x + grid.width * 0.5, grid.y + grid.height * 0.5);
await page.locator('#tb [data-tb="add"]').selectOption("tageskarte");
ok(await page.locator("#pm").isVisible() && (await page.locator("#pmHead").innerText()) === "Karte (Tag)", "neue Tageskarte öffnet das Fenster");
ok(await page.locator("#pmNameRow").isHidden() && await page.locator("#pmFit").isVisible(), "keine Beschriftung, dafür „Auf den Tag einpassen“");
await page.waitForFunction(() => /OpenStreetMap/.test(document.querySelector("#pmStatus").textContent));
const st = await page.evaluate(() => ({ z: pmd.z, lat: pmd.lat, day: pmd.day }));
ok(st.day && st.z === fit.z, `Start bereits auf den Tag eingepasst (Zoom ${st.z})`);
await page.locator("#pmZp").click();
await page.waitForFunction((z) => pmd.z === z + 1 && document.querySelector("#pmZ").textContent === String(z + 1), fit.z);
await page.locator("#pmFit").click();
await page.waitForFunction((z) => pmd.z === z, fit.z);
ok(true, "„Auf den Tag einpassen“ stellt den Ausschnitt zurück");
await page.screenshot({ path: join(out, "tageskarte-fenster.png") });
await page.locator("#pmOk").click();
await page.waitForFunction(() => document.querySelector("#pm").hidden);
const tile = await page.evaluate(() => { const x = S.trip.days[0].pages[0].tiles.find((q) => q.mod === "tageskarte"); return { w: x.w, h: x.h, has: /^data:image\/jpeg/.test(x.ptImg || ""), z: x.pt && x.pt.zoom, name: x.pt && x.pt.name, warns: layoutTrip(S.trip).warns || [] }; });
ok(tile.has && tile.w === 2 && tile.h === 2 && tile.z === fit.z && tile.name === "", "Kartenbild mit Weg gespeichert (2×2, Zoom wie eingepasst)");
const ops = await page.evaluate(() => { const pg = layoutTrip(S.trip).pages[1]; return { img: pg.ops.filter((o) => o.k === "img").length, pins: pg.ops.filter((o) => o.k === "path" && o.d && o.d.startsWith("M50 100C50")).length }; });
ok(ops.img >= 1 && ops.pins === 0, "Seite zeigt das Bild ohne Nadel in der Mitte");
await page.waitForTimeout(300);
await sheet.screenshot({ path: join(out, "tageskarte-seite.png") });

console.log("Projekt und PDF");
{
  const r = await page.evaluate(async () => {
    const t = S.trip, x = t.days[0].pages[0].tiles.find((q) => q.mod === "tageskarte"), atts = await collectAttachments(t), att = atts.find((a) => a.name === `kachelkarte-${x.id}.jpg`);
    const { pages } = layoutTrip(t), bytes = await buildPdf(pages, { title: "x" }, atts), back = await readProjectPdf(new File([bytes], "p.pdf", { type: "application/pdf" }));
    const y = back.trip.days[0].pages[0].tiles.find((q) => q.mod === "tageskarte");
    return { att: !!att, mod: y && y.mod, img: !!(y && /^data:image\/jpeg/.test(y.ptImg || "")), zoom: y && y.pt && y.pt.zoom };
  });
  ok(r.att && r.mod === "tageskarte" && r.img && r.zoom === fit.z, "Kartenbild steht als Anhang im PDF und kommt beim Öffnen zurück");
}
await page.selectOption("[data-k=photoStyle]", "frame").catch(() => {});
{
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
  const f = join(out, "tageskarte.pdf"); await dl.saveAs(f);
  ok((await PDFDocument.load(readFileSync(f))).getPageCount() >= 2, "PDF erstellt");
}
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
