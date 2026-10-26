// Test: Bedienung in der Vorschau – Rückgängig/Wiederholen, Seitenleiste, Vorschläge, Format übertragen, Doppelklick, freie Zellen.
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
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1250 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on("dialog", (d) => d.accept());
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

await page.evaluate(() => { S.trip.capWeather = false; S.trip.placeMode = "off"; }); // keine Hintergrundabfragen, die die Vorschau neu zeichnen
const mods = (i) => page.evaluate((i) => S.trip.days[i].pages.map((p) => p.tiles.map((x) => x.mod + x.w + "x" + x.h).join()).join("|"), i);
const gap = () => page.waitForTimeout(700); // Änderungen im Abstand von über 600 ms sind getrennte Schritte
const sheet = (n) => page.locator("#pages .sheet").nth(n);
const sheetOfDay = (i) => page.evaluate((i) => S.pages.findIndex((pg) => pg.meta && pg.meta.dayId === S.trip.days[i].id), i);

console.log("Rückgängig und Wiederholen");
ok(await page.locator("#undoBtn").isDisabled(), "ohne Änderung ist Rückgängig ausgegraut");
const start = await mods(0);
await page.evaluate(() => { const d = S.trip.days[0]; d.pages[0].tiles.pop(); changed(); renderPreview(); });
await page.waitForTimeout(350);
ok((await mods(0)) !== start && await page.locator("#undoBtn").isEnabled(), "Änderung am Aufbau schaltet Rückgängig frei");
await page.locator("#undoBtn").click();
ok((await mods(0)) === start, "Rückgängig stellt den Aufbau wieder her");
ok(await page.locator("#redoBtn").isEnabled(), "Wiederholen ist frei");
await page.locator("#redoBtn").click();
ok((await mods(0)) !== start, "Wiederholen macht es noch einmal");
await page.keyboard.press("Control+z");
ok((await mods(0)) === start, "Strg+Z");
await page.keyboard.press("Control+y");
ok((await mods(0)) !== start, "Strg+Y");
await page.keyboard.press("Control+z");
await page.evaluate(() => { const d = S.trip.days[0]; d.title = "Neuer Titel"; changed(); });
ok(await page.evaluate(() => undoSt.undo.length) === 0, "Text- und andere Änderungen füllen den Stapel nicht (nur der Seitenaufbau)");
await gap();
await page.evaluate(() => { const t = S.trip.days[0].pages[0].tiles; t[1].w = 2; changed(); t[1].w = 3; changed(); });
ok(await page.evaluate(() => undoSt.undo.length) === 1, "mehrere Änderungen kurz hintereinander sind ein Schritt");
await page.keyboard.press("Control+z");
ok((await mods(0)) === start, "ein Schritt zurück genügt");

console.log("Seitenleiste in der Vorschau");
const s1 = await sheetOfDay(0);
await sheet(s1).scrollIntoViewIfNeeded();
await sheet(s1).hover();
ok(await sheet(s1).locator(".pbar").isVisible(), "beim Darüberfahren erscheint die Seitenleiste");
await gap();
await sheet(s1).locator('[data-pb="add"]').click();
ok(await page.evaluate(() => S.trip.days[0].pages.length === 2 && S.trip.days[0].pages[1].tiles.length === 0), "„+ Seite“ fügt eine leere Seite hinter der Seite ein");
const s1b = (await sheetOfDay(0)) + 1;
ok(await page.evaluate((i) => S.pages[i].meta.pageIdx === 1, s1b), "leere Seite hat eine Vorschau mit Raster");
await sheet(s1b).hover();
ok((await sheet(s1b).locator(".fc").count()) === 24, "freie Zellen: alle 24 Zellen der leeren Seite");
await gap();
await sheet(s1b).locator('[data-pb="up"]').click();
ok(await page.evaluate(() => S.trip.days[0].pages[0].tiles.length === 0 && S.trip.days[0].pages[1].tiles.length > 0), "↑ verschiebt die Seite nach vorn");
await gap();
await sheet(s1).hover();
await sheet(s1).locator('[data-pb="del"]').click();
ok(await page.evaluate(() => S.trip.days[0].pages.length === 1 && S.trip.days[0].pages[0].tiles.length > 0), "✕ löscht die Seite");
await page.keyboard.press("Control+z");
ok(await page.evaluate(() => S.trip.days[0].pages.length === 2), "Löschen lässt sich rückgängig machen");
await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z");
await gap();

console.log("Freie Zellen");
await page.evaluate(() => { const d = S.trip.days[0]; d.pages = [newPage([newTile("strecke", 4, 1), newTile("text", 2, 2)])]; changed(); renderPreview(); });
await page.waitForTimeout(350);
await sheet(s1).hover();
ok((await sheet(s1).locator(".fc").count()) === 24 - 4 - 4, "freie Zellen = Raster minus belegte Zellen (16)");

console.log("Vorschläge");
await gap();
await sheet(s1).locator('[data-pb="preset"]').selectOption("tagebuch");
ok((await mods(0)).startsWith("strecke4x1,wetter1x1,unterkunft1x1,highlights2x1,text4x4"), `Vorschlag „Tagebuch groß“ angewendet: ${await mods(0)}`);
ok(await page.evaluate(() => layoutTrip(S.trip).warns.every((w) => !/Tag 1: .* nicht auf die Seite/.test(w))), "Vorschlag passt auf die Seite");
await gap();
await page.keyboard.press("Control+z");
ok((await mods(0)).startsWith("strecke4x1,text2x2"), "Vorschlag ist rückgängig zu machen");

console.log("Fotos und Vorschläge");
await page.evaluate(async () => {
  const mk = async (i) => { const cv = document.createElement("canvas"); cv.width = 1200; cv.height = 800; const g = cv.getContext("2d"); g.fillStyle = `hsl(${i * 60},50%,60%)`; g.fillRect(0, 0, 1200, 800); return new File([await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8))], `p${i}.jpg`, { type: "image/jpeg" }); };
  await addPhotosToDay(S.trip.days[1].id, await Promise.all([1, 2, 3, 4, 5, 6].map(mk)));
});
await page.waitForTimeout(1200);
const dayIdx1 = await sheetOfDay(1);
await sheet(dayIdx1 + 1).scrollIntoViewIfNeeded();
await sheet(dayIdx1 + 1).hover();
await sheet(dayIdx1 + 1).locator('[data-pb="preset"]').selectOption("fotos");
const ph = await page.evaluate(() => { const d = S.trip.days[1], used = d.pages.flatMap((p) => p.tiles).filter((x) => x.mod === "foto").map((x) => x.photo); return { shown: new Set(used).size, all: d.photos.length, pages: d.pages.length }; });
ok(ph.shown === ph.all, `Fotoseite: alle ${ph.all} Fotos des Tages stehen auf Kacheln, auch die 2 überzähligen (zusätzliche Seite): ${ph.pages} Seiten`);

console.log("Format übertragen");
await page.waitForTimeout(800);
await page.evaluate(() => { const d = S.trip.days[2]; d.pages = [newPage([newTile("strecke", 4, 1), newTile("notiz", 2, 2, { text: "nicht kopieren" }), newTile("wetter")])]; changed(); renderPreview(); });
await page.waitForTimeout(350);
const s2 = await sheetOfDay(2);
await sheet(s2).scrollIntoViewIfNeeded(); await sheet(s2).hover();
await sheet(s2).locator('[data-pb="brush"]').click();
ok(await page.locator("#brushbar").isVisible() && await page.evaluate(() => !!S.brush), "Pinsel aktiv, Hinweisleiste erscheint");
const s3 = await sheetOfDay(3);
await sheet(s3).scrollIntoViewIfNeeded();
const bb = await sheet(s3).boundingBox();
await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
ok((await mods(3)) === "strecke4x1,notiz2x2,wetter1x1" && await page.evaluate(() => S.trip.days[3].pages[0].tiles[1].text === ""), "Zielseite übernimmt Aufbau, Notiztext wird nicht mitkopiert");
ok(await page.evaluate(() => !!S.brush), "Pinsel bleibt aktiv für weitere Seiten");
await page.locator("#brushAll").click();
ok(await page.evaluate(() => S.trip.days.every((d, i) => i === 2 || d.pages[0].tiles.map((x) => x.mod).join().startsWith("strecke,notiz,wetter"))), "„Auf alle Tage“ überträgt auf die Seite gleicher Nummer");
await page.keyboard.press("Escape");
ok(await page.locator("#brushbar").isHidden() && await page.evaluate(() => !S.brush), "Escape beendet den Pinsel");
ok(await page.evaluate(() => { const d = S.trip.days[1], used = new Set(d.pages.flatMap((p) => p.tiles).filter((x) => x.mod === "foto").map((x) => x.photo)); return d.photos.every((p) => used.has(p.id)); }), "beim Übertragen geht kein Foto verloren");

console.log("Ein Foto nur einmal pro Tag");
await page.evaluate(() => { const d = S.trip.days[1]; d.pages = [newPage([tileOf("strecke", 4), newTile("foto", 2, 2), newTile("foto", 2, 2)])]; setTilePhoto(d, d.pages[0].tiles[1], d.photos[0].id); setTilePhoto(d, d.pages[0].tiles[2], d.photos[1].id); changed(); renderPreview(); });
await page.waitForTimeout(400);
{
  const di = await sheetOfDay(1), t2 = await page.evaluate(() => S.trip.days[1].pages[0].tiles[2].id);
  await sheet(di).scrollIntoViewIfNeeded();
  const bx = await sheet(di).locator(`.tl[data-id="${t2}"]`).boundingBox();
  await page.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
  const first = await page.evaluate(() => S.trip.days[1].photos[0].id);
  ok((await page.locator('#tb [data-tb="photo"] option').allInnerTexts()).some((t) => /wird verschoben/.test(t)), "Auswahl weist darauf hin, dass ein schon platziertes Foto verschoben wird");
  await page.locator('#tb [data-tb="photo"]').selectOption(first);
  ok(await page.evaluate((id) => { const t = S.trip.days[1].pages[0].tiles; return t[2].photo === id && !t[1].photo; }, first), "Foto zum zweiten Mal platziert: verschwindet an der ursprünglichen Stelle (Kachel bleibt leer)");
  await page.waitForTimeout(300);
  ok((await sheet(di).locator(".tl.empty").count()) >= 1, "die leere Kachel ist in der Vorschau sichtbar");
}
ok(await page.evaluate(() => { const t = cleanTrip({ app: "Reise-Protokoll", trip: { days: [{ pages: [{ tiles: [{ mod: "foto", photo: "a" }, { mod: "foto", photo: "a" }] }] }] } }); const x = t.days[0].pages[0].tiles; return x[0].photo === "a" && !x[1].photo; }), "Datei mit doppeltem Foto wird beim Öffnen bereinigt");

console.log("Freie Plätze mit Fotos füllen");
await page.evaluate(() => { const d = S.trip.days[1]; d.pages = [newPage([newTile("strecke", 4, 1)])]; addPhotoTiles(d, d.photos.slice(0, 3), 4); changed(); renderPreview(); });
await page.waitForTimeout(300);
ok(await page.evaluate(() => { const d = S.trip.days[1], t = d.pages[0].tiles, pk = packTiles(t, 4, 6); const free = 24 - pk.placed.reduce((n, q) => n + q.w * q.h, 0); return d.pages.length === 1 && t.filter((x) => x.mod === "foto").length === 3 && !pk.rest.length && free <= 4; }), "neue Fotos füllen den freien Platz der Seite statt eine neue Seite zu beginnen");
await page.evaluate(() => { const d = S.trip.days[1]; d.pages = defaultPages(4); addPhotoTiles(d, d.photos, 4); changed(); renderPreview(); });
await page.waitForTimeout(300);
const before = await page.evaluate(() => S.trip.days[1].pages.length);
await page.evaluate(() => { const d = S.trip.days[1]; applyLayout(d, d.pages[0], LAYOUTS.find((l) => l.id === "panorama").build(4), 4); changed(); renderPreview(); });
await page.waitForTimeout(300);
ok(await page.evaluate(() => { const d = S.trip.days[1], used = d.pages.flatMap((p) => p.tiles).filter((x) => x.mod === "foto").map((x) => x.photo); return d.pages[0].tiles.some((x) => x.mod === "foto" && x.photo === d.photos[0].id) && new Set(used).size === used.length && d.photos.every((p) => used.includes(p.id)); }), "Vorschlag belegt seine Fotoplätze mit Fotos, auch von anderen Seiten (dort verschwinden sie), keines doppelt, keines geht verloren");
ok(await page.evaluate(() => layoutTrip(S.trip).pages.every((pg) => !pg.meta || pg.meta.tiles.every((q) => !q.empty || q.mod !== "foto"))), "keine leeren Fotoplätze nach dem Anwenden");
void before;

console.log("Doppelklick");
await page.evaluate(() => { loadTrip(demoTrip("rundreise")); });
await page.waitForTimeout(300);
const sd = await sheetOfDay(0);
await sheet(sd).scrollIntoViewIfNeeded();
const tid = await page.evaluate(() => S.trip.days[0].pages[0].tiles.find((x) => x.mod === "text").id);
const tb = await sheet(sd).locator(`.tl[data-id="${tid}"]`).boundingBox();
await page.mouse.dblclick(tb.x + tb.width / 2, tb.y + tb.height / 2);
ok(await page.evaluate(() => S.tab === "days" && document.activeElement && /\.text$/.test(document.activeElement.dataset.k || "")), "Doppelklick auf Tagebuch springt ins Textfeld des Tages");
await page.evaluate(() => { document.activeElement.blur(); });
await page.evaluate(async () => {
  const cv = document.createElement("canvas"); cv.width = 1200; cv.height = 800; cv.getContext("2d").fillRect(0, 0, 1200, 800);
  await addPhotosToDay(S.trip.days[0].id, [new File([await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8))], "x.jpg", { type: "image/jpeg" })]);
});
await page.waitForTimeout(400);
const fid = await page.evaluate(() => S.trip.days[0].pages.flatMap((p) => p.tiles).find((x) => x.mod === "foto").id);
const sf = await page.evaluate((id) => S.pages.findIndex((pg) => pg.meta && pg.meta.tiles.some((q) => q.id === id)), fid);
await sheet(sf).scrollIntoViewIfNeeded();
const fb = await sheet(sf).locator(`.tl[data-id="${fid}"]`).boundingBox();
await page.mouse.dblclick(fb.x + fb.width / 2, fb.y + fb.height / 2);
ok(await page.locator("#editor").isVisible(), "Doppelklick auf ein Foto öffnet den Foto-Editor");
await page.click("#edDone");

console.log("Neue Datei: Rückgängig zurückgesetzt");
ok(await page.evaluate(() => { loadTrip(demoTrip("kurztrip")); return undoSt.undo.length === 0 && undoSt.redo.length === 0; }), "Stapel beim Laden geleert");
await sheet(1).screenshot({ path: join(out, "workflow-seite.png") });
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
