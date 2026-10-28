// Test: Touch-Geräte (Android): Beim Tippen bleibt die Vorschau stehen und wird erst beim Verlassen des Feldes aktualisiert; die Eingabefelder werden nicht neu aufgebaut.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FEHLT ") + msg); if (!c) failed++; };
const nm = (p) => join(root, "node_modules", p);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function open(ctxOpt) {
  const page = await (await browser.newContext(ctxOpt)).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith("file:")) return r.continue();
    if (u.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("pdf-lib/dist/pdf-lib.min.js")) });
    if (u.includes("exifr")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("exifr/dist/full.umd.js")) });
    return r.abort();
  });
  await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
  await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready && document.querySelectorAll("#pages .sheet").length > 0);
  await page.evaluate(() => { S.trip.capWeather = false; S.trip.placeMode = "off"; S.tab = "days"; S.open.add(S.trip.days[0].id); renderPanel(); });
  return { page, errors };
}
/* im Feld tippen, ohne es zu verlassen */
const typeIn = (page, text) => page.evaluate((text) => {
  const el = document.querySelector(`[data-k="d:${S.trip.days[0].id}.title"]`);
  el.__keep = true; el.focus(); el.value = text; el.dispatchEvent(new Event("input", { bubbles: true }));
  return !!el;
}, text);
const preview = (page) => page.locator("#pages").innerText();

console.log("Touch-Gerät (Android)");
{
  const { page, errors } = await open({ viewport: { width: 420, height: 900 }, hasTouch: true, isMobile: true });
  ok(await page.evaluate(() => touchUi === true), "Gerät wird als Touch-Gerät erkannt (pointer: coarse)");
  await typeIn(page, "Tippe auf dem Handy");
  await page.waitForTimeout(700);
  ok(!(await preview(page)).includes("Tippe auf dem Handy"), "während des Tippens bleibt die Vorschau stehen");
  ok(await page.evaluate(() => document.activeElement && document.activeElement.__keep === true), "das Eingabefeld wird dabei nicht neu aufgebaut (Fokus und Tastatur bleiben)");
  ok(await page.evaluate(() => S.trip.days[0].title === "Tippe auf dem Handy"), "Eingabe ist trotzdem sofort im Projekt gespeichert");
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(500);
  ok((await preview(page)).includes("Tippe auf dem Handy"), "beim Verlassen des Feldes wird die Vorschau aktualisiert");
  /* Schalter und Auswahlfelder aktualisieren sofort */
  await page.evaluate(() => { const el = document.querySelector(`[data-k="d:${S.trip.days[0].id}.text"]`); el.focus(); el.value = "Zweiter Eintrag"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(500);
  ok(!(await preview(page)).includes("Zweiter Eintrag"), "auch beim Tippen in einem mehrzeiligen Feld");
  await page.evaluate(() => { const b = document.createElement("button"); document.body.appendChild(b); b.focus(); });
  await page.waitForTimeout(400);
  ok((await preview(page)).includes("Zweiter Eintrag"), "und wird nach dem Wechsel aktualisiert");
  ok(errors.length === 0, "keine Fehler" + (errors.length ? ": " + errors[0] : ""));
  await page.context().close();
}

console.log("Computer mit Maus");
{
  const { page, errors } = await open({ viewport: { width: 1400, height: 900 } });
  ok(await page.evaluate(() => touchUi === false), "kein Touch-Gerät erkannt");
  await typeIn(page, "Tippe am Rechner");
  await page.waitForTimeout(700);
  ok((await preview(page)).includes("Tippe am Rechner"), "Vorschau aktualisiert sich schon während des Tippens");
  ok(errors.length === 0, "keine Fehler" + (errors.length ? ": " + errors[0] : ""));
  await page.context().close();
}
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
