// Test: Kachel „Wikipedia-Auszug“ (Suche, Vorschau-Fenster, Kennzahlen aus Wikidata, Quellenzeile, PDF). Alle Netzzugriffe sind Testantworten.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PDFDocument, PDFName, PDFDict, PDFArray } from "pdf-lib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "test/out");
mkdirSync(out, { recursive: true });
let failed = 0;
const ok = (c, msg) => { console.log((c ? "  ok   " : "  FEHLT ") + msg); if (!c) failed++; };
const NL = "\u000a";

/* ---------- Testantworten (Form wie bei der echten MediaWiki-/Wikidata-API) ---------- */
const search = { batchcomplete: true, query: { pages: [
  { pageid: 77028, ns: 0, title: "Ludwig-Maximilians-Universität München", index: 3, description: "deutsche Universität in München, Bayern", pageprops: { wikibase_item: "Q55044" } },
  { pageid: 3215, ns: 0, title: "München", index: 1, description: "Landeshauptstadt des Freistaates Bayern, Deutschland", pageprops: { wikibase_item: "Q1726" } },
  { pageid: 3437350, ns: 0, title: "FC Bayern München", index: 2, description: "Sportverein aus München", pageprops: { wikibase_item: "Q15789" } },
] } };
const extractMuc = "München [ˈmʏnçn̩] (Aussprache: ˈmʏnçn̩; bairisch Minga, Ауди) ist die Hauptstadt des Freistaates Bayern. Sie hat ca. 1,5 Mio. Einwohner. Die Stadt wurde 1158 erstmals erwähnt. Im 19. Jahrhundert wuchs sie stark. Heute ist sie ein wichtiger Wirtschaftsstandort." + NL + "Zweiter Absatz mit Text. Noch ein Satz im zweiten Absatz.";
const articles = {
  "München": { pageid: 3215, ns: 0, title: "München", extract: extractMuc, pageprops: { wikibase_item: "Q1726" }, fullurl: "https://de.wikipedia.org/wiki/M%C3%BCnchen", canonicalurl: "https://de.wikipedia.org/wiki/M%C3%BCnchen", description: "Landeshauptstadt des Freistaates Bayern, Deutschland" },
  "Nirgendwo": { title: "Nirgendwo", missing: true },
};
const snak = (value, extra = {}) => ({ mainsnak: { snaktype: "value", datavalue: { value } }, rank: "normal", ...extra });
const qt = (time, precision = 11) => ({ P585: [{ datavalue: { value: { time, precision } } }] });
const claims = {
  P1082: [snak({ amount: "+1185421", unit: "1" }, { qualifiers: qt("+2010-12-31T00:00:00Z") }), snak({ amount: "+1512491", unit: "1" }, { qualifiers: qt("+2023-12-31T00:00:00Z") }), snak({ amount: "+1388308", unit: "1" }, { qualifiers: qt("+2019-12-31T00:00:00Z") })],
  P2046: [snak({ amount: "+310.74", unit: "http://www.wikidata.org/entity/Q712226" }, { qualifiers: qt("+2012-01-01T00:00:00Z") }), snak({ amount: "+310.71", unit: "http://www.wikidata.org/entity/Q712226" }, { rank: "preferred", qualifiers: qt("+2023-01-01T00:00:00Z") })],
  P571: [snak({ time: "+1158-00-00T00:00:00Z", precision: 9 })],
  P1249: [snak({ time: "+1158-06-14T00:00:00Z", precision: 11 })],
  P2044: [snak({ amount: "+519", unit: "http://www.wikidata.org/entity/Q11573" })],
  P17: [snak({ "entity-type": "item", id: "Q183" }, { rank: "preferred" }), snak({ "entity-type": "item", id: "Q713750" }, { qualifiers: { P582: [{ datavalue: { value: { time: "+1990-10-03T00:00:00Z", precision: 11 } } }] } })],
  P131: [snak({ "entity-type": "item", id: "Q10562" }, { rank: "preferred" })],
};
const labelsOf = { Q183: "Deutschland", Q10562: "Oberbayern" };
let wikiDown = false, calls = [];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1250 }, acceptDownloads: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const nm = (p) => join(root, "node_modules", p);
const cors = { "access-control-allow-origin": "*" };
await page.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith("file:")) return r.continue();
  if (u.includes("pdf-lib.min.js")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("pdf-lib/dist/pdf-lib.min.js")) });
  if (u.includes("exifr")) return r.fulfill({ contentType: "text/javascript", body: readFileSync(nm("exifr/dist/full.umd.js")) });
  const url = new URL(u), q = url.searchParams;
  if (url.hostname === "de.wikipedia.org" || url.hostname === "www.wikidata.org") {
    calls.push(url.hostname + ":" + (q.get("generator") || q.get("props") || q.get("prop")));
    if (wikiDown) return r.abort();
    const json = (o) => r.fulfill({ contentType: "application/json", headers: cors, body: JSON.stringify(o) });
    if (url.hostname === "de.wikipedia.org") {
      if (q.get("generator") === "search") return json(q.get("gsrsearch") === "Nichts" ? { batchcomplete: true, query: { pages: [] } } : search);
      return json({ batchcomplete: true, query: { pages: [articles[q.get("titles")] || { title: q.get("titles"), missing: true }] } });
    }
    if (q.get("props") === "claims") return json({ entities: { [q.get("ids")]: { claims: q.get("ids") === "Q1726" ? claims : {} } } });
    return json({ entities: Object.fromEntries(q.get("ids").split("|").map((id) => [id, { labels: { de: { language: "de", value: labelsOf[id] } } }])) });
  }
  return r.abort();
});
await page.goto(pathToFileURL(join(root, "dist/Reise-Protokoll.html")).href);
await page.waitForFunction(() => typeof FM !== "undefined" && FM.ready && document.querySelectorAll("#pages .sheet").length > 0);
await page.evaluate(() => { S.trip.capWeather = false; S.trip.placeMode = "off"; });

console.log("Hilfen");
const h = await page.evaluate((txt) => ({
  cut2: wpCut(wpTidy(txt), 2), cut4: wpCut(wpTidy(txt), 4), all: wpTidy(txt),
  abbr: wpSentences("Das war z. B. ein Test. Dr. Meier kam am 14. Juni 1999 nach St. Gallen. Danach ging er."),
  t: [wdTime({ time: "+1158-00-00T00:00:00Z", precision: 9 }), wdTime({ time: "+1158-06-14T00:00:00Z", precision: 11 }), wdTime({ time: "+1158-06-01T00:00:00Z", precision: 10 }), wdTime({ time: "-0753-04-21T00:00:00Z", precision: 9 }), wdTime({ time: "+1250-00-00T00:00:00Z", precision: 7 }), wdTime({ time: "+1920-00-00T00:00:00Z", precision: 8 })],
  q: [wdQty({ amount: "+1512491", unit: "1" }, "pop"), wdQty({ amount: "+310.71", unit: "http://www.wikidata.org/entity/Q712226" }, "area"), wdQty({ amount: "+31071", unit: "http://www.wikidata.org/entity/Q35852" }, "area"), wdQty({ amount: "+1500000", unit: "http://www.wikidata.org/entity/Q25343" }, "area"), wdQty({ amount: "+324", unit: "http://www.wikidata.org/entity/Q11573" }, "len"), wdQty({ amount: "+2.5", unit: "http://www.wikidata.org/entity/Q828224" }, "len"), wdQty({ amount: "+5", unit: "http://www.wikidata.org/entity/Q99999" }, "area")],
  urls: [validWpUrl("https://de.wikipedia.org/wiki/M%C3%BCnchen"), validWpUrl("https://evil.example/wiki/x"), validWpUrl("https://de.wikipedia.org/wiki/x y"), validWpUrl("javascript:alert(1)"), validWpUrl("https://de.wikipedia.org.evil.com/wiki/x")],
}), extractMuc);
ok(!/[\[ˈ]/.test(h.all) && !h.all.includes("Ауди") && h.all.startsWith("München ist die Hauptstadt"), `Aussprache und Klammern mit unbekannten Schriften entfallen: ${h.all.slice(0, 60)}`);
ok(await page.evaluate(() => wpTidy("Der Eiffelturm (französisch Tour Eiffel, [tuʁ ɛfɛl]) ist ein Turm. Er steht in Paris (, ).")) === "Der Eiffelturm (französisch Tour Eiffel) ist ein Turm. Er steht in Paris.", "Reste nach dem Entfernen der Aussprache werden aufgeräumt");
ok(h.cut2 ==="München ist die Hauptstadt des Freistaates Bayern. Sie hat ca. 1,5 Mio. Einwohner.", `Kürzen auf 2 Sätze trennt nicht bei „ca.“ und „Mio.“: ${h.cut2.slice(0, 80)}`);
ok(h.cut4.split(NL).length === 1 && h.cut4.endsWith("Im 19. Jahrhundert wuchs sie stark."), "4 Sätze: Ordnungszahl „19.“ trennt nicht");
ok(h.abbr.length === 3 && h.abbr[0].startsWith("Das war z. B. ein Test.") && h.abbr[1].includes("14. Juni") && h.abbr[1].includes("St. Gallen"), `Abkürzungen und Daten: ${h.abbr.length} Sätze`);
ok(h.t.join("|") === "1158|14.06.1158|Juni 1158|753 v. Chr.|13. Jh.|1920er", `Zeitangaben: ${h.t.join(" | ")}`);
ok(h.q.join("|") === "1.512.491|310,7 km²|310,7 km²|1,5 km²|324 m|2.500 m|", `Mengen: ${h.q.join(" | ")}`);
ok(h.urls.join() === "true,false,false,false,false", "nur Artikeladressen der deutschen Wikipedia sind als Link erlaubt");

console.log("Kennzahlen aus Wikidata");
const facts = await page.evaluate(() => wdFacts("Q1726"));
ok(facts.map((f) => f.l + "=" + f.v).join(" | ") === "Einwohner (2023)=1.512.491 | Fläche=310,7 km² | Gegründet=1158 | Erste Erwähnung=14.06.1158 | Höhe ü. NN=519 m | Land=Deutschland | Region=Oberbayern", `neuester Einwohnerwert, bevorzugte Fläche, kein früheres Land: ${facts.map((f) => f.l + "=" + f.v).join(" | ")}`);
ok((await page.evaluate(() => wdFacts("Q0"))).length === 0, "Eintrag ohne Daten: keine Kennzahlen, kein Fehler");

console.log("Fenster");
await page.evaluate(() => { const d = S.trip.days[0]; d.place = { name: "München", lat: null, lon: null }; d.pages = [newPage([tileOf("strecke", 4), newTile("notiz", 2, 1)])]; changed(); renderPreview(); });
await page.waitForTimeout(400);
const sh = page.locator("#pages .sheet").nth(1);
await sh.scrollIntoViewIfNeeded();
const grid = await sh.locator(".ov").boundingBox();
await page.mouse.click(grid.x + grid.width * 0.9, grid.y + grid.height * 0.5);
await page.locator('#tb [data-tb="add"]').selectOption("wikipedia");
ok(await page.locator("#wp").isVisible(), "neue Wikipedia-Kachel öffnet das Fenster");
ok(await page.locator("#wpQ").inputValue() === "München", "Suchbegriff ist der Ort des Tages");
await page.waitForSelector("#wpHits button");
const hits = await page.locator("#wpHits button").allInnerTexts();
ok(hits.length === 3 && hits[0].startsWith("München") && hits[1].startsWith("FC Bayern") && hits[2].startsWith("Ludwig"), `Trefferliste nach Güte sortiert (${hits.length})`);
ok(await page.locator("#wpOk").isDisabled(), "Übernehmen erst nach Auswahl");
await page.locator("#wpHits button").first().click();
await page.waitForSelector("#wpEd:not([hidden])");
await page.waitForFunction(() => document.querySelectorAll("#wpFacts .fact").length > 0);
ok(await page.locator("#wpTit").inputValue() === "München", "Überschrift aus dem Artikel");
ok((await page.locator("#wpTxt").inputValue()).endsWith("Im 19. Jahrhundert wuchs sie stark."), "Text vorab auf 4 Sätze gekürzt");
ok(await page.locator("#wpFacts .fact").count() === 7 && await page.locator('#wpFacts input[data-f="on"]:checked').count() === 4, "7 Kennzahlen gefunden, die ersten 4 angehakt");
const prev = await page.locator("#wpSheet").innerText();
ok(prev.includes("1.512.491") && prev.includes("310,7 km²") && prev.includes("Quelle: Wikipedia") && prev.includes("CC BY-SA 4.0") && prev.includes("Wikidata, CC0"), "Vorschau zeigt Kennzahlen und Quellenzeile");
ok(!prev.includes("519 m"), "abgewählte Kennzahl fehlt in der Vorschau");
await page.locator('#wpFacts input[data-k="4"][data-f="on"]').check();
ok((await page.locator("#wpSheet").innerText()).includes("519 m"), "Kennzahl anhaken: sofort in der Vorschau");
await page.locator('#wpFacts input[data-k="0"][data-f="v"]').fill("rund 1,5 Mio.");
await page.locator('#wpFacts input[data-k="0"][data-f="l"]').fill("Einwohner");
await page.waitForTimeout(250);
ok((await page.locator("#wpSheet").innerText()).includes("rund 1,5 Mio."), "Kennzahl von Hand ändern");
await page.locator("#wpLen button[data-n='1']").click();
ok((await page.locator("#wpTxt").inputValue()) === "München ist die Hauptstadt des Freistaates Bayern.", "Kürzen auf 1 Satz");
await page.locator("#wpLen button[data-n='0']").click();
ok((await page.locator("#wpTxt").inputValue()).includes("Zweiter Absatz mit Text."), "„alles“ stellt den ganzen Einleitungstext wieder her");
await page.locator("#wpLen button[data-n='2']").click();
await page.locator("#wpTxt").fill("Eigener Text: schöne Stadt an der Isar.");
await page.locator("#wpAddFact").click();
await page.locator('#wpFacts .fact:last-child input[data-f="l"]').fill("Spitzname");
await page.locator('#wpFacts .fact:last-child input[data-f="v"]').fill("Millionendorf");
await page.waitForTimeout(250);
ok((await page.locator("#wpSheet").innerText()).includes("Millionendorf") && (await page.locator("#wpSheet").innerText()).includes("Eigener Text"), "eigener Text und eigene Kennzahl");
await page.locator('#wpSizes button[data-w="2"][data-h="2"]').click();
ok(await page.locator('#wpSizes button[aria-pressed="true"]').innerText() === "2×2", "Größe wählbar, Vorschau in echter Größe");
await page.screenshot({ path: join(out, "wikipedia-fenster.png") });
await page.locator("#wpOk").click();
ok(await page.locator("#wp").isHidden(), "Übernehmen schließt das Fenster");
const tile = await page.evaluate(() => { const t = S.trip.days[0].pages[0].tiles.find((x) => x.mod === "wikipedia"); return t && { w: t.w, h: t.h, wp: t.wp }; });
ok(tile && tile.w === 2 && tile.h === 2 && tile.wp.title === "München" && tile.wp.url === "https://de.wikipedia.org/wiki/M%C3%BCnchen" && tile.wp.text.startsWith("Eigener Text") && tile.wp.facts.length === 8 && tile.wp.facts.filter((f) => f.on).length === 6 && tile.wp.wd === true && /^\d{4}-\d\d-\d\d$/.test(tile.wp.date), "Kachel enthält Titel, Adresse, Text, 8 Kennzahlen (6 sichtbar), Abrufdatum");
await page.waitForTimeout(400);
const text = await sh.innerText();
ok(text.includes("WIKIPEDIA") && text.includes("rund 1,5 Mio.") && text.includes("Millionendorf") && text.includes("Eigener Text") && text.includes("Quelle: Wikipedia"), "Kachel erscheint in der Seitenvorschau");
await sh.screenshot({ path: join(out, "wikipedia-seite.png") });

console.log("Bearbeiten, Abbrechen, Fehler");
const wid = tile && await page.evaluate(() => S.trip.days[0].pages[0].tiles.find((x) => x.mod === "wikipedia").id);
const bb = await sh.locator(`.tl[data-id="${wid}"]`).boundingBox();
await page.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2);
ok(await page.locator("#wp").isVisible() && await page.locator("#wpEd").isVisible() && await page.locator("#wpTit").inputValue() === "München" && (await page.locator("#wpTxt").inputValue()).startsWith("Eigener Text"), "Doppelklick öffnet das Fenster mit den gespeicherten Werten");
await page.locator("#wpTxt").fill("Verworfen");
await page.locator("#wpCancel").click();
ok(await page.evaluate(() => S.trip.days[0].pages[0].tiles.find((x) => x.mod === "wikipedia").wp.text.startsWith("Eigener Text")), "Abbrechen ändert nichts");
await page.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.keyboard.press("Escape");
ok(await page.locator("#wp").isHidden() && await page.evaluate(() => S.trip.days[0].pages[0].tiles.some((x) => x.mod === "wikipedia")), "Escape schließt das Fenster, die Kachel bleibt (Entf löscht sie nicht)");
await page.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.locator("#wpQ").fill("Nichts"); await page.locator("#wpGo").click();
await page.waitForFunction(() => /Nichts gefunden/.test(document.querySelector("#wpStatus").textContent));
ok(true, "Suche ohne Treffer: Hinweis");
wikiDown = true;
await page.locator("#wpQ").fill("München"); await page.locator("#wpGo").click();
await page.waitForFunction(() => /nicht erreichbar/.test(document.querySelector("#wpStatus").textContent));
ok(true, "Wikipedia nicht erreichbar: verständliche Meldung statt Fehler");
wikiDown = false;
await page.locator("#wpCancel").click();
await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });

console.log("Sidebar, Projekt, PDF");
await page.click('[data-tab="days"]');
await page.evaluate(() => { S.open.add(S.trip.days[0].id); renderPanel(); });
ok(await page.locator('details.day[open] [data-act="wpOpen"]').count() === 1 && (await page.locator("details.day[open] .tile small").allInnerTexts()).some((t) => t.includes("München") && t.includes("6 Kennzahlen")), "Seitenleiste: Knopf und Zusammenfassung der Kachel");
await page.locator('details.day[open] [data-act="wpOpen"]').click();
ok(await page.locator("#wp").isVisible(), "Knopf in der Seitenleiste öffnet das Fenster");
await page.locator("#wpCancel").click();
const rt = await page.evaluate(() => { const x = cleanTrip(jsonOfTrip(S.trip, new Map(), new Map())); const t = x.days[0].pages[0].tiles.find((q) => q.mod === "wikipedia"); return t && { n: t.wp.facts.length, url: t.wp.url, wd: t.wp.wd, text: t.wp.text.slice(0, 11) }; });
ok(rt && rt.n === 8 && rt.url.startsWith("https://de.wikipedia.org/wiki/") && rt.wd && rt.text === "Eigener Tex", "Projektdatei: Auszug bleibt erhalten");
const evil = await page.evaluate(() => { const t = cleanTrip({ app: "Reise-Protokoll", trip: { days: [{ pages: [{ tiles: [{ mod: "wikipedia", wp: { title: "T".repeat(999), url: "javascript:alert(1)", text: 5, date: "gestern", wd: "ja", facts: [{ l: "x".repeat(99), v: "y".repeat(999), on: 1 }, null, "x", { l: "", v: "" }].concat(Array.from({ length: 30 }, () => ({ l: "a", v: "b", on: true }))) } }, { mod: "wikipedia", wp: "kaputt" }] }] }] } }).days[0].pages[0].tiles; return { a: t[0].wp, b: t[1].wp }; });
ok(evil.a.title.length === 200 && evil.a.url === "" && evil.a.text === "" && evil.a.date === "" && evil.a.wd === true && evil.a.facts.length === 12 && evil.a.facts[0].l.length === 40 && evil.a.facts[0].v.length === 80 && evil.b === undefined, "manipulierte Daten werden bereinigt (Adresse, Längen, Anzahl, Typen)");
ok(await page.evaluate(() => { const x = copyTiles([{ mod: "wikipedia", w: 2, h: 2, wp: { title: "x" } }])[0]; return x.mod === "wikipedia" && !x.wp; }), "Format übertragen kopiert den Inhalt nicht");
{
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]);
  const f = join(out, "wikipedia.pdf"); await dl.saveAs(f);
  const pdf = await PDFDocument.load(readFileSync(f)), uris = [];
  pdf.getPages().forEach((pg) => { const an = pg.node.lookupMaybe(PDFName.of("Annots"), PDFArray); if (an) for (let i = 0; i < an.size(); i++) { const d = an.lookupMaybe(i, PDFDict), act = d && d.lookupMaybe(PDFName.of("A"), PDFDict), u = act && act.get(PDFName.of("URI")); if (u && u.decodeText) uris.push(u.decodeText()); } });
  ok(uris.includes("https://de.wikipedia.org/wiki/M%C3%BCnchen"), "PDF: Quellenzeile verlinkt den Artikel");
}
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
