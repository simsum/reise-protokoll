// Test: Anzeige der voraussichtlichen PDF-Größe (neben der Seitenzahl) und Vergleich mit der echten Größe.
import { chromium } from "playwright";
import { readFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

console.log("Anzeige");
const txt = () => page.locator("#pageCount").innerText();
ok(/^7 Seiten · PDF ca\. \d+ KB$/.test(await txt()), `ohne Fotos: Seitenzahl und Größe in KB: ${await txt()}`);
ok((await page.locator("#pageCount").getAttribute("title")).includes("Voraussichtliche Größe des PDFs") && (await page.locator("#pageCount").getAttribute("title")).includes("Bilder auf den Seiten"), "Tooltip schlüsselt die Größe auf");

console.log("Mit Fotos");
await page.evaluate(async () => {
  S.trip.capWeather = false; S.trip.placeMode = "off";
  const mk = async (i) => {
    const cv = document.createElement("canvas"); cv.width = 3000; cv.height = 2000; const g = cv.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 3000, 2000); gr.addColorStop(0, `hsl(${i * 60},50%,60%)`); gr.addColorStop(1, `hsl(${i * 60 + 80},50%,30%)`); g.fillStyle = gr; g.fillRect(0, 0, 3000, 2000);
    let s = i * 7919; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 900; k++) { g.fillStyle = `hsla(${rnd() * 360},60%,${30 + rnd() * 50}%,.55)`; const x = rnd() * 3000, y = rnd() * 2000, r = 8 + rnd() * 90; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    const im = g.getImageData(0, 0, 3000, 2000), d = im.data; for (let k = 0; k < d.length; k += 4) { const n = (rnd() - 0.5) * 36; d[k] += n; d[k + 1] += n; d[k + 2] += n; } g.putImageData(im, 0, 0);
    return new File([await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.9))], `foto${i}.jpg`, { type: "image/jpeg" });
  };
  await addPhotosToDay(S.trip.days[0].id, await Promise.all([1, 2, 3, 4].map(mk)));
});
await page.waitForTimeout(800);
const info = async () => page.evaluate(() => { const { pages } = layoutTrip(S.trip), e = pdfEstimate(S.trip, pages); return { e, orig: S.trip.days.flatMap((d) => d.photos).reduce((s, p) => s + p.file.size, 0), pages: pages.length }; });
let a = await info();
ok(a.e.embedded === a.orig && a.e.img > 0 && a.e.total > a.orig, `Originale zählen voll (${(a.orig / 1048576).toFixed(1)} MB), Seitenbilder kommen dazu`);
ok(/MB$/.test(await txt()), `Anzeige in MB: ${await txt()}`);
const dl = async () => { const [d] = await Promise.all([page.waitForEvent("download"), page.click("#pdfBtn")]); const f = join(out, "groesse.pdf"); await d.saveAs(f); return statSync(f).size; };
const real = await dl(), ratio = real / a.e.total;
console.log(`   geschätzt ${(a.e.total / 1048576).toFixed(2)} MB, tatsächlich ${(real / 1048576).toFixed(2)} MB (Verhältnis ${ratio.toFixed(2)})`);
ok(ratio > 0.6 && ratio < 1.6, "Schätzung liegt nahe an der echten Größe (Originale eingebettet, 150 dpi)");

console.log("Einstellungen wirken");
await page.evaluate(() => { S.trip.dpi = "300"; changed(); renderPreview(); });
const hi = (await info()).e.img;
await page.evaluate(() => { S.trip.dpi = "110"; changed(); renderPreview(); });
const lo = (await info()).e.img;
ok(hi > lo * 3, `höhere Auflösung: größere Seitenbilder (300 dpi ${(hi / 1048576).toFixed(1)} MB gegen 110 dpi ${(lo / 1048576).toFixed(1)} MB)`);
await page.evaluate(() => { S.trip.dpi = "150"; S.trip.embed = "1600"; changed(); renderPreview(); });
const small = (await info()).e;
ok(small.embedded < a.orig * 0.5 && small.embedded > 0, `Fotos auf 1600 px verkleinert: eingebettet nur ${(small.embedded / 1048576).toFixed(1)} MB statt ${(a.orig / 1048576).toFixed(1)} MB`);
const realSmall = await dl(), estSmall = (await info()).e.total;
console.log(`   geschätzt ${(estSmall / 1048576).toFixed(2)} MB, tatsächlich ${(realSmall / 1048576).toFixed(2)} MB (Verhältnis ${(realSmall / estSmall).toFixed(2)})`);
ok(realSmall / estSmall > 0.5 && realSmall / estSmall < 1.8, "auch bei verkleinerten Fotos nahe an der echten Größe");
await page.evaluate(() => { S.trip.projData = false; changed(); renderPreview(); });
const noData = (await info()).e;
ok(noData.embedded === 0 && noData.extra === 0 && (await page.locator("#pageCount").getAttribute("title")).includes("Ohne Bearbeitungsdaten"), "ohne Bearbeitungsdaten: nur Seitenbilder, Tooltip weist darauf hin");
const realNo = await dl();
console.log(`   geschätzt ${(noData.total / 1048576).toFixed(2)} MB, tatsächlich ${(realNo / 1048576).toFixed(2)} MB`);
ok(realNo / noData.total > 0.5 && realNo / noData.total < 1.8, "ohne eingebettete Daten ebenfalls nahe an der echten Größe");
ok(errors.length === 0, "keine Fehler in der Konsole" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
await browser.close();
console.log(failed ? `\n${failed} Prüfung(en) fehlgeschlagen` : "\nAlle Prüfungen bestanden");
process.exit(failed ? 1 : 0);
