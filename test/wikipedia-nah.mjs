// Test: Wikipedia „In der Nähe“ (Umkreissuche, Beliebtheit nach Seitenaufrufen, Positionen aus Ort/Fotos/Gerät). Alle Netzzugriffe sind Testantworten.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "test/out");
mkdirSync(out, { recursive: true });
let failed = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FEHLT ") + msg); if (!c) failed++; };

const days = (o) => ({ "2026-10-01": o.a, "2026-10-02": o.b });
const geo = [
  { pageid: 1, ns: 0, title: "Mariensäule (München)", lat: 48.1374, lon: 11.5755, dist: 19.6, primary: "" },
  { pageid: 2, ns: 0, title: "Sektion Prag", lat: 48.1375, lon: 11.5756, dist: 20.2, primary: "" },
  { pageid: 3, ns: 0, title: "Marienplatz (München)", lat: 48.1372, lon: 11.5753, dist: 120.4, primary: "" },
  { pageid: 4, ns: 0, title: "Albertgasse", lat: 48.1386, lon: 11.5746, dist: 300, primary: "" },
  { pageid: 5, ns: 0, title: "Frauenkirche (München)", lat: 48.1386, lon: 11.5739, dist: 1410.5, primary: "" },
];
const info = {
  "Mariensäule (München)": { description: "ein Maria geweihtes Standbild auf einer Säule im Stadtzentrum von München", views: days({ a: 400, b: 397 }), qid: "Q1" },
  "Sektion Prag": { description: "Sektion des Deutschen Alpenvereins", views: days({ a: 6, b: 6 }), qid: "Q2" },
  "Marienplatz (München)": { description: "zentraler Platz der Münchner Innenstadt", views: days({ a: 2000, b: 456 }), qid: "Q3" },
  "Albertgasse": { description: "Gasse in München", views: days({ a: 9, b: 10 }), qid: "Q4" },
  "Frauenkirche (München)": { description: "Kathedralkirche des katholischen Erzbistums München und Freising, Deutschland", views: days({ a: 7000, b: 597 }), qid: "Q99" },
};
const snak = (value, extra = {}) => ({ mainsnak: { snaktype: "value", datavalue: { value } }, rank: "normal", ...extra });
const claims99 = { P571: [snak({ time: "+1468-00-00T00:00:00Z", precision: 9 })], P2048: [snak({ amount: "+99", unit: "http://www.wikidata.org/entity/Q11573" })], P84: [snak({ "entity-type": "item", id: "Q777" })] };
let wikiDown = false, geoReqs = [], pvRounds = 0, busy = 0;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1250 }, geolocation: { latitude: 47.8, longitude: 13.04 }, permissions: ["geolocation"] });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|geolocation|Geolocation/i.test(m.text())) errors.push(m.text()); });
const nm = (p) => join(root, "node_modules", p);
const cors = { "access-control-allow-origin": "*" };
await page.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith("file:")) return r.continue();
  if (u.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("pdf-lib/dist/pdf-lib.min.js")) });
  if (u.includes("exifr")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("exifr/dist/full.umd.js")) });
  const url = new URL(u), q = url.searchParams, json = (o) => r.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify(o) });
  if (url.hostname === "de.wikipedia.org") {
    if (wikiDown) return r.abort();
    if (q.get("list") === "geosearch") { geoReqs.push({ coord: q.get("gscoord"), radius: q.get("gsradius") }); if (busy > 0) { busy--; return json({ error: { code: "cirrussearch-too-busy-error", info: "Search is currently too busy." } }); } return json({ batchcomplete: true, query: { geosearch: geo } }); }
    if (q.get("prop") === "description|pageprops|pageviews") { /* Seitenaufrufe kommen in Runden, wie bei der echten API */
      const second = !!q.get("pvipcontinue"); pvRounds++;
      const titles = q.get("titles").split("|"), part = second ? titles.slice(2) : titles;
      return json({ batchcomplete: true, ...(second ? {} : { continue: { pvipcontinue: "x", continue: "||description|pageprops" } }), query: { pages: part.map((t) => ({ title: t, description: info[t].description, pageprops: { wikibase_item: info[t].qid }, pageviews: info[t].views })) } });
    }
    const t = q.get("titles"), i = info[t];
    return json({ batchcomplete: true, query: { pages: [i ? { title: t, extract: "Die Frauenkirche ist die Kathedrale von München. Sie wurde im 15. Jahrhundert erbaut. Ihre Türme prägen die Stadt.", pageprops: { wikibase_item: i.qid }, canonicalurl: "https://de.wikipedia.org/wiki/Frauenkirche_(M%C3%BCnchen)", description: i.description } : { title: t, missing: true }] } });
  }
  if (url.hostname === "www.wikidata.org") {
    if (wikiDown) return r.abort();
    if (q.get("props") === "claims") return json({ entities: { [q.get("ids")]: { claims: q.get("ids") === "Q99" ? claims99 : {} } } });
    return json({ entities: Object.fromEntries(q.get("ids").split("|").map((id) => [id, { labels: { de: { language: "de", value: "Jörg von Halsbach" } } }])) });
  }
  return r.abort();
});
await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready && document.querySelectorAll("#pages .sheet").length > 0);
await page.evaluate(() => {
  S.trip.capWeather = false; S.trip.placeMode = "off";
  const d = S.trip.days[0]; d.place = { name: "München", lat: 48.1374, lon: 11.5755 };
  d.photos.push(normPhoto({ id: "ph1", name: "a.jpg", src: "data:image/jpeg;base64,/9j/4AAQ", bw: 10, bh: 10, gps: { lat: 48.2, lon: 11.6 }, place: "Schwabing" }), normPhoto({ id: "ph2", name: "b.jpg", src: "data:image/jpeg;base64,/9j/4AAQ", bw: 10, bh: 10, gps: { lat: 48.2001, lon: 11.6001 }, place: "Doppelt" }));
  d.pages = [newPage([tileOf("strecke", 4)])]; changed(); renderPreview();
});
await page.waitForTimeout(400);

console.log("Hilfen");
const un = await page.evaluate(async () => {
  const seen = []; const items = await wpNearby(48.1374, 11.5755, 20000, (it) => seen.push(it.map((x) => x.views)));
  return { n: items.length, calls: seen.length, first: seen[0].every((v) => v === null), last: seen[seen.length - 1].every((v) => v !== null), by: wpSortNear(items, "views").map((x) => x.title).join("|"), byDist: wpSortNear(items, "dist")[0].title, d: [wpDist(19.6), wpDist(410.5), wpDist(1410.5), wpDist(9999)] };
});
ok(geoReqs[0].radius === "10000", "Radius wird auf höchstens 10 km begrenzt (API-Grenze)");
ok(un.n === 5 && un.calls >= 3 && un.first && un.last, `zuerst die Entfernungsliste, dann Ergänzung in Runden (${un.calls} Zwischenstände, ${pvRounds} Abfragen)`);
ok(un.by === "Frauenkirche (München)|Marienplatz (München)|Mariensäule (München)|Albertgasse|Sektion Prag", "nach Beliebtheit: Frauenkirche, Marienplatz, Mariensäule vor Gasse und Verein");
ok(un.byDist === "Mariensäule (München)" && un.d.join("|") === "20 m|411 m|1,4 km|10 km", `nach Entfernung sortiert, Entfernungen lesbar: ${un.d.join(" | ")}`);

console.log("Fenster");
await page.locator("#pages .sheet").nth(1).scrollIntoViewIfNeeded();
const grid = await page.locator("#pages .sheet").nth(1).locator(".ov").boundingBox();
await page.mouse.click(grid.x + grid.width * 0.5, grid.y + grid.height * 0.5);
await page.locator('#tb [data-tb="add"]').selectOption("wikipedia");
await page.waitForSelector("#wpHits button");
const opts = await page.locator("#wpNear option").allInnerTexts();
ok(opts.length === 3 && opts[0] === "Ort des Tages: München" && opts[1] === "Foto 1: Schwabing" && opts[2] === "Aktueller Standort des Geräts", `Umgebung wählbar: ${opts.join(" | ")} (Foto in 15 m Abstand wird nicht doppelt gelistet)`);
geoReqs = [];
await page.locator("#wpNearGo").click();
await page.waitForFunction(() => /beliebteste zuerst/.test(document.querySelector("#wpStatus").textContent));
let titles = (await page.locator("#wpHits button b").allInnerTexts());
ok(titles.join("|") === "Frauenkirche (München)|Marienplatz (München)|Mariensäule (München)|Albertgasse|Sektion Prag", `Ergebnis nach Beliebtheit: ${titles.slice(0, 3).join(", ")} …`);
ok(geoReqs.at(-1).coord === "48.1374|11.5755" && geoReqs.at(-1).radius === "3000", "Standardradius 3 km um den Ort des Tages");
const row = await page.locator("#wpHits button").first().innerText();
ok(row.includes("Kathedralkirche") && row.includes("1,4 km"), `Zeile zeigt Beschreibung und Entfernung: ${row.replace(/\s+/g, " ")}`);
ok(await page.locator("#wpSort").isVisible() && (await page.locator("#wpSort").innerText()).includes("Entfernung"), "Knopf zum Umsortieren");
await page.locator("#wpSort").click();
titles = await page.locator("#wpHits button b").allInnerTexts();
ok(titles[0] === "Mariensäule (München)" && titles.at(-1) === "Frauenkirche (München)" && /nächste zuerst/.test(await page.locator("#wpStatus").innerText()), "nach Entfernung sortiert");
await page.locator("#wpSort").click();
await page.locator("#wpNear").selectOption("1");
await page.locator("#wpRad").selectOption("10");
await page.locator("#wpNearGo").click();
await page.waitForFunction(() => /beliebteste zuerst/.test(document.querySelector("#wpStatus").textContent));
ok(geoReqs.at(-1).coord === "48.2|11.6" && geoReqs.at(-1).radius === "10000", "Foto-GPS und Radius 10 km werden verwendet");
await page.locator("#wpNear").selectOption("2");
await page.locator("#wpNearGo").click();
await page.waitForFunction(() => /beliebteste zuerst/.test(document.querySelector("#wpStatus").textContent));
ok(geoReqs.at(-1).coord === "47.8|13.04", "Standort des Geräts (Erlaubnis erteilt)");
await ctx.clearPermissions();
await page.locator("#wpNearGo").click();
await page.waitForFunction(() => /nicht verfügbar/.test(document.querySelector("#wpStatus").textContent));
ok(true, "ohne Erlaubnis: verständliche Meldung statt Fehler");
await ctx.grantPermissions(["geolocation"]);

console.log("Treffer übernehmen");
await page.locator("#wpNear").selectOption("0");
await page.locator("#wpNearGo").click();
await page.waitForFunction(() => /beliebteste zuerst/.test(document.querySelector("#wpStatus").textContent));
await page.locator("#wpHits button").first().click();
await page.waitForSelector("#wpEd:not([hidden])");
await page.waitForFunction(() => document.querySelectorAll("#wpFacts .fact").length > 0);
ok(await page.locator("#wpTit").inputValue() === "Frauenkirche (München)", "Artikel aus der Nähe-Liste geladen");
const facts = await page.locator("#wpFacts .fact").evaluateAll((rows) => rows.map((r) => r.querySelector("input[data-f=l]").value + "=" + r.querySelector("input[data-f=v]").value));
ok(facts.join(" | ") === "Baujahr=1468 | Höhe=99 m | Architekt=Jörg von Halsbach", `Kennzahlen für ein Bauwerk: ${facts.join(" | ")}`);
ok(await page.locator('#wpFacts input[data-f="on"]:checked').count() === 3, "alle drei angehakt");
await page.locator("#wpOk").click();
await page.waitForTimeout(300);
await page.locator("#pages .sheet").nth(1).screenshot({ path: join(out, "wikipedia-bauwerk.png") });
ok((await page.locator("#pages .sheet").nth(1).innerText()).includes("Jörg von Halsbach"), "Kachel zeigt die Kennzahlen");

console.log("Fehler");
const wid0 = await page.evaluate(() => S.trip.days[0].pages[0].tiles.find((x) => x.mod === "wikipedia").id);
const bb0 = await page.locator("#pages .sheet").nth(1).locator(`.tl[data-id="${wid0}"]`).boundingBox();
await page.mouse.dblclick(bb0.x + bb0.width / 2, bb0.y + bb0.height / 2);
await page.locator("#wpNear").selectOption("0");
geoReqs = []; busy = 1;
await page.locator("#wpNearGo").click();
await page.waitForFunction(() => /beliebteste zuerst/.test(document.querySelector("#wpStatus").textContent), null, { timeout: 15000 });
ok(geoReqs.length === 2, "Wikipedia „zu beschäftigt“: die Suche wird einmal automatisch wiederholt und gelingt");
geoReqs = []; busy = 99;
await page.locator("#wpNearGo").click();
await page.waitForFunction(() => /überlastet/.test(document.querySelector("#wpStatus").textContent), null, { timeout: 15000 });
ok(geoReqs.length === 3, "dauerhaft überlastet: nach drei Versuchen verständliche Meldung");
busy = 0;
await page.locator("#wpCancel").click();
wikiDown = true;
const wid = await page.evaluate(() => S.trip.days[0].pages[0].tiles.find((x) => x.mod === "wikipedia").id);
const bb = await page.locator("#pages .sheet").nth(1).locator(`.tl[data-id="${wid}"]`).boundingBox();
await page.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.locator("#wpNearGo").click();
await page.waitForFunction(() => /nicht erreichbar/.test(document.querySelector("#wpStatus").textContent));
ok(true, "Wikipedia nicht erreichbar: Meldung");
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
