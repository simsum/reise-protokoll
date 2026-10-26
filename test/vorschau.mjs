// Test: Kacheln direkt in der Vorschau bearbeiten (auswählen, Größe, verschieben, einfügen, löschen).
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
await page.evaluate(() => { document.querySelector("#pages").scrollTop = 0; });

const sheet = page.locator("#pages .sheet").nth(1);
const tiles = () => page.evaluate(() => S.trip.days[0].pages[0].tiles.map((x) => x.mod + x.w + "x" + x.h).join());
const tl = (mod) => page.evaluate((mod) => { const t = S.trip.days[0].pages[0].tiles.find((x) => x.mod === mod); return t && t.id; }, mod);
const box = async (sel) => { await sheet.locator(sel).first().scrollIntoViewIfNeeded(); return sheet.locator(sel).first().boundingBox(); };
const day0Frames = () => page.evaluate(() => [...document.querySelectorAll("#pages .sheet")].filter((sh) => S.pages[+sh.dataset.pi].meta && S.pages[+sh.dataset.pi].meta.dayId === S.trip.days[0].id).reduce((n, sh) => n + sh.querySelectorAll(".tl").length, 0));
const centre = (b) => [b.x + b.width / 2, b.y + b.height / 2];

console.log("Auswählen");
ok((await sheet.locator(".tl").count()) === 7, "jede Kachel hat einen Rahmen über der Vorschau (7)");
ok((await page.locator("#pages .sheet").first().locator(".tl").count()) === 0, "Deckseite hat keine Rahmen");
const idW = await tl("wetter");
await page.mouse.click(...centre(await box(`.tl[data-id="${idW}"]`)));
ok(await page.evaluate((id) => S.sel && S.sel.tileId === id, idW) && await page.locator("#tb").isVisible(), "Klick wählt die Kachel, die Werkzeugleiste erscheint");
ok(await sheet.locator(".tl.sel").count() === 1, "gewählte Kachel ist markiert");

console.log("Größe");
await page.locator('#tb [data-tb="size"][data-w="2"][data-h="2"]').click();
ok((await tiles()).includes("wetter2x2"), "Knopf 2×2 in der Werkzeugleiste");
{
  const h = await box(".tl.sel .hd"), t = await box(".tl.sel"), cell = t.width / 2; // zwei Kacheln breit
  await page.mouse.move(...centre(h)); await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + cell * 0.6, h.y + h.height / 2 + 10, { steps: 6 });
  ok(await page.locator("#ghost").isVisible(), "beim Ziehen der Ecke erscheint der Rahmen der neuen Größe");
  await page.mouse.up();
  ok(/wetter3x2|wetter3x3/.test(await tiles()), `Ecke ziehen ändert die Größe im Raster: ${(await tiles()).match(/wetter\dx\d/)[0]}`);
}

console.log("Verschieben");
await page.evaluate(() => { S.trip.days[0].pages[0].tiles.find((x) => x.mod === "wetter").w = 1; S.trip.days[0].pages[0].tiles.find((x) => x.mod === "wetter").h = 1; changed(); renderPreview(); });
const before = (await tiles()).split(",").map((s) => s.replace(/\d+x\d+/, ""));
{
  const idK = await tl("kosten"), a = await box(`.tl[data-id="${idW}"]`), b = await box(`.tl[data-id="${idK}"]`);
  await page.mouse.move(...centre(a)); await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.5, b.y + 20, { steps: 8 });
  ok(await page.locator("#ghost").isVisible(), "beim Ziehen zeigt ein Rahmen das Ziel");
  await page.mouse.up();
  const after = (await tiles()).split(",").map((s) => s.replace(/\d+x\d+/, ""));
  ok(before.join() !== after.join() && after.indexOf("wetter") > after.indexOf("unterkunft") && after.indexOf("wetter") < after.indexOf("kosten"), `Kachel Wetter auf den Platz von Ausgaben gezogen, steht jetzt vor Ausgaben und hinter Unterkunft: ${after.join(" ")}`);
}

console.log("Löschen und Einfügen");
await page.locator('#tb [data-tb="del"]').click();
ok(!(await tiles()).includes("wetter") && (await day0Frames()) === 6 && await page.locator("#tb").isHidden(), "✕ entfernt die Kachel (6 Rahmen übrig)");
{
  /* freie Fläche: rechts neben der Unterkunft liegt jetzt eine Lücke der ersten Reihe nach der Strecke */
  const grid = await box(".ov"), cols = 4, cw = grid.width / cols;
  const used = await page.evaluate(() => { const m = S.pages[1].meta; return m.tiles.map((q) => [q.c, q.r, q.w, q.h]); });
  let cell = null;
  for (let r = 0; r < 6 && !cell; r++) for (let c = 0; c < 4 && !cell; c++) if (!used.some(([x, y, w, h]) => c >= x && c < x + w && r >= y && r < y + h)) cell = { c, r };
  ok(!!cell, "es gibt eine freie Zelle");
  const rowH = grid.height / 6;
  await page.mouse.click(grid.x + (cell.c + 0.5) * cw, grid.y + (cell.r + 0.5) * rowH);
  ok(await page.locator('#tb [data-tb="add"]').isVisible(), "Klick auf freie Fläche öffnet die Auswahl");
  await page.locator('#tb [data-tb="add"]').click(); // wie ein Mensch: erst ins Auswahlfeld klicken (Zeigerereignisse), dann wählen
  ok(await page.locator('#tb [data-tb="add"]').isVisible() && await page.evaluate(() => ia && ia.mode === "menu"), "Klick ins Menü schließt es nicht");
  await page.locator('#tb [data-tb="add"]').selectOption("notiz");
  ok((await tiles()).includes("notiz2x1") && (await day0Frames()) === 7 && await page.locator("#pages .tl.sel").count() === 1, "neue Notiz-Kachel eingefügt und gewählt");
  ok(await page.locator('#tb [data-tb="text"]').isVisible(), "Notiz hat ein Textfeld in der Leiste");
  await page.locator('#tb [data-tb="text"]').fill("Hallo Welt");
  await page.waitForTimeout(400);
  ok((await sheet.innerText()).includes("Hallo Welt"), "Text erscheint in der Vorschau, während man tippt");
  ok(await page.locator('#tb [data-tb="text"]').isVisible() && await page.evaluate(() => document.activeElement && document.activeElement.dataset.tb === "text"), "Textfeld behält beim Tippen den Fokus");
}

console.log("Auswahl aufheben und Seitenleiste");
await page.keyboard.press("Escape");
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await page.keyboard.press("Escape");
ok(await page.evaluate(() => S.sel === null) && await page.locator("#tb").isHidden(), "Escape hebt die Auswahl auf");
await page.click('[data-tab="days"]');
await page.evaluate(() => { S.open.add(S.trip.days[0].id); renderPanel(); });
ok((await page.locator("details.day[open] .tile").count()) >= 7, "Seitenleiste zeigt dieselben Kacheln (nach Änderung in der Vorschau)");
await sheet.screenshot({ path: join(out, "vorschau-kacheln.png") });
ok(await page.evaluate(() => layoutTrip(S.trip).pages.every((pg) => pg.ops.length > 0)), "Layout und PDF-Modell unverändert gültig");
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
