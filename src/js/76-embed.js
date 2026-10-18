/* ---------- Fotos im PDF: Originale einbetten, verkleinern (EXIF bleibt), Bildauflösung auf der Seite ----------
   Wie im Foto-Protokoll: Die Originaldatei kommt bitgenau als Anhang ins PDF. Optional wird sie vorher auf 1600, 2400
   oder 3200 px verkleinert; Aufnahmedatum und GPS bleiben dabei in der Datei. */

/* EXIF-Segment (APP1) einer JPEG-Datei */
function exifSegment(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let o = 2;
  while (o + 4 < bytes.length && bytes[o] === 0xff) {
    const mk = bytes[o + 1], len = (bytes[o + 2] << 8) | bytes[o + 3];
    if (mk === 0xda || mk === 0xd9) break;
    if (mk === 0xe1 && String.fromCharCode(...bytes.subarray(o + 4, o + 10)) === "Exif\0\0") return bytes.slice(o, o + 2 + len);
    o += 2 + len;
  }
  return null;
}
/* Orientierung im IFD0 auf 1 setzen: das neue Bild ist bereits gedreht */
function resetOrientation(seg) {
  try {
    const dv = new DataView(seg.buffer, seg.byteOffset, seg.byteLength), t = 10;
    const le = dv.getUint16(t) === 0x4949, ifd = t + dv.getUint32(t + 4, le), n = dv.getUint16(ifd, le);
    for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (dv.getUint16(e, le) === 0x0112) dv.setUint16(e + 8, 1, le); }
  } catch (e) { /* unverändert lassen */ }
  return seg;
}
/* Minimales EXIF mit Aufnahmezeit und GPS (für HEIC und PNG, wo kein EXIF übernommen werden kann) */
function buildExif(p) {
  const dt = p.day && p.time && !p.dayFromFile ? `${p.day.replace(/-/g, ":")} ${p.time}` : null, gps = p.gps;
  if (!dt && !gps) return null;
  const ab = new ArrayBuffer(400), dv = new DataView(ab);
  dv.setUint16(0, 0x4d4d); dv.setUint16(2, 42); dv.setUint32(4, 8);
  const n0 = 1 + (dt ? 1 : 0) + (gps ? 1 : 0);
  let pos = 8 + 2 + n0 * 12 + 4;
  const exifOff = pos; if (dt) pos += 2 + 12 + 4 + 20;
  const gpsOff = pos; if (gps) pos += 2 + 5 * 12 + 4 + 48;
  const ent = (at, tag, type, count, val) => { dv.setUint16(at, tag); dv.setUint16(at + 2, type); dv.setUint32(at + 4, count); if (type === 3) dv.setUint16(at + 8, val); else dv.setUint32(at + 8, val); };
  let e = 8; dv.setUint16(e, n0); e += 2;
  ent(e, 0x0112, 3, 1, 1); e += 12;
  if (dt) { ent(e, 0x8769, 4, 1, exifOff); e += 12; }
  if (gps) { ent(e, 0x8825, 4, 1, gpsOff); e += 12; }
  dv.setUint32(e, 0);
  if (dt) {
    const data = exifOff + 18;
    dv.setUint16(exifOff, 1); ent(exifOff + 2, 0x9003, 2, 20, data); dv.setUint32(exifOff + 14, 0);
    for (let i = 0; i < 19; i++) dv.setUint8(data + i, dt.charCodeAt(i));
    dv.setUint8(data + 19, 0);
  }
  if (gps) {
    const data = gpsOff + 66; let a = gpsOff; dv.setUint16(a, 5); a += 2;
    ent(a, 0, 1, 4, 0); dv.setUint8(a + 8, 2); dv.setUint8(a + 9, 3); a += 12;
    ent(a, 1, 2, 2, 0); dv.setUint8(a + 8, gps.lat >= 0 ? 78 : 83); a += 12;
    ent(a, 2, 5, 3, data); a += 12;
    ent(a, 3, 2, 2, 0); dv.setUint8(a + 8, gps.lon >= 0 ? 69 : 87); a += 12;
    ent(a, 4, 5, 3, data + 24); a += 12; dv.setUint32(a, 0);
    const dms = (at, v) => {
      v = Math.abs(v); const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60 * 1000);
      [[d, 1], [m, 1], [s, 1000]].forEach(([nu, de], i) => { dv.setUint32(at + i * 8, nu); dv.setUint32(at + i * 8 + 4, de); });
    };
    dms(data, gps.lat); dms(data + 24, gps.lon);
  }
  const seg = new Uint8Array(10 + pos);
  seg.set([0xff, 0xe1, ((pos + 8) >> 8) & 0xff, (pos + 8) & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0]); seg.set(new Uint8Array(ab, 0, pos), 10);
  return seg;
}

/* Original verkleinern (neu kodiertes JPEG mit übernommenem EXIF). null = lohnt sich nicht, dann kommt das Original. */
async function compressOriginal(p, edge) {
  const orig = new Uint8Array(await p.file.arrayBuffer());
  const bmp = await decodeFile(p.file), s = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = "high";
  g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
  let jpg = new Uint8Array(await (await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82))).arrayBuffer());
  const ex = exifSegment(orig), seg = ex ? resetOrientation(ex) : buildExif(p);
  if (seg && seg.length < 65000) { const out = new Uint8Array(jpg.length + seg.length); out.set(jpg.subarray(0, 2)); out.set(seg, 2); out.set(jpg.subarray(2), 2 + seg.length); jpg = out; }
  if (jpg.length > orig.length * 0.9) return null;
  return { bytes: jpg, name: /\.jpe?g$/i.test(p.name) ? p.name : p.name.replace(/\.[^.]+$/, "") + ".jpg", px: `${c.width}×${c.height}` };
}

/* Foto in der Auflösung für die Seite: aus dem Original, mit Drehung und Ausschnitt, höchstens so scharf wie das Original.
   op = Bildoperation (w, h in pt), dpi = gewünschte Auflösung. */
async function renderPhotoPx(p, op, dpi) {
  let bmp;
  try { bmp = p.file ? await decodeFile(p.file) : await bitmapOf(p); } catch (e) { bmp = await bitmapOf(p); }
  const v = viewBox(p), f = bmp.width / p.bw;                // f: Pixel des Originals je Pixel der Arbeitskopie
  const need = Math.max(op.w / v.w, op.h / v.h) * dpi / 72;  // Pixel je Pixel der Arbeitskopie für die gewünschte dpi
  const k = Math.min(need, f);
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(v.w * k)); c.height = Math.max(1, Math.round(v.h * k));
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  drawView(g, bmp, p, c.width, c.height); bmp.close && bmp.close();
  return new Uint8Array(await (await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86))).arrayBuffer());
}
