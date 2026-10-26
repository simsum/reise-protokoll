// Test: Markdown und Schriften in Notiz-Kacheln (Vorschau und PDF).
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

console.log("Auszeichnung");
const inl = await page.evaluate(() => {
  const f = (s) => mdInline(s, {}).map((x) => x.t + ":" + (x.bold ? "b" : "") + (x.ital ? "i" : "") + (x.code ? "c" : "")).join("|");
  return { a: f("**fett** und *kursiv* und ***beides*** und `code`"), b: f("5 * 3 = 15 und snake_case_name"), c: f("_unter_ und \\*kein\\*"), d: f("[Text](https://x.de) bleibt Text"), e: f("**offen") };
});
ok(inl.a === "fett:b| und :|kursiv:i| und :|beides:bi| und :|code:c", `fett, kursiv, beides, Code: ${inl.a}`);
ok(inl.b === "5 * 3 = 15 und snake_case_name:", `Sternchen mit Leerzeichen und Unterstriche im Wort bleiben Text: ${inl.b}`);
ok(inl.c === "unter:i| und *kein*:", `_kursiv_ und maskierte Zeichen: ${inl.c}`);
ok(inl.d === "Text bleibt Text:", `Link zeigt nur den Text: ${inl.d}`);
ok(inl.e === "offen:b" || inl.e === "**offen:", `nicht geschlossene Markierung stürzt nicht ab: ${inl.e}`);
const blk = await page.evaluate(() => mdBlocks("# Titel\n## Zwei\n- eins\n  - tief\n2. zwei\n> Zitat\n---\n\nText").map((b) => b.k + (b.lvl != null ? b.lvl : "") + (b.mark || "")).join(","));
ok(blk === "h1,h2,li0•,li1•,li0" + "2.,q,hr,gap,p", `Blöcke erkannt: ${blk}`);

console.log("Layout und Schriften");
const ops = await page.evaluate(() => {
  const T = THEMES.meer, t = newTrip(); const pg = new Pg(T);
  const r = { x: 0, y: 0, w: 240, h: 300 };
  const res = {};
  for (const fam of ["serif", "sans", "mono"]) {
    const p2 = new Pg(T); drawMd(p2, "# Kopf\nNormal **fett** *kursiv* ***fk*** `code`\n- Punkt", r, 0, 11, 7, fam);
    res[fam] = [...new Set(p2.ops.filter((o) => o.k === "t").map((o) => o.f))].sort().join();
  }
  const p3 = new Pg(T); drawMd(p3, "# Groß\nklein", r, 0, 11, 7, "serif");
  const sizes = p3.ops.filter((o) => o.k === "t").map((o) => o.s);
  const p4 = new Pg(T); drawMd(p4, "- a\n1. b", r, 0, 11, 7, "serif");
  res.marks = p4.ops.filter((o) => o.k === "t").map((o) => o.text).join("|");
  res.heading = sizes[0] > sizes[1];
  const w = []; const p5 = new Pg(T);
  res.cut = !drawMd(p5, "Zeile\n".repeat(80), { x: 0, y: 0, w: 100, h: 60 }, 0, 11, 7, "sans");
  res.plain = (() => { const p6 = new Pg(T); drawMd(p6, "Ein ganz normaler Text ohne Auszeichnung, der umbrochen wird, weil er länger ist als die Kachel breit ist.", { x: 0, y: 0, w: 120, h: 200 }, 0, 11, 7, "serif"); return p6.ops.filter((o) => o.k === "t").map((o) => o.f + o.s).join(); })();
  return res;
});
ok(ops.serif === "S,SB,SI,SBI" || ops.serif === "C,S,SB,SBI,SI", `Serif: ${ops.serif}`);
ok(/R/.test(ops.sans) && /B/.test(ops.sans) && /BI/.test(ops.sans) && /I/.test(ops.sans), `Sans (Helvetica): ${ops.sans}`);
ok(ops.mono.includes("C") && !ops.mono.includes("S"), `Mono (Courier): ${ops.mono}`);
ok(ops.heading, "Überschrift ist größer als der Fließtext");
ok(ops.marks === "•|a|1.|b" || ops.marks === "a|•|b|1.", `Aufzählungs- und Nummernzeichen: ${ops.marks}`);
ok(ops.cut, "zu langer Text wird gekürzt (drawMd meldet, dass es nicht passt)");
ok(/^S11(,S11)*$/.test(ops.plain), `Text ohne Auszeichnung: Serif in Normalgröße, keine Sonderschrift (${ops.plain.split(",").length} Zeilen)`);

console.log("Bedienung");
await page.evaluate(() => { S.trip.capWeather = false; S.trip.placeMode = "off"; const d = S.trip.days[0]; d.pages = [newPage([tileOf("strecke", 4), newTile("notiz", 2, 2, { text: "Hallo Welt" })])]; changed(); renderPreview(); });
await page.waitForTimeout(400);
const sh = page.locator("#pages .sheet").nth(1);
await sh.scrollIntoViewIfNeeded();
const nid = await page.evaluate(() => S.trip.days[0].pages[0].tiles[1].id);
const bb = await sh.locator(`.tl[data-id="${nid}"]`).boundingBox();
await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
ok(await page.locator('#tb [data-tb="font"]').isVisible() && await page.locator('#tb [data-tb="md"]').count() === 7, "Leiste: Schriftwahl und 7 Markdown-Knöpfe");
await page.locator('#tb [data-tb="text"]').fill("Hallo Welt");
await page.locator('#tb [data-tb="text"]').evaluate((ta) => { ta.setSelectionRange(0, 5); });
await page.locator('#tb [data-tb="md"][data-md="b"]').click();
ok(await page.evaluate(() => S.trip.days[0].pages[0].tiles[1].text) === "**Hallo** Welt", "Knopf B umschließt die Auswahl mit **");
await page.locator('#tb [data-tb="md"][data-md="b"]').click();
ok(await page.evaluate(() => S.trip.days[0].pages[0].tiles[1].text) === "Hallo Welt", "zweiter Klick nimmt es wieder weg");
await page.locator('#tb [data-tb="text"]').evaluate((ta) => { ta.value = "eins\nzwei"; ta.setSelectionRange(0, 8); ta.dispatchEvent(new Event("input", { bubbles: true })); });
await page.locator('#tb [data-tb="md"][data-md="ul"]').click();
ok(await page.evaluate(() => S.trip.days[0].pages[0].tiles[1].text) === "- eins\n- zwei", "Knopf • setzt Aufzählungszeichen auf alle gewählten Zeilen");
await page.locator('#tb [data-tb="text"]').fill("# Überschrift\nText mit **fett** und *kursiv*\n- Punkt eins\n- Punkt zwei\n> Zitat\n---\nUnd `Code`");
await page.waitForTimeout(400);
await page.locator('#tb [data-tb="font"]').selectOption("sans");
await page.waitForTimeout(400);
ok(await page.evaluate(() => S.trip.days[0].pages[0].tiles[1].font) === "sans" && (await sh.innerHTML()).includes("Helvetica"), "Schrift Sans in Vorschau (Helvetica)");
await page.locator('#tb [data-tb="font"]').selectOption("mono");
await page.waitForTimeout(400);
ok((await sh.innerHTML()).includes("Courier New") && (await sh.innerHTML()).includes("font-weight:700"), "Schrift Mono in Vorschau (Courier), fett");
await page.locator('#tb [data-tb="font"]').selectOption("serif");
await page.waitForTimeout(400);
await sh.screenshot({ path: join(out, "markdown-seite.png") });
ok(await page.evaluate(() => layoutTrip(S.trip).pages[1].ops.some((o) => o.k === "t" && o.text === "Text mit")), "Wörter in derselben Schrift bleiben ein Textlauf (im PDF zusammenhängend markier- und kopierbar)");

console.log("PDF und Projekt");
{
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
  const f = join(out, "markdown.pdf"); await dl.saveAs(f);
  ok((await PDFDocument.load(readFileSync(f))).getPageCount() >= 2, "PDF mit Markdown-Notiz erstellt");
  const txt = await page.evaluate(() => layoutTrip(S.trip).pages[1].ops.filter((o) => o.k === "t").map((o) => o.f).join(","));
  ok(/SB/.test(txt) && /SI/.test(txt) && /C(,|$)/.test(txt), "alle Schriftschnitte im Seitenmodell (fett, kursiv, Code)");
}
ok(await page.evaluate(() => { const t = cleanTrip({ app: "Reise-Protokoll", trip: { days: [{ pages: [{ tiles: [{ mod: "notiz", font: "comic" }, { mod: "notiz", font: "mono" }] }] }] } }).days[0].pages[0].tiles; return t[0].font === undefined && t[1].font === "mono"; }), "Schrift wird beim Öffnen geprüft (nur serif, sans, mono)");
ok(await page.evaluate(() => { const x = copyTiles([{ mod: "notiz", w: 2, h: 1, text: "x", font: "mono" }])[0]; return x.font === "mono" && x.text === ""; }), "Format übertragen: Schrift wird mitkopiert, Text nicht");
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
