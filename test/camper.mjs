// Test: Camper-Variante der Kachel „Unterkunft“ (Stellplatz mit Wasser, WC, Duschen, Strom, WLAN, Sonstiges).
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

console.log("Daten");
ok(await page.evaluate(() => { const d = newDay(); return d.lodgingKind === "unterkunft" && Object.keys(d.camp).join() === "wasser,wc,duschen,strom,wlan,sonstiges" && Object.values(d.camp).every((v) => v === false); }), "neuer Tag: Art „Unterkunft“, sechs Ausstattungsmerkmale alle aus");
ok(await page.evaluate(() => { const x = cleanTrip({ app: "Reise-Protokoll", trip: { days: [{ lodgingKind: "zelt", camp: { wasser: true, wc: "ja", strom: 1, wlan: true, evil: true }, campNote: "x".repeat(500) }, { lodgingKind: "stellplatz", camp: "kaputt" }] } }).days; return x[0].lodgingKind === "unterkunft" && x[0].camp.wasser === true && x[0].camp.wc === false && x[0].camp.strom === false && x[0].camp.wlan === true && !("evil" in x[0].camp) && x[0].campNote.length === 100 && x[1].lodgingKind === "stellplatz" && Object.values(x[1].camp).every((v) => v === false); }), "Projektdatei: Art und Ausstattung werden geprüft (nur Wahrheitswerte, bekannte Felder)");
ok(await page.evaluate(() => { const t = normalizeTrip({ days: [{ date: "2026-05-01", camp: { strom: true } }] }); return t.days[0].camp.strom === true && t.days[0].camp.wasser === false && t.days[0].lodgingKind === "unterkunft"; }), "ältere Tage ohne Camper-Felder werden ergänzt");

console.log("Kachel");
const probe = (day, w, h) => page.evaluate(({ day, w, h }) => {
  const T = THEMES.meer, d = { ...newDay(), ...day, camp: { ...blankCamp(), ...(day.camp || {}) } }, pg = new Pg(T), warns = [];
  const r = { x: 0, y: 0, w: w || 121, h: h || 103 };
  MODULES.unterkunft.draw(pg, { d, i: 0, T, warns }, {}, r);
  const paths = pg.ops.filter((o) => o.k === "path"), txt = pg.ops.filter((o) => o.k === "t").map((o) => o.text);
  const icon = (n) => paths.filter((o) => o.d === ICONS[n]).length;
  const inside = pg.ops.every((o) => o.k !== "t" || (o.x >= -0.5 && o.y >= -0.5 && o.y + o.s <= r.h + 0.5));
  return { check: icon("check"), cross: icon("cross"), camper: icon("camper"), bed: icon("bed"), txt, warns, inside, n: pg.ops.length };
}, { day, w, h });
{
  const a = await probe({ lodgingKind: "stellplatz", lodging: "Camping am See", camp: { wasser: true, strom: true, wlan: true } });
  ok(a.check === 3 && a.cross === 3 && a.camper === 1, `3 Haken für vorhandene, 3 Kreuze für fehlende Merkmale, Camper-Symbol (${a.check} / ${a.cross})`);
  ok(["Wasser", "WC", "Duschen", "Strom", "WLAN", "Sonstiges"].every((t) => a.txt.includes(t)) && a.txt.includes("STELLPLATZ") && a.txt.includes("Camping am See"), "alle sechs Merkmale stehen immer in der Kachel, dazu Titel „Stellplatz“ und der Name");
  ok(a.inside && a.warns.length === 0, "passt in eine 1×1-Kachel (121 × 103 pt) ohne Hinweis");
  const none = await probe({ lodgingKind: "stellplatz" });
  ok(none.cross === 6 && none.check === 0 && none.n > 0, "Stellplatz ohne Angaben: Kachel erscheint trotzdem, alle Kreuze");
  const all = await probe({ lodgingKind: "stellplatz", camp: { wasser: true, wc: true, duschen: true, strom: true, wlan: true, sonstiges: true }, campNote: "Hunde erlaubt" });
  ok(all.check === 6 && all.cross === 0 && all.txt.includes("Hunde erlaubt") && !all.txt.includes("Sonstiges"), "alle vorhanden: sechs Haken, Sonstiges zeigt den eigenen Text");
  const wide = await probe({ lodgingKind: "stellplatz", lodging: "Stellplatz", camp: { wc: true } }, 250, 103);
  ok(wide.check === 1 && wide.cross === 5 && wide.warns.length === 0, "breite Kachel: zwei Spalten");
  const tiny = await probe({ lodgingKind: "stellplatz", lodging: "Name", camp: {} }, 121, 50);
  ok(tiny.warns.some((w) => /nicht in die Kachel/.test(w)), "zu kleine Kachel: Hinweis zum Vergrößern");
  const hotel = await probe({ lodging: "Hotel Sonne" });
  ok(hotel.bed === 1 && hotel.check === 0 && hotel.camper === 0 && hotel.txt.includes("UNTERKUNFT"), "Art „Unterkunft“ wie bisher (Bettsymbol, kein Haken)");
  const empty = await probe({});
  ok(empty.n === 0, "Unterkunft ohne Eintrag: Kachel zeichnet nichts");
}

console.log("Bedienung");
await page.evaluate(() => { const d = S.trip.days[0]; d.pages = [newPage([tileOf("strecke", 4), newTile("unterkunft", 2, 1), newTile("unterkunft", 1, 1)])]; changed(); renderPreview(); });
await page.waitForTimeout(400);
await page.click('[data-tab="days"]');
await page.evaluate(() => { S.open.add(S.trip.days[0].id); renderPanel(); });
const day = "details.day[open]";
ok(await page.locator(`${day} select[data-k$=".lodgingKind"]`).count() === 1 && await page.locator(`${day} .camp`).count() === 0, "Reiter „Tage“: Umschalter Unterkunft / Stellplatz, ohne Stellplatz keine Merkmale");
await page.locator(`${day} select[data-k$=".lodgingKind"]`).selectOption("stellplatz");
ok(await page.locator(`${day} .camp input[type=checkbox]`).count() === 6, "mit Stellplatz: sechs Kästchen (Wasser, WC, Duschen, Strom, WLAN, Sonstiges)");
ok((await page.locator(`${day} label:has(input[data-k$=".lodging"])`).first().innerText()).includes("Name des Stellplatzes"), "Feld heißt „Name des Stellplatzes“");
await page.locator(`${day} .camp input[data-k$=".camp.wasser"]`).check();
await page.locator(`${day} .camp input[data-k$=".camp.strom"]`).check();
ok(await page.evaluate(() => { const c = S.trip.days[0].camp; return c.wasser && c.strom && !c.wc && !c.wlan; }), "Kästchen setzen die Merkmale");
ok(await page.locator(`${day} .camp input[data-k$=".campNote"]`).count() === 0, "Textfeld für Sonstiges erst nach Auswahl");
await page.locator(`${day} .camp input[data-k$=".camp.sonstiges"]`).check();
await page.locator(`${day} .camp input[data-k$=".campNote"]`).fill("Hunde erlaubt");
await page.locator(`${day} label:has(input[data-k$=".lodging"]) input`).first().fill("Camping am Waldsee");
await page.waitForTimeout(500);
const sheet = page.locator("#pages .sheet").nth(1);
await sheet.scrollIntoViewIfNeeded();
const txt = await sheet.innerText();
ok(txt.includes("STELLPLATZ") && txt.includes("Camping am Waldsee") && txt.includes("Hunde erlaubt") && txt.includes("Duschen"), "Vorschau zeigt Stellplatz, Name, eigenen Text und alle Merkmale");
ok(await sheet.locator(".tl.empty").count() === 0, "Stellplatz-Kachel ist nicht „leer“");
await page.locator(`${day} select[data-k$=".lodgingKind"]`).selectOption("unterkunft");
ok(await page.locator(`${day} .camp`).count() === 0 && await page.evaluate(() => S.trip.days[0].camp.wasser === true), "zurück auf Unterkunft: Merkmale bleiben gespeichert, Kästchen verschwinden");
await page.locator(`${day} select[data-k$=".lodgingKind"]`).selectOption("stellplatz");
await page.waitForTimeout(400);
await sheet.screenshot({ path: join(out, "camper-seite.png") });

console.log("PDF");
{
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
  const f = join(out, "camper.pdf"); await dl.saveAs(f);
  ok((await PDFDocument.load(readFileSync(f))).getPageCount() >= 2, "PDF mit Stellplatz-Kacheln erstellt");
}
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
