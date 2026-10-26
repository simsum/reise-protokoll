/* ---------- Markdown für Notiz-Kacheln ----------
   Unterstützt: # ## ### Überschriften, **fett**, *kursiv* / _kursiv_, ***beides***, `Code`, - * + Aufzählung, 1. Nummerierung,
   > Zitat, --- Trennlinie, [Text](Adresse) (nur der Text, Links gibt es im PDF nur als feste Adressen), \* maskiert ein Zeichen.
   Eine Zeile im Text ist eine Zeile im PDF (wie beim Tagebuch), eine Leerzeile ein halber Abstand. Schriftfamilien sind die PDF-Standardschriften
   (Serif = Times, Sans = Helvetica/Arial, Mono = Courier), damit Vorschau und PDF gleich umbrechen. */
const FAMILIES = {
  serif: { name: "Serif (Times)", r: "S", b: "SB", i: "SI", bi: "SBI" },
  sans: { name: "Sans (Helvetica / Arial)", r: "R", b: "B", i: "I", bi: "BI" },
  mono: { name: "Mono (Courier)", r: "C", b: "CB", i: "CI", bi: "CBI" },
};
const fontKey = (fam, bold, ital) => { const f = FAMILIES[fam] || FAMILIES.serif; return bold ? (ital ? f.bi : f.b) : (ital ? f.i : f.r); };

/* Zeile → Abschnitte [{t, bold, ital, code}] */
function mdInline(src, base) {
  const segs = []; let bold = !!base.bold, ital = !!base.ital, code = false, buf = "";
  const flush = () => { if (buf) { segs.push({ t: buf, bold, ital, code }); buf = ""; } };
  const alnum = (c) => !!c && /[\p{L}\p{N}]/u.test(c), blank = (c) => !c || /\s/.test(c);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (code) { if (ch === "`") { flush(); code = false; } else buf += ch; continue; }
    if (ch === "\\" && i + 1 < src.length && "*_`[]\\#>-".includes(src[i + 1])) { buf += src[++i]; continue; }
    if (ch === "`") { flush(); code = true; continue; }
    if (ch === "[") {
      const m = /^\[([^\]]*)\]\(([^)]*)\)/.exec(src.slice(i));
      if (m) { buf += m[1]; i += m[0].length - 1; continue; }
    }
    if (ch === "*" || ch === "_") {
      let n = 1; while (src[i + n] === ch) n++;
      const prev = src[i - 1], next = src[i + n];
      if (ch === "_" && alnum(prev) && alnum(next)) { buf += ch.repeat(n); i += n - 1; continue; } // Unterstrich im Wort
      const canOpen = !blank(next), canClose = !blank(prev);
      const left = Math.min(n, 3), wantBold = left >= 2, wantItal = left === 1 || left === 3;
      let lit = n - left, togB = false, togI = false;
      if (wantBold) { if (bold ? canClose : canOpen) togB = true; else lit += 2; }
      if (wantItal) { if (ital ? canClose : canOpen) togI = true; else lit += 1; }
      if (togB || togI) flush(); // nur bei echter Auszeichnung einen neuen Abschnitt beginnen
      if (togB) bold = !bold;
      if (togI) ital = !ital;
      if (lit) buf += ch.repeat(lit);
      i += n - 1; continue;
    }
    buf += ch;
  }
  flush();
  return segs;
}

/* Text → Blöcke */
function mdBlocks(text) {
  const out = [];
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    let m;
    if (!line.trim()) out.push({ k: "gap" });
    else if ((m = /^\s*(#{1,3})\s+(.*)$/.exec(line))) out.push({ k: "h", lvl: m[1].length, text: m[2] });
    else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) out.push({ k: "hr" });
    else if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(line))) out.push({ k: "li", lvl: Math.min(2, Math.floor(m[1].length / 2)), mark: "•", text: m[2] });
    else if ((m = /^(\s*)(\d{1,3})[.)]\s+(.*)$/.exec(line))) out.push({ k: "li", lvl: Math.min(2, Math.floor(m[1].length / 2)), mark: m[2] + ".", text: m[3] });
    else if ((m = /^>\s?(.*)$/.exec(line))) out.push({ k: "q", text: m[1] });
    else out.push({ k: "p", text: line });
  }
  return out;
}

/* Abschnitte → Zeilen mit Läufen [{t, f, x}] (Breite w, Schriftgröße size); Leerzeichen werden als Abstand gerechnet */
function mdWrap(segs, w, size, fam) {
  const words = []; let cur = null;
  const end = (gapF) => { if (cur) { cur.gap = tw(" ", gapF, size); cur.gapF = gapF; words.push(cur); cur = null; } };
  for (const sg of segs) {
    const f = sg.code ? fontKey("mono", sg.bold, sg.ital) : fontKey(fam, sg.bold, sg.ital);
    for (const ch of clean(sg.t)) {
      if (/\s/.test(ch)) { end(f); continue; }
      if (!cur) cur = { parts: [], w: 0 };
      const last = cur.parts[cur.parts.length - 1];
      if (last && last.f === f) last.t += ch; else cur.parts.push({ t: ch, f });
    }
  }
  end(fontKey(fam, false, false));
  words.forEach((wd) => { wd.parts.forEach((p) => { p.w = tw(p.t, p.f, size); }); wd.w = wd.parts.reduce((a, p) => a + p.w, 0); });
  /* zu lange Wörter zeichenweise teilen */
  const pieces = [];
  for (const wd of words) {
    if (wd.w <= w) { pieces.push(wd); continue; }
    let chunk = { parts: [], w: 0, gap: 0 };
    for (const p of wd.parts) for (const ch of p.t) {
      const cw = tw(ch, p.f, size);
      if (chunk.w + cw > w && chunk.parts.length) { pieces.push(chunk); chunk = { parts: [], w: 0, gap: 0 }; }
      const last = chunk.parts[chunk.parts.length - 1];
      if (last && last.f === p.f) { last.t += ch; last.w += cw; } else chunk.parts.push({ t: ch, f: p.f, w: cw });
      chunk.w += cw;
    }
    chunk.gap = wd.gap; chunk.gapF = wd.gapF; pieces.push(chunk);
  }
  const lines = []; let line = [], lw = 0;
  /* aufeinanderfolgende Wörter in derselben Schrift werden ein Lauf (mit Leerzeichen), damit der Text im PDF zusammenhängend bleibt */
  const push = () => {
    if (!line.length) return;
    let x = 0; const runs = [];
    line.forEach((wd, k) => {
      wd.parts.forEach((p, j) => {
        const last = runs[runs.length - 1], prev = line[k - 1];
        if (j === 0 && k > 0 && last && last.f === p.f && prev.gapF === p.f) last.t += " " + p.t; else runs.push({ t: p.t, f: p.f, x });
        x += p.w;
      });
      if (k < line.length - 1) x += wd.gap;
    });
    lines.push(runs); line = []; lw = 0;
  };
  for (const wd of pieces) {
    const need = line.length ? lw + line[line.length - 1].gap + wd.w : wd.w;
    if (line.length && need > w + 0.01) push();
    lw = line.length ? lw + line[line.length - 1].gap + wd.w : wd.w;
    line.push(wd);
  }
  push();
  return lines.length ? lines : [[]];
}

/* Gesamtlayout bei Grundschrift s: Elemente mit Höhe und Zeilen */
function mdLayout(text, s, w, fam) {
  const items = []; let y = 0; const lh = s * 1.45;
  for (const b of mdBlocks(text)) {
    if (b.k === "gap") { y += lh * 0.5; continue; }
    if (b.k === "hr") { items.push({ k: "hr", y: y + lh * 0.35 }); y += lh * 0.7; continue; }
    if (b.k === "h") {
      const size = s * [1.6, 1.35, 1.15][b.lvl - 1], hl = size * 1.25;
      if (y > 0) y += size * 0.3;
      const lines = mdWrap(mdInline(clean(b.text), { bold: true }), w, size, fam);
      items.push({ k: "lines", y, x: 0, size, lh: hl, lines, bold: true }); y += lines.length * hl + size * 0.15; continue;
    }
    const ind = b.k === "li" ? s * 1.2 * (b.lvl + 1) : b.k === "q" ? s * 0.9 : 0;
    const lines = mdWrap(mdInline(clean(b.text), { ital: b.k === "q" }), w - ind, s, fam);
    items.push({ k: "lines", y, x: ind, size: s, lh, lines, mark: b.k === "li" ? { t: b.mark, f: fontKey(fam, false, false), x: ind - s * 1.2 + (b.mark === "•" ? s * 0.25 : 0) } : null, bar: b.k === "q" });
    y += lines.length * lh;
  }
  return { items, h: y, lh };
}

/* Zeichnet Markdown in r ab Höhe top; größte Schrift ≤ hi, die passt, sonst kürzen. Liefert true, wenn alles passt. */
function drawMd(pg, text, r, top, hi, lo, fam) {
  const avail = r.h - top, T = pg.T;
  let pick = null;
  for (const s of sizeRange(hi, lo)) { const x = mdLayout(text, s, r.w, fam); if (x.h <= avail + 0.5) { pick = { s, ...x }; break; } }
  let fits = true;
  if (!pick) { pick = { s: lo, ...mdLayout(text, lo, r.w, fam) }; fits = false; }
  let drawn = 0;
  for (const it of pick.items) {
    if (it.k === "hr") { if (it.y <= avail) pg.line(r.x, r.y + top + it.y, r.x + r.w, r.y + top + it.y, T.rule, 0.6); continue; }
    let lines = it.lines;
    if (!fits) lines = lines.filter((_, k) => it.y + (k + 1) * it.lh <= avail + 0.5);
    if (!lines.length) continue;
    const cut = !fits && lines.length < it.lines.length;
    lines.forEach((runs, k) => {
      const y = r.y + top + it.y + k * it.lh;
      if (cut && k === lines.length - 1 && runs.length) { const l = runs[runs.length - 1]; runs = [...runs.slice(0, -1), { ...l, t: fitT(l.t + " …", l.f, it.size, r.w - it.x - l.x) }]; }
      runs.forEach((q) => pg.text(r.x + it.x + q.x, y + (it.lh - it.size) / 2, q.t, { f: q.f, s: it.size }));
      if (k === 0 && it.mark) pg.text(r.x + it.mark.x, y + (it.lh - it.size) / 2, it.mark.t, { f: it.mark.f, s: it.size });
    });
    if (it.bar) pg.rect(r.x + it.size * 0.2, r.y + top + it.y + 1, 2, lines.length * it.lh - 2, { fill: T.accent2 });
    drawn++;
  }
  return fits && drawn >= 0;
}
