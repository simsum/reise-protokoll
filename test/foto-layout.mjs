// Test: Fotos nutzen den Freiraum der Tagesseite; Foto-Stile (Schatten, Rahmen, schlicht) in Vorschau und PDF.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
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
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const nm = (p) => join(root, "node_modules", p);
await page.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith("file:")) return r.continue();
  if (u.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("pdf-lib/dist/pdf-lib.min.js")) });
  if (u.includes("exifr")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("exifr/dist/full.umd.js")) });
  return r.abort();
});
await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready);

/* Tage mit 1, 2, 3, 4, 6 Fotos und wenig Text, ein Tag mit sehr viel Text */
await page.evaluate(async () => {
  const t = newTrip("rundreise"); t.title = "Fototest"; t.capWeather = false; t.placeMode = "off"; loadTrip(t, true);
  const mk = async (i, portrait) => {
    const W = portrait ? 900 : 1200, H = portrait ? 1200 : 800, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, `hsl(${i * 47},55%,65%)`); gr.addColorStop(1, `hsl(${i * 47 + 70},55%,35%)`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = "rgba(255,255,255,.85)"; g.font = "bold 160px sans-serif"; g.fillText("Foto " + i, 60, H / 2);
    return new File([await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85))], `f${i}.jpg`, { type: "image/jpeg" });
  };
  let n = 0;
  for (const count of [1, 2, 3, 4, 6, 3]) {
    const d = newDay("2026-05-" + String(14 + S.trip.days.length)); d.title = `Tag mit ${count} Foto${count > 1 ? "s" : ""}`; d.place = { name: "Ort", lat: null, lon: null };
    d.text = count === 3 && S.trip.days.length === 5 ? "Sehr langer Text. ".repeat(160) : "Kurzer Tagebucheintrag über einen schönen Tag mit wenig Text.";
    d.highlights = "Aussicht\nEssen"; d.costs = [{ id: uid(), l: "Eintritt", cat: "aktivitaeten", a: "12" }];
    for (let k = 0; k < count; k++) d.photos.push(await readOne(await mk(++n, k % 3 === 2)));
    S.trip.days.push(d);
  }
  async function readOne(f) { return makePhoto(f); }
  S.trip.photoStyle = "shadow"; S.trip.stripN = "auto"; changed();
});
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
  const t = S.trip, { pages } = layoutTrip(t);
  return { pages: pages.length, perDay: t.days.map((d, i) => pages.filter((pg) => pg.ops.some((o) => o.k === "img" && d.photos.some((p) => p.id === o.pid))).length), imgs: pages.map((pg) => pg.ops.filter((o) => o.k === "img").length) };
});
console.log("   Bilder je Seite:", info.imgs.join(","));
ok(info.imgs.slice(1, 6).join() === "1,2,3,4,6", "automatisch: alle Fotos von 1, 2, 3, 4 und 6 Fotos stehen bei wenig Text auf der Tagesseite");
ok(info.imgs[6] === 0 && info.imgs.some((n, i) => i > 6 && n === 3), `viel Text: kein Platz auf der Tagesseite, die 3 Fotos kommen auf eine Fotoseite (${info.pages} Seiten)`);

console.log("Stile");
for (const st of ["shadow", "frame", "plain"]) {
  await page.evaluate((st) => { S.trip.photoStyle = st; changed(); }, st);
  await page.waitForTimeout(300);
  const c = await page.evaluate(() => { const ops = layoutTrip(S.trip).pages[1].ops; return { shadow: ops.filter((o) => o.k === "rect" && o.fo != null).length, round: ops.filter((o) => o.k === "img" && o.r > 0).length, white: ops.filter((o) => o.k === "rect" && o.fill === "#FFFFFF").length }; });
  ok(st === "shadow" ? c.shadow >= 7 && c.round === 1 : st === "frame" ? c.shadow >= 7 && c.white === 2 && c.round === 0 : c.shadow === 0 && c.round === 0, `${st}: ${JSON.stringify(c)}`);
}
await page.evaluate(() => { S.trip.photoStyle = "shadow"; changed(); });
await page.waitForTimeout(400);
await page.locator("#pages .sheet").nth(4).screenshot({ path: join(out, "layout-4.png") });

console.log("PDF");
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
const f = join(out, "foto-layout.pdf"); await dl.saveAs(f);
ok((await PDFDocument.load(readFileSync(f))).getPageCount() === info.pages, `PDF mit Schatten und runden Ecken erstellt (${info.pages} Seiten)`);
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
