/* ---------- Module (Kacheln) ----------
   Jede Seite eines Tages ist ein Raster aus Kacheln (`trip.cols` Spalten, GRID_ROWS Zeilen). Eine Kachel nimmt ein Modul auf
   und kann 1…cols Spalten breit und 1…GRID_ROWS Zeilen hoch sein. Die Kacheln stehen als Liste in `day.pages[].tiles[]`;
   `packTiles()` setzt sie der Reihe nach auf das erste freie Rechteck. Was nicht passt, läuft auf die nächste Seite.

   Neues Modul = ein Eintrag in MODULES:
     name              Anzeigename in der Auswahl
     size(cols)        Standardgröße [Breite, Höhe] in Kacheln
     draw(pg, c, tile, r)
                       zeichnet in das Rechteck r {x,y,w,h}; c = {t, d, i, T, warns, st} (Reise, Tag, Tagesnummer, Farben, Warnungen, Kennzahlen).
                       Ein leeres Modul zeichnet nichts. Passt der Inhalt nicht, wird die Schrift kleiner, dann gekürzt und eine Warnung gemeldet.  */

const GRID_ROWS = 6;

/* ---------- Hilfen für Tagesdaten ---------- */
function weatherInfo(d) {
  const bits = [];
  if (d.weather) bits.push(weatherName(d.weather));
  const a = hasNum(d.tmin), b = hasNum(d.tmax);
  if (a && b) bits.push(`${fmtNum(parseNum(d.tmin))}–${fmtNum(parseNum(d.tmax))} °C`);
  else if (a || b) bits.push(`${fmtNum(parseNum(a ? d.tmin : d.tmax))} °C`);
  return { label: "Wetter", value: bits.join(" · "), ico: d.weather || "sun" };
}

/* Tagesplan: jede Zeile ein Punkt, optional mit Uhrzeit vorn („9:30 Frühstück“, „14.00 – Museum“). */
function parsePlan(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^(\d{1,2})[:.](\d{2})(?:\s*(?:Uhr|h))?\s*[-–:]?\s*(.*)$/.exec(l);
    return m ? { time: `${m[1].padStart(2, "0")}:${m[2]}`, text: m[3] || "" } : { time: "", text: l };
  });
}

/* Unterzeile unter dem Tagestitel: von – nach */
function daySub(t, i) {
  const d = t.days[i], from = dayFrom(t, i), to = dayPlaceName(t, d);
  return from && to && from !== to ? from + " – " + to : to || from;
}

/* Streckenangabe des Tages (nur mit Kilometern oder Fahrzeit) → {from, to, mid} oder null */
function routeInfo(t, i) {
  const d = t.days[i], bits = [];
  if (hasNum(d.km) && parseNum(d.km) > 0) bits.push(fmtNum(parseNum(d.km)) + " km");
  if (d.drive.trim()) bits.push(d.drive.trim() + " h");
  if (!bits.length) return null;
  return { from: dayFrom(t, i), to: dayPlaceName(t, d), mid: bits.join("  ·  ") };
}

/* ---------- Raster ---------- */
/* Setzt die Kacheln der Reihe nach auf das erste freie Rechteck (zeilenweise gesucht). Liefert {placed:[{tile,c,r,w,h}], rest:[Kacheln ohne Platz]}. */
function packTiles(tiles, cols, rows) {
  const used = new Set(), placed = [], rest = [];
  const free = (c, r, w, h) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (used.has(y * cols + x)) return false; return true; };
  for (const tile of tiles) {
    const fx = MODULES[tile.mod] && MODULES[tile.mod].fixed; // Module mit fester Größe (Wettersymbol)
    const w = fx ? fx[0] : clamp(Math.round(tile.w) || 1, 1, cols), h = fx ? fx[1] : clamp(Math.round(tile.h) || 1, 1, rows);
    let spot = null;
    for (let r = 0; r + h <= rows && !spot; r++) for (let c = 0; c + w <= cols; c++) if (free(c, r, w, h)) { spot = { c, r }; break; }
    if (!spot) { rest.push(tile); continue; }
    for (let y = spot.r; y < spot.r + h; y++) for (let x = spot.c; x < spot.c + w; x++) used.add(y * cols + x);
    placed.push({ tile, c: spot.c, r: spot.r, w, h });
  }
  return { placed, rest };
}

/* Schrittweise kleinere Schriftgrößen (halbe Punkte) */
const sizeRange = (hi, lo) => { const a = []; for (let s = hi; s >= lo - 1e-9; s -= 0.5) a.push(s); return a; };
const card = (pg, r) => pg.rect(r.x, r.y, r.w, r.h, { fill: pg.T.soft, r: 8 });

/* Grafische Kacheln (Foto, Karten, Wettersymbol) sehen aus wie Fotos (Einstellung „Aussehen der Fotos“): Schatten mit abgerundeten Ecken, weißer Rand
   mit Schatten oder schlicht mit dünnem Rand. Liefert den Innenraum {x, y, w, h}, rad (Eckenradius) und plain (dünnen Rand danach zeichnen). */
function frameFor(pg, t, T, x, y, w, h) {
  const st = t.photoStyle, pad = st === "frame" ? 5 : 0, rad = st === "shadow" ? 5 : 0;
  if (st === "shadow") pg.shadow(x, y, w, h, rad);
  if (st === "frame") { pg.shadow(x, y, w, h, 1.5); pg.rect(x, y, w, h, { fill: "#FFFFFF", stroke: T.rule, sw: 0.4, r: 1.5 }); }
  return { x: x + pad, y: y + pad, w: w - 2 * pad, h: h - 2 * pad, rad, plain: !st || st === "plain" };
}
const plainEdge = (pg, f, T) => { if (f.plain) pg.rect(f.x, f.y, f.w, f.h, { stroke: T.rule, sw: 0.5 }); };

/* Streckenleiste: Start – Ziel mit Kilometern in der Mitte */
function routeStrip(pg, sp, T, x, y, w) {
  const ly = y + 30;
  if (sp.from) pg.text(x, y, fitT(sp.from, "B", 10.5, w / 2 - 40), { f: "B", s: 10.5 });
  if (sp.to) pg.text(x + w, y, fitT(sp.to, "B", 10.5, w / 2 - 40), { f: "B", s: 10.5, a: "r" });
  pg.line(x + 8, ly, x + w - 8, ly, T.accent2, 1.4);
  pg.rect(x, ly - 5, 10, 10, { fill: T.paper, stroke: T.accent, sw: 2, r: 5 });
  pg.rect(x + w - 10, ly - 5, 10, 10, { fill: T.accent, r: 5 });
  if (sp.mid) {
    const mw = tw(sp.mid, "B", 9) + 36, cx = x + w / 2;
    pg.rect(cx - mw / 2, ly - 11, mw, 22, { fill: T.paper, stroke: T.accent2, sw: 1, r: 11 });
    pg.icon("car", cx - mw / 2 + 9, ly - 8, 15, T.accent, 1.6);
    pg.text(cx - mw / 2 + 28, ly - 4.5, sp.mid, { f: "B", s: 9, c: T.ink });
  }
}

/* Zeitleiste in der Schriftgröße s: Zeilen und Gesamthöhe */
function timelineRows(items, s, w) {
  const lh = s * 1.45, tx = 5.64 * s, rows = []; let h = 0;
  for (const it of items) {
    const lines = wrapAll(it.text || " ", "S", s, w - tx), need = lines.length * lh + s * 0.55;
    rows.push({ it, lines, y: h, need }); h += need;
  }
  return { rows, h, lh, tx };
}

/* Fließtext (Absätze) in der Schriftgröße s */
function paraLines(paras, s, w) {
  const lh = s * 1.45, out = []; let h = 0;
  for (const p of paras) {
    if (!p.trim()) { h += lh * 0.5; continue; }
    for (const l of wrapAll(p, "S", s, w)) { out.push({ t: l, y: h }); h += lh; }
  }
  return { lines: out, h, lh };
}

/* Zeichnet Fließtext in r ab Höhe `top`; wählt die größte Schrift ≤ hi, die passt, sonst kürzt es. Liefert true, wenn alles passt. */
function drawParas(pg, text, r, top, hi, lo) {
  const paras = String(text).split(/\r?\n/), avail = r.h - top;
  let pick = null;
  for (const s of sizeRange(hi, lo)) { const x = paraLines(paras, s, r.w); if (x.h <= avail + 0.5) { pick = { s, ...x }; break; } }
  let fits = true;
  if (!pick) { pick = { s: lo, ...paraLines(paras, lo, r.w) }; fits = false; }
  let lines = pick.lines;
  if (!fits) {
    lines = lines.filter((l) => l.y + pick.lh <= avail + 0.5);
    if (lines.length) lines[lines.length - 1] = { ...lines[lines.length - 1], t: fitT(lines[lines.length - 1].t + " …", "S", pick.s, r.w) };
  }
  lines.forEach((l) => pg.text(r.x, r.y + top + l.y + (pick.lh - pick.s) / 2, l.t, { f: "S", s: pick.s }));
  return fits;
}

/* Stellplatz (Camper): Name und alle Ausstattungsmerkmale, je mit Haken (vorhanden) oder Kreuz (nicht vorhanden) */
function drawCamp(pg, c, r, v) {
  const { d, i, T, warns } = c, cols = r.w >= 190 ? 2 : 1, rows = Math.ceil(CAMP_OPTS.length / cols);
  card(pg, r);
  pg.label(r.x + 12, r.y + 8, "Stellplatz", T.muted);
  pg.icon("camper", r.x + r.w - 12 - 17, r.y + 6, 17, T.accent, 1.5);
  let y = r.y + 21;
  if (v) {
    const l = wrapMax(v, "B", 9.5, r.w - 24, r.h >= 150 ? 2 : 1);
    l.lines.forEach((x, k) => pg.text(r.x + 12, y + k * 12, x, { f: "B", s: 9.5 }));
    y += l.lines.length * 12 + 3;
    if (l.cut) warns.push(`Tag ${i + 1}: Der Name des Stellplatzes ist für die Kachel zu lang und wird gekürzt.`);
  }
  const avail = r.y + r.h - 8 - y, rowH = clamp(avail / rows, 8.5, 15), s = Math.min(9, rowH * 0.74), iw = s * 1.15, colW = (r.w - 24) / cols;
  if (avail < rows * 8.5 - 0.5) warns.push(`Tag ${i + 1}: Die Stellplatz-Angaben passen nicht in die Kachel, bitte die Kachel vergrößern.`);
  CAMP_OPTS.forEach(([id, name], k) => {
    const col = Math.floor(k / rows), row = k % rows, x = r.x + 12 + col * colW, yy = y + row * rowH, on = !!(d.camp && d.camp[id]);
    if (on) pg.icon("check", x, yy + (rowH - iw) / 2 - 0.5, iw, T.accent, 2.4);
    else pg.icon("cross", x + iw * 0.1, yy + (rowH - iw) / 2 - 0.5 + iw * 0.1, iw * 0.8, mix(T.muted, "#FFFFFF", 0.3), 2);
    const label = id === "sonstiges" && on && (d.campNote || "").trim() ? d.campNote.trim() : name;
    pg.text(x + iw + 4, yy + (rowH - s) / 2, fitT(label, "R", s, colW - iw - 8), { s, c: on ? T.ink : T.muted, f: on ? "B" : "R" });
  });
}

/* Nadel (Spitze liegt auf (x, y)) mit Schatten, in Schemafarben */
function drawPin(pg, x, y, s, T) {
  const P = (d, o) => pg.ops.push({ k: "path", x: x - s / 2, y: y - s, w: s, h: s, vw: 100, vh: 100, d, fill: o.fill || null, stroke: o.stroke || null, sw: o.sw || 0, fo: o.fo, so: o.so });
  pg.rect(x - s * 0.22, y - s * 0.04, s * 0.44, s * 0.08, { fill: "#000000", fo: 0.22, r: s * 0.04 });
  P("M50 100C50 100 16 64 16 38a34 34 0 1 1 68 0c0 26-34 62-34 62z", { fill: T.accent2, stroke: "#FFFFFF", sw: 5 });
  P("M50 26a12 12 0 1 0 0.01 0z", { fill: "#FFFFFF" });
}

/* ---------- Die Module ---------- */
const MODULES = {
  leer: { name: "Leer (Platzhalter)", size: () => [1, 1], draw() {} },

  /* Nur ein Symbol, immer 1×1: macht freie Flächen hübscher. tile.sym: "auto" (Wetter des Tages) oder ein Symbol aus SYMBOLS */
  wettersymbol: {
    name: "Wettersymbol", size: () => [1, 1], fixed: [1, 1],
    draw(pg, c, tile, r) {
      const id = tile.sym && tile.sym !== "auto" ? tile.sym : c.d.weather;
      if (!id) return;
      const T = c.T, f = frameFor(pg, c.t, T, r.x, r.y, r.w, r.h), s = Math.min(f.w, f.h), sz = s * 0.8;
      pg.rect(f.x, f.y, f.w, f.h, { fill: T.soft, r: f.rad });
      plainEdge(pg, f, T);
      pg.rect(f.x + (f.w - s * 0.9) / 2, f.y + (f.h - s * 0.9) / 2, s * 0.9, s * 0.9, { fill: "#FFFFFF", fo: 0.6, r: s * 0.45 });
      drawSymbol(pg, id, f.x + (f.w - sz) / 2, f.y + (f.h - sz) / 2, sz, T);
    },
  },

  foto: {
    name: "Foto", size: () => [2, 2],
    draw(pg, c, tile, r) {
      const { t, d, i, T, warns } = c, p = d.photos.find((x) => x.id === tile.photo);
      if (!p) { warns.push(`Tag ${i + 1}: Eine Fotokachel hat noch kein Foto.`); return; }
      const L = photoLines(t, p, r.w, Math.min(6, Math.floor((r.h * 0.4) / LH)), warns, `Tag ${i + 1}`);
      photoBlock(pg, p, r.x, r.y, r.w, r.h, L, T, 0, t.photoStyle);
    },
  },

  wetter: {
    name: "Wetter", size: () => [1, 1],
    draw(pg, c, tile, r) {
      const { d, i, T, warns } = c, wi = weatherInfo(d), v = (wi.value || "").trim(), wxd = dayWxDetail(d);
      if (!v && !wxd && !d.weather) return;
      card(pg, r);
      pg.label(r.x + 12, r.y + 8, "Wetter", T.muted);
      pg.icon(wi.ico, r.x + 11, r.y + 22, 17, T.accent, 1.5);
      const vl = v ? v.split(" · ").slice(0, 2) : []; // Wetter und Temperatur je eine Zeile
      vl.forEach((l, k) => pg.text(r.x + 35, r.y + 22 + k * 12 + (vl.length === 1 ? 3 : 0), fitT(l, "R", 9.5, r.w - 46), { s: 9.5, c: T.ink }));
      if (wxd) {
        const y0 = r.y + 22 + Math.max(1, vl.length) * 12 + 8, n = Math.floor((r.y + r.h - 8 - y0) / 11);
        if (n < 1) warns.push(`Tag ${i + 1}: Die Wetterdetails passen nicht in die Kachel.`);
        else {
          const wl = wrapMax(wxd, "R", 8.5, r.w - 24, n);
          wl.lines.forEach((l, k) => pg.text(r.x + 12, y0 + k * 11, l, { s: 8.5, c: T.ink }));
          if (wl.cut) warns.push(`Tag ${i + 1}: Die Wetterdetails sind für die Kachel zu lang und werden gekürzt.`);
        }
      }
    },
  },

  unterkunft: {
    name: "Unterkunft", size: () => [1, 1],
    draw(pg, c, tile, r) {
      const { d, i, T, warns } = c, v = (d.lodging || "").trim();
      if (d.lodgingKind === "stellplatz") { drawCamp(pg, c, r, v); return; }
      if (!v) return;
      card(pg, r);
      pg.label(r.x + 12, r.y + 8, "Unterkunft", T.muted);
      pg.icon("bed", r.x + 11, r.y + 22, 17, T.accent, 1.5);
      const n = Math.max(1, Math.floor((r.h - 28) / 12)), l = wrapMax(v, "R", 9.5, r.w - 46, Math.min(n, 4));
      l.lines.forEach((x, k) => pg.text(r.x + 35, r.y + 25 + k * 12, x, { s: 9.5 }));
      if (l.cut) warns.push(`Tag ${i + 1}: Die Unterkunft ist für die Kachel zu lang und wird gekürzt.`);
    },
  },

  strecke: {
    name: "Strecke", size: (cols) => [cols, 1],
    draw(pg, c, tile, r) {
      const sp = routeInfo(c.t, c.i), { T } = c;
      if (!sp) return;
      if (r.w >= 300) { routeStrip(pg, sp, T, r.x, r.y + Math.max(0, (r.h - 41) / 2), r.w); return; }
      card(pg, r);
      pg.label(r.x + 12, r.y + 8, "Strecke", T.muted);
      const route = [sp.from, sp.to].filter(Boolean).join(" – "), n = Math.max(1, Math.floor((r.h - 54) / 12));
      if (route) wrapMax(route, "B", 9.5, r.w - 24, Math.min(n, 4)).lines.forEach((l, k) => pg.text(r.x + 12, r.y + 22 + k * 12, l, { f: "B", s: 9.5 }));
      pg.icon("car", r.x + 11, r.y + r.h - 28, 15, T.accent, 1.6);
      pg.text(r.x + 31, r.y + r.h - 24.5, fitT(sp.mid, "B", 9, r.w - 43), { f: "B", s: 9 });
    },
  },

  plan: {
    name: "Tagesplan", size: (cols) => [cols > 3 ? 2 : 1, 3],
    draw(pg, c, tile, r) {
      const { d, i, T, warns } = c, items = parsePlan(d.plan);
      if (!items.length) return;
      pg.label(r.x, r.y, "Tagesplan");
      const top = 16, avail = r.h - top;
      let pick = null;
      for (const s of sizeRange(11, 7)) { const x = timelineRows(items, s, r.w); if (x.h - s * 0.55 <= avail + 0.5) { pick = { s, ...x }; break; } }
      let rows, s;
      if (pick) { rows = pick.rows; s = pick.s; }
      else { s = 7; const x = timelineRows(items, s, r.w); pick = { ...x }; rows = x.rows.filter((q) => q.y + q.lines.length * x.lh <= avail + 0.5); warns.push(`Tag ${i + 1}: Der Tagesplan ist für die Kachel zu lang und wird abgeschnitten.`); }
      if (!rows.length) return;
      const lh = pick.lh, tline = 4.55 * s, tx = pick.tx, y0 = r.y + top, last = rows[rows.length - 1];
      pg.line(r.x + tline, y0 + lh / 2, r.x + tline, y0 + last.y + lh / 2, T.accent2, 1.2);
      for (const q of rows) {
        const y = y0 + q.y;
        if (q.it.time) pg.text(r.x, y + (lh - s * 0.86) / 2, q.it.time, { f: "B", s: s * 0.86, c: T.accent });
        pg.rect(r.x + tline - 2.5, y + lh / 2 - 2.5, 5, 5, { fill: q.it.time ? T.accent : T.accent2, r: 2.5 });
        q.lines.forEach((l, k) => pg.text(r.x + tx, y + k * lh + (lh - s) / 2, l, { f: "S", s }));
      }
    },
  },

  text: {
    name: "Tagebuch", size: (cols) => [cols > 3 ? 2 : cols - 1, 3],
    draw(pg, c, tile, r) {
      const { t, d, i, T, warns } = c, body = String(d.text || "");
      if (!body.trim() && !t.ruled) return;
      pg.label(r.x, r.y, "Tagebuch");
      if (!body.trim()) { for (let y = r.y + 16; y + 16 <= r.y + r.h; y += 16) pg.line(r.x, y + 14, r.x + r.w, y + 14, T.rule, 0.5); return; }
      if (!drawParas(pg, body, r, 16, 11, 7)) warns.push(`Tag ${i + 1}: Das Tagebuch ist für die Kachel zu lang und wird abgeschnitten.`);
    },
  },

  notiz: {
    name: "Notiz (freier Text)", size: (cols) => [2, 1],
    draw(pg, c, tile, r) {
      const body = String(tile.text || "");
      if (!body.trim()) return;
      if (!drawMd(pg, body, r, 0, 11, 7, tile.font || "serif")) c.warns.push(`Tag ${c.i + 1}: Eine Notiz ist für die Kachel zu lang und wird abgeschnitten.`);
    },
  },

  /* Auszug aus der Wikipedia mit Kennzahlen (Fenster in 86-wikidialog.js, Zeichnen in 79-wikipedia.js) */
  wikipedia: {
    name: "Wikipedia-Auszug", size: () => [2, 2],
    draw(pg, c, tile, r) {
      const wp = tile.wp;
      if (!wp || !(wp.title || (wp.text && wp.text.trim()) || (wp.facts || []).some((f) => f.on))) return;
      wikiDraw(pg, c.T, wp, r, c.warns, c.i);
    },
  },

  highlights: {
    name: "Highlights", size: () => [2, 1],
    draw(pg, c, tile, r) {
      const { d, i, T, warns } = c, hl = dayHighlights(d);
      if (!hl.length) return;
      pg.label(r.x, r.y, "Highlights");
      const avail = r.h - 16;
      let pick = null;
      for (const s of sizeRange(9.5, 7)) {
        const lh = s * 1.37, rows = hl.map((h) => wrapMax(h, "R", s, r.w - 13, 3).lines), h = rows.reduce((a, l) => a + l.length * lh + 4, 0);
        if (h <= avail + 0.5) { pick = { s, lh, rows }; break; }
      }
      if (!pick) { const s = 7, lh = s * 1.37; pick = { s, lh, rows: hl.map((h) => wrapMax(h, "R", s, r.w - 13, 3).lines) }; }
      let y = r.y + 16;
      for (const lines of pick.rows) {
        const need = lines.length * pick.lh + 4;
        if (y + need > r.y + r.h + 0.5) { warns.push(`Tag ${i + 1}: Nicht alle Highlights passen in die Kachel.`); break; }
        pg.rect(r.x, y + pick.lh / 2 - 1.5, 4, 4, { fill: T.accent2, r: 2 });
        lines.forEach((l, k) => pg.text(r.x + 13, y + k * pick.lh + (pick.lh - pick.s) / 2, l, { s: pick.s }));
        y += need;
      }
    },
  },

  kosten: {
    name: "Ausgaben", size: (cols) => [Math.max(1, cols - 2), 2],
    draw(pg, c, tile, r) {
      const { t, d, T } = c, costs = d.costs.filter((x) => x.l.trim() || parseNum(x.a));
      if (!costs.length) return;
      pg.label(r.x, r.y, "Ausgaben");
      const s = r.h >= 90 ? 9 : 8, rowH = s * 1.55, max = Math.max(0, Math.floor((r.h - 17 - 22) / rowH));
      const list = costs.length > max ? costs.slice(0, Math.max(0, max - 1)) : costs;
      let y = r.y + 17;
      for (const x of list) {
        const a = money(parseNum(x.a), t.currency), aw = tw(a, "R", s);
        pg.text(r.x, y, fitT(x.l || "–", "R", s, r.w - aw - 8), { s });
        pg.text(r.x + r.w, y, a, { s, a: "r" });
        y += rowH;
      }
      if (costs.length > list.length) {
        const rest = costs.slice(list.length);
        pg.text(r.x, y, `+ ${rest.length} weitere`, { s, c: T.muted });
        pg.text(r.x + r.w, y, money(rest.reduce((q, x) => q + parseNum(x.a), 0), t.currency), { s, a: "r", c: T.muted });
        y += rowH;
      }
      pg.line(r.x, y + 2, r.x + r.w, y + 2, T.rule, 0.8);
      pg.text(r.x, y + 8, "Summe", { f: "B", s: 9.5 });
      pg.text(r.x + r.w, y + 8, money(dayCosts(d), t.currency), { f: "B", s: 9.5, a: "r", c: T.accent });
    },
  },

  karte: {
    name: "Karte (Strecke)", size: () => [2, 2],
    draw(pg, c, tile, r) {
      const { t, i, T, warns } = c;
      if (t.mapImg) {
        const f = frameFor(pg, t, T, r.x, r.y, r.w, r.h);
        pg.img(f.x, f.y, f.w, f.h, t.mapImg, t.mapW, t.mapH, undefined, f.rad);
        plainEdge(pg, f, T);
      } else {
        pg.rect(r.x, r.y, r.w, r.h, { fill: T.soft, r: 8 });
        pg.icon("pin", r.x + r.w / 2 - 12, r.y + r.h / 2 - 20, 24, T.muted, 1.4);
        pg.text(r.x + r.w / 2, r.y + r.h / 2 + 10, fitT("Karte noch nicht erzeugt", "R", 8.5, r.w - 12), { s: 8.5, c: T.muted, a: "c" });
        warns.push(`Tag ${i + 1}: Eine Kartenkachel hat noch keine Karte (Reiter „Karte“).`);
      }
    },
  },

  /* Karte um eine selbst gewählte Position (Fenster in 87-mapdialog.js): Bild aus OSM-Kacheln in tile.ptImg, Nadel, Beschriftung und Quelle als Vektoren */
  punktkarte: {
    name: "Karte (Punkt)", size: () => [2, 2],
    draw(pg, c, tile, r) {
      const pt = tile.pt, { t, i, T, warns } = c;
      if (!pt) return;
      if (!tile.ptImg) {
        pg.rect(r.x, r.y, r.w, r.h, { fill: T.soft, r: 8 });
        pg.icon("pin", r.x + r.w / 2 - 12, r.y + r.h / 2 - 20, 24, T.muted, 1.4);
        pg.text(r.x + r.w / 2, r.y + r.h / 2 + 10, fitT("Kartenbild fehlt, Position neu übernehmen", "R", 8, r.w - 12), { s: 8, c: T.muted, a: "c" });
        warns.push(`Tag ${i + 1}: Einer Punktkarte fehlt das Kartenbild (Position im Fenster neu übernehmen).`);
        return;
      }
      const f = frameFor(pg, t, T, r.x, r.y, r.w, r.h);
      pg.img(f.x, f.y, f.w, f.h, tile.ptImg, tile.ptW, tile.ptH, undefined, f.rad);
      plainEdge(pg, f, T);
      if (tile.ptW && tile.ptW < f.w * 1.6) warns.push(`Tag ${i + 1}: Eine Punktkarte ist für eine kleinere Kachel erzeugt und wirkt unscharf (Position im Fenster neu übernehmen).`);
      drawPin(pg, f.x + f.w / 2, f.y + f.h / 2, clamp(Math.min(f.w, f.h) * 0.2, 18, 34), T);
      const cs = 5.6, cr = pt.credit ? Math.min(f.w * 0.6, tw(pt.credit, "R", cs) + 8) : 0;
      if (cr) {
        pg.rect(f.x + f.w - cr - 3, f.y + f.h - 12, cr, 9.5, { fill: "#FFFFFF", fo: 0.85, r: 3 });
        pg.text(f.x + f.w - cr + 1, f.y + f.h - 10.6, fitT(pt.credit, "R", cs, cr - 8), { s: cs, c: "#333333" });
      }
      const nm = (pt.name || "").trim(), room = f.w - cr - 22;
      if (nm && room >= 30) {
        const lw = Math.min(room, tw(nm, "SB", 8.5) + 14);
        pg.rect(f.x + 5, f.y + f.h - 20, lw, 15, { fill: "#FFFFFF", fo: 0.92, r: 7.5 });
        pg.text(f.x + 12, f.y + f.h - 16.2, fitT(nm, "SB", 8.5, lw - 14), { f: "SB", s: 8.5, c: T.ink });
      }
    },
  },

  kennzahlen: {
    name: "Kennzahlen", size: (cols) => [cols, 1],
    draw(pg, c, tile, r) {
      const { t, T, st } = c, list = defaultStats(t, st), g = 8;
      const nc = clamp(Math.round(r.w / 110), 1, 4), nr = Math.max(1, Math.min(Math.ceil(list.length / nc), Math.floor((r.h + g) / (34 + g))));
      const bw = (r.w - g * (nc - 1)) / nc, bh = Math.min(64, (r.h - g * (nr - 1)) / nr);
      list.slice(0, nc * nr).forEach((s, k) => {
        const x = r.x + (k % nc) * (bw + g), y = r.y + Math.floor(k / nc) * (bh + g), vs = clamp(bh * 0.33, 10, 21);
        pg.rect(x, y, bw, bh, { fill: T.soft, r: 8 });
        pg.text(x + 10, y + bh * 0.2, fitT(s.v, "SB", vs, bw - 20), { f: "SB", s: vs, c: T.accent });
        pg.text(x + 10, y + bh * 0.2 + vs + 6, fitT(s.l.toUpperCase(), "B", 6.8, bw - 20, 1), { f: "B", s: 6.8, c: T.muted, ls: 1 });
      });
      if (list.length > nc * nr) c.warns.push(`Tag ${c.i + 1}: Nicht alle Kennzahlen passen in die Kachel.`);
    },
  },
};

/* ---------- Vorschläge für den Seitenaufbau ----------
   build(cols) liefert die Kacheln einer Seite; Fotokacheln bekommen beim Anwenden die Fotos des Tages (applyLayout in 10-model.js). */
const LAYOUTS = [
  { id: "tag", name: "Tagesübersicht", build: (cols) => defaultPages(cols)[0].tiles },
  { id: "tagebuch", name: "Tagebuch groß", build: (cols) => [newTile("strecke", cols, 1), newTile("wetter"), newTile("unterkunft"), newTile("highlights", Math.max(1, cols - 2), 1), newTile("text", cols, 4)] },
  { id: "panorama", name: "Panorama und Text", build: (cols) => [newTile("strecke", cols, 1), newTile("foto", cols, 2), newTile("text", cols - 1, 3), newTile("wetter"), newTile("unterkunft"), newTile("kosten")] },
  { id: "fotos", name: "Fotoseite (große Bilder)", build: (cols) => (cols >= 4 ? [0, 1, 2, 3].map(() => newTile("foto", 2, 3)) : [0, 1, 2].map(() => newTile("foto", 3, 2))) },
  { id: "pano2", name: "Zwei Panoramen", build: (cols) => [newTile("foto", cols, 3), newTile("foto", cols, 3)] },
];
