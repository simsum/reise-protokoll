// Test: Foto-Optionen wie im Foto-Protokoll (Beschriftung, Ort, Prüfsummen, Einbetten/Verkleinern, Bildauflösung).
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PDFDocument, PDFName, PDFRawStream, PDFDict } from "pdf-lib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "test/out");
mkdirSync(out, { recursive: true });
let failed = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FEHLT ") + msg); if (!c) failed++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1250 }, acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const nm = (p) => join(root, "node_modules", p);
let osmDown = false;
await page.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith("file:")) return r.continue();
  if (u.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("pdf-lib/dist/pdf-lib.min.js")) });
  if (u.includes("exifr")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("exifr/dist/full.umd.js")) });
  if (u.includes("nominatim") && u.includes("zoom=18")) {
    if (osmDown) return r.abort();
    return r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ address: { road: "Testweg", house_number: "5", postcode: "80331", city: "München", country_code: "de", country: "Deutschland" } }) });
  }
  return r.abort();
});
await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready);

/* JPEG mit EXIF (Zeit, GPS) in beliebiger Größe */
await page.evaluate(() => {
  window.exifJpeg = async (i, dt, lat, lon, W = 3000, H = 2000) => {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"); const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "hsl(" + i * 50 + ",60%,55%)"); gr.addColorStop(1, "hsl(" + (i * 50 + 90) + ",60%,35%)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H); for (let k = 0; k < 400; k++) { g.fillStyle = `hsl(${(k * 37) % 360},70%,50%)`; g.fillRect((k * 97) % W, (k * 53) % H, 40, 40); }
    const jpg = new Uint8Array(await (await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9))).arrayBuffer());
    const ab = new ArrayBuffer(400), dv = new DataView(ab);
    dv.setUint16(0, 0x4d4d); dv.setUint16(2, 42); dv.setUint32(4, 8);
    const n0 = 3; let pos = 8 + 2 + n0 * 12 + 4; const exifOff = pos; pos += 2 + 12 + 4 + 20; const gpsOff = pos; pos += 2 + 5 * 12 + 4 + 48;
    const ent = (at, tag, type, count, val) => { dv.setUint16(at, tag); dv.setUint16(at + 2, type); dv.setUint32(at + 4, count); if (type === 3) dv.setUint16(at + 8, val); else dv.setUint32(at + 8, val); };
    let e = 8; dv.setUint16(e, n0); e += 2; ent(e, 0x0112, 3, 1, 1); e += 12; ent(e, 0x8769, 4, 1, exifOff); e += 12; ent(e, 0x8825, 4, 1, gpsOff); e += 12; dv.setUint32(e, 0);
    { const data = exifOff + 18; dv.setUint16(exifOff, 1); ent(exifOff + 2, 0x9003, 2, 20, data); dv.setUint32(exifOff + 14, 0); for (let k = 0; k < 19; k++) dv.setUint8(data + k, dt.charCodeAt(k)); dv.setUint8(data + 19, 0); }
    { const data = gpsOff + 66; let a = gpsOff; dv.setUint16(a, 5); a += 2;
      ent(a, 0, 1, 4, 0); dv.setUint8(a + 8, 2); dv.setUint8(a + 9, 3); a += 12; ent(a, 1, 2, 2, 0); dv.setUint8(a + 8, lat >= 0 ? 78 : 83); a += 12; ent(a, 2, 5, 3, data); a += 12;
      ent(a, 3, 2, 2, 0); dv.setUint8(a + 8, lon >= 0 ? 69 : 87); a += 12; ent(a, 4, 5, 3, data + 24); a += 12; dv.setUint32(a, 0);
      const dms = (at, v) => { v = Math.abs(v); const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60 * 1000); [[d, 1], [m, 1], [s, 1000]].forEach(([nu, de], k) => { dv.setUint32(at + k * 8, nu); dv.setUint32(at + k * 8 + 4, de); }); };
      dms(data, lat); dms(data + 24, lon); }
    const seg = new Uint8Array(10 + pos); seg.set([0xff, 0xe1, ((pos + 8) >> 8) & 0xff, (pos + 8) & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0]); seg.set(new Uint8Array(ab, 0, pos), 10);
    const res = new Uint8Array(jpg.length + seg.length); res.set(jpg.subarray(0, 2)); res.set(seg, 2); res.set(jpg.subarray(2), 2 + seg.length);
    return new File([res], "urlaub" + i + ".jpg", { type: "image/jpeg", lastModified: Date.parse("2020-01-01T00:00:00") });
  };
});

const fresh = async (opts) => {
  await page.evaluate(async (opts) => {
    const t = newTrip("rundreise"); t.capWeather = false; Object.assign(t, opts || {}); loadTrip(t, true);
    await addPhotos([await exifJpeg(1, "2026:05:14 09:10:00", 48.137, 11.575), await exifJpeg(2, "2026:05:14 15:30:00", 48.14, 11.58)]);
  }, opts);
};
const download = async () => {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
  const f = join(out, "foto-optionen.pdf"); await dl.saveAs(f);
  return readFileSync(f);
};

console.log("Beschriftung unter den Fotos");
await fresh({ placeMode: "auto" });
await page.waitForFunction(() => S.trip.days[0].photos.every((p) => p.place), null, { timeout: 20000 });
const pl = await page.evaluate(() => S.trip.days[0].photos.map((p) => p.place + "|" + p.placeSrc));
ok(pl.every((x) => x === "Testweg 5, 80331 München|osm"), `Ort über OpenStreetMap (Straße, Hausnummer, PLZ): ${pl[0]}`);
await page.evaluate(() => { Object.assign(S.trip, { capNum: true, capDate: true, capPlace: true, capGps: true, capFile: true, capNote: true }); S.trip.days[0].photos[0].note = "Aussicht vom Turm"; changed(); });
await page.waitForTimeout(500);
const txt = await page.locator("#pages").innerText();
console.log("   Vorschautext:", JSON.stringify(txt.match(/Foto \d[^\n]*/g)));
ok(txt.includes("Foto 1 · 14.05.2026, 09:10 Uhr") && txt.includes("Foto 2 · 14.05.2026, 15:30 Uhr"), "Fotonummer, Datum und Uhrzeit");
ok(txt.includes("Testweg 5, 80331 München"), "Ort");
ok(/48,13700° N, 11,57500° E|48\.13700° N, 11\.57500° E/.test(txt), "GPS-Koordinaten");
ok(txt.includes("Datei: urlaub1.jpg") && txt.includes("Aussicht vom Turm"), "Dateiname und Bemerkung");
ok((await page.locator('#pages a[href*="openstreetmap.org/?mlat=48.137000"]').count()) === 1, "GPS als Link zur Karte");
await page.locator("#pages .sheet").nth(1).screenshot({ path: join(out, "beschriftung.png") });
await page.evaluate(() => { Object.assign(S.trip, { capNum: false, capDate: false, capPlace: false, capGps: false, capFile: false }); changed(); });
await page.waitForTimeout(400);
ok(!(await page.locator("#pages").innerText()).includes("Foto 1  ·"), "Beschriftungen lassen sich abschalten");

console.log("Ort: manuell, offline, aus");
await page.evaluate(() => { const p = S.trip.days[0].photos[0]; const el = document.querySelector(`[data-k="d:${S.trip.days[0].id}.photos.${p.id}.place"]`); S.tab = "days"; renderPanel(); });
await page.evaluate(() => { const d = S.trip.days[0], p = d.photos[0], el = document.querySelector(`[data-k="d:${d.id}.photos.${p.id}.place"]`); el.value = "Mein Lieblingsplatz"; el.dispatchEvent(new Event("input", { bubbles: true })); });
ok(await page.evaluate(() => S.trip.days[0].photos[0].placeSrc === "manual"), "Von Hand eingetragen: manuell");
await page.evaluate(() => { const el = document.querySelector('[data-k="placeMode"]'); S.tab = "trip"; renderPanel(); const sel = document.querySelector('[data-k="placeMode"]'); sel.value = "offline"; sel.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForFunction(() => S.trip.days[0].photos[1].placeSrc === "offline", null, { timeout: 20000 });
const off = await page.evaluate(() => S.trip.days[0].photos.map((p) => p.place + "|" + p.placeSrc));
ok(off[0] === "Mein Lieblingsplatz|manual" && /^(München|Munich|bei )/.test(off[1].split("|")[0]) && off[1].endsWith("|offline"), `Offline-Liste, manuelle Angabe bleibt: ${off.join(" / ")}`);
await page.evaluate(() => { const sel = document.querySelector('[data-k="placeMode"]'); sel.value = "off"; sel.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForTimeout(500);
ok(await page.evaluate(() => S.trip.days[0].photos[1].place === "" && S.trip.days[0].photos[0].place === "Mein Lieblingsplatz"), "Ort aus: nur die manuelle Angabe bleibt");

console.log("OSM nicht erreichbar: Rückfall auf die Liste");
osmDown = true; await page.evaluate(() => osmCache.clear());
await fresh({ placeMode: "auto" });
await page.waitForFunction(() => S.trip.days[0].photos.every((p) => p.placeSrc === "offline"), null, { timeout: 20000 });
ok(true, "Offline-Ort statt Fehler");
osmDown = false;

console.log("Prüfsummen und Einbetten");
await fresh({ placeMode: "off", hashes: true, embed: "original" });
const shas = await page.evaluate(async () => Promise.all(S.trip.days[0].photos.map(async (p) => [p.sha, [...new Uint8Array(await crypto.subtle.digest("SHA-256", await p.file.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("")])));
ok(shas.every(([a, b]) => a && a === b), "SHA-256 jedes Originals berechnet");
const pdf1 = await download();
const doc1 = await PDFDocument.load(pdf1);
const sizeOrig = pdf1.length;
ok(doc1.getPageCount() === 4, `Prüfsummen-Seite angehängt: ${doc1.getPageCount()} Seiten (Deckseite, Tag, Fotoseite, Prüfsummen)`);
const pdfText = await page.evaluate(() => layoutTrip(S.trip).pages.at(-1).ops.filter((o) => o.k === "t").map((o) => o.text).join("\n"));
ok(shas.every(([a]) => pdfText.includes(a)) && pdfText.includes("Prüfsummen der Originalfotos"), "Prüfsummen stehen auf der Seite");

for (const edge of ["1600", "2400"]) {
  await page.evaluate((e) => { S.trip.embed = e; }, edge);
  const bytes = await download();
  const info = await page.evaluate(async (b64) => {
    const att = (await readPdfAttachments(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).filter((a) => /^\d{4} /.test(a.name));
    const res = [];
    for (const a of att) {
      const bmp = await createImageBitmap(new Blob([a.bytes], { type: "image/jpeg" }));
      const ex = await exifr.parse(a.bytes, { pick: ["DateTimeOriginal"], reviveValues: false }), g = await exifr.gps(a.bytes).catch(() => null);
      res.push({ w: bmp.width, h: bmp.height, dt: ex && ex.DateTimeOriginal, lat: g && g.latitude, size: a.bytes.length });
    }
    return res;
  }, bytes.toString("base64"));
  ok(info.length === 2 && info.every((x) => Math.max(x.w, x.h) === +edge), `${edge} px: Fotos verkleinert (${info.map((x) => x.w + "×" + x.h).join(", ")}, ${bytes.length < sizeOrig ? "kleineres PDF" : "PDF NICHT kleiner"})`);
  ok(info.every((x) => x.dt === "2026:05:14 09:10:00" || x.dt === "2026:05:14 15:30:00") && info.every((x) => Math.abs(x.lat - 48.137) < 0.01 || Math.abs(x.lat - 48.14) < 0.01), "Aufnahmedatum und GPS bleiben in der verkleinerten Datei");
}
/* verkleinert eingebettet wieder öffnen */
await fresh({ placeMode: "off", embed: "2400" });
await download();
await page.evaluate(() => loadTrip(newTrip("kurztrip"), true));
page.once("dialog", (d) => d.accept());
await page.setInputFiles("#openFile", join(out, "foto-optionen.pdf"));
await page.waitForFunction(() => S.trip.days.length === 1 && S.trip.days[0].photos.length === 2, null, { timeout: 60000 });
ok(await page.evaluate(() => S.trip.days[0].photos[0].gps && S.trip.days[0].photos[0].time === "09:10:00" && S.trip.embed === "2400" && S.trip.days[0].photos[0].sha.length === 64), "verkleinert eingebettet: wieder geöffnet (Prüfsumme des Originals bleibt)");

console.log("Bildauflösung auf der Seite");
const imgWidths = async (bytes) => {
  const d = await PDFDocument.load(bytes), w = [];
  for (const [, obj] of d.context.enumerateIndirectObjects()) if (obj instanceof PDFRawStream && obj.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")) w.push(obj.dict.get(PDFName.of("Width")).asNumber());
  return w.filter((x) => x > 100);
};
await fresh({ placeMode: "off", projData: false });
const sizes = {};
for (const dpi of ["110", "300"]) {
  await page.evaluate((v) => { S.trip.dpi = v; }, dpi);
  const b = await download(); sizes[dpi] = { bytes: b.length, w: Math.max(...(await imgWidths(b))) };
}
ok(sizes["300"].w > sizes["110"].w * 2 && sizes["300"].bytes > sizes["110"].bytes, `110 dpi: ${sizes["110"].w} px breit, 300 dpi: ${sizes["300"].w} px breit (PDF ${Math.round(sizes["110"].bytes / 1024)} → ${Math.round(sizes["300"].bytes / 1024)} KB)`);

ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
