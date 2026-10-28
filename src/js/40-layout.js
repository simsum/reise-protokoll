/* ---------- Seitenmodell ----------
   Aus der Reise entsteht eine Liste von Seiten {W, H, ops}. Maße in Punkt
   (1/72 Zoll), Ursprung oben links. Vorschau (pageHtml) und PDF (buildPdf)
   zeichnen beide nur aus diesem Modell – es gibt keine zweite Layout-Logik.

   Operationen (k):
     rect  {x,y,w,h,fill,fo,stroke,sw,r}       Rechteck, optional abgerundet (fo = Deckkraft der Füllung)
     line  {x1,y1,x2,y2,c,sw}                  Linie
     t     {x,y,text,s,f,c,a,ls}               Text; y = Oberkante, a = l|c|r, ls = Buchstabenabstand
     path  {x,y,w,h,vw,vh,d,fill,stroke,sw}    SVG-Pfad im Raster vw×vh (Symbole)
     link  {x,y,w,h,url}                       klickbarer Bereich (nur feste oder streng geprüfte Adressen: Projektseite, Wikipedia-Artikel)
     img   {x,y,w,h,src,iw,ih,pid,r}           Bild, füllt den Rahmen (zugeschnitten, Ecken r); pid = Foto-ID (Büroklammer im PDF)         */
const PW = 595.28, PH = 841.89, MX = 40, CW = PW - 2 * MX, BOTTOM = 790;
const PROJECT_URL = "https://github.com/simsum/reise-protokoll", PROJECT_LABEL = "Reise-Protokoll · github.com/simsum/reise-protokoll";

class Pg {
  constructor(T) {
    this.W = PW; this.H = PH; this.ops = []; this.T = T;
    if (T.paper.toUpperCase() !== "#FFFFFF") this.rect(0, 0, PW, PH, { fill: T.paper });
  }
  rect(x, y, w, h, o = {}) { this.ops.push({ k: "rect", x, y, w, h, fill: o.fill || null, stroke: o.stroke || null, sw: o.sw || 0.6, r: Math.min(o.r || 0, w / 2, h / 2), fo: o.fo }); }
  /* weicher Schatten: mehrere schwach deckende Rechtecke, nach unten versetzt */
  shadow(x, y, w, h, r = 0) { for (let i = 1; i <= 7; i++) { const e = i * 0.85; this.rect(x - e, y - e + 1.8, w + 2 * e, h + 2 * e, { fill: "#000000", fo: 0.032, r: r + e }); } }
  line(x1, y1, x2, y2, c, sw = 0.6) { this.ops.push({ k: "line", x1, y1, x2, y2, c, sw }); }
  text(x, y, text, o = {}) {
    this.ops.push({ k: "t", x, y, text: clean(text), s: o.s || 10, f: o.f || "R", c: o.c || this.T.ink, a: o.a || "l", ls: o.ls || 0 });
  }
  link(x, y, w, h, url) { this.ops.push({ k: "link", x, y, w, h, url }); }
  icon(name, x, y, s, c, sw = 1.6) { this.ops.push({ k: "path", x, y, w: s, h: s, vw: 24, vh: 24, d: ICONS[name] || ICONS.sun, fill: null, stroke: c, sw }); }
  img(x, y, w, h, src, iw, ih, pid, r = 0) { this.ops.push({ k: "img", x, y, w, h, src, iw: iw || w, ih: ih || h, pid, r }); }
  label(x, y, text, c, a) { this.text(x, y, String(text).toUpperCase(), { f: "B", s: 7.5, c: c || this.T.accent, ls: 1.4, a }); }
}

/* ---------- Kopf für Folgeseiten (Fortsetzung, Fotos, Kosten) ---------- */
function miniHeader(pg, kicker, title) {
  pg.label(MX, 40, kicker);
  pg.text(MX, 54, fitT(title, "SB", 20, CW), { f: "SB", s: 20 });
  pg.line(MX, 86, PW - MX, 86, pg.T.rule, 0.8);
  return 106;
}

/* ---------- Deckseite ---------- */
function coverPage(t, st, T, warns) {
  const pg = new Pg(T);
  const BAND = 290;
  const photo = !!t.coverPhoto;
  if (photo) pg.img(0, 0, PW, BAND, t.coverPhoto, t.coverW, t.coverH);
  else {
    pg.rect(0, 0, PW, BAND, { fill: T.accent });
    pg.icon("pin", PW - MX - 190, 62, 190, mix(T.accent, "#FFFFFF", 0.14), 0.9); /* Dekor */
  }
  const soft = mix(T.accent, "#FFFFFF", 0.78);
  pg.text(MX, 44, "REISEPROTOKOLL", { f: "B", s: 8, c: soft, ls: 1.8 });
  if (st.range) pg.text(PW - MX, 44, st.range, { f: "B", s: 9, c: T.onAccent, a: "r" });

  /* Titel so groß wie möglich (höchstens zwei Zeilen bei großer, drei bei kleiner Schrift) */
  const ttl = t.title.trim() || "Meine Reise";
  let ts = 32, title = wrapMax(ttl, "SB", 32, CW, 3).lines;
  for (const sz of [58, 50, 44, 38]) {
    const l = wrapAll(ttl, "SB", sz, CW);
    if (l.length <= (sz >= 44 ? 2 : 3)) { ts = sz; title = l; break; }
  }
  const tl = ts * 1.1;
  const sub = t.subtitle.trim() ? wrapMax(t.subtitle, "SI", 16, CW, 2).lines : [];
  const blockH = title.length * tl + (sub.length ? 10 + sub.length * 20 : 0);
  const top = Math.max(96, 266 - blockH);
  pg.rect(MX, top - 18, 44, 3, { fill: T.accent2 });
  title.forEach((l, k) => pg.text(MX, top + k * tl, l, { f: "SB", s: ts, c: T.onAccent }));
  sub.forEach((l, k) => pg.text(MX, top + title.length * tl + 10 + k * 20, l, { f: "SI", s: 16, c: soft }));

  /* Kennzahlen */
  const stats = defaultStats(t, st).slice(0, 4);
  const gap = 12, cw = (CW - gap * (stats.length - 1)) / stats.length, sy = BAND + 22;
  stats.forEach((c, k) => {
    const x = MX + k * (cw + gap);
    pg.rect(x, sy, cw, 64, { fill: T.soft, r: 8 });
    pg.text(x + 12, sy + 12, fitT(c.v, "SB", 21, cw - 24), { f: "SB", s: 21, c: T.accent });
    pg.text(x + 12, sy + 45, fitT(c.l.toUpperCase(), "B", 6.8, cw - 24, 1), { f: "B", s: 6.8, c: T.muted, ls: 1 });
  });

  /* Karte */
  const my = sy + 64 + 18, mh = 220;
  if (t.mapImg) {
    if (t.photoStyle === "shadow") pg.shadow(MX, my, CW, mh, 6);
    pg.img(MX, my, CW, mh, t.mapImg, t.mapW, t.mapH, undefined, t.photoStyle === "shadow" ? 6 : 0);
    if (t.photoStyle !== "shadow") pg.rect(MX, my, CW, mh, { stroke: T.rule, sw: 0.8 });
  } else {
    pg.rect(MX, my, CW, mh, { fill: T.soft, r: 8 });
    pg.icon("pin", PW / 2 - 14, my + mh / 2 - 26, 28, T.muted, 1.4);
    pg.text(PW / 2, my + mh / 2 + 10, "Karte noch nicht erzeugt (Reiter „Karte“)", { s: 9, c: T.muted, a: "c" });
    warns.push("Die Karte für die Deckseite fehlt noch (Reiter „Karte“).");
  }
  const pts = t.route.points.filter((p) => !p.via).map((p) => p.name).filter(Boolean); // Routenpunkte ohne Anzeige bleiben weg
  if (pts.length) pg.text(MX, my + mh + 7, fitT(pts.join("  –  "), "R", 8, CW), { s: 8, c: T.muted });

  /* Zusammenfassung */
  const zy = my + mh + 34;
  pg.label(MX, zy, "Zusammenfassung");
  pg.line(MX + 100, zy + 4, PW - MX, zy + 4, T.rule);
  const sum = wrapMax(t.summary.trim() || "–", "S", 11, CW, 6);
  sum.lines.forEach((l, k) => pg.text(MX, zy + 20 + k * 16, l, { f: "S", s: 11 }));
  if (sum.cut) warns.push("Die Zusammenfassung ist für die Deckseite zu lang und wird abgeschnitten (höchstens 6 Zeilen).");
  /* Reisende */
  if (t.travelers.trim()) {
    pg.label(MX, zy + 20 + 6 * 16 + 6, "Reisende");
    pg.text(MX, zy + 20 + 6 * 16 + 19, fitT(t.travelers.trim(), "S", 11, CW), { f: "S", s: 11 });
  }
  return pg;
}

/* Kennzahlen der Deckseite: Dauer immer, dann was vorhanden ist (Ziel/Stationen, Strecke, Kosten, Fotos, Temperatur), höchstens vier */
function defaultStats(t, st) {
  const list = [{ v: `${st.nDays} ${st.nDays === 1 ? "Tag" : "Tage"}`, l: st.nDays > 1 ? `Dauer · ${st.nights} Nächte` : "Dauer" }];
  if (st.places.length === 1) list.push({ v: st.places[0], l: "Reiseziel" });
  else if (st.places.length > 1) list.push({ v: String(st.places.length), l: "Stationen" });
  if (st.km) list.push({ v: (st.kmEst ? "~" : "") + fmtNum(st.km) + " km", l: "Strecke" });
  if (st.cost > 0) list.push({ v: money(st.cost, t.currency), l: "Kosten" });
  if (st.photos) list.push({ v: String(st.photos), l: st.photos === 1 ? "Foto" : "Fotos" });
  if (st.avgT != null) list.push({ v: fmtNum(st.avgT) + " °C", l: "Ø Temperatur" });
  return list;
}

/* ---------- Tagesseiten ----------
   Kopf (nur auf der ersten Seite des Tages) und darunter das Kachelraster. Jede Seite des Tages (day.pages) wird gepackt;
   was nicht mehr passt, läuft auf eine zusätzliche Seite direkt dahinter. */
function dayHeader(pg, t, i, T, title) {
  const d = t.days[i];
  pg.rect(MX, 40, 56, 56, { fill: T.accent, r: 10 });
  pg.text(MX + 28, 50, "TAG", { f: "B", s: 6.5, c: mix(T.accent, "#FFFFFF", 0.75), a: "c", ls: 1.5 });
  pg.text(MX + 28, 60, String(i + 1), { f: "SB", s: i + 1 > 99 ? 20 : 26, c: T.onAccent, a: "c" });
  const hx = MX + 74, hw = CW - 74;
  pg.text(hx, 42, (fmtLong(d.date) || "Tag " + (i + 1)).toUpperCase(), { f: "B", s: 7.5, c: T.muted, ls: 1.2 });
  pg.text(hx, 56, fitT(title, "SB", 21, hw), { f: "SB", s: 21 });
  const sub = daySub(t, i);
  if (sub) pg.text(hx, 83, fitT(sub, "B", 10, hw), { f: "B", s: 10, c: T.accent });
  pg.line(MX, 110, PW - MX, 110, T.rule, 0.8);
  return 124;
}

function dayPages(t, i, T, warns, st) {
  const d = t.days[i], out = [], title = d.title.trim() || "Tag " + (i + 1), queue = d.pages.map((p) => ({ id: p.id, tiles: p.tiles })), gap = 10;
  if (!queue.length) queue.push({ id: null, tiles: [] });
  const colW = (CW - gap * (t.cols - 1)) / t.cols;
  for (let k = 0; k < queue.length && k < 40; k++) {
    const pg = new Pg(T); out.push(pg);
    const top = k === 0 ? dayHeader(pg, t, i, T, title) : miniHeader(pg, `Tag ${i + 1} · Seite ${k + 1}`, title);
    const rowH = (BOTTOM - top - gap * (GRID_ROWS - 1)) / GRID_ROWS, { placed, rest } = packTiles(queue[k].tiles, t.cols, GRID_ROWS);
    if (rest.length) { queue.splice(k + 1, 0, { id: queue[k].id, tiles: rest, spill: true }); warns.push(`Tag ${i + 1}: ${rest.length} ${rest.length === 1 ? "Kachel passt" : "Kacheln passen"} nicht auf die Seite und ${rest.length === 1 ? "steht" : "stehen"} auf einer zusätzlichen Seite.`); }
    /* Maße für die Bedienung in der Vorschau (82-preview.js), nicht Teil des PDFs */
    pg.meta = { dayId: d.id, pageId: queue[k].id, pageIdx: d.pages.findIndex((p) => p.id === queue[k].id), spill: !!queue[k].spill, cols: t.cols, rows: GRID_ROWS, x0: MX, y0: top, colW, rowH, gap, tiles: [] };
    for (const q of placed) {
      const r = { x: MX + q.c * (colW + gap), y: top + q.r * (rowH + gap), w: q.w * colW + (q.w - 1) * gap, h: q.h * rowH + (q.h - 1) * gap };
      const mt = { id: q.tile.id, mod: q.tile.mod, c: q.c, r: q.r, w: q.w, h: q.h, rx: r.x, ry: r.y, rw: r.w, rh: r.h }, n0 = pg.ops.length;
      pg.meta.tiles.push(mt);
      (MODULES[q.tile.mod] || MODULES.leer).draw(pg, { t, d, i, T, warns, st }, q.tile, r);
      mt.empty = pg.ops.length === n0; // zeichnet nichts: in der Vorschau sichtbar machen, damit man die Kachel findet
    }
  }
  return out;
}

/* ---------- Foto mit Markierungen und Beschriftung ----------
   Hat das Foto Markierungen, wird es ganz gezeigt (Rand bleibt frei), sonst füllt es den Rahmen. */
const LH = 10.5;
const photoNo = (t, p) => t.days.flatMap((d) => d.photos).indexOf(p) + 1;
const gpsText = (g) => `${Math.abs(g.lat).toFixed(5)}° ${g.lat >= 0 ? "N" : "S"}, ${Math.abs(g.lon).toFixed(5)}° ${g.lon >= 0 ? "E" : "W"}`;
const mapUrl = (g) => `https://www.openstreetmap.org/?mlat=${g.lat.toFixed(6)}&mlon=${g.lon.toFixed(6)}#map=18/${g.lat.toFixed(6)}/${g.lon.toFixed(6)}`;

/* Beschriftungszeilen unter einem Foto nach den Einstellungen (Fotonummer, Datum, Ort, GPS, Wetter, Bemerkung, Notizen, Dateiname) */
function photoLines(t, p, w, maxLines, warns, where) {
  const L = [], add = (text, f, s, c, extra) => wrapAll(text, f, s, extra && extra.n ? w - 12 : w).forEach((l, k) => L.push({ t: l, f, s, c, ...(extra || {}), n: extra && extra.n && !k ? extra.n : 0, x: extra && extra.n ? 12 : 0 }));
  const head = [t.capNum ? "Foto " + photoNo(t, p) : "", t.capDate && p.day ? fmtDate(p.day, { day: "2-digit", month: "2-digit", year: "numeric" }) + (p.time ? ", " + p.time.slice(0, 5) + " Uhr" : "") : ""].filter(Boolean).join("  ·  ");
  if (head) add(head, "B", 8, "ink");
  if (t.capPlace && p.place) add(p.place, "R", 8, "ink");
  if (t.capGps && p.gps) L.push({ t: gpsText(p.gps), f: "R", s: 7.5, c: "acc", url: mapUrl(p.gps), n: 0, x: 0 });
  if (t.wxLine && p.weather) add(p.weather, "R", 7.5, "muted");
  if (t.capNote && (p.note || "").trim()) add(p.note.trim(), "I", 8.5, "ink");
  if (t.capMarks) NUMS(p).forEach((m, k) => { if ((m.note || "").trim()) add(m.note.trim(), "R", 8, "muted", { n: k + 1, col: m.c }); });
  if (t.capFile && p.name) add("Datei: " + p.name, "R", 7.5, "muted");
  if (maxLines <= 0) { if (L.length) warns.push(`${where}: Die Fotobeschriftung passt nicht unter das Foto und entfällt.`); return []; }
  if (L.length > maxLines) {
    L.length = maxLines;
    const last = L[maxLines - 1]; last.t = fitT(last.t + " …", last.f, last.s, w - (last.x || 0));
    warns.push(`${where}: Eine Fotobeschriftung ist zu lang und wird gekürzt.`);
  }
  return L;
}
const captionH = (L) => (L.length ? L.length * LH + 5 : 0);

function photoBlock(pg, p, x, y, w, h, L, T, fixedIh, style) {
  const v = photoView(p), th = captionH(L), cellH = fixedIh || Math.max(20, h - th);
  const pad = style === "frame" ? 5 : 0, rad = style === "shadow" ? 5 : 0;
  const marked = viewMarks(p).length > 0, aw = w - 2 * pad, ah = cellH - 2 * pad;
  let r = { x: x + pad, y: y + pad, w: aw, h: ah };
  if (marked) { const k = Math.min(aw / v.w, ah / v.h); r = { w: v.w * k, h: v.h * k }; r.x = x + pad + (aw - r.w) / 2; r.y = y + pad; }
  if (style === "shadow") pg.shadow(r.x, r.y, r.w, r.h, rad);
  if (style === "frame") { pg.shadow(r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad, 1.5); pg.rect(r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad, { fill: "#FFFFFF", stroke: T.rule, sw: 0.4, r: 1.5 }); }
  pg.img(r.x, r.y, r.w, r.h, v.src, v.w, v.h, p.id, rad);
  if (!style || style === "plain") pg.rect(r.x, r.y, r.w, r.h, { stroke: T.rule, sw: 0.5 });
  if (marked) drawMarks(pg, p, r, v);
  const col = { ink: T.ink, muted: T.muted, acc: T.accent };
  L.forEach((l, k) => {
    const ty = y + cellH + 5 + k * LH;
    if (l.n) {
      pg.rect(x, ty + 0.5, 8, 8, { fill: l.col, r: 4 });
      pg.text(x + 4, ty + 1.9, String(l.n), { f: "B", s: 5.8, c: numInk(l.col), a: "c" });
    }
    pg.text(x + (l.x || 0), ty, l.t, { f: l.f, s: l.s, c: col[l.c] });
    if (l.url) pg.link(x, ty - 1, tw(l.t, l.f, l.s), 10, l.url);
  });
}

/* Markierungen als Vektoren über dem Foto (Rahmen r, Ansicht v) */
function drawMarks(pg, p, r, v) {
  const vm = viewMarks(p), nums = vm.filter((q) => q.t === "num"), sc = r.w / v.w;
  const path = (d, o) => pg.ops.push({ k: "path", x: r.x, y: r.y, w: r.w, h: r.h, vw: v.w, vh: v.h, d, fill: o.fill || null, stroke: o.stroke || null, sw: o.sw || 0, fo: o.fo, so: o.so });
  for (const pass of ["halo", "color"]) {
    for (const m of vm) {
      const g = markGeom(m, p), halo = pass === "halo", col = halo ? haloOf(m.c) : m.c, op = halo ? 0.85 : 1;
      if (g.num) {
        const d = circlePath(m.x, m.y, g.r);
        if (halo) path(d, { fill: col, fo: op, stroke: col, so: op, sw: g.sw * 2.4 });
        else {
          path(d, { fill: col });
          const sz = g.r * 1.3 * sc;
          pg.text(r.x + m.x * sc, r.y + m.y * sc - 0.4865 * sz, String(nums.indexOf(m) + 1), { f: "B", s: sz, c: numInk(m.c), a: "c" });
        }
        continue;
      }
      g.stroke.forEach((d) => path(d, { stroke: col, so: op, sw: halo ? g.sw * 2.2 : g.sw }));
      g.fill.forEach((d) => path(d, halo ? { fill: col, fo: op, stroke: col, so: op, sw: g.sw * 1.2 } : { fill: col }));
    }
  }
}

/* ---------- Kostenübersicht ---------- */
function costPages(t, st, T) {
  if (!(st.cost > 0)) return [];
  const out = [], pg = new Pg(T); out.push(pg);
  miniHeader(pg, "Auswertung", "Kostenübersicht");
  let y = 112;
  pg.text(MX, y, money(st.cost, t.currency), { f: "SB", s: 36, c: T.accent });
  pg.text(MX, y + 46, `insgesamt  ·  ${money(st.perDay, t.currency)} pro Tag  ·  ${st.nDays} ${st.nDays === 1 ? "Tag" : "Tage"}`, { s: 10, c: T.muted });
  y += 84;
  pg.label(MX, y, "Nach Kategorie"); y += 22;
  const cats = CATS.filter((c) => st.byCat[c.id] > 0).sort((a, b) => st.byCat[b.id] - st.byCat[a.id]);
  const bx = MX + 120, bwid = CW - 120 - 112;
  for (const c of cats) {
    const v = st.byCat[c.id], frac = v / st.cost;
    pg.text(MX, y, c.name, { s: 10 });
    pg.rect(bx, y + 1, bwid, 10, { fill: T.soft, r: 5 });
    pg.rect(bx, y + 1, Math.max(4, bwid * frac), 10, { fill: T.accent, r: 5 });
    pg.text(PW - MX, y, money(v, t.currency), { f: "B", s: 10, a: "r" });
    pg.text(PW - MX - 70, y, fmtNum(frac * 100) + " %", { s: 9, c: T.muted, a: "r" });
    y += 24;
  }
  y += 14;
  const rowsAll = t.days.map((d, i) => ({ i, d, sum: dayCosts(d) }));
  let cur = pg, first = true;
  pg.label(MX, y, "Nach Tag"); y += 22;
  for (const r of rowsAll) {
    if (y + 18 > BOTTOM) {
      cur = new Pg(T); out.push(cur);
      y = miniHeader(cur, "Auswertung", "Kostenübersicht · Fortsetzung"); first = false;
    }
    const place = dayPlaceName(t, r.d);
    cur.text(MX, y, `Tag ${r.i + 1}`, { f: "B", s: 9.5 });
    cur.text(MX + 52, y, fitT([fmtDate(r.d.date, { day: "numeric", month: "short" }), place].filter(Boolean).join("  ·  "), "R", 9.5, CW - 52 - 100), { s: 9.5, c: T.muted });
    cur.text(PW - MX, y, r.sum ? money(r.sum, t.currency) : "–", { s: 9.5, a: "r", c: r.sum ? T.ink : T.muted });
    cur.line(MX, y + 15, PW - MX, y + 15, T.rule, 0.5);
    y += 20;
  }
  return out;
}

/* ---------- Prüfsummenseiten (SHA-256 der Originaldateien) ---------- */
function hashPages(t, T) {
  const photos = t.days.flatMap((d, i) => d.photos.map((p) => ({ p, i }))), out = [];
  if (!t.hashes || !photos.length) return out;
  let pg = null, y = 0, first = true;
  const open = () => {
    pg = new Pg(T); out.push(pg);
    y = miniHeader(pg, "Nachweis", "Prüfsummen der Originalfotos" + (first ? "" : " · Fortsetzung"));
    if (first) {
      const intro = "Die Prüfsumme (SHA-256) wird über die unveränderte Originaldatei gebildet. Stimmt sie mit der Prüfsumme einer vorliegenden Datei überein, ist diese Datei bitgenau das Original. Prüfen unter Windows: certutil -hashfile <Datei> SHA256, unter macOS/Linux: shasum -a 256 <Datei>";
      wrapMax(intro, "R", 8, CW, 4).lines.forEach((l) => { pg.text(MX, y, l, { s: 8, c: T.muted }); y += 10.5; });
      y += 8;
    }
    first = false;
  };
  const note = t.embed !== "original" ? `Im PDF verkleinert eingebettet (${t.embed} px), die Prüfsumme gilt für die Originaldatei.` : "";
  photos.forEach(({ p, i }) => {
    const rowH = 11 + 10 + 8 + (note ? 9.5 : 0);
    if (!pg || y + rowH > BOTTOM) open();
    const no = "Foto " + photoNo(t, p), nx = MX + Math.max(44, tw(no, "B", 8.5) + 8);
    pg.text(MX, y, no, { f: "B", s: 8.5 });
    const meta = [p.name, fmtSize(p.size || (p.file && p.file.size) || 0), p.day ? fmtDate(p.day, { day: "2-digit", month: "2-digit", year: "numeric" }) + (p.time ? ", " + p.time.slice(0, 5) + " Uhr" : "") : "", "Tag " + (i + 1)].filter(Boolean).join("  ·  ");
    pg.text(nx, y, fitT(meta, "R", 8.5, MX + CW - nx), { s: 8.5 }); y += 11;
    pg.text(nx, y, p.sha || "–", { f: "C", s: 7.5 }); y += 10;
    if (note) { pg.text(nx, y, fitT(note, "R", 7, MX + CW - nx), { s: 7, c: T.muted }); y += 9.5; }
    y += 3; pg.line(MX, y, PW - MX, y, T.rule, 0.4); y += 5;
  });
  return out;
}
const fmtSize = (b) => (b >= 1048576 ? fmtNum(b / 1048576, 1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

/* ---------- Gesamtreise ---------- */
function layoutTrip(t) {
  const T = THEMES[t.theme] || THEMES.meer, st = tripStats(t), warns = [], pages = [];
  pages.push(coverPage(t, st, T, warns));
  t.days.forEach((_, i) => pages.push(...dayPages(t, i, T, warns, st)));
  if (t.costPage) pages.push(...costPages(t, st, T));
  pages.push(...hashPages(t, T));
  const N = pages.length;
  const created = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  pages.forEach((pg, n) => {
    if (n) pg.line(MX, 800, PW - MX, 800, T.rule, 0.6);
    pg.text(MX, 806, fitT((t.title.trim() || "Meine Reise") + " · erstellt am " + created, "R", 7.5, CW - 110), { s: 7.5, c: T.muted });
    pg.text(MX, 816.5, PROJECT_LABEL, { s: 7.5, c: T.accent });
    pg.link(MX, 815.5, tw(PROJECT_LABEL, "R", 7.5), 10, PROJECT_URL);
    if (n) pg.text(PW - MX, 806, `Seite ${n + 1} von ${N}`, { s: 7.5, c: T.muted, a: "r" });
  });
  if (!t.days.length) warns.push("Noch keine Tage angelegt (Reiter „Tage“).");
  return { pages, warns, stats: st };
}
