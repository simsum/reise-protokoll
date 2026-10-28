/* ---------- Projektdaten im PDF ----------
   Beim Erstellen hängt buildPdf() Dateien an das PDF an:
     reise-protokoll-projekt.json   alle Einstellungen und Eingaben (ohne Bilddaten)
     0001 <Name>, 0002 …            die Fotos (Original oder Arbeitskopie), `att` in der JSON verweist darauf
     karte.jpg, titelfoto.jpg       Karte und Titelfoto
   Ein solches PDF lässt sich wieder öffnen und weiterbearbeiten. Alles, was aus einem PDF gelesen wird,
   ist unsicher und läuft vor jeder Verwendung durch cleanTrip(). */
const PROJECT_FILE = "reise-protokoll-projekt.json", MAP_FILE = "karte.jpg", COVER_FILE = "titelfoto.jpg";
const FORMAT = 2;

/* ---------- Prüfen unsicherer Daten ---------- */
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const clipStr = (v, n = 4000) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v, a, b, d) => (isNum(v) && v >= a && v <= b ? v : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const cleanIso = (v) => (typeof v === "string" && parseIso(v) ? v : "");
const cleanId = (v, seen) => { const s = typeof v === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(v) && !/^__|^(constructor|prototype)$/.test(v) && !seen.has(v) ? v : uid(); seen.add(s); return s; };
const cleanGeo = (g) => (g && isNum(g.lat) && isNum(g.lon) && Math.abs(g.lat) <= 90 && Math.abs(g.lon) <= 180 ? { lat: g.lat, lon: g.lon } : null);
const cleanPlace = (p) => { const g = cleanGeo(p) || { lat: null, lon: null }; return { name: clipStr(p && p.name, 200), lat: g.lat, lon: g.lon }; };
const cleanCrop = (c) => (c && [c.x, c.y, c.w, c.h].every(isNum) && c.x >= 0 && c.y >= 0 && c.w > 0 && c.h > 0 ? { x: c.x, y: c.y, w: c.w, h: c.h } : null);
function cleanMark(m) {
  if (!m || typeof m !== "object" || !["circle", "arrow", "num"].includes(m.t) || !isNum(m.x) || !isNum(m.y) || typeof m.c !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(m.c)) return null;
  const o = { t: m.t, x: m.x, y: m.y, c: m.c.toUpperCase() };
  if (m.t === "arrow") { if (!isNum(m.x2) || !isNum(m.y2)) return null; o.x2 = m.x2; o.y2 = m.y2; }
  else { if (!isNum(m.r) || m.r <= 0) return null; o.r = m.r; if (m.t === "num") o.note = clipStr(m.note, 500); }
  return o;
}
function cleanWx(x) {
  if (!x || typeof x !== "object" || !["brightsky", "openmeteo"].includes(x.src)) return null;
  const o = { src: x.src, kind: oneOf(x.kind, ["", ...WEATHER.map((w) => w.id)], ""), cond: clipStr(x.cond, 40), model: x.model === "era5" ? "era5" : "", station: clipStr(x.station, 60) };
  for (const k of ["t", "feels", "hum", "wind", "dir", "gust", "rain", "cloud", "press", "dist"]) o[k] = wxNum(x[k]);
  return o;
}
function cleanPhotoMeta(g, seen) {
  g = g && typeof g === "object" ? g : {};
  return {
    id: cleanId(g.id, seen), name: clipStr(g.name, 300) || "Foto", type: clipStr(g.type, 100), mod: num(g.mod, 0, 4e12, 0), size: num(g.size, 0, 1e11, 0),
    att: /^\d{4}$/.test(g.att) ? g.att : null, shrunk: !!g.shrunk, day: cleanIso(g.day), time: /^\d\d:\d\d:\d\d$/.test(g.time) ? g.time : "", dayFromFile: !!g.dayFromFile,
    gps: cleanGeo(g.gps), note: clipStr(g.note, 1000), rot: oneOf(g.rot, [0, 1, 2, 3], 0), crop: cleanCrop(g.crop),
    marks: (Array.isArray(g.marks) ? g.marks : []).slice(0, 300).map(cleanMark).filter(Boolean), bw: num(g.bw, 1, 20000, 0), bh: num(g.bh, 1, 20000, 0),
    wx: cleanWx(g.wx), weather: clipStr(g.weather, 300), weatherSrc: oneOf(g.weatherSrc, ["", "brightsky", "openmeteo", "manual"], ""),
    place: clipStr(g.place, 500), placeSrc: oneOf(g.placeSrc, ["", "osm", "offline", "manual"], ""), sha: typeof g.sha === "string" && /^[0-9a-f]{64}$/.test(g.sha) ? g.sha : "",
  };
}
function cleanTile(x, cols, seen) {
  x = x && typeof x === "object" ? x : {};
  const o = { id: cleanId(x.id, seen), mod: oneOf(x.mod, Object.keys(MODULES), "leer"), w: clamp(Math.round(x.w) || 1, 1, cols), h: clamp(Math.round(x.h) || 1, 1, GRID_ROWS) };
  if (typeof x.photo === "string" && /^[A-Za-z0-9_-]{1,24}$/.test(x.photo)) o.photo = x.photo;
  if (typeof x.text === "string") o.text = clipStr(x.text, 4000);
  if (Object.keys(FAMILIES).includes(x.font)) o.font = x.font;
  if (x.sym === "auto" || SYMBOLS.some((q) => q.id === x.sym)) o.sym = x.sym;
  const fx = MODULES[o.mod] && MODULES[o.mod].fixed; if (fx) { o.w = fx[0]; o.h = fx[1]; }
  return o;
}
const cleanPage = (pg, cols, seen) => ({ id: cleanId(pg && pg.id, seen), tiles: (pg && Array.isArray(pg.tiles) ? pg.tiles : []).slice(0, 60).map((x) => cleanTile(x, cols, seen)) });

function cleanTrip(j) {
  if (!j || typeof j !== "object" || j.app !== "Reise-Protokoll" || !j.trip || typeof j.trip !== "object") return null;
  const t = j.trip, cols = oneOf(+t.cols, [3, 4], 4), base = newTrip(), seen = new Set(), photoIds = new Set();
  const r = t.route && typeof t.route === "object" ? t.route : {};
  const out = {
    ...base, cols, theme: oneOf(t.theme, Object.keys(THEMES), "meer"), title: clipStr(t.title, 200), subtitle: clipStr(t.subtitle, 300), travelers: clipStr(t.travelers, 300),
    currency: typeof t.currency === "string" && /^[A-Z]{3}$/.test(t.currency) ? t.currency : "EUR", start: cleanIso(t.start),
    startPlace: cleanPlace(t.startPlace), roundTrip: !!t.roundTrip,
    summary: clipStr(t.summary, 4000), summaryAuto: t.summaryAuto !== false, mapUser: !!t.mapUser, ruled: t.ruled !== false, costPage: t.costPage !== false,
    projData: t.projData !== false, capWeather: t.capWeather !== false, wxLine: !!t.wxLine,
    capNum: !!t.capNum, capDate: !!t.capDate, capPlace: !!t.capPlace, capGps: !!t.capGps, capNote: t.capNote !== false, capMarks: t.capMarks !== false, capFile: !!t.capFile, hashes: !!t.hashes,
    dpi: oneOf(t.dpi, ["110", "150", "220", "300"], "150"), placeMode: oneOf(t.placeMode, ["auto", "offline", "off"], "auto"), photoStyle: oneOf(t.photoStyle, ["shadow", "frame", "plain"], "shadow"), embed: oneOf(t.embed === "work" ? "1600" : t.embed, ["original", "3200", "2400", "1600"], "original"),
    mapSource: oneOf(t.mapSource, ["", "osm", "osmde", "esri"], ""), mapW: num(t.mapW, 1, 20000, 0), mapH: num(t.mapH, 1, 20000, 0), coverW: num(t.coverW, 1, 20000, 0), coverH: num(t.coverH, 1, 20000, 0),
    hasMap: !!t.hasMap, hasCover: !!t.hasCover,
    route: {
      auto: r.auto !== false, road: r.road !== false, km: num(r.km, 0, 1e6, null), mapSig: clipStr(r.mapSig, 4000),
      legs: (Array.isArray(r.legs) ? r.legs : []).slice(0, 300).map((l) => ({ km: num(l && l.km, 0, 1e6, 0), min: num(l && l.min, 0, 1e6, 0) })),
      points: (Array.isArray(r.points) ? r.points : []).slice(0, 300).map((p) => ({ id: cleanId(p && p.id, seen), ...cleanPlace(p), day: Number.isInteger(p && p.day) ? p.day : -1, via: !!(p && p.via) })).filter((p) => p.name),
    },
    days: (Array.isArray(t.days) ? t.days : []).slice(0, 400).map((d) => {
      d = d && typeof d === "object" ? d : {};
      return {
        id: cleanId(d.id, seen), date: cleanIso(d.date), place: cleanPlace(d.place), from: clipStr(d.from, 200), km: clipStr(d.km, 20), drive: clipStr(d.drive, 20),
        title: clipStr(d.title, 200), lodging: clipStr(d.lodging, 200), lodgingKind: oneOf(d.lodgingKind, ["unterkunft", "stellplatz"], "unterkunft"), campNote: clipStr(d.campNote, 100),
        camp: Object.fromEntries(CAMP_OPTS.map(([id]) => [id, !!(d.camp && typeof d.camp === "object" && d.camp[id] === true)])), weather: oneOf(d.weather, ["", ...WEATHER.map((w) => w.id)], ""), tmin: clipStr(d.tmin, 12), tmax: clipStr(d.tmax, 12), wxAuto: typeof d.wxAuto === "boolean" ? d.wxAuto : null, wxExtra: clipStr(d.wxExtra, 300),
        text: clipStr(d.text, 20000), plan: clipStr(d.plan, 8000), highlights: clipStr(d.highlights, 4000),
        costs: (Array.isArray(d.costs) ? d.costs : []).slice(0, 200).map((c) => ({ id: cleanId(c && c.id, seen), l: clipStr(c && c.l, 200), cat: oneOf(c && c.cat, CATS.map((k) => k.id), "sonstiges"), a: clipStr(c && c.a, 20) })),
        photos: (Array.isArray(d.photos) ? d.photos : []).slice(0, 500).map((g) => cleanPhotoMeta(g, photoIds)),
        pages: Array.isArray(d.pages) ? d.pages.slice(0, 40).map((pg) => cleanPage(pg, cols, seen)) : defaultPages(cols),
      };
    }),
  };
  out.days.forEach((d) => { const used = new Set(); d.pages.forEach((pg) => pg.tiles.forEach((x) => { if (x.photo) { if (used.has(x.photo)) delete x.photo; else used.add(x.photo); } })); }); // ein Foto nur einmal pro Tag
  out.route.points.forEach((p) => { p.lat = Number.isFinite(p.lat) ? p.lat : null; p.lon = Number.isFinite(p.lon) ? p.lon : null; });
  return out;
}

/* ---------- Schreiben ---------- */
function jsonOfTrip(t, attOf, shrunkOf) {
  // Bilddaten gehören nicht in die JSON (sie stehen als Anhänge im PDF); `src` nur bei Fotos weglassen (die Wetterquelle heißt auch so)
  const o = JSON.parse(JSON.stringify(t, function (k, v) {
    if (k === "mapImg" || k === "coverPhoto") return undefined;
    if ((k === "src" || k === "vsrc" || k === "file") && typeof this.bw === "number") return undefined;
    return v;
  }));
  o.days.forEach((d) => d.photos.forEach((p) => { p.att = attOf.get(p.id) || null; p.shrunk = !!shrunkOf.get(p.id); }));
  o.hasMap = !!t.mapImg; o.hasCover = !!t.coverPhoto;
  return { app: "Reise-Protokoll", format: FORMAT, created: new Date().toISOString(), trip: o };
}

/* Alle Anhänge der Reise: Projektdaten, Fotos, Karte, Titelfoto */
async function collectAttachments(t, onProgress) {
  const list = [], attOf = new Map(), shrunkOf = new Map(), photos = t.days.flatMap((d) => d.photos), edge = t.embed === "original" ? 0 : +t.embed;
  let n = 0;
  for (const p of photos) {
    n++;
    const nr = String(n).padStart(4, "0");
    let bytes = null, mime = "image/jpeg", name = p.name || "Foto", rel = "Alternative", px = "";
    if (p.file) {
      if (edge) {
        const c = await compressOriginal(p, edge).catch((e) => { console.warn(e); return null; });
        if (c) { bytes = c.bytes; name = c.name; px = c.px; }
      }
      if (!bytes) { bytes = new Uint8Array(await p.file.arrayBuffer()); mime = p.type || "application/octet-stream"; rel = "Source"; }
    } else {
      bytes = bytesOfDataUrl(p.src);
      if (!/\.jpe?g$/i.test(name)) name = name.replace(/\.[^.]+$/, "") + ".jpg";
    }
    const shrunk = rel === "Alternative";
    const desc = ["Foto " + n, p.day ? fmtDate(p.day, { day: "numeric", month: "long", year: "numeric" }) : "", p.time ? p.time.slice(0, 5) + " Uhr" : "", p.place, p.gps ? gpsText(p.gps) : "",
      shrunk ? `verkleinert${px ? " (" + px + ")" : ""}` : "Originaldatei", p.sha ? "SHA-256 Original: " + p.sha : ""].filter(Boolean).join(" · ");
    attOf.set(p.id, nr); shrunkOf.set(p.id, shrunk);
    list.push({ name: `${nr} ${name}`, bytes, mime, desc, rel, pid: p.id });
    if (onProgress) onProgress(n, photos.length);
  }
  if (t.mapImg) list.push({ name: MAP_FILE, bytes: bytesOfDataUrl(t.mapImg), mime: "image/jpeg", desc: "Karte der Deckseite", rel: "Data" });
  if (t.coverPhoto) list.push({ name: COVER_FILE, bytes: bytesOfDataUrl(t.coverPhoto), mime: "image/jpeg", desc: "Titelfoto der Deckseite", rel: "Data" });
  const json = new TextEncoder().encode(JSON.stringify(jsonOfTrip(t, attOf, shrunkOf)));
  list.unshift({ name: PROJECT_FILE, bytes: json, mime: "application/json", desc: "Bearbeitungsdaten von Reise-Protokoll (Einstellungen, Tage, Notizen, Markierungen). Das PDF in Reise-Protokoll öffnen, um es weiterzubearbeiten.", rel: "Data" });
  return list;
}

/* ---------- Lesen ---------- */
async function readPdfAttachments(bytes) {
  const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream } = PDFLib;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const names = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict), tree = names && names.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
  const out = [], text = (o) => (o && typeof o.decodeText === "function" ? o.decodeText() : "");
  const walk = (node, depth) => {
    if (!node || depth > 8) return;
    const arr = node.lookupMaybe(PDFName.of("Names"), PDFArray);
    if (arr) for (let i = 0; i + 1 < arr.size(); i += 2) {
      const spec = arr.lookupMaybe(i + 1, PDFDict), ef = spec && spec.lookupMaybe(PDFName.of("EF"), PDFDict), st = ef && ef.lookup(PDFName.of("F"));
      if (!(st instanceof PDFRawStream)) continue;
      let data; try { data = decodePDFRawStream(st).decode(); } catch (e) { continue; }
      out.push({ name: text(spec.lookup(PDFName.of("UF"))) || text(arr.lookup(i)), bytes: data });
    }
    const kids = node.lookupMaybe(PDFName.of("Kids"), PDFArray);
    if (kids) for (let i = 0; i < kids.size(); i++) walk(kids.lookupMaybe(i, PDFDict), depth + 1);
  };
  walk(tree, 0);
  return out;
}

const looksJpeg = (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/* Liest ein Projekt-PDF und liefert die fertige Reise (mit Fotos). Wirft eine Fehlermeldung als Text. */
async function readProjectPdf(file, onProgress) {
  if (!window.PDFLib) throw new Error("Die PDF-Bibliothek konnte nicht geladen werden (Internet nötig).");
  let found;
  try { found = await readPdfAttachments(new Uint8Array(await file.arrayBuffer())); }
  catch (e) { throw new Error("Das PDF konnte nicht gelesen werden."); }
  const pe = found.find((a) => a.name === PROJECT_FILE);
  if (!pe) throw new Error("In diesem PDF stehen keine Bearbeitungsdaten. Sie fehlen, wenn die Option „Bearbeitungsdaten im PDF speichern“ aus war oder ein anderes Programm das PDF verändert hat.");
  let raw;
  try { raw = JSON.parse(new TextDecoder().decode(pe.bytes)); } catch (e) { throw new Error("Die Bearbeitungsdaten im PDF sind beschädigt."); }
  if (isNum(raw.format) && raw.format > FORMAT) throw new Error("Dieses PDF stammt aus einer neueren Version von Reise-Protokoll. Bitte die Seite aktualisieren.");
  const t = cleanTrip(raw);
  if (!t) throw new Error("Das PDF ist kein Reise-Protokoll.");

  const asUrl = async (name) => { const a = found.find((x) => x.name === name); return a && looksJpeg(a.bytes) ? blobToDataUrl(new Blob([a.bytes], { type: "image/jpeg" })) : ""; };
  t.mapImg = t.hasMap ? await asUrl(MAP_FILE) : ""; t.coverPhoto = t.hasCover ? await asUrl(COVER_FILE) : "";
  if (!t.mapImg) t.mapW = t.mapH = 0;
  if (!t.coverPhoto) t.coverW = t.coverH = 0;
  delete t.hasMap; delete t.hasCover;

  const metas = t.days.flatMap((d) => d.photos), total = metas.length;
  let done = 0, missing = 0, unreadable = 0;
  for (const d of t.days) {
    const list = [];
    for (const m of d.photos) {
      const a = m.att && found.find((x) => x.name.startsWith(m.att + " "));
      if (!a) { missing++; done++; continue; }
      try {
        const f = new File([a.bytes], m.name, { type: m.shrunk ? "image/jpeg" : m.type, lastModified: m.mod || Date.now() });
        const p = await makePhoto(f, m);
        await refreshView(p);
        list.push(p);
      } catch (e) { console.warn(e); unreadable++; }
      if (onProgress) onProgress(++done, total);
    }
    d.photos = list;
  }
  t.route.mapSig = t.route.mapSig || "";
  return { trip: t, missing, unreadable, total };
}
