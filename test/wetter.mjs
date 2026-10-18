// Test: Wetter aus Fotodaten (EXIF-Zeit und GPS) → Tageswetter, Fotozeile, Projekt-PDF.
// Bright Sky und Open-Meteo werden durch Testantworten ersetzt.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "test/out");
mkdirSync(out, { recursive: true });
let failed = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FEHLT ") + msg); if (!c) failed++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1250 }, acceptDownloads: true })).newPage();
const errors = [], calls = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); }); // 404 von Bright Sky außerhalb Deutschlands ist gewollt
const nm = (p) => join(root, "node_modules", p);
const cors = { "access-control-allow-origin": "*" };
await page.route("**/*", (r) => {
  const u = new URL(r.request().url());
  if (u.protocol === "file:") return r.continue();
  if (u.href.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("pdf-lib/dist/pdf-lib.min.js")) });
  if (u.href.includes("exifr")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("exifr/dist/full.umd.js")) });
  if (u.hostname === "api.brightsky.dev") {
    calls.push("bs " + u.searchParams.get("date"));
    if (+u.searchParams.get("lat") < 45) return r.fulfill({ status: 404, headers: cors, contentType: "application/json", body: "{}" });
    const hh = +u.searchParams.get("date").slice(11, 13);
    return r.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify({ weather: [{ temperature: hh, icon: "partly-cloudy-day", condition: "dry", relative_humidity: 60, wind_speed: 12, wind_direction: 225, wind_gust_speed: 20, precipitation: 0, cloud_cover: 40, pressure_msl: 1015, source_id: 1 }], sources: [{ id: 1, station_name: "Muenchen-Stadt", distance: 3200 }] }) });
  }
  if (u.hostname.endsWith("open-meteo.com")) {
    calls.push("om " + u.searchParams.get("start_date"));
    const day = u.searchParams.get("start_date"), time = Array.from({ length: 24 }, (_, h) => `${day}T${String(h).padStart(2, "0")}:00`), arr = (f) => time.map((_, h) => f(h));
    return r.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify({ hourly: { time, temperature_2m: arr((h) => h), apparent_temperature: arr((h) => h - 1), relative_humidity_2m: arr(() => 70), precipitation: arr(() => 1.2), weather_code: arr(() => 61), pressure_msl: arr(() => 1010), cloud_cover: arr(() => 90), wind_speed_10m: arr(() => 15), wind_direction_10m: arr(() => 270), wind_gusts_10m: arr(() => 30), is_day: arr(() => 1) } }) });
  }
  return r.abort();
});

await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready);

/* JPEG mit EXIF (Aufnahmezeit, GPS) im Browser erzeugen */
await page.evaluate(() => {
  window.exifJpeg = async (i, dt, lat, lon) => {
    const cv = document.createElement("canvas"); cv.width = 800; cv.height = 600;
    const g = cv.getContext("2d"); g.fillStyle = "hsl(" + i * 60 + ",45%,60%)"; g.fillRect(0, 0, 800, 600);
    const jpg = new Uint8Array(await (await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8))).arrayBuffer());
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
    return new File([res], "exif" + i + ".jpg", { type: "image/jpeg", lastModified: Date.parse("2020-01-01T00:00:00") });
  };
});

console.log("Fotos mit EXIF-Zeit und GPS");
await page.evaluate(() => loadTrip(newTrip("rundreise"), true));
await page.evaluate(async () => {
  const f = await Promise.all([
    exifJpeg(0, "2026:05:14 09:10:00", 48.137, 11.575), exifJpeg(1, "2026:05:14 14:20:00", 48.14, 11.58),
    exifJpeg(2, "2026:05:15 14:50:00", 38.72, -9.14),
  ]);
  await addPhotos(f);
});
ok(await page.evaluate(() => S.trip.days.map((d) => d.date).join() === "2026-05-14,2026-05-15"), "Tage aus EXIF-Datum (nicht aus Dateidatum)");
ok(await page.evaluate(() => S.trip.days[0].photos[0].gps && S.trip.days[0].photos[0].time === "09:10:00"), "EXIF-Zeit und GPS gelesen");
await page.waitForFunction(() => S.trip.days.every((d) => d.photos.every((p) => p.wx)), null, { timeout: 30000 });
const w = await page.evaluate(() => S.trip.days.map((d) => ({ w: d.weather, a: d.tmin, b: d.tmax, auto: d.wxAuto, src: d.photos.map((p) => p.weatherSrc).join("+") })));
ok(w[0].w === "partly" && w[0].a === "9" && w[0].b === "14" && w[0].auto === true, `Tag 1 (DWD): ${JSON.stringify(w[0])}`);
ok(w[0].src === "brightsky+brightsky", "Quelle Bright Sky (DWD) in Deutschland");
ok(w[1].w === "rain" && w[1].a === "15" && w[1].b === "15" && w[1].src === "openmeteo", `Tag 2 (Ausland, Open-Meteo): ${JSON.stringify(w[1])}`);
ok(calls.filter((c) => c.startsWith("bs")).length === 3 && calls.filter((c) => c.startsWith("om")).length === 1, `Abfragen: ${calls.join(", ")}`);
await page.waitForTimeout(500);
ok((await page.locator("#pages").innerText()).includes("9–14 °C"), "Wetterkasten der Tagesseite: 9–14 °C");
const det = await page.evaluate(() => dayWxDetail(S.trip.days[0]));
ok(/Wind Ø 12 km\/h aus SW, Böen bis 20 km\/h/.test(det) && /Luftfeuchte Ø 60 %/.test(det) && /Luftdruck 1015 hPa/.test(det) && /Quelle: DWD \(Muenchen-Stadt\)/.test(det), "Detailzeile: " + det);
ok((await page.locator("#pages").innerText()).includes("Luftfeuchte Ø 60 %"), "Detailzeile auf der Tagesseite");
await page.evaluate(() => { S.trip.days[0].wxExtra = "Eigener Text zum Wetter"; changed(); });
await page.waitForTimeout(400);
ok((await page.locator("#pages").innerText()).includes("Eigener Text zum Wetter") && !(await page.locator("#pages").innerText()).includes("Luftfeuchte Ø 60"), "eigener Text ersetzt die automatische Zeile");
await page.evaluate(() => { S.trip.days[0].wxExtra = ""; changed(); });

console.log("Manuelle Änderung und Fotozeile");
await page.evaluate(() => { S.tab = "days"; renderPanel(); });
await page.evaluate(() => { const d = S.trip.days[0]; const el = document.querySelector(`[data-k="d:${d.id}.tmax"]`); el.value = "30"; el.dispatchEvent(new Event("input", { bubbles: true })); });
ok(await page.evaluate(() => S.trip.days[0].wxAuto === false && S.trip.days[0].tmax === "30"), "Von Hand geändert: nicht mehr automatisch");
await page.evaluate(async () => { await addPhotosToDay(S.trip.days[0].id, [await exifJpeg(5, "2026:05:14 18:00:00", 48.137, 11.575)]); });
await page.waitForTimeout(800);
ok(await page.evaluate(() => S.trip.days[0].tmax === "30"), "neue Fotodaten überschreiben die manuelle Eingabe nicht");
await page.evaluate(() => { S.trip.wxLine = true; changed(); });
await page.waitForTimeout(500);
const ptxt = await page.locator("#pages").innerText();
ok(/Wind 12 km\/h/.test(ptxt), "Wetterzeile unter dem Foto: " + (ptxt.match(/\d\d:\d\d Uhr[^\n]*/g) || []).join(" | ").slice(0, 120));
await page.evaluate(() => resetDayWeather(S.trip.days[0]));
await page.waitForFunction(() => S.trip.days[0].tmax === "18", null, { timeout: 20000 });
ok(await page.evaluate(() => S.trip.days[0].tmin === "9"), "„neu ermitteln“ hebt die manuelle Änderung auf (9–18 °C)");

console.log("Ohne GPS oder mit Dateidatum: keine Abfrage");
const before = calls.length;
await page.evaluate(async () => {
  const cv = document.createElement("canvas"); cv.width = 50; cv.height = 50;
  const f = new File([await new Promise((r) => cv.toBlob(r, "image/jpeg"))], "plain.jpg", { type: "image/jpeg", lastModified: Date.parse("2026-05-20T12:00:00") });
  await addPhotos([f]);
});
await page.waitForTimeout(800);
ok(calls.length === before, "keine Wetterabfrage für Foto ohne EXIF-Zeit/GPS");

console.log("Roundtrip im PDF");
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
await dl.saveAs(join(out, "wetter.pdf"));
await page.evaluate(() => loadTrip(newTrip("kurztrip"), true));
page.once("dialog", (d) => d.accept());
const n0 = calls.length;
await page.setInputFiles("#openFile", join(out, "wetter.pdf"));
await page.waitForFunction(() => S.trip.days.length === 3, null, { timeout: 60000 });
await page.waitForTimeout(800);
const back = await page.evaluate(() => ({ w: S.trip.days[1].weather, a: S.trip.days[1].tmin, auto: S.trip.days[1].wxAuto, wx: !!S.trip.days[1].photos[0].wx, t: S.trip.days[0].photos[0].wx.t }));
ok(back.w === "rain" && back.a === "15" && back.auto === true && back.wx && back.t === 9, "Wetterdaten der Fotos und Tage im PDF wiederhergestellt");
ok(calls.length === n0, "nach dem Öffnen keine neue Abfrage");

console.log("Ausgeschaltet");
await page.evaluate(() => { const t = newTrip("rundreise"); t.capWeather = false; loadTrip(t, true); });
const m0 = calls.length;
await page.evaluate(async () => addPhotos([await exifJpeg(7, "2026:06:01 10:00:00", 48.137, 11.575)]));
await page.waitForTimeout(800);
ok(calls.length === m0, "mit ausgeschalteter Option keine Abfrage");

ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
