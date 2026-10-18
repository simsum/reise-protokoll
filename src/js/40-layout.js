/* ---------- Seitenmodell ----------
   Aus der Reise entsteht eine Liste von Seiten {W, H, ops}. Maße in Punkt
   (1/72 Zoll), Ursprung oben links. Vorschau (pageHtml) und PDF (buildPdf)
   zeichnen beide nur aus diesem Modell – es gibt keine zweite Layout-Logik.

   Operationen (k):
     rect  {x,y,w,h,fill,fo,stroke,sw,r}       Rechteck, optional abgerundet (fo = Deckkraft der Füllung)
     line  {x1,y1,x2,y2,c,sw}                  Linie
     t     {x,y,text,s,f,c,a,ls}               Text; y = Oberkante, a = l|c|r, ls = Buchstabenabstand
     path  {x,y,w,h,vw,vh,d,fill,stroke,sw}    SVG-Pfad im Raster vw×vh (Symbole)
     link  {x,y,w,h,url}                       klickbarer Bereich (nur feste, im Code stehende Adressen)
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

/* ---------- Text in Spalten fließen lassen ---------- */
/* blocks: [{label, paras[]}]. Liefert die neue y-Position und die Blöcke, die nicht mehr passten. */
function flow(pg, blocks, x, y, w, yMax, o) {
  const { T, ruled } = o, lh = 16, s = 11, multi = blocks.length > 1;
  const hasText = (b) => (b.items ? b.items.length > 0 : b.paras.some((p) => p.trim()));
  const rule = (yy) => pg.line(x, yy + lh - 2, x + w, yy + lh - 2, T.rule, 0.5);
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi], has = hasText(b);
    if (!has && !ruled) continue;
    if (y + 16 + lh * 2 > yMax) return { y, rest: blocks.slice(bi).filter(hasText) };
    pg.label(x, y, b.label + (b.cont ? " · Fortsetzung" : ""));
    y += 16;
    if (!has) {
      const n = multi ? 4 : Math.floor((yMax - y) / lh);
      for (let k = 0; k < n && y + lh <= yMax; k++) { rule(y); y += lh; }
      y += 8; continue;
    }
    if (b.items) {
      /* Zeitleiste: Uhrzeit links, senkrechte Linie mit Punkten, Text rechts */
      const tx = x + 62, tws = w - 62, top0 = y, at = pg.ops.length;
      const vline = (y2) => pg.ops.splice(at, 0, { k: "line", x1: x + 50, y1: top0 + lh / 2, x2: x + 50, y2, c: T.accent2, sw: 1.2 });
      for (let ii = 0; ii < b.items.length; ii++) {
        const it = b.items[ii], lines = wrapAll(it.text || " ", "S", s, tws), need = lines.length * lh + 6;
        if (y + need > yMax) {
          vline(y - 6 - lh / 2);
          return { y, rest: [{ label: b.label, kind: "timeline", items: b.items.slice(ii), cont: true }, ...blocks.slice(bi + 1).filter(hasText)] };
        }
        if (it.time) pg.text(x, y + (lh - 9.5) / 2, it.time, { f: "B", s: 9.5, c: T.accent });
        pg.rect(x + 47.5, y + lh / 2 - 2.5, 5, 5, { fill: it.time ? T.accent : T.accent2, r: 2.5 });
        lines.forEach((l, k) => pg.text(tx, y + k * lh + (lh - s) / 2, l, { f: "S", s }));
        y += need;
      }
      vline(y - 6 - lh / 2);
      y += 6; continue;
    }
    for (let pi = 0; pi < b.paras.length; pi++) {
      const para = b.paras[pi];
      if (!para.trim()) { y += lh * 0.5; continue; }
      const lines = wrapAll(para, "S", s, w), avail = Math.floor((yMax - y) / lh);
      const draw = (arr) => arr.forEach((l, k) => pg.text(x, y + k * lh + (lh - s) / 2, l, { f: "S", s }));
      if (lines.length <= avail) { draw(lines); y += lines.length * lh; continue; }
      let left;
      if (avail >= 2) { draw(lines.slice(0, avail)); y += avail * lh; left = [lines.slice(avail).join(" "), ...b.paras.slice(pi + 1)]; }
      else left = b.paras.slice(pi);
      return { y, rest: [{ label: b.label, paras: left, cont: true }, ...blocks.slice(bi + 1).filter(hasText)] };
    }
    y += 10;
  }
  return { y, rest: [] };
}

function rulesTo(pg, x, y, w, yMax) {
  for (; y + 16 <= yMax; y += 16) pg.line(x, y + 14, x + w, y + 14, pg.T.rule, 0.5);
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
  const tpl = TEMPLATES[t.template], pg = new Pg(T);
  const BAND = 290;
  const photo = !!t.coverPhoto;
  if (photo) pg.img(0, 0, PW, BAND, t.coverPhoto, t.coverW, t.coverH);
  else {
    pg.rect(0, 0, PW, BAND, { fill: T.accent });
    pg.icon("pin", PW - MX - 190, 62, 190, mix(T.accent, "#FFFFFF", 0.14), 0.9); /* Dekor */
  }
  const soft = mix(T.accent, "#FFFFFF", 0.78);
  pg.text(MX, 44, "REISEPROTOKOLL  ·  " + tpl.label.toUpperCase(), { f: "B", s: 8, c: soft, ls: 1.8 });
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
  const stats = (tpl.stats ? tpl.stats(t, st) : defaultStats(t, st)).slice(0, 4);
  const gap = 12, cw = (CW - gap * 3) / 4, sy = BAND + 22;
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
  const pts = t.route.points.map((p) => p.name).filter(Boolean);
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

function defaultStats(t, st) {
  const cost = st.cost > 0 ? money(st.cost, t.currency) : "–";
  return [
    { v: `${st.nDays} ${st.nDays === 1 ? "Tag" : "Tage"}`, l: st.nDays > 1 ? `Dauer · ${st.nights} Nächte` : "Dauer" },
    { v: String(st.places.length || "–"), l: "Orte" },
    { v: st.km ? (st.kmEst ? "~" : "") + fmtNum(st.km) + " km" : "–", l: "Strecke" },
    { v: cost, l: "Kosten" },
  ];
}

/* ---------- Tagesseite ---------- */
function dayPages(t, i, T, warns) {
  const tpl = TEMPLATES[t.template], d = t.days[i], out = [];
  const pg = new Pg(T); out.push(pg);
  const title = d.title.trim() || "Tag " + (i + 1);

  pg.rect(MX, 40, 56, 56, { fill: T.accent, r: 10 });
  pg.text(MX + 28, 50, "TAG", { f: "B", s: 6.5, c: mix(T.accent, "#FFFFFF", 0.75), a: "c", ls: 1.5 });
  pg.text(MX + 28, 60, String(i + 1), { f: "SB", s: i + 1 > 99 ? 20 : 26, c: T.onAccent, a: "c" });
  const hx = MX + 74, hw = CW - 74;
  pg.text(hx, 42, (fmtLong(d.date) || "Tag " + (i + 1)).toUpperCase(), { f: "B", s: 7.5, c: T.muted, ls: 1.2 });
  pg.text(hx, 56, fitT(title, "SB", 21, hw), { f: "SB", s: 21 });
  const sub = tpl.dayHeader(t, i);
  if (sub) pg.text(hx, 83, fitT(sub, "B", 10, hw), { f: "B", s: 10, c: T.accent });
  pg.line(MX, 110, PW - MX, 110, T.rule, 0.8);

  /* Infokästen */
  const bw = (CW - 20) / 3;
  tpl.info(t, i).slice(0, 3).forEach((b, k) => {
    const x = MX + k * (bw + 10), y = 122;
    pg.rect(x, y, bw, 46, { fill: T.soft, r: 8 });
    pg.label(x + 12, y + 8, b.label, T.muted);
    pg.icon(b.ico, x + 11, y + 21, 17, T.accent, 1.5);
    const v = (b.value || "").trim();
    pg.text(x + 35, y + 25, fitT(v || "–", "R", 9.5, bw - 46), { s: 9.5, c: v ? T.ink : T.muted });
  });

  /* Wetterdetails (Wind, Niederschlag, Luftfeuchte …) als eigene Zeile unter den Infokästen */
  let off = 0;
  const wxd = dayWxDetail(d);
  if (wxd) {
    const wl = wrapMax(wxd, "R", 8.5, CW - 44, 3), bh = 12 + wl.lines.length * 11;
    pg.rect(MX, 176, CW, bh, { fill: T.soft, r: 8 });
    pg.icon(d.weather || "sun", MX + 11, 176 + (bh - 17) / 2, 17, T.accent, 1.5);
    wl.lines.forEach((l, k) => pg.text(MX + 35, 176 + 6.5 + k * 11, l, { s: 8.5, c: T.ink }));
    off = bh + 10;
  }

  /* Kopf der Textspalten */
  const lw = 316, rx = MX + lw + 24, rw = PW - MX - rx;
  let bodyTop = 188 + off;
  const sp = tpl.strip ? tpl.strip(t, i) : null;
  if (sp && (sp.from || sp.to)) { routeStrip(pg, sp, T, 182 + off); bodyTop = 236 + off; }
  const blocks = tpl.sections(d);

  /* Fotos auf der Tagesseite.
     „automatisch“: Der Text wird zuerst gemessen, der Freiraum darunter gehört den Fotos (so viele wie mit gutem Format hineinpassen).
     Feste Zahl (0–3): ein Streifen am Seitenende, dessen Höhe von der Zahl der Beschriftungszeilen abhängt. */
  const style = t.photoStyle;
  let shown = [], bodyBottom = BOTTOM - 4, place = () => {};
  if (t.stripN === "auto") {
    const dm = new Pg(T), r1 = flow(dm, blocks, MX, bodyTop, lw, BOTTOM - 4, { T, ruled: false });
    const textEnd = Math.max(r1.rest.length ? BOTTOM : r1.y, rightColumn(dm, t, d, T, rx, bodyTop, rw, BOTTOM - 4, [], i));
    const y0 = textEnd + 22, fit = d.photos.length && BOTTOM - y0 >= 130 ? fitPhotos(t, d.photos, MX, y0, CW, BOTTOM - y0) : null;
    if (fit) {
      shown = d.photos.slice(0, fit.n); bodyBottom = y0 - 16;
      const top = Math.min(...fit.cells.map((c) => c.y)), bot = Math.max(...fit.cells.map((c) => c.y + c.h)), shift = Math.max(0, (BOTTOM - y0 - (bot - top)) / 2 - 4);
      place = () => shown.forEach((p, k) => photoBlock(pg, p, fit.cells[k].x, fit.cells[k].y + shift, fit.cells[k].w, fit.cells[k].h, fit.Ls[k], T, 0, style));
    }
  } else {
    shown = d.photos.slice(0, +t.stripN);
    const g = 10, sw = shown.length ? (CW - g * (shown.length - 1)) / shown.length : 0;
    const lines = shown.map((p) => photoLines(t, p, sw, 8, warns, `Tag ${i + 1}`));
    const stripH = shown.length ? 100 + Math.max(...lines.map(captionH)) : 0, stripY = BOTTOM - stripH;
    if (shown.length) bodyBottom = stripY - 16;
    place = () => shown.forEach((p, k) => photoBlock(pg, p, MX + k * (sw + g), stripY, sw, stripH, lines[k], T, 100, style));
  }
  place();

  /* Text links, Highlights und Ausgaben rechts */
  let r = flow(pg, blocks, MX, bodyTop, lw, bodyBottom, { T, ruled: t.ruled });
  if (!r.rest.length && t.ruled) rulesTo(pg, MX, r.y, lw, bodyBottom);
  rightColumn(pg, t, d, T, rx, bodyTop, rw, bodyBottom, warns, i);

  /* Fortsetzungsseiten */
  for (let n = 0; r.rest.length && n < 8; n++) {
    const p2 = new Pg(T); out.push(p2);
    const y0 = miniHeader(p2, `Tag ${i + 1} · Fortsetzung`, title);
    r = flow(p2, r.rest, MX, y0, CW, BOTTOM, { T, ruled: false });
  }
  if (r.rest.length) warns.push(`Tag ${i + 1}: Der Text ist zu lang und wird abgeschnitten.`);

  /* weitere Fotos: Aufteilung nach Anzahl, gleichmäßig auf Seiten verteilt */
  const more = d.photos.slice(shown.length), per = more.length ? Math.ceil(more.length / Math.ceil(more.length / 6)) : 6;
  for (let k = 0; k < more.length; k += per) {
    const p3 = new Pg(T); out.push(p3);
    const y0 = miniHeader(p3, `Tag ${i + 1} · Fotos`, title), chunk = more.slice(k, k + per);
    galleryCells(chunk.length, MX, y0, CW, BOTTOM - y0).forEach((c, n) => photoBlock(p3, chunk[n], c.x, c.y, c.w, c.h, photoLines(t, chunk[n], c.w, 10, warns, `Tag ${i + 1}`), T, 0, style));
  }
  return out;
}

/* Rahmen für n Fotos (1–6) in einer Fläche; Höhen begrenzt, damit nichts überlang wird */
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
  if (t.wxLine && p.weather) add((p.time ? p.time.slice(0, 5) + " Uhr · " : "") + p.weather, "R", 7.5, "muted");
  if (t.capNote && (p.note || "").trim()) add(p.note.trim(), "I", 8.5, "ink");
  if (t.capMarks) NUMS(p).forEach((m, k) => { if ((m.note || "").trim()) add(m.note.trim(), "R", 8, "muted", { n: k + 1, col: m.c }); });
  if (t.capFile && p.name) add("Datei: " + p.name, "R", 7.5, "muted");
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

function galleryCells(n, x, y, w, h, opt = {}) {
  const g = 12, half = (w - g) / 2, cap = opt.cap || 300, out = [];
  if (opt.side) { // Tagesseite: breite, flache Fläche
    if (n === 3 && h >= 330) {
      const top = Math.min(cap, (h - g) * 0.55), bot = Math.min(cap * 0.75, h - top - g);
      return [{ x, y, w, h: top }, { x, y: y + top + g, w: half, h: bot }, { x: x + half + g, y: y + top + g, w: half, h: bot }];
    }
    const cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), cw = (w - (cols - 1) * g) / cols, ch = Math.min(cap, (h - (rows - 1) * g) / rows);
    for (let k = 0; k < n; k++) out.push({ x: x + (k % cols) * (cw + g), y: y + Math.floor(k / cols) * (ch + g), w: cw, h: ch });
    return out;
  }
  if (n === 1) out.push({ x, y, w, h: Math.min(h, cap * 1.5) });
  else if (n === 2) { const ch = Math.min(cap, (h - g) / 2); out.push({ x, y, w, h: ch }, { x, y: y + ch + g, w, h: ch }); }
  else if (n === 3) {
    const top = Math.min(cap, (h - g) * 0.55), bot = Math.min(cap * 0.75, h - top - g);
    out.push({ x, y, w, h: top }, { x, y: y + top + g, w: half, h: bot }, { x: x + half + g, y: y + top + g, w: half, h: bot });
  } else {
    const nr = Math.ceil(n / 2), ch = Math.min(cap, (h - g * (nr - 1)) / nr);
    for (let k = 0; k < n; k++) out.push({ x: x + (k % 2) * (half + g), y: y + Math.floor(k / 2) * (ch + g), w: half, h: ch });
  }
  return out;
}

/* So viele Fotos wie mit gutem Format in die freie Fläche passen (mindestens 95 pt Bildhöhe je Foto) */
function fitPhotos(t, photos, x, y, w, h) {
  for (let n = Math.min(photos.length, 6); n >= 1; n--) {
    const cells = galleryCells(n, x, y, w, h, { cap: 360, side: true });
    if (n === 1) { // ein einzelnes Foto behält sein Seitenverhältnis (nicht zugeschnitten), mittig
      const v = photoView(photos[0]), c = cells[0], cw = Math.min(w, (c.h - 22) * (v.w / v.h));
      cells[0] = { x: x + (w - cw) / 2, y: c.y, w: cw, h: c.h };
    }
    const Ls = cells.map((c, k) => photoLines(t, photos[k], c.w, 5, [], ""));
    if (cells.every((c, k) => c.h - captionH(Ls[k]) >= 95 && c.y + c.h <= y + h + 0.5)) return { n, cells, Ls };
  }
  return null;
}

/* Streckenleiste (Rundreise): Start – Ziel mit Kilometern in der Mitte */
function routeStrip(pg, sp, T, y) {
  const ly = y + 30;
  if (sp.from) pg.text(MX, y, fitT(sp.from, "B", 10.5, CW / 2 - 40), { f: "B", s: 10.5 });
  if (sp.to) pg.text(PW - MX, y, fitT(sp.to, "B", 10.5, CW / 2 - 40), { f: "B", s: 10.5, a: "r" });
  pg.line(MX + 8, ly, PW - MX - 8, ly, T.accent2, 1.4);
  pg.rect(MX, ly - 5, 10, 10, { fill: T.paper, stroke: T.accent, sw: 2, r: 5 });
  pg.rect(PW - MX - 10, ly - 5, 10, 10, { fill: T.accent, r: 5 });
  if (sp.mid) {
    const w = tw(sp.mid, "B", 9) + 36;
    pg.rect(PW / 2 - w / 2, ly - 11, w, 22, { fill: T.paper, stroke: T.accent2, sw: 1, r: 11 });
    pg.icon("car", PW / 2 - w / 2 + 9, ly - 8, 15, T.accent, 1.6);
    pg.text(PW / 2 - w / 2 + 28, ly - 4.5, sp.mid, { f: "B", s: 9, c: T.ink });
  }
}

function rightColumn(pg, t, d, T, x, y, w, yMax, warns, i) {
  const hl = dayHighlights(d), costs = d.costs.filter((c) => c.l.trim() || parseNum(c.a));
  const rows = 14, costH = costs.length ? 16 + Math.min(costs.length, 9) * rows + 26 : 0;
  if (hl.length) {
    pg.label(x, y, "Highlights"); y += 16;
    const limit = yMax - costH - (costH ? 14 : 0);
    for (const h of hl) {
      const lines = wrapMax(h, "R", 9.5, w - 13, 3).lines, need = lines.length * 13 + 4;
      if (y + need > limit) { warns.push(`Tag ${i + 1}: Nicht alle Highlights passen auf die Seite.`); break; }
      pg.rect(x, y + 4.5, 4, 4, { fill: T.accent2, r: 2 });
      lines.forEach((l, k) => pg.text(x + 13, y + k * 13 + 1.5, l, { s: 9.5 }));
      y += need;
    }
    y += 12;
  }
  if (costs.length) {
    pg.label(x, y, "Ausgaben"); y += 17;
    const max = 9, list = costs.length > max ? costs.slice(0, max - 1) : costs;
    for (const c of list) {
      const a = money(parseNum(c.a), t.currency), aw = tw(a, "R", 9);
      pg.text(x, y, fitT(c.l || "–", "R", 9, w - aw - 8), { s: 9 });
      pg.text(x + w, y, a, { s: 9, a: "r" });
      y += rows;
    }
    if (costs.length > max) {
      const rest = costs.slice(max - 1);
      pg.text(x, y, `+ ${rest.length} weitere`, { s: 9, c: T.muted });
      pg.text(x + w, y, money(rest.reduce((s, c) => s + parseNum(c.a), 0), t.currency), { s: 9, a: "r", c: T.muted });
      y += rows;
    }
    pg.line(x, y + 2, x + w, y + 2, T.rule, 0.8);
    pg.text(x, y + 8, "Summe", { f: "B", s: 9.5 });
    pg.text(x + w, y + 8, money(dayCosts(d), t.currency), { f: "B", s: 9.5, a: "r", c: T.accent });
    y += 22;
  }
  return y;
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
  t.days.forEach((_, i) => pages.push(...dayPages(t, i, T, warns)));
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
