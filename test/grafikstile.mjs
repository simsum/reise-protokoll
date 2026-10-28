// Test: Grafische Kacheln (Wettersymbol, Karte Strecke, Karte Punkt) folgen dem „Aussehen der Fotos“ (Schatten, Rahmen, schlicht).
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
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready && document.querySelectorAll("#pages .sheet").length > 0);

const IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
/* Operationen einer Kachel unter einem Stil */
const probe = (style, mod) => page.evaluate(({ style, mod, IMG }) => {
  const t = S.trip, T = THEMES[t.theme], pg = new Pg(T), r = { x: 100, y: 100, w: 253, h: mod === "wettersymbol" ? 103 : 216 };
  t.photoStyle = style; t.mapImg = IMG; t.mapW = 2; t.mapH = 2;
  const tile = mod === "punktkarte" || mod === "tageskarte" ? { pt: { lat: 1, lon: 2, zoom: 5, name: "Ort", credit: "© Test" }, ptImg: IMG, ptW: 2000, ptH: 1000 } : { sym: "sun" };
  MODULES[mod].draw(pg, { t, d: { weather: "sun" }, i: 0, T, warns: [], st: {} }, tile, r);
  const sh = pg.ops.filter((o) => o.k === "rect" && o.fill === "#000000" && o.fo != null && o.fo < 0.1).length;
  const white = pg.ops.filter((o) => o.k === "rect" && o.fill === "#FFFFFF" && o.fo == null && o.stroke).length;
  const border = pg.ops.filter((o) => o.k === "rect" && o.stroke && !o.fill && o.sw === 0.5).length;
  const img = pg.ops.find((o) => o.k === "img"), card = pg.ops.find((o) => o.k === "rect" && o.fill === T.soft);
  const inner = img || card;
  return { sh, white, border, rad: inner ? inner.r : null, inset: inner ? Math.round(inner.x - r.x) : null, innerW: inner ? Math.round(inner.w) : null };
}, { style, mod, IMG });

const names = { wettersymbol: "Wettersymbol", karte: "Karte (Strecke)", punktkarte: "Karte (Punkt)", tageskarte: "Karte (Tag)" };
for (const mod of Object.keys(names)) {
  console.log(names[mod]);
  const sh = await probe("shadow", mod), fr = await probe("frame", mod), pl = await probe("plain", mod);
  ok(sh.sh >= 7 && sh.rad === 5 && sh.inset === 0 && sh.white === 0 && sh.border === 0, `Schatten und abgerundete Ecken (${sh.sh} Schattenebenen, Radius ${sh.rad})`);
  ok(fr.sh >= 7 && fr.white === 1 && fr.inset === 5 && fr.rad === 0 && fr.innerW === 243, `weißer Rand mit Schatten (Innenraum 5 pt eingerückt: ${fr.innerW} statt 253 pt breit)`);
  ok(pl.sh === 0 && pl.white === 0 && pl.border === 1 && pl.rad === 0 && pl.inset === 0, "schlicht: kein Schatten, dünner Rand, eckig");
}

console.log("Einstellung wirkt in der Vorschau");
await page.evaluate(() => {
  S.trip.capWeather = false; S.trip.placeMode = "off"; S.trip.mapImg = ""; const d = S.trip.days[0]; d.weather = "partly";
  d.pages = [newPage([newTile("wettersymbol"), newTile("wettersymbol", 1, 1, { sym: "rain" }), newTile("wettersymbol", 1, 1, { sym: "rainbow" }), newTile("notiz", 1, 1, { text: "daneben" })])]; changed(); renderPreview();
});
const counts = {};
for (const st of ["shadow", "frame", "plain"]) {
  await page.selectOption('[data-k="photoStyle"]', st).catch(async () => { await page.click('[data-tab="trip"]'); await page.selectOption('[data-k="photoStyle"]', st); });
  await page.waitForTimeout(400);
  counts[st] = await page.evaluate(() => { const pg = layoutTrip(S.trip).pages[1]; return { shadow: pg.ops.filter((o) => o.k === "rect" && o.fill === "#000000" && o.fo != null && o.fo < 0.1).length, white: pg.ops.filter((o) => o.k === "rect" && o.fill === "#FFFFFF" && o.fo == null && o.stroke).length }; });
  const sheet = page.locator("#pages .sheet").nth(1);
  await sheet.scrollIntoViewIfNeeded();
  await sheet.screenshot({ path: join(out, `grafikstile-${st}.png`), clip: undefined });
}
ok(counts.shadow.shadow === 21 && counts.frame.shadow === 21 && counts.frame.white === 3 && counts.plain.shadow === 0, `Umschalten „Aussehen der Fotos“ wirkt auf alle drei Wettersymbole (Schatten ${counts.shadow.shadow}, Rahmen ${counts.frame.white}, schlicht ${counts.plain.shadow})`);
await page.selectOption('[data-k="photoStyle"]', "shadow");
{
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
  const f = join(out, "grafikstile.pdf"); await dl.saveAs(f);
  ok((await PDFDocument.load(readFileSync(f))).getPageCount() >= 2, "PDF erstellt");
}
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
