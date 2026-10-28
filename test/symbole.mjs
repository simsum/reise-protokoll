// Test: Kachel „Wettersymbol“ (feste Größe 1×1, Symbole in den Farben des Farbschemas, Vorschau und PDF).
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
await page.evaluate(() => { S.trip.capWeather = false; S.trip.placeMode = "off"; });

console.log("Symbole");
const draw = await page.evaluate(() => {
  const res = {};
  for (const th of Object.keys(THEMES)) for (const s of SYMBOLS) {
    const T = THEMES[th], pg = new Pg(T), r = { x: 100, y: 200, w: 121, h: 103 };
    MODULES.wettersymbol.draw(pg, { d: { weather: "" }, T }, { sym: s.id }, r);
    const paths = pg.ops.filter((o) => o.k === "path");
    const inside = pg.ops.every((o) => o.k !== "path" || (o.x >= r.x - 0.5 && o.y >= r.y - 0.5 && o.x + o.w <= r.x + r.w + 0.5 && o.y + o.h <= r.y + r.h + 0.5));
    res[th + "/" + s.id] = { n: paths.length, filled: paths.some((o) => o.fill), inside };
  }
  return res;
});
const keys = Object.keys(draw);
ok(keys.length === 50 && keys.every((k) => draw[k].n >= 3 && draw[k].inside), `alle ${keys.length} Kombinationen (10 Symbole × 5 Farbschemata): mehrteilige Vektorbilder innerhalb der Kachel`);
ok(await page.evaluate(() => SYMBOLS.length) === 10, "10 Symbole: Sonne, Heiter, Bewölkt, Regen, Gewitter, Schnee, Nebel, Mond und Sterne, Regenbogen, Wind");
ok(await page.evaluate(() => { const T = THEMES.meer, a = new Pg(T), b = new Pg(THEMES.herbst); const r = { x: 0, y: 0, w: 121, h: 103 }; MODULES.wettersymbol.draw(a, { d: {}, T: THEMES.meer }, { sym: "rain" }, r); MODULES.wettersymbol.draw(b, { d: {}, T: THEMES.herbst }, { sym: "rain" }, r); return JSON.stringify(a.ops) !== JSON.stringify(b.ops); }), "Farben folgen dem Farbschema");
ok(await page.evaluate(() => { const T = THEMES.meer, pg = new Pg(T); MODULES.wettersymbol.draw(pg, { d: { weather: "" }, T }, {}, { x: 0, y: 0, w: 121, h: 103 }); const n1 = pg.ops.length; const p2 = new Pg(T); MODULES.wettersymbol.draw(p2, { d: { weather: "storm" }, T }, { sym: "auto" }, { x: 0, y: 0, w: 121, h: 103 }); return n1 === pg.ops.length && n1 === (new Pg(T)).ops.length && p2.ops.length > n1; }), "Automatisch: ohne Wetter des Tages zeichnet die Kachel nichts, mit Wetter das passende Symbol");

console.log("Feste Größe 1×1");
ok(await page.evaluate(() => { const p = packTiles([newTile("wettersymbol", 3, 4), newTile("wettersymbol", 1, 1)], 4, 6); return p.placed.every((q) => q.w === 1 && q.h === 1) && p.placed.length === 2; }), "Raster erzwingt 1×1, auch bei anderen Maßen in den Daten");
ok(await page.evaluate(() => { const t = tileOf("wettersymbol", 3); return t.w === 1 && t.h === 1; }), "neue Kachel ist 1×1");
ok(await page.evaluate(() => { const t = newTile("text", 2, 3); setTileMod(t, "wettersymbol"); return t.w === 1 && t.h === 1; }), "Modulwechsel auf Wettersymbol setzt 1×1");
ok(await page.evaluate(() => { const x = cleanTrip({ app: "Reise-Protokoll", trip: { days: [{ pages: [{ tiles: [{ mod: "wettersymbol", w: 4, h: 5, sym: "wind" }, { mod: "wettersymbol", sym: "<b>" }] }] }] } }).days[0].pages[0].tiles; return x[0].w === 1 && x[0].h === 1 && x[0].sym === "wind" && x[1].sym === undefined; }), "Projektdatei: Größe 1×1 erzwungen, Symbol geprüft");
ok(await page.evaluate(() => { const x = copyTiles([{ mod: "wettersymbol", w: 1, h: 1, sym: "moon" }])[0]; return x.sym === "moon"; }), "Format übertragen kopiert das Symbol");

console.log("Bedienung");
await page.evaluate(() => { const d = S.trip.days[0]; d.pages = [newPage([tileOf("strecke", 4), newTile("wettersymbol")])]; changed(); renderPreview(); });
await page.waitForTimeout(400);
const sh = page.locator("#pages .sheet").nth(1);
await sh.scrollIntoViewIfNeeded();
const tid = await page.evaluate(() => S.trip.days[0].pages[0].tiles[1].id);
ok(await sh.locator(`.tl.fixed[data-id="${tid}"]`).count() === 1, "Kachel in der Vorschau als „feste Größe“ markiert (kein Größengriff)");
const bb = await sh.locator(`.tl[data-id="${tid}"]`).boundingBox();
await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
ok(await page.locator('#tb [data-tb="sym"]').isVisible() && await page.locator('#tb [data-tb="size"]').count() === 0, "Leiste: Symbolwahl, keine Größenknöpfe");
ok(await page.locator('#tb [data-tb="sym"] option').count() === 11, "Auswahl: automatisch plus 10 Symbole");
await page.locator('#tb [data-tb="sym"]').selectOption("rainbow");
ok(await page.evaluate(() => S.trip.days[0].pages[0].tiles[1].sym) === "rainbow", "Symbol gewählt");
await page.waitForTimeout(300);
ok(await page.evaluate(() => layoutTrip(S.trip).pages[1].ops.filter((o) => o.k === "path").length) >= 6, "Regenbogen in der Vorschau gezeichnet");
await page.locator('#tb [data-tb="mod"]').selectOption("text");
await page.locator('#tb [data-tb="size"][data-w="2"][data-h="2"]').click();
ok(await page.evaluate(() => { const t = S.trip.days[0].pages[0].tiles[1]; return t.mod === "text" && t.w === 2 && t.h === 2; }), "wieder auf ein anderes Modul gewechselt: Größe frei");
await page.locator('#tb [data-tb="mod"]').selectOption("wettersymbol");
ok(await page.evaluate(() => { const t = S.trip.days[0].pages[0].tiles[1]; return t.w === 1 && t.h === 1; }), "zurück auf Wettersymbol: 1×1");
await page.click('[data-tab="days"]');
await page.evaluate(() => { S.open.add(S.trip.days[0].id); renderPanel(); });
ok(await page.locator('details.day[open] select[data-k$=".sym"]').count() === 1, "Seitenleiste: Symbolwahl; feste Größe statt Breite und Höhe");
ok(await page.locator('details.day[open] .tile:has(select[data-k$=".sym"]) select[data-k$=".w"]').count() === 0, "Seitenleiste: keine Breite/Höhe für das Wettersymbol");

console.log("PDF");
await page.evaluate(() => { const d = S.trip.days[0]; d.pages = [newPage([...SYMBOLS.map((s) => newTile("wettersymbol", 1, 1, { sym: s.id }))])]; S.trip.theme = "herbst"; changed(); renderPreview(); });
await page.waitForTimeout(400);
{
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
  const f = join(out, "symbole.pdf"); await dl.saveAs(f);
  ok((await PDFDocument.load(readFileSync(f))).getPageCount() >= 2, "PDF mit allen Symbolen erstellt");
}
await page.locator("#pages .sheet").nth(1).screenshot({ path: join(out, "symbole-seite.png") });
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
