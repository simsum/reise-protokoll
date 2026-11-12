import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined});
try {
 const page=await browser.newPage({viewport:{width:1400,height:1000}}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('file:'))return r.continue(); const p=u.includes('pdf-lib.min.js')?'node_modules/pdf-lib/dist/pdf-lib.min.js':u.includes('exifr')?'node_modules/exifr/dist/full.umd.js':null; return p?r.fulfill({contentType:'text/javascript',body:readFileSync(p)}):r.abort();});
 await page.goto(pathToFileURL(process.cwd()+'/dist/Reise-Protokoll.html').href); await page.waitForFunction(()=>FM.ready && S.pages.length);
 await page.evaluate(async()=>{ S.trip.capWeather=false; S.trip.placeMode='off'; const d=S.trip.days[0]; const cv=document.createElement('canvas');cv.width=40;cv.height=40;const ctx=cv.getContext('2d');const files=[];for(let i=0;i<2;i++){ctx.fillStyle=i?'blue':'red';ctx.fillRect(0,0,40,40); const b=await new Promise(r=>cv.toBlob(r,'image/jpeg'));files.push(new File([b],`bild${i}.jpg`,{type:'image/jpeg',lastModified:100+i}));}await addPhotosToDay(d.id,files);S.tab='days';S.open.add(d.id);renderPanel();renderPreview();});
 const day=page.locator('details.day').first(); assert.equal(await day.locator('.photo-choice').count(),2); assert.equal(await day.locator('.pcard').count(),1); assert.equal(await day.locator('.advanced-layout').getAttribute('open'),null);
 await day.locator('.photo-gallery').scrollIntoViewIfNeeded(); await page.screenshot({path:'test/out/foto-bedienung.png'});
 await day.locator('.photo-choice').nth(1).click(); assert.match(await day.locator('.pcard small').innerText(),/bild1/);
 await day.locator('[data-act="photoUnplace"]').click(); assert.equal(await page.evaluate(()=>S.trip.days[0].photos.length),2); assert.equal(await page.evaluate(()=>photosInUse(S.trip.days[0]).has(S.trip.days[0].photos[1].id)),false);
 await day.locator('[data-act="photoPlace"]').click(); assert.equal(await page.evaluate(()=>photosInUse(S.trip.days[0]).has(S.trip.days[0].photos[1].id)),true);
 await day.locator('[data-act="photoUnplace"]').click();
 const drag = await page.evaluateHandle(() => new DataTransfer());
 await day.locator('.photo-choice').nth(1).dispatchEvent('dragstart',{dataTransfer:drag});
 const target = page.locator('#pages .sheet').nth(1).locator('.tl').first();
 let box = await target.boundingBox(); await target.dispatchEvent('drop',{dataTransfer:drag,clientX:box.x+box.width/2,clientY:box.y+box.height/2});
 assert.equal(await page.evaluate(()=>photosInUse(S.trip.days[0]).has(S.trip.days[0].photos[1].id)),false, 'andere Kachel darf kein Foto aufnehmen');
 const photoId = await page.evaluate(()=>S.trip.days[0].pages.flatMap(p=>p.tiles).find(x=>x.mod==='foto').id);
 const photoTarget = page.locator(`#pages .tl[data-id="${photoId}"]`).first(); await photoTarget.scrollIntoViewIfNeeded(); box = await photoTarget.boundingBox(); await photoTarget.dispatchEvent('drop',{dataTransfer:drag,clientX:box.x+box.width/2,clientY:box.y+box.height/2});
 assert.equal(await page.evaluate(()=>photosInUse(S.trip.days[0]).has(S.trip.days[0].photos[1].id)),true,'Foto auf Fotokachel gezogen');
 await day.locator('.advanced-layout > summary').click(); await page.waitForFunction(()=>S.advanced.has(S.trip.days[0].id)); await page.evaluate(()=>renderPanel()); assert.notEqual(await day.locator('.advanced-layout').getAttribute('open'),null);
 await page.setViewportSize({width:390,height:900}); assert(await day.locator('.photo-choice').first().isVisible()); assert(await page.locator('#pages .pbar').first().evaluate(el=>getComputedStyle(el).opacity==='1') || !await page.evaluate(()=>matchMedia('(pointer:coarse)').matches));
 assert.deepEqual(errors,[]); console.log('OK: Fotoauswahl, Platzieren, Entfernen und erweiterte Ansicht');
} finally {await browser.close();}
