// Direkte Navigation, sichtbares Bearbeiten, Speicherfehler und kleine Fenster.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", r => {
    const u = r.request().url();
    if (u.startsWith("file:")) return r.continue();
    const lib = u.includes("pdf-lib.min.js") ? "pdf-lib/dist/pdf-lib.min.js" : u.includes("exifr") ? "exifr/dist/full.umd.js" : null;
    return lib ? r.fulfill({ contentType: "text/javascript", body: readFileSync(join(root, "node_modules", lib)) }) : r.abort();
  });
  await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
  await page.waitForFunction(() => FM.ready && S.pages.length);
  await page.evaluate(() => { S.trip.capWeather = false; S.trip.placeMode = "off"; });
  await page.click('[data-tab="days"]');
  const dayId = await page.evaluate(() => S.trip.days.at(-1).id);
  await page.selectOption("#dayJump", dayId);
  assert(await page.locator(`details[data-day="${dayId}"]`).getAttribute("open") !== null);
  await page.click(`details[data-day="${dayId}"] [data-act="showDay"]`);
  assert.equal(await page.evaluate(() => S.pages[+document.querySelector("#pageJump").value].meta.dayId), dayId);
  await page.selectOption("#pageJump", "0");
  assert(await page.locator("#pages").evaluate(el => el.scrollTop < 30));
  await page.evaluate(() => {
    const d = S.trip.days[0], pg = d.pages[0], tile = pg.tiles.find(t => TILE_FIELD[t.mod]);
    showPreviewPage(S.pages.findIndex(p => p.meta && p.meta.dayId === d.id));
  });
  await page.locator('#pages .sheet[data-pi="1"] .tl').first().click();
  await page.locator('[data-tb="edit"]').click();
  assert(await page.evaluate(() => document.activeElement.closest("#panel") !== null));
  await page.evaluate(() => { S.trip.title = "Bedienungstest"; changed(); });
  await page.waitForFunction(() => document.querySelector("#saveStatus").textContent.startsWith("Im Browser gespeichert"));
  await page.evaluate(() => { window.originalIdb = idb; idb = () => Promise.reject(new Error("Test: Speicher voll")); scheduleSave(); });
  await page.waitForFunction(() => document.querySelector("#saveStatus").textContent.startsWith("Browserkopie nicht gespeichert"));
  await page.evaluate(() => { idb = window.originalIdb; });
  mkdirSync(join(root, "test/out"), { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.selectOption("#pageJump", "0");
    await page.selectOption("#zoom", "fit");
    await page.waitForTimeout(250);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `kein horizontaler Überlauf bei ${width}px`);
    assert(await page.evaluate(() => {
      const sheet = document.querySelector("#pages .sheet").getBoundingClientRect();
      const view = document.querySelector("#pages").getBoundingClientRect();
      return sheet.width <= view.width && sheet.height <= view.height;
    }), `ganze Seite passt bei ${width}px`);
    await page.screenshot({ path: join(root, `test/out/bedienung-${width}.png`) });
  }
  assert.deepEqual(errors, []);
  console.log("OK: Tages- und Seitennavigation, Bearbeiten, Speicherstatus und responsive Vorschau");
} finally { await browser.close(); }
