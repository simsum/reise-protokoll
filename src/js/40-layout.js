/* ---------- Seitenmodell ----------
   Aus der Reise entsteht eine Liste von Seiten {W, H, ops}. Maße in Punkt
   (1/72 Zoll), Ursprung oben links. Vorschau (pageHtml) und PDF (buildPdf)
   zeichnen beide nur aus diesem Modell – es gibt keine zweite Layout-Logik.

   Operationen (k):
     rect  {x,y,w,h,fill,stroke,sw,r}          Rechteck, optional abgerundet
     line  {x1,y1,x2,y2,c,sw}                  Linie
     t     {x,y,text,s,f,c,a,ls}               Text; y = Oberkante, a = l|c|r, ls = Buchstabenabstand
     path  {x,y,w,h,vw,vh,d,fill,stroke,sw}    SVG-Pfad im Raster vw×vh (Symbole)
     img   {x,y,w,h,src,iw,ih}                 Bild, füllt den Rahmen (zugeschnitten)         */
const PW = 595.28, PH = 841.89, MX = 40, CW = PW - 2 * MX, BOTTOM = 790;

class Pg {
  constructor(T) {
    this.W = PW; this.H = PH; this.ops = []; this.T = T;
    if (T.paper.toUpperCase() !== "#FFFFFF") this.rect(0, 0, PW, PH, { fill: T.paper });
  }
  rect(x, y, w, h, o = {}) { this.ops.push({ k: "rect", x, y, w, h, fill: o.fill || null, stroke: o.stroke || null, sw: o.sw || 0.6, r: Math.min(o.r || 0, w / 2, h / 2) }); }
  line(x1, y1, x2, y2, c, sw = 0.6) { this.ops.push({ k: "line", x1, y1, x2, y2, c, sw }); }
  text(x, y, text, o = {}) {
    this.ops.push({ k: "t", x, y, text: clean(text), s: o.s || 10, f: o.f || "R", c: o.c || this.T.ink, a: o.a || "l", ls: o.ls || 0 });
  }
  icon(name, x, y, s, c, sw = 1.6) { this.ops.push({ k: "path", x, y, w: s, h: s, vw: 24, vh: 24, d: ICONS[name] || ICONS.sun, fill: null, stroke: c, sw }); }
  img(x, y, w, h, src, iw, ih) { this.ops.push({ k: "img", x, y, w, h, src, iw: iw || w, ih: ih || h }); }
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
  const my = sy + 64 + 18, mh = 236;
  if (t.mapImg) {
    pg.img(MX, my, CW, mh, t.mapImg, t.mapW, t.mapH);
    pg.rect(MX, my, CW, mh, { stroke: T.rule, sw: 0.8 });
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
  if (t.travelers.trim()) pg.text(MX, 806, fitT("Reisende: " + t.travelers.trim(), "R", 8.5, CW), { s: 8.5, c: T.muted });
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

  /* Fotos (die ersten drei als Streifen) */
  const shown = d.photos.slice(0, 3), stripY = BOTTOM - 104;
  const bodyBottom = shown.length ? stripY - 18 : BOTTOM - 4;
  if (shown.length) {
    const g = 8, w = (CW - g * (shown.length - 1)) / shown.length;
    shown.forEach((p, k) => pg.img(MX + k * (w + g), stripY, w, 104, p.src, p.w, p.h));
  }

  /* Text links */
  const lw = 316;
  let bodyTop = 188;
  const sp = tpl.strip ? tpl.strip(t, i) : null;
  if (sp && (sp.from || sp.to)) { routeStrip(pg, sp, T, 182); bodyTop = 236; }
  const blocks = tpl.sections(d);
  let r = flow(pg, blocks, MX, bodyTop, lw, bodyBottom, { T, ruled: t.ruled });
  if (!r.rest.length && t.ruled) rulesTo(pg, MX, r.y, lw, bodyBottom);

  /* Highlights und Ausgaben rechts */
  rightColumn(pg, t, d, T, MX + lw + 24, bodyTop, PW - MX - (MX + lw + 24), bodyBottom, warns, i);

  /* Fortsetzungsseiten */
  for (let n = 0; r.rest.length && n < 8; n++) {
    const p2 = new Pg(T); out.push(p2);
    const y0 = miniHeader(p2, `Tag ${i + 1} · Fortsetzung`, title);
    r = flow(p2, r.rest, MX, y0, CW, BOTTOM, { T, ruled: false });
  }
  if (r.rest.length) warns.push(`Tag ${i + 1}: Der Text ist zu lang und wird abgeschnitten.`);

  /* weitere Fotos: Aufteilung nach Anzahl, gleichmäßig auf Seiten verteilt */
  const more = d.photos.slice(3), per = more.length ? Math.ceil(more.length / Math.ceil(more.length / 6)) : 6;
  for (let k = 0; k < more.length; k += per) {
    const p3 = new Pg(T); out.push(p3);
    const y0 = miniHeader(p3, `Tag ${i + 1} · Fotos`, title), chunk = more.slice(k, k + per);
    galleryCells(chunk.length, MX, y0, CW, BOTTOM - y0).forEach((c, n) => p3.img(c.x, c.y, c.w, c.h, chunk[n].src, chunk[n].w, chunk[n].h));
  }
  return out;
}

/* Rahmen für n Fotos (1–6) in einer Fläche; Höhen begrenzt, damit nichts überlang wird */
function galleryCells(n, x, y, w, h) {
  const g = 12, half = (w - g) / 2, cap = (v) => Math.min(v, 300), out = [];
  const rows = (cols, nr) => { const ch = cap((h - g * (nr - 1)) / nr); return ch; };
  if (n === 1) out.push({ x, y, w, h: Math.min(h, 460) });
  else if (n === 2) { const ch = cap((h - g) / 2); out.push({ x, y, w, h: ch }, { x, y: y + ch + g, w, h: ch }); }
  else if (n === 3) {
    const top = Math.min(300, (h - g) * 0.55), bot = Math.min(220, h - top - g);
    out.push({ x, y, w, h: top }, { x, y: y + top + g, w: half, h: bot }, { x: x + half + g, y: y + top + g, w: half, h: bot });
  } else {
    const nr = Math.ceil(n / 2), ch = rows(2, nr);
    for (let k = 0; k < n; k++) out.push({ x: x + (k % 2) * (half + g), y: y + Math.floor(k / 2) * (ch + g), w: half, h: ch });
  }
  return out;
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

/* ---------- Gesamtreise ---------- */
function layoutTrip(t) {
  const T = THEMES[t.theme] || THEMES.meer, st = tripStats(t), warns = [], pages = [];
  pages.push(coverPage(t, st, T, warns));
  t.days.forEach((_, i) => pages.push(...dayPages(t, i, T, warns)));
  if (t.costPage) pages.push(...costPages(t, st, T));
  const N = pages.length;
  pages.forEach((pg, n) => {
    if (!n) return;
    pg.line(MX, 800, PW - MX, 800, T.rule, 0.6);
    pg.text(MX, 810, fitT(t.title.trim() || "Meine Reise", "R", 7.5, CW - 80), { s: 7.5, c: T.muted });
    pg.text(PW - MX, 810, `Seite ${n + 1} von ${N}`, { s: 7.5, c: T.muted, a: "r" });
  });
  if (!t.days.length) warns.push("Noch keine Tage angelegt (Reiter „Tage“).");
  return { pages, warns, stats: st };
}
