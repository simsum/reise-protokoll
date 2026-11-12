import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  await page.route('**/*', r => { const u=r.request().url(); if(u.startsWith('file:')) return r.continue(); const p=u.includes('pdf-lib.min.js')?'node_modules/pdf-lib/dist/pdf-lib.min.js':u.includes('exifr')?'node_modules/exifr/dist/full.umd.js':null; return p?r.fulfill({contentType:'text/javascript',body:readFileSync(p)}):r.abort(); });
  await page.goto(pathToFileURL(process.cwd()+'/dist/Reise-Protokoll.html').href);
  await page.waitForFunction(() => FM.ready && S.pages.length);
  await page.evaluate(() => { S.trip.capWeather=false; S.trip.placeMode='off'; S.tab='days'; S.open.add(S.trip.days[0].id); renderPanel(); });
  const day = page.locator('details.day').first();
  await day.locator('[data-k$=".lodgingKind"]').selectOption('stellplatz');
  await day.locator('[data-k$=".campWaste"]').selectOption('ja');
  await day.locator('[data-k$=".campDogs"]').selectOption('nein');
  await day.locator('[data-k$=".campPrice"]').fill('18 EUR / Nacht');
  await day.locator('[data-k$=".tips"]').fill('Früh reservieren');
  await day.locator('[data-k$=".tips"]').blur();
  const result = await page.evaluate(async () => {
    const d = S.trip.days[0]; const tips = d.pages.flatMap(p=>p.tiles).filter(x=>x.mod==='tipps').length;
    const pages=layoutTrip(S.trip).pages; const rendered=pages.flatMap(p=>p.ops).filter(o=>o.k==='t').map(o=>o.text).join('|');
    const attachments=await collectAttachments(S.trip); const bytes=await buildPdf(pages,{title:'Test'},attachments);
    const restored=await readProjectPdf(new File([bytes],'test.pdf',{type:'application/pdf'}));
    const clean=cleanTrip({app:'Reise-Protokoll',trip:{days:[{campWaste:'unerlaubt',campDogs:'ja',tips:'Tipp'}]}}).days[0];
    return {tips,rendered, restored:restored.trip.days[0], clean};
  });
  assert.equal(result.tips,1); assert.match(result.rendered,/Früh reservieren/); assert.match(result.rendered,/Entsorgung/); assert.match(result.rendered,/Hunde/); assert.match(result.rendered,/18 EUR/);
  assert.equal(result.restored.tips,'Früh reservieren'); assert.equal(result.restored.campWaste,'ja'); assert.equal(result.restored.campDogs,'nein'); assert.equal(result.restored.campPrice,'18 EUR / Nacht'); assert.equal(result.clean.campWaste,'');
  console.log('OK: Tipps, Stellplatzangaben, Darstellung und PDF-Roundtrip');
} finally { await browser.close(); }

