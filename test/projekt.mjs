// Test: Mehrfach-Import, Projektdaten im PDF, PDF wieder öffnen, manipulierte PDFs.
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PDFDocument } from "pdf-lib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "test/out");
mkdirSync(out, { recursive: true });
let failed = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FEHLT ") + msg); if (!c) failed++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1250 }, acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const nm = (p) => join(root, "node_modules", p);
await page.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith("file:")) return r.continue();
  if (u.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("pdf-lib/dist/pdf-lib.min.js")) });
  if (u.includes("exifr")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("exifr/dist/full.umd.js")) });
  if (u.includes("nominatim") && u.includes("reverse")) return r.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ name: "Testdorf", address: { village: "Testdorf" } }) });
  return r.abort();
});

await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready);

/* Beispielfotos: Datum über lastModified, GPS gibt es ohne EXIF nicht */
const mkFiles = `async (specs) => Promise.all(specs.map(async ([i, iso]) => {
  const cv = document.createElement("canvas"); cv.width = 1200; cv.height = i % 2 ? 900 : 800;
  const g = cv.getContext("2d"); g.fillStyle = "hsl(" + i * 47 + ",45%,60%)"; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#fff"; g.font = "120px sans-serif"; g.fillText("Foto " + (i + 1), 80, 300);
  return new File([await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8))], "bild" + i + ".jpg", { type: "image/jpeg", lastModified: Date.parse(iso) });
}))`;

console.log("Mehrfach-Import");
await page.evaluate(() => { const t = newTrip("rundreise"); loadTrip(t, true); });
await page.evaluate(async (src) => {
  const files = await eval(src)([[0, "2026-05-14T09:10:00"], [1, "2026-05-14T15:30:00"], [2, "2026-05-16T11:00:00"], [3, "2026-05-16T08:00:00"], [4, "2026-05-17T12:00:00"]]);
  await addPhotos(files);
}, mkFiles);
const days = await page.evaluate(() => S.trip.days.map((d) => `${d.date}:${d.photos.length}`));
ok(days.join(" ") === "2026-05-14:2 2026-05-16:2 2026-05-17:1", `Tage aus Fotodaten: ${days.join(" ")}`);
ok(await page.evaluate(() => S.trip.start === "2026-05-14"), "Reisebeginn aus erstem Foto");
ok(await page.evaluate(() => S.trip.days[1].photos[0].time < S.trip.days[1].photos[1].time), "Fotos eines Tages nach Uhrzeit sortiert");

console.log("Anmerkungen");
await page.evaluate(() => {
  const t = S.trip, p = t.days[0].photos[0];
  t.title = "Projekttest <b>fett</b>"; t.summaryAuto = false; t.summary = "Eigene Zusammenfassung";
  t.days[0].place = { name: "Teststadt", lat: 48.1, lon: 11.5 }; t.days[0].text = "Tagebuch eins";
  p.note = "Schöner Blick"; p.marks = [{ t: "circle", x: 400, y: 300, r: 90, c: "#E3242B" }, { t: "num", x: 700, y: 400, r: 40, c: "#FFC400", note: "Hier lang" }, { t: "arrow", x: 200, y: 200, x2: 320, y2: 120, c: "#1F6FEB" }];
  changed();
});
await page.evaluate(async () => { const p = S.trip.days[0].photos[1]; await rotatePhoto(p, 1); await setCrop(p, { x: 100, y: 100, w: 500, h: 600 }); p.note = "Gedreht und zugeschnitten"; changed(); });
await page.waitForTimeout(500);
const txt = await page.locator("#pages").innerText();
ok(txt.includes("Schöner Blick") && txt.includes("Hier lang"), "Bildunterschrift und Notiz zur Nummer in der Vorschau");
const dims = await page.evaluate(() => { const p = S.trip.days[0].photos[1]; return [p.w, p.h, !!p.vsrc]; });
ok(dims[0] === 500 && dims[1] === 600 && dims[2], `Ausschnitt nach Drehung: ${dims[0]}×${dims[1]}`);
await page.evaluate(async (src) => {
  const f = (await eval(src)([[9, "2026-05-14T10:00:00"]]))[0]; await useCover(f);
}, mkFiles);

await page.click('[data-tab="days"]');
await page.evaluate(() => { const d = document.querySelector("details.day"); d.open = true; d.scrollIntoView(); });
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, "ui-tage.png") });
await page.evaluate(() => openEditor(S.trip.days[0].photos[0]));
await page.waitForTimeout(400);
await page.screenshot({ path: join(out, "ui-editor.png") });
ok(await page.locator("#edNotes input").count() === 1, "Editor zeigt Notizfeld zur Nummer");
await page.click("#edDone");
ok(await page.locator("#editor").isHidden(), "Editor schließt");

console.log("PDF erstellen");
await page.click('[data-tab="trip"]');
const origSums = await page.evaluate(async () => {
  const out = [];
  for (const d of S.trip.days) for (const p of d.photos) out.push([p.name, p.file.size, [...new Uint8Array(await crypto.subtle.digest("SHA-256", await p.file.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("")]);
  return out;
});
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
await dl.saveAs(join(out, "projekt.pdf"));
const pdfBytes = readFileSync(join(out, "projekt.pdf"));
const pdf = await PDFDocument.load(pdfBytes);
ok(pdf.getPageCount() >= 4, `PDF erstellt: ${pdf.getPageCount()} Seiten, ${(pdfBytes.length / 1024).toFixed(0)} KB`);
const atts = await page.evaluate(async (b64) => (await readPdfAttachments(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).map((a) => a.name), pdfBytes.toString("base64"));
ok(atts.includes("reise-protokoll-projekt.json") && atts.filter((n) => /^\d{4} /.test(n)).length === 5 && atts.includes("titelfoto.jpg"), `Anhänge: ${atts.length} (Projekt, 5 Fotos, Titelfoto)`);

console.log("PDF wieder öffnen");
await page.evaluate(() => { const t = newTrip("kurztrip"); t.title = "Anderes Projekt"; loadTrip(t, true); });
page.once("dialog", (d) => d.accept());
await page.setInputFiles("#openFile", join(out, "projekt.pdf"));
await page.waitForFunction(() => S.trip.title.startsWith("Projekttest"), null, { timeout: 60000 });
const re = await page.evaluate(() => {
  const t = S.trip, p = t.days[0].photos[0], q = t.days[0].photos[1];
  return { tpl: t.template, days: t.days.length, photos: t.days.map((d) => d.photos.length), summary: t.summary, sumAuto: t.summaryAuto, place: t.days[0].place, text: t.days[0].text,
    note: p.note, marks: p.marks.length, markNote: p.marks.find((m) => m.t === "num").note, qrot: q.rot, qcrop: q.crop, qnote: q.note, cover: !!t.coverPhoto, theme: t.theme, embed: t.embed };
});
ok(re.tpl === "reise" && re.days === 3 && re.photos.join() === "2,2,1", "Vorlage, Tage und Foto-Anzahl wiederhergestellt");
ok(re.summary === "Eigene Zusammenfassung" && re.sumAuto === false, "Zusammenfassung (von Hand) bleibt erhalten");
ok(re.place.name === "Teststadt" && re.text === "Tagebuch eins", "Ort mit Position und Tagebuchtext");
ok(re.note === "Schöner Blick" && re.marks === 3 && re.markNote === "Hier lang", "Bildunterschrift, Markierungen und Notiz");
ok(re.qrot === 1 && re.qcrop && re.qcrop.w === 500 && re.qnote === "Gedreht und zugeschnitten", "Drehung und Ausschnitt");
ok(re.cover, "Titelfoto wiederhergestellt");
const back = await page.evaluate(async () => {
  const out = [];
  for (const d of S.trip.days) for (const p of d.photos) out.push([p.name, p.file.size, [...new Uint8Array(await crypto.subtle.digest("SHA-256", await p.file.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("")]);
  return out;
});
ok(JSON.stringify(back) === JSON.stringify(origSums), "Originalfotos bitgenau wiederhergestellt");
ok(await page.evaluate(() => document.querySelector("#pages").innerHTML.includes("&lt;b&gt;") || !document.querySelector("#pages b")), "Titel mit HTML wird nur als Text gezeigt");

console.log("Manipuliertes PDF");
const evil = await page.evaluate(async () => {
  const bad = {
    app: "Reise-Protokoll", format: 1,
    trip: {
      template: "gibtsnicht", theme: "<script>", title: "T".repeat(5000), currency: "<img>", start: "morgen", roundTrip: "ja",
      startPlace: { name: "x", lat: 999, lon: "abc" },
      route: { points: [{ id: "../../x", name: "P", lat: 1, lon: 2 }, "str", null], km: -5, legs: "nein" },
      days: [{ id: "__proto__", date: "31.02.2026", place: { name: "<img src=x onerror=alert(1)>", lat: 91 }, weather: "hagel", text: 42, costs: [{ l: "a", cat: "böse", a: "<x>" }, 7],
        photos: [{ id: "a", att: "../../etc", marks: [{ t: "num", x: 1, y: 1, r: -4, c: "red" }, { t: "circle", x: 1, y: 1, r: 5, c: "#abcdef" }, { t: "evil" }], rot: 9, crop: { x: -1, y: 0, w: 5, h: 5 }, gps: { lat: 1000, lon: 0 }, src: "javascript:alert(1)", day: "2026-13-45" }] }]
        .concat(Array.from({ length: 600 }, () => ({}))),
    },
  };
  const t = cleanTrip(bad), p = t.days[0].photos[0];
  /* auch als echtes PDF durch die Leselogik schicken */
  const { pages } = layoutTrip(newTrip("rundreise"));
  const bytes = await buildPdf(pages, { title: "x" }, [{ name: PROJECT_FILE, bytes: new TextEncoder().encode(JSON.stringify(bad)), mime: "application/json" }]);
  const r = await readProjectPdf(new File([bytes], "boese.pdf", { type: "application/pdf" }));
  return { tpl: t.template, theme: t.theme, title: t.title.length, cur: t.currency, start: t.start, round: t.roundTrip, sp: t.startPlace, pts: t.route.points.length, ptId: t.route.points[0].id, km: t.route.km, legs: t.route.legs.length,
    days: t.days.length, day0: { id: t.days[0].id, date: t.days[0].date, name: t.days[0].place.name, lat: t.days[0].place.lat, weather: t.days[0].weather, text: t.days[0].text, costs: t.days[0].costs.length, cat: t.days[0].costs[0].cat },
    photo: { att: p.att, marks: p.marks.length, rot: p.rot, crop: p.crop, gps: p.gps, src: p.src, day: p.day }, viaPdf: r.trip.days.length, viaPdfTitle: r.trip.title.length };
});
ok(evil.tpl === "reise" && evil.theme === "meer" && evil.title === 200 && evil.cur === "EUR" && evil.start === "" && evil.round === true, "Vorlage, Design, Titel, Währung, Datum geprüft");
ok(evil.sp.lat === null && evil.sp.lon === null, "ungültige Koordinaten verworfen");
ok(evil.pts === 1 && evil.ptId !== "../../x" && evil.km === null && evil.legs === 0, "Route bereinigt");
ok(evil.days === 400 && evil.day0.id !== "__proto__" && evil.day0.date === "" && evil.day0.lat === null && evil.day0.weather === "" && evil.day0.text === "" && evil.day0.cat === "sonstiges", "Tage: höchstens 400, Felder geprüft");
ok(evil.photo.att === null && evil.photo.marks === 1 && evil.photo.rot === 0 && evil.photo.crop === null && evil.photo.gps === null && evil.photo.src === undefined && evil.photo.day === "", "Foto-Angaben geprüft (kein Bild aus Textfeld)");
ok(evil.viaPdf === 400 && evil.viaPdfTitle === 200, "auch über echtes PDF bereinigt");
ok(await page.evaluate(() => !document.querySelector("img[onerror]") && !window.__pwn), "kein Schadcode ausgeführt");

console.log("PDF ohne Projektdaten");
const plain = await page.evaluate(async () => {
  const { pages } = layoutTrip(newTrip("rundreise")); const bytes = await buildPdf(pages, { title: "x" }, []);
  try { await readProjectPdf(new File([bytes], "x.pdf")); return "kein Fehler"; } catch (e) { return e.message; }
});
ok(/keine Bearbeitungsdaten/.test(plain), "verständliche Meldung: " + plain.slice(0, 50));

ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
