/* ---------- Kacheln in der Vorschau bearbeiten ----------
   Über jeder Tagesseite liegt eine Schicht aus Rahmen (`.tl`), je einer pro Kachel (Maße aus `pg.meta`, das layoutTrip() liefert).
   Anklicken wählt eine Kachel (Werkzeugleiste #tb), Ziehen verschiebt sie auf eine andere Stelle (auch auf eine andere Seite desselben Tages),
   die Ecke unten rechts ändert die Größe im Raster, ein Klick auf freie Fläche fügt eine Kachel ein. Die Schicht ist nur Oberfläche und nicht Teil des PDFs. */
S.sel = null;   // gewählte Kachel {dayId, pageId, tileId}
S.pages = [];   // Seiten der letzten Vorschau
let ia = null;  // laufende Bedienung (Klick, Ziehen, Größe, freie Fläche)

function tileOverlay(pg) {
  const m = pg.meta; if (!m) return "";
  const gw = m.cols * m.colW + (m.cols - 1) * m.gap, gh = m.rows * m.rowH + (m.rows - 1) * m.gap, p = (v, tot) => (v / tot * 100).toFixed(3) + "%";
  const used = new Set(); m.tiles.forEach((q) => { for (let y = q.r; y < q.r + q.h; y++) for (let x = q.c; x < q.c + q.w; x++) used.add(y * m.cols + x); });
  let free = "";
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) if (!used.has(r * m.cols + c)) free += `<div class="fc" style="left:${p(c * (m.colW + m.gap), gw)};top:${p(r * (m.rowH + m.gap), gh)};width:${p(m.colW, gw)};height:${p(m.rowH, gh)}"></div>`;
  const bar = `<div class="pbar"><button data-pb="add" title="Neue leere Seite danach einfügen">+ Seite</button>${m.spill ? "" : `<button data-pb="up" title="Seite nach vorn">↑</button><button data-pb="down" title="Seite nach hinten">↓</button><button data-pb="del" title="Diese Seite mit allen Kacheln löschen">✕</button>`}
    <select data-pb="preset" title="Seitenaufbau aus einem Vorschlag"><option value="">Aufbau …</option>${LAYOUTS.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("")}</select><button data-pb="brush" title="Format übertragen: Aufbau dieser Seite auf andere Seiten übernehmen">🖌 Format</button></div>`;
  return `${bar}${m.spill ? `<div class="ovf">Fortsetzung: Diese Kacheln hatten auf der Seite davor keinen Platz</div>` : ""}<div class="ov" style="left:${p(m.x0, pg.W)};top:${p(m.y0, pg.H)};width:${p(gw, pg.W)};height:${p(gh, pg.H)}">${free}${m.tiles.map((q) =>
    `<div class="tl${q.empty ? " empty" : ""}${(MODULES[q.mod] || {}).fixed ? " fixed" : ""}" data-id="${q.id}" style="left:${p(q.rx - m.x0, gw)};top:${p(q.ry - m.y0, gh)};width:${p(q.rw, gw)};height:${p(q.rh, gh)}"><span class="tn">${esc((MODULES[q.mod] || MODULES.leer).name)}</span>${q.empty ? `<span class="te">${q.mod === "foto" ? "Kein Foto gewählt" : q.mod === "leer" ? "Leer" : "Nichts eingetragen"}</span>` : ""}<i class="hd" title="Größe ändern"></i></div>`).join("")}</div>`;
}

/* Kontext der gewählten Kachel: Tag, Seite, Kachel */
function selCtx() {
  const s = S.sel; if (!s) return null;
  const d = dayOf(s.dayId), pg = d && d.pages.find((p) => p.id === s.pageId), tile = pg && pg.tiles.find((x) => x.id === s.tileId);
  return tile ? { d, pg, tile } : null;
}
const metaOfTile = (id) => { for (const pg of S.pages) if (pg.meta) { const q = pg.meta.tiles.find((x) => x.id === id); if (q) return { pg, m: pg.meta, q }; } return null; };

/* nach jedem Rendern der Vorschau: Auswahl wiederfinden oder verwerfen */
function syncSelection() {
  if (S.sel && !(selCtx() && metaOfTile(S.sel.tileId))) { S.sel = null; if (ia && ia.mode !== "menu") ia = null; }
  $$("#pages .tl.sel").forEach((e) => e.classList.remove("sel"));
  if (S.sel) { const e = $(`#pages .tl[data-id="${S.sel.tileId}"]`); if (e) e.classList.add("sel"); }
  if (ia && ia.mode === "menu") placeToolbar(ia.at);
  else if (S.sel) placeToolbar();
  else hideToolbar();
}

function tileChanged() { changed(); clearTimeout(prevTimer); renderPreview(); if (S.tab === "days") renderPanel(); if (S.sel) buildToolbar(); }
function select(sel) {
  S.sel = sel; ia = null;
  $$("#pages .tl.sel").forEach((e) => e.classList.remove("sel"));
  if (sel) { const e = $(`#pages .tl[data-id="${sel.tileId}"]`); if (e) e.classList.add("sel"); buildToolbar(); } else hideToolbar();
}

/* ---------- Werkzeugleiste ---------- */
function hideToolbar() { const tb = $("#tb"); tb.hidden = true; tb.innerHTML = ""; }
function buildToolbar() {
  const tb = $("#tb"), c = selCtx(); if (!c) { hideToolbar(); return; }
  const t = S.trip, { tile, d } = c, w = clamp(tile.w, 1, t.cols), h = clamp(tile.h, 1, GRID_ROWS), idx = c.pg.tiles.indexOf(tile), inUse = photosInUse(d, tile), fixed = MODULES[tile.mod] && MODULES[tile.mod].fixed;
  const sz = ([a, b]) => `<button data-tb="size" data-w="${a}" data-h="${b}" aria-pressed="${w === Math.min(a, t.cols) && h === b}">${a}×${b}</button>`;
  tb.innerHTML = `<div class="tbrow"><select data-tb="mod" title="Modul">${Object.entries(MODULES).map(([id, m]) => `<option value="${id}" ${id === tile.mod ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>
    ${tile.mod === "foto" ? `<select data-tb="photo" title="Foto"><option value="">– Foto wählen –</option>${d.photos.map((p, n) => `<option value="${p.id}" ${p.id === tile.photo ? "selected" : ""}>${n + 1}: ${esc(p.name)}${inUse.has(p.id) ? " (schon platziert, wird verschoben)" : ""}</option>`).join("")}</select>` : ""}
    <button class="ico" data-tb="prev" title="In der Reihenfolge nach vorn" ${idx <= 0 ? "disabled" : ""}>◀</button><button class="ico" data-tb="next" title="In der Reihenfolge nach hinten" ${idx >= c.pg.tiles.length - 1 ? "disabled" : ""}>▶</button>
    <button class="ico" data-tb="del" title="Kachel entfernen">✕</button></div>
    ${fixed ? `<div class="tbrow"><small>feste Größe 1×1</small></div>` : `<div class="tbrow">${SIZES.map(sz).join("")}<button data-tb="size" data-w="${t.cols}" data-h="1" aria-pressed="${w === t.cols && h === 1}">Ganze Breite</button><small>${w}×${h}</small></div>`}
    ${tile.mod === "punktkarte" ? `<div class="tbrow"><button data-tb="pm">${tile.pt ? "Position ändern …" : "Position wählen …"}</button></div>` : ""}
    ${tile.mod === "wikipedia" ? `<div class="tbrow"><button data-tb="wp">${tile.wp ? "Wikipedia bearbeiten …" : "Wikipedia suchen …"}</button></div>` : ""}
    ${tile.mod === "wettersymbol" ? `<div class="tbrow"><select data-tb="sym" title="Symbol"><option value="auto" ${!tile.sym || tile.sym === "auto" ? "selected" : ""}>Wetter des Tages (automatisch)</option>${SYMBOLS.map((q) => `<option value="${q.id}" ${tile.sym === q.id ? "selected" : ""}>${esc(q.name)}</option>`).join("")}</select></div>` : ""}
    ${tile.mod === "notiz" ? `<div class="tbrow"><select data-tb="font" title="Schrift">${Object.entries(FAMILIES).map(([id, f]) => `<option value="${id}" ${(tile.font || "serif") === id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select>
      <button data-tb="md" data-md="b" title="Fett (**Text**)"><b>B</b></button><button data-tb="md" data-md="i" title="Kursiv (*Text*)"><i>I</i></button><button data-tb="md" data-md="h" title="Überschrift (## )">H</button><button data-tb="md" data-md="ul" title="Aufzählung (- )">•</button><button data-tb="md" data-md="ol" title="Nummerierung (1. )">1.</button><button data-tb="md" data-md="q" title="Zitat (> )">❝</button><button data-tb="md" data-md="hr" title="Trennlinie (---)">―</button></div>
      <textarea data-tb="text" rows="4" placeholder="Freier Text. Markdown: **fett**, *kursiv*, # Überschrift, - Liste">${esc(tile.text || "")}</textarea>` : ""}`;
  tb.hidden = false; placeToolbar();
}
/* Leiste über (sonst unter) der gewählten Kachel, im sichtbaren Bereich der Vorschau */
function placeToolbar(at) {
  const tb = $("#tb"); if (tb.hidden) return;
  const v = $("#pages").getBoundingClientRect(), el = at ? null : $("#pages .tl.sel");
  const r = at ? { left: at.x, right: at.x, top: at.y, bottom: at.y } : el && el.getBoundingClientRect();
  if (!r || r.bottom < v.top || r.top > v.bottom) { tb.style.visibility = "hidden"; return; }
  tb.style.visibility = "visible";
  const h = tb.offsetHeight, w = tb.offsetWidth;
  let top = r.top - h - 6; if (top < v.top + 2) top = Math.min(r.bottom + 6, v.bottom - h - 2);
  tb.style.top = Math.max(v.top + 2, top) + "px";
  tb.style.left = clamp(r.left, v.left + 4, Math.max(v.left + 4, v.right - w - 4)) + "px";
}

/* ---------- Einfügeposition: vor der ersten Kachel ab der Zielzelle (in der Reihenfolge der Seite) ---------- */
function insertIndex(list, m, cellIdx, exclude) {
  const placed = m.tiles.map((q) => ({ q, pos: q.r * m.cols + q.c })).filter((x) => x.q.id !== (exclude && exclude.id));
  const next = placed.find((x) => x.pos >= cellIdx), pick = (id) => list.findIndex((x) => x.id === id);
  if (next) return pick(next.q.id);
  const last = placed.length ? placed[placed.length - 1] : null;
  return last ? pick(last.q.id) + 1 : list.length;
}
const cellAt = (m, x, y) => ({ c: clamp(Math.floor((x - m.x0) / (m.colW + m.gap)), 0, m.cols - 1), r: clamp(Math.floor((y - m.y0) / (m.rowH + m.gap)), 0, m.rows - 1) });
/* Zeigerposition in Seitenkoordinaten (pt) der Seite unter dem Zeiger */
function pagePoint(e) {
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    const sh = el.closest && el.closest("#pages .sheet"); if (!sh) continue;
    const pg = S.pages[+sh.dataset.pi], rc = sh.getBoundingClientRect();
    return { sh, pg, rc, x: (e.clientX - rc.left) / rc.width * pg.W, y: (e.clientY - rc.top) / rc.height * pg.H };
  }
  return null;
}
const screenRect = (p, x, y, w, h) => ({ left: p.rc.left + x / p.pg.W * p.rc.width, top: p.rc.top + y / p.pg.H * p.rc.height, width: w / p.pg.W * p.rc.width, height: h / p.pg.H * p.rc.height });
function showGhost(r, ok) {
  let g = $("#ghost"); if (!g) { g = document.createElement("div"); g.id = "ghost"; document.body.appendChild(g); }
  if (!r) { g.hidden = true; return; }
  g.hidden = false; g.className = ok === false ? "bad" : "";
  Object.assign(g.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
}

/* ---------- Bedienung ---------- */
function bindPreviewTiles() {
  const pages = $("#pages");
  pages.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    const sh = e.target.closest(".sheet"); if (!sh) return;
    if (e.target.closest(".pbar")) return;
    const pg = S.pages[+sh.dataset.pi], m = pg && pg.meta;
    if (!m) { select(null); return; }
    if (S.brush) { e.preventDefault(); paintPage(m.dayId, m.pageId); return; }
    const tl = e.target.closest(".tl");
    if (e.pointerType === "mouse") e.preventDefault();
    if (e.target.classList.contains("hd") && tl) { ia = { mode: "resize", id: tl.dataset.id, x: e.clientX, y: e.clientY }; return; }
    if (tl) {
      select({ dayId: m.dayId, pageId: m.pageId, tileId: tl.dataset.id });
      ia = { mode: "pending", id: tl.dataset.id, x: e.clientX, y: e.clientY };
      return;
    }
    select(null);
    const p = pagePoint(e); if (p) ia = { mode: "empty", x: e.clientX, y: e.clientY, pi: +sh.dataset.pi, pt: p };
  });
  document.addEventListener("pointermove", (e) => {
    if (!ia) return;
    if (ia.mode === "pending" && Math.hypot(e.clientX - ia.x, e.clientY - ia.y) > 6) { ia.mode = "drag"; document.body.classList.add("moving"); }
    if (ia.mode === "drag") {
      const p = pagePoint(e), src = metaOfTile(ia.id);
      if (!p || !p.pg.meta || !src) { showGhost(null); ia.target = null; return; }
      const m = p.pg.meta, cell = cellAt(m, p.x, p.y), w = Math.min(src.q.w, m.cols - cell.c), h = Math.min(src.q.h, m.rows - cell.r), okDay = m.dayId === src.m.dayId;
      ia.target = okDay ? { pg: p.pg, cell } : null;
      showGhost(screenRect(p, m.x0 + cell.c * (m.colW + m.gap), m.y0 + cell.r * (m.rowH + m.gap), w * m.colW + (w - 1) * m.gap, h * m.rowH + (h - 1) * m.gap), okDay);
    }
    if (ia.mode === "resize") {
      const src = metaOfTile(ia.id), sh = src && $(`#pages .sheet[data-pi="${S.pages.indexOf(src.pg)}"]`); if (!src || !sh) return;
      const rc = sh.getBoundingClientRect(), x = (e.clientX - rc.left) / rc.width * src.pg.W, y = (e.clientY - rc.top) / rc.height * src.pg.H, m = src.m;
      const w = clamp(Math.floor((x - m.x0) / (m.colW + m.gap)) - src.q.c + 1, 1, m.cols - src.q.c), h = clamp(Math.floor((y - m.y0) / (m.rowH + m.gap)) - src.q.r + 1, 1, m.rows - src.q.r);
      ia.size = { w, h };
      showGhost(screenRect({ pg: src.pg, rc }, src.q.rx, src.q.ry, w * m.colW + (w - 1) * m.gap, h * m.rowH + (h - 1) * m.gap));
    }
  });
  document.addEventListener("pointerup", (e) => {
    const a = ia; if (!a || a.mode === "menu") return; // Einfügen-Menü bleibt offen, auch wenn man hineinklickt
    showGhost(null); document.body.classList.remove("moving");
    if (a.mode === "drag" && a.target) {
      const src = selCtx(), m = a.target.pg.meta, d = src.d;
      const dst = d.pages.find((p) => p.id === m.pageId) || (() => { const np = newPage(); d.pages.push(np); return np; })();
      const idx = insertIndex(dst.tiles, m, a.target.cell.r * m.cols + a.target.cell.c, src.tile);
      const ref = dst.tiles[idx] && dst.tiles[idx] !== src.tile ? dst.tiles[idx] : null;
      src.pg.tiles = src.pg.tiles.filter((x) => x !== src.tile);
      dst.tiles.splice(ref ? dst.tiles.indexOf(ref) : Math.min(idx, dst.tiles.length), 0, src.tile);
      S.sel = { dayId: d.id, pageId: dst.id, tileId: src.tile.id };
      ia = null; tileChanged(); return;
    }
    if (a.mode === "resize" && a.size) { const c = selCtx(); if (c) { c.tile.w = a.size.w; c.tile.h = a.size.h; ia = null; tileChanged(); return; } }
    if (a.mode === "empty" && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 6) { openAddMenu(a, e); return; }
    ia = null;
  });
  document.addEventListener("pointercancel", () => { showGhost(null); document.body.classList.remove("moving"); if (ia && ia.mode !== "menu") ia = null; });

  /* Werkzeugleiste */
  const tb = $("#tb");
  tb.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tb]"); if (!b) return;
    const c = selCtx(), t = S.trip;
    if (b.dataset.tb === "cancel") { ia = null; hideToolbar(); return; }
    if (b.dataset.tb === "pm") { const c1 = selCtx(); if (c1) openPointMap(c1.tile, c1.d); return; }
    if (b.dataset.tb === "wp") { const c0 = selCtx(); if (c0) openWikipedia(c0.tile, c0.d); return; }
    if (b.dataset.tb === "md") { mdApply($('#tb [data-tb="text"]'), b.dataset.md); return; }
    if (!c) return;
    if (b.dataset.tb === "size") { c.tile.w = Math.min(+b.dataset.w, t.cols); c.tile.h = +b.dataset.h; }
    else if (b.dataset.tb === "prev" || b.dataset.tb === "next") moveIn(c.pg.tiles, c.pg.tiles.indexOf(c.tile), b.dataset.tb === "prev" ? -1 : 1);
    else if (b.dataset.tb === "del") { c.pg.tiles = c.pg.tiles.filter((x) => x !== c.tile); S.sel = null; }
    tileChanged();
  });
  tb.addEventListener("change", (e) => {
    const el = e.target, c = selCtx();
    if (el.dataset.tb === "add") { addFromMenu(el.value); return; }
    if (!c) return;
    if (el.dataset.tb === "mod") { setTileMod(c.tile, el.value); if (el.value === "wikipedia" && !c.tile.wp) { tileChanged(); openWikipedia(c.tile, c.d); return; } if (el.value === "punktkarte" && !c.tile.pt) { tileChanged(); openPointMap(c.tile, c.d); return; } }
    if (el.dataset.tb === "sym") c.tile.sym = el.value;
    if (el.dataset.tb === "photo") setTilePhoto(c.d, c.tile, el.value);
    if (el.dataset.tb === "font") c.tile.font = el.value;
    tileChanged();
  });
  tb.addEventListener("input", (e) => {
    const c = selCtx(); if (e.target.dataset.tb !== "text" || !c) return;
    c.tile.text = e.target.value; changed();
  });
  document.addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || "") || !$("#editor").hidden || !$("#wp").hidden || !$("#pm").hidden) return;
    if (e.key === "Escape" && S.brush) { endBrush(); return; }
    if (e.key === "Escape" && (S.sel || ia)) select(null);
    if ((e.key === "Delete" || e.key === "Backspace") && S.sel) { const c = selCtx(); if (c) { e.preventDefault(); c.pg.tiles = c.pg.tiles.filter((x) => x !== c.tile); S.sel = null; tileChanged(); } }
  });
  /* Seitenleiste über jeder Tagesseite */
  pages.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-pb]"); if (!b) return;
    const m = S.pages[+b.closest(".sheet").dataset.pi].meta, d = m && dayOf(m.dayId); if (!d) return;
    const t = S.trip, act = b.dataset.pb;
    if (act === "add") d.pages.splice(m.pageIdx + 1, 0, newPage());
    else if (act === "up" || act === "down") moveIn(d.pages, m.pageIdx, act === "up" ? -1 : 1);
    else if (act === "del") d.pages.splice(m.pageIdx, 1);
    else if (act === "brush") { const pg = d.pages[m.pageIdx]; if (!pg) return; startBrush(JSON.parse(JSON.stringify(pg.tiles)), d.id, m.pageIdx); return; }
    S.sel = null; tileChanged();
  });
  pages.addEventListener("change", (e) => {
    const el = e.target; if (el.dataset.pb !== "preset" || !el.value) return;
    const m = S.pages[+el.closest(".sheet").dataset.pi].meta, d = m && dayOf(m.dayId), l = LAYOUTS.find((x) => x.id === el.value); if (!d || !l) return;
    let pg = d.pages[m.pageIdx]; if (!pg) { pg = newPage(); d.pages.push(pg); }
    const n = applyLayout(d, pg, l.build(S.trip.cols), S.trip.cols);
    S.sel = null; tileChanged();
    toast(`Aufbau „${l.name}“ angewendet${n ? `, ${n} ${n === 1 ? "weiteres Foto" : "weitere Fotos"} auf einer zusätzlichen Seite` : ""}.`);
  });
  /* Doppelklick: passenden Editor öffnen */
  pages.addEventListener("dblclick", (e) => {
    const tl = e.target.closest(".tl"); if (!tl || S.brush) return;
    const c = selCtx(); if (c && c.tile.id === tl.dataset.id) editTile(c.d, c.tile);
  });
  $("#brushAll").addEventListener("click", paintAll);
  $("#brushEnd").addEventListener("click", endBrush);
  pages.addEventListener("scroll", () => placeToolbar(ia && ia.mode === "menu" ? ia.at : undefined));
  window.addEventListener("resize", () => placeToolbar(ia && ia.mode === "menu" ? ia.at : undefined));
}

/* Freie Fläche angeklickt: Modul wählen und dort einfügen */
function openAddMenu(a, e) {
  const pg = S.pages[a.pi], m = pg && pg.meta; if (!m) { ia = null; return; }
  ia = { mode: "menu", dayId: m.dayId, pageId: m.pageId, pi: a.pi, cell: cellAt(m, a.pt.x, a.pt.y), at: { x: e.clientX, y: e.clientY } };
  const tb = $("#tb");
  tb.innerHTML = `<div class="tbrow"><select data-tb="add"><option value="">+ Kachel einfügen …</option>${Object.entries(MODULES).map(([id, md]) => `<option value="${id}">${esc(md.name)}</option>`).join("")}</select><button class="ico" data-tb="cancel" title="Abbrechen">✕</button></div>`;
  tb.hidden = false; placeToolbar(ia.at);
}
function addFromMenu(mod) {
  const a = ia; if (!a || a.mode !== "menu" || !mod) return;
  const d = dayOf(a.dayId), pg0 = S.pages[a.pi], m = pg0 && pg0.meta; if (!d || !m) { ia = null; hideToolbar(); return; }
  let pg = d.pages.find((p) => p.id === a.pageId); if (!pg) { pg = newPage(); d.pages.push(pg); }
  const tile = tileOf(mod, S.trip.cols);
  pg.tiles.splice(insertIndex(pg.tiles, m, a.cell.r * m.cols + a.cell.c, null), 0, tile);
  S.sel = { dayId: d.id, pageId: pg.id, tileId: tile.id }; ia = null;
  tileChanged();
  if (mod === "wikipedia") openWikipedia(tile, d);
  if (mod === "punktkarte") openPointMap(tile, d);
}

/* ---------- Doppelklick auf eine Kachel: dorthin springen, wo man sie bearbeitet ---------- */
const TILE_FIELD = { text: "text", plan: "plan", highlights: "highlights", wetter: "weather", unterkunft: "lodging", strecke: "km", kosten: "costs" };
function editTile(d, tile) {
  if (tile.mod === "foto") { const p = d.photos.find((x) => x.id === tile.photo); if (p) openEditor(p); else { const sel = $('#tb [data-tb="photo"]'); if (sel) sel.focus(); } return; }
  if (tile.mod === "wikipedia") { openWikipedia(tile, d); return; }
  if (tile.mod === "punktkarte") { openPointMap(tile, d); return; }
  if (tile.mod === "notiz") { const ta = $('#tb [data-tb="text"]'); if (ta) ta.focus(); return; }
  if (tile.mod === "karte") { S.tab = "map"; renderPanel(); return; }
  if (tile.mod === "kennzahlen") { S.tab = "sum"; renderPanel(); return; }
  const field = TILE_FIELD[tile.mod]; if (!field) return;
  S.tab = "days"; S.open.add(d.id); renderPanel();
  const el = field === "costs" ? $(`details.day[data-day="${d.id}"] [data-act="addCost"]`) : $(`[data-k="d:${d.id}.${field}"]`);
  if (el) { el.scrollIntoView({ block: "center" }); el.focus(); }
}

/* ---------- Format übertragen (Pinsel) ----------
   Wie in Excel: Aufbau einer Seite aufnehmen (🖌 an der Seite), dann Zielseiten anklicken. Fotos und Notiztexte werden nicht mitkopiert,
   Fotokacheln bekommen die Fotos des Zieltags (applyLayout). „Auf alle Tage“ überträgt auf die Seite mit derselben Nummer jedes anderen Tages. */
S.brush = null;
function startBrush(tiles, dayId, pageIdx) {
  S.brush = { tiles, dayId, pageIdx }; select(null);
  document.body.classList.add("brush"); $("#brushbar").hidden = false; $(".tip").hidden = true;
  toast("Format aufgenommen: Zielseiten anklicken, Escape beendet.", 4500);
}
function endBrush() { S.brush = null; document.body.classList.remove("brush"); $("#brushbar").hidden = true; $(".tip").hidden = false; }
function paintPage(dayId, pageId) {
  const d = dayOf(dayId), pg = d && d.pages.find((p) => p.id === pageId); if (!d) return;
  const page = pg || (() => { const np = newPage(); d.pages.push(np); return np; })();
  if (d.id === S.brush.dayId && d.pages.indexOf(page) === S.brush.pageIdx) { toast("Das ist die Quellseite."); return; }
  const n = applyLayout(d, page, S.brush.tiles, S.trip.cols);
  tileChanged();
  toast(`Format übertragen${n ? `, ${n} ${n === 1 ? "weiteres Foto" : "weitere Fotos"} auf einer zusätzlichen Seite` : ""}.`);
}
function paintAll() {
  if (!S.brush) return;
  let n = 0;
  for (const d of S.trip.days) {
    if (d.id === S.brush.dayId) continue;
    while (d.pages.length <= S.brush.pageIdx) d.pages.push(newPage());
    applyLayout(d, d.pages[S.brush.pageIdx], S.brush.tiles, S.trip.cols); n++;
  }
  tileChanged(); toast(n ? `Format auf ${n} ${n === 1 ? "Tag" : "Tage"} übertragen.` : "Es gibt keine anderen Tage.");
}

/* Markdown-Knöpfe: Auswahl umschließen bzw. Zeilenanfang setzen oder entfernen */
function mdApply(ta, kind) {
  if (!ta) return;
  let v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
  const wrap = { b: "**", i: "*" }[kind];
  if (wrap) {
    if (v.slice(a - wrap.length, a) === wrap && v.slice(b, b + wrap.length) === wrap && a >= wrap.length) { // Auswahl liegt schon zwischen den Zeichen: wieder entfernen
      ta.value = v.slice(0, a - wrap.length) + v.slice(a, b) + v.slice(b + wrap.length); ta.setSelectionRange(a - wrap.length, b - wrap.length);
      ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus(); return;
    }
    const sel = v.slice(a, b), has = sel.startsWith(wrap) && sel.endsWith(wrap) && sel.length >= 2 * wrap.length;
    const inner = has ? sel.slice(wrap.length, sel.length - wrap.length) : sel, text = has ? inner : wrap + inner + wrap;
    ta.value = v.slice(0, a) + text + v.slice(b);
    const ca = a + (has ? 0 : wrap.length); ta.setSelectionRange(ca, ca + inner.length);
  } else if (kind === "hr") {
    const ins = (a > 0 && v[a - 1] !== "\n" ? "\n" : "") + "---\n";
    ta.value = v.slice(0, a) + ins + v.slice(b); ta.setSelectionRange(a + ins.length, a + ins.length);
  } else {
    const ls = v.lastIndexOf("\n", a - 1) + 1, le = (() => { const k = v.indexOf("\n", b); return k < 0 ? v.length : k; })();
    const lines = v.slice(ls, le).split("\n"), pre = { h: "## ", ul: "- ", q: "> " }[kind];
    const re = kind === "ol" ? /^\d{1,3}[.)]\s+/ : kind === "h" ? /^#{1,3}\s+/ : kind === "ul" ? /^[-*+]\s+/ : /^>\s?/;
    const all = lines.every((l) => re.test(l) || !l.trim());
    const out = lines.map((l, k) => (all ? l.replace(re, "") : l.trim() ? (kind === "ol" ? `${k + 1}. ` : pre) + l.replace(re, "") : l));
    ta.value = v.slice(0, ls) + out.join("\n") + v.slice(le); ta.setSelectionRange(ls, ls + out.join("\n").length);
  }
  ta.dispatchEvent(new Event("input", { bubbles: true })); ta.focus();
}
