/* ---------- Fotos ----------
   Ein Foto hat die Originaldatei (`file`, bleibt unverändert) und eine Arbeitskopie `src`
   (JPEG, höchstens PHOTO_EDGE px) für Vorschau und Seiten. Aus EXIF kommen Aufnahmetag, -zeit und GPS.

   Ansicht: Drehen (rot, 0–3 × 90° im Uhrzeigersinn) und Ausschnitt (crop, in Pixeln des gedrehten Bildes)
   ändern nur die Ansicht `vsrc`. Markierungen (marks) liegen in Pixeln der Arbeitskopie (bw × bh) und werden
   mit viewMarks() in die Ansicht umgerechnet. p.w × p.h ist die Größe der Ansicht. */
const PHOTO_EDGE = 1600;
const isHeic = (f) => /heic|heif/i.test(f.type || "") || /\.(heic|heif)$/i.test(f.name || "");
const isPdfFile = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name || "");
const isImageFile = (f) => /^image\//.test(f.type || "") || /\.(jpe?g|png|webp|heic|heif|tiff?)$/i.test(f.name || "");

let heicLib = null;
function loadHeic() {
  if (heicLib) return heicLib;
  heicLib = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
    s.onload = () => (window.heic2any ? res(window.heic2any) : rej(new Error("heic2any fehlt")));
    s.onerror = () => rej(new Error("HEIC-Konverter nicht ladbar"));
    document.head.appendChild(s);
  });
  return heicLib;
}

async function decodeFile(file) {
  try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch (e) {
    if (!isHeic(file)) throw e;
    let out = await (await loadHeic())({ blob: file, toType: "image/jpeg", quality: 0.95 });
    if (Array.isArray(out)) out = out[0];
    return createImageBitmap(out, { imageOrientation: "from-image" });
  }
}

const blobToDataUrl = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const dataUrlToBlob = (u) => fetch(u).then((r) => r.blob());

const exifParts = (raw) => {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(raw || ""));
  return m ? { day: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}:${m[6]}` } : null;
};

/* Foto aus einer Datei; `meta` (aus einem Projekt-PDF) ersetzt das Lesen von EXIF. */
async function makePhoto(file, meta) {
  const bmp = await decodeFile(file);
  const s = Math.min(1, PHOTO_EDGE / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(bmp.width * s)); cv.height = Math.max(1, Math.round(bmp.height * s));
  const g = cv.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close && bmp.close();
  const reuse = meta && meta.shrunk && s === 1 && file.type === "image/jpeg";
  const p = {
    id: uid(), name: file.name || "Foto", type: file.type || "", mod: file.lastModified || 0, size: file.size || 0, file,
    src: reuse ? await blobToDataUrl(file) : cv.toDataURL("image/jpeg", 0.85), bw: cv.width, bh: cv.height, w: cv.width, h: cv.height, vsrc: "",
    gps: null, day: "", time: "", dayFromFile: false, note: "", rot: 0, crop: null, marks: [],
    wx: null, weather: "", weatherSrc: "", wxTried: false,
  };
  if (meta) return applyPhotoMeta(p, meta);
  let ex = null;
  if (window.exifr) {
    try { const g2 = await exifr.gps(file); if (g2 && Number.isFinite(g2.latitude) && !(g2.latitude === 0 && g2.longitude === 0)) p.gps = { lat: g2.latitude, lon: g2.longitude }; } catch (e) { /* kein GPS */ }
    try { const x = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"], reviveValues: false }); ex = exifParts(x && (x.DateTimeOriginal || x.CreateDate)); } catch (e) { /* kein Datum */ }
  }
  if (!ex && file.lastModified) {
    const d = new Date(file.lastModified), q = (n) => String(n).padStart(2, "0");
    ex = { day: `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`, time: `${q(d.getHours())}:${q(d.getMinutes())}:${q(d.getSeconds())}` };
    p.dayFromFile = true;
  }
  if (ex) { p.day = ex.day; p.time = ex.time; }
  return p;
}

/* Gespeicherte Angaben übernehmen; Markierungen und Ausschnitt an die Größe der Arbeitskopie anpassen. */
function applyPhotoMeta(p, m) {
  p.id = m.id || p.id; p.name = m.name || p.name; p.gps = m.gps; p.day = m.day; p.time = m.time; p.dayFromFile = !!m.dayFromFile; p.note = m.note;
  p.rot = m.rot; p.wx = m.wx; p.weather = m.weather; p.weatherSrc = m.weatherSrc; p.wxTried = !!(m.wx || m.weather);
  const f = m.bw > 0 ? p.bw / m.bw : 1;
  const sc = (o) => { const q = { ...o }; for (const k of ["x", "y", "x2", "y2", "r"]) if (k in q) q[k] = q[k] * f; return q; };
  p.marks = m.marks.map(sc);
  p.crop = m.crop ? { x: m.crop.x * f, y: m.crop.y * f, w: m.crop.w * f, h: m.crop.h * f } : null;
  const [rw, rh] = rotDims(p);
  if (p.crop && (p.crop.x + p.crop.w > rw + 1 || p.crop.y + p.crop.h > rh + 1)) p.crop = null;
  applyView(p);
  return p;
}

/* ---------- Ansicht: Drehen und Ausschnitt ---------- */
const rotDims = (p) => (p.rot % 2 ? [p.bh, p.bw] : [p.bw, p.bh]);
const toRot = (p, x, y) => (p.rot === 1 ? [p.bh - y, x] : p.rot === 2 ? [p.bw - x, p.bh - y] : p.rot === 3 ? [y, p.bw - x] : [x, y]);
const fromRot = (p, x, y) => (p.rot === 1 ? [y, p.bh - x] : p.rot === 2 ? [p.bw - x, p.bh - y] : p.rot === 3 ? [p.bw - y, x] : [x, y]);
function viewBox(p, full) { const [rw, rh] = rotDims(p); return full || !p.crop ? { x: 0, y: 0, w: rw, h: rh } : p.crop; }
function applyView(p) { const v = viewBox(p); p.w = v.w; p.h = v.h; }
const mapMark = (m, f) => { const o = { ...m }; [o.x, o.y] = f(m.x, m.y); if (m.t === "arrow") [o.x2, o.y2] = f(m.x2, m.y2); return o; };
function viewMarks(p, full) {
  const v = viewBox(p, full), out = [];
  for (const m of p.marks || []) {
    const q = mapMark(m, (x, y) => { const [a, b] = toRot(p, x, y); return [a - v.x, b - v.y]; });
    if (q.x < 0 || q.y < 0 || q.x > v.w || q.y > v.h) continue; // außerhalb des Ausschnitts
    q.src = m; out.push(q);
  }
  return out;
}
const unviewMark = (p, m, full) => { const v = viewBox(p, full); return mapMark(m, (x, y) => fromRot(p, x + v.x, y + v.y)); };
const NUMS = (p) => viewMarks(p).filter((q) => q.t === "num").map((q) => q.src);
const ROT_T = [[1, 0, 0, 1], [0, 1, -1, 0], [-1, 0, 0, -1], [0, -1, 1, 0]];
function drawView(g, bmp, p, w, h, full) {
  const v = viewBox(p, full), [a, b, c, d] = ROT_T[p.rot];
  g.save(); g.scale(w / v.w, h / v.h); g.translate(-v.x, -v.y);
  g.transform(a, b, c, d, p.rot === 1 ? p.bh : p.rot === 2 ? p.bw : 0, p.rot === 2 ? p.bh : p.rot === 3 ? p.bw : 0);
  g.imageSmoothingQuality = "high"; g.drawImage(bmp, 0, 0, p.bw, p.bh); g.restore();
}
const bitmapOf = async (p) => createImageBitmap(await dataUrlToBlob(p.src));

/* Ansicht neu berechnen (nach Drehen oder Ausschnitt). Ohne beides ist die Ansicht die Arbeitskopie. */
async function refreshView(p) {
  applyView(p);
  if (!p.rot && !p.crop) { p.vsrc = ""; return; }
  const bmp = await bitmapOf(p), v = viewBox(p), k = Math.min(1, PHOTO_EDGE / Math.max(v.w, v.h));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(v.w * k)); c.height = Math.max(1, Math.round(v.h * k));
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  drawView(g, bmp, p, c.width, c.height); bmp.close();
  p.vsrc = c.toDataURL("image/jpeg", 0.88);
}
/* Bild, Breite und Höhe der Ansicht für das Seitenlayout */
const photoView = (p) => ({ src: p.vsrc || p.src, w: p.w || p.bw, h: p.h || p.bh });

async function rotatePhoto(p, dir) { // dir: +1 im Uhrzeigersinn, -1 dagegen
  const [rw, rh] = rotDims(p), c = p.crop;
  if (c) p.crop = dir > 0 ? { x: rh - c.y - c.h, y: c.x, w: c.h, h: c.w } : { x: c.y, y: rw - c.x - c.w, w: c.h, h: c.w };
  p.rot = (p.rot + dir + 4) % 4;
  await refreshView(p);
}
async function setCrop(p, c) {
  const [rw, rh] = rotDims(p);
  if (c) {
    const x = Math.max(0, Math.round(c.x)), y = Math.max(0, Math.round(c.y));
    c = { x, y, w: Math.min(rw - x, Math.round(c.w)), h: Math.min(rh - y, Math.round(c.h)) };
    if (c.w < rw * 0.05 || c.h < rh * 0.05 || (c.w >= rw && c.h >= rh)) c = null;
  }
  p.crop = c;
  await refreshView(p);
}

/* ---------- Markierungen (Geometrie wie im Foto-Protokoll) ---------- */
const haloOf = (c) => (c === "#FFC400" ? "#1A1A1A" : "#FFFFFF");
const numInk = (c) => (c === "#FFC400" ? "#1A1A1A" : "#FFFFFF");
const rnd = (n) => +n.toFixed(1);
const circlePath = (x, y, R) => `M${rnd(x - R)} ${rnd(y)}A${rnd(R)} ${rnd(R)} 0 1 0 ${rnd(x + R)} ${rnd(y)}A${rnd(R)} ${rnd(R)} 0 1 0 ${rnd(x - R)} ${rnd(y)}Z`;
function markGeom(m, p) {
  const base = Math.min(p.bw || 1000, p.bh || 750), sw = Math.max(2, base * 0.0085);
  if (m.t === "num") return { sw, num: true, r: Math.max(m.r, sw * 3) };
  if (m.t === "circle") return { sw, stroke: [circlePath(m.x, m.y, Math.max(m.r, sw * 2))], fill: [] };
  const dx = m.x - m.x2, dy = m.y - m.y2, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  const hl = Math.min(sw * 4.4, len * 0.6), hw = hl * 0.78;
  const bx = m.x - ux * hl, by = m.y - uy * hl, sx = m.x - ux * hl * 0.7, sy = m.y - uy * hl * 0.7;
  return {
    sw, stroke: [`M${rnd(m.x2)} ${rnd(m.y2)}L${rnd(sx)} ${rnd(sy)}`],
    fill: [`M${rnd(m.x)} ${rnd(m.y)}L${rnd(bx - uy * hw / 2)} ${rnd(by + ux * hw / 2)}L${rnd(bx + uy * hw / 2)} ${rnd(by - ux * hw / 2)}Z`],
  };
}

/* Markierungen für die Bearbeitungsansicht als SVG-Inhalt (Koordinaten der Ansicht) */
function marksSvgInner(p, opt = {}) {
  const vm = viewMarks(p, opt.full); if (opt.extra) vm.push(opt.extra);
  const nums = vm.filter((q) => q.t === "num"); let a = "", b = "";
  for (const m of vm) {
    const g = markGeom(m, p), halo = haloOf(m.c), hw = g.sw * 2.2;
    if (g.num) {
      const n = nums.indexOf(m) + 1, fs = (g.r * 1.3).toFixed(1);
      a += `<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="${g.r.toFixed(1)}" fill="${halo}" fill-opacity=".85" stroke="${halo}" stroke-opacity=".85" stroke-width="${(g.sw * 2.4).toFixed(1)}"/>`;
      b += `<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="${g.r.toFixed(1)}" fill="${m.c}"/><text x="${m.x.toFixed(1)}" y="${m.y.toFixed(1)}" dy=".36em" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="${fs}" fill="${numInk(m.c)}">${n}</text>`;
      continue;
    }
    g.stroke.forEach((d) => { a += `<path d="${d}" fill="none" stroke="${halo}" stroke-opacity=".85" stroke-width="${hw}" stroke-linecap="round"/>`; b += `<path d="${d}" fill="none" stroke="${m.c}" stroke-width="${g.sw}" stroke-linecap="round"/>`; });
    g.fill.forEach((d) => { a += `<path d="${d}" fill="${halo}" fill-opacity=".85" stroke="${halo}" stroke-opacity=".85" stroke-width="${hw - g.sw}" stroke-linejoin="round"/>`; b += `<path d="${d}" fill="${m.c}"/>`; });
  }
  return a + b;
}

/* ---------- Nominatim (OpenStreetMap): Suche und Ortsname, höchstens eine Anfrage pro Sekunde ---------- */
let nomChain = Promise.resolve();
function nominatim(path) {
  const run = () => fetch("https://nominatim.openstreetmap.org/" + path, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) })
    .then((r) => { if (!r.ok) throw new Error("Nominatim " + r.status); return r.json(); });
  const p = nomChain.then(run, run);
  nomChain = p.then(() => new Promise((r) => setTimeout(r, 1100)), () => new Promise((r) => setTimeout(r, 1100)));
  return p;
}
const placeNameOf = (r) => {
  const a = r.address || {};
  return a.city || a.town || a.village || a.municipality || a.hamlet || a.county || r.name || String(r.display_name || "").split(",")[0];
};
async function searchPlace(q) {
  const r = await nominatim(`search?format=jsonv2&addressdetails=1&limit=6&accept-language=de&q=${encodeURIComponent(q)}`);
  return r.map((x) => ({ name: placeNameOf(x) || q, lat: +x.lat, lon: +x.lon, info: x.display_name }));
}
async function reversePlace(lat, lon) {
  const r = await nominatim(`reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=de&lat=${lat}&lon=${lon}`);
  return placeNameOf(r) || "";
}
