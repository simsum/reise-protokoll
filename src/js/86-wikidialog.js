/* ---------- Wikipedia-Fenster: suchen, Vorschau, vor dem Einfügen bearbeiten ----------
   Ablauf: Suchbegriff (vorgeschlagen: Ort des Tages) → Treffer wählen → Überschrift, Text (kürzbar) und Kennzahlen (an-/abwählbar, änderbar) bearbeiten,
   dabei zeigt die Vorschau die Kachel in ihrer echten Größe → „Übernehmen“ schreibt alles in die Kachel (tile.wp). Abbrechen ändert nichts. */
const wpd = { pos: [], sort: "views", near: null, d: null, tile: null, hits: [], orig: "", facts: [], w: 2, h: 2, url: "", date: "", wd: false, busy: 0 };
const wpq = (id) => document.getElementById(id);

function openWikipedia(tile, d) {
  const wp = tile.wp;
  Object.assign(wpd, { d, tile, hits: [], orig: wp ? wp.text : "", facts: wp ? wp.facts.map((f) => ({ ...f })) : [], w: tile.w, h: tile.h, url: wp ? wp.url : "", date: wp ? wp.date : "", wd: wp ? !!wp.wd : false, busy: 0 });
  wpq("wpTit").value = wp ? wp.title : ""; wpq("wpTxt").value = wp ? wp.text : "";
  wpq("wpQ").value = (wp && wp.title) || dayPlaceName(S.trip, d) || d.title || "";
  wpd.pos = wpPositions(d); wpd.near = null; wpd.sort = "views";
  wpq("wpNear").innerHTML = wpd.pos.map((p, i) => `<option value="${i}">${esc(p.l)}</option>`).join("");
  wpq("wpSort").hidden = true;
  wpq("wpHits").innerHTML = ""; wpq("wpStatus").textContent = ""; wpq("wpEd").hidden = !wp;
  wpq("wp").hidden = false;
  wpRenderFacts(); wpRenderSizes(); wpPreview(); wpSyncOk();
  if (!wp && wpq("wpQ").value.trim()) wpSearchRun();
  else if (!wp && !touchUi) wpq("wpQ").focus();
}
function closeWikipedia() { wpq("wp").hidden = true; wpd.d = wpd.tile = null; }
const wpSyncOk = () => { wpq("wpOk").disabled = wpq("wpEd").hidden || (!wpq("wpTit").value.trim() && !wpq("wpTxt").value.trim()); };

/* Orte für „In der Nähe“: Ort des Tages (mit Position), Fotos mit GPS (ohne Doppelte), aktueller Standort des Geräts */
function wpPositions(d) {
  const list = [];
  if (hasGeo(d.place)) list.push({ l: "Ort des Tages: " + d.place.name, lat: d.place.lat, lon: d.place.lon, n: d.place.name });
  d.photos.forEach((p, n) => {
    if (list.length >= 9 || !p.gps || list.some((q) => q.lat != null && haversine(q, p.gps) < 0.3)) return;
    list.push({ l: `Foto ${n + 1}${p.place ? ": " + p.place : ""}`, lat: p.gps.lat, lon: p.gps.lon, n: p.place || "" });
  });
  list.push({ l: "Aktueller Standort des Geräts", here: true });
  return list;
}
const wpHere = () => new Promise((res, rej) => (navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }), (e) => rej(e), { timeout: 15000, maximumAge: 60000 }) : rej(new Error("keine Ortung"))));
function wpRenderHits(hits) {
  wpq("wpHits").innerHTML = hits.map((h, i) => `<button type="button" data-i="${i}"><b>${esc(h.title)}</b> <small>${esc(h.desc)}${h.desc && h.dist != null ? " · " : ""}${h.dist != null ? esc(wpDist(h.dist)) : ""}</small></button>`).join("");
}
async function wpNearRun() {
  const src = wpd.pos[+wpq("wpNear").value], st = wpq("wpStatus"), id = ++wpd.busy; if (!src) return;
  wpq("wpHits").innerHTML = ""; wpq("wpSort").hidden = true;
  let at = src;
  if (src.here) {
    st.textContent = "Standort wird ermittelt (das Gerät fragt nach Erlaubnis) …";
    try { at = { ...src, ...(await wpHere()) }; } catch (e) { if (id === wpd.busy) st.textContent = "Der Standort ist nicht verfügbar (keine Erlaubnis oder aus einer lokalen Datei nicht möglich). Stattdessen den Ort des Tages oder ein Foto wählen."; return; }
    if (id !== wpd.busy) return;
  } else if (src.lat == null) { st.textContent = "Für diese Auswahl gibt es keine Position."; return; }
  const rad = +wpq("wpRad").value;
  st.textContent = "Suche in der Nähe …";
  const show = (items, done) => {
    if (id !== wpd.busy) return;
    wpd.hits = wpSortNear(items, done && items.some((x) => x.views != null) ? wpd.sort : "dist"); wpRenderHits(wpd.hits); // während des Ladens bleibt die Reihenfolge stehen (nach Entfernung)
    const known = items.some((x) => x.views != null);
    st.textContent = done ? (items.length ? `${items.length} Artikel im Umkreis von ${rad} km, ${known && wpd.sort === "views" ? "beliebteste zuerst (Seitenaufrufe)" : "nächste zuerst"}. Auswählen:` : `Im Umkreis von ${rad} km gibt es keine Artikel.`) : `${items.length} Artikel gefunden, Beliebtheit wird ermittelt (${items.filter((x) => x.views != null).length}/${items.length}) …`;
    const sb = wpq("wpSort"); sb.hidden = !(done && known); sb.textContent = wpd.sort === "views" ? "nach Entfernung sortieren" : "nach Beliebtheit sortieren";
  };
  try {
    wpd.near = []; const items = await wpNearby(at.lat, at.lon, rad * 1000, (it) => { wpd.near = it; show(it, false); });
    if (id !== wpd.busy) return;
    wpd.near = items; show(items, true);
  } catch (e) { if (id === wpd.busy) st.textContent = wpErrText(e); }
}

async function wpSearchRun() {
  const q = wpq("wpQ").value.trim(), st = wpq("wpStatus"), box = wpq("wpHits"); if (!q) return;
  const id = ++wpd.busy; st.textContent = "Suche …"; box.innerHTML = "";
  try {
    const hits = await wpSearch(q); if (id !== wpd.busy) return;
    wpd.hits = hits;
    box.innerHTML = hits.length ? hits.map((h, i) => `<button type="button" data-i="${i}"><b>${esc(h.title)}</b> <small>${esc(h.desc)}</small></button>`).join("") : "";
    st.textContent = hits.length ? "Treffer wählen:" : "Nichts gefunden. Anderen Suchbegriff versuchen.";
  } catch (e) { if (id === wpd.busy) st.textContent = wpErrText(e); }
}

async function wpPick(i) {
  const hit = wpd.hits[i]; if (!hit) return;
  const id = ++wpd.busy, st = wpq("wpStatus"); st.textContent = "Artikel wird geladen …";
  try {
    const art = await wpArticle(hit.title); if (id !== wpd.busy) return;
    const qid = art.qid || hit.qid;
    st.textContent = qid ? "Kennzahlen werden geladen …" : "";
    let facts = []; if (qid) { try { facts = await wdFacts(qid); } catch (e) { facts = []; } }
    if (id !== wpd.busy) return;
    wpd.orig = wpTidy(art.text); wpd.url = art.url; wpd.date = isoOf(new Date()); wpd.wd = facts.length > 0;
    wpd.facts = facts.map((f, k) => ({ l: f.l, v: f.v, on: k < 4 }));
    wpq("wpTit").value = art.title; wpq("wpTxt").value = wpCut(wpd.orig, 4);
    wpq("wpEd").hidden = false; wpq("wpHits").innerHTML = "";
    st.textContent = facts.length ? "Text auf 4 Sätze gekürzt, Kennzahlen aus Wikidata. Alles lässt sich noch ändern." : "Keine Kennzahlen gefunden, nur Text. Eigene Kennzahlen lassen sich unten ergänzen.";
    wpRenderFacts(); wpPreview(); wpSyncOk();
  } catch (e) { if (id === wpd.busy) st.textContent = "Der Artikel konnte nicht geladen werden (" + (e.message || "Fehler") + ")."; }
}

function wpRenderFacts() {
  wpq("wpFacts").innerHTML = wpd.facts.map((f, k) => `<div class="fact"><input type="checkbox" data-k="${k}" data-f="on" ${f.on ? "checked" : ""} aria-label="anzeigen"><input data-k="${k}" data-f="l" value="${esc(f.l)}" placeholder="Bezeichnung" aria-label="Bezeichnung"><input data-k="${k}" data-f="v" value="${esc(f.v)}" placeholder="Wert" aria-label="Wert"><button type="button" class="ico" data-k="${k}" data-f="del" title="Entfernen">×</button></div>`).join("") || "<small>Keine Kennzahlen.</small>";
}
function wpRenderSizes() {
  const t = S.trip, w = Math.min(wpd.w, t.cols), h = wpd.h;
  wpq("wpSizes").innerHTML = SIZES.map(([a, b]) => `<button type="button" data-w="${a}" data-h="${b}" aria-pressed="${w === Math.min(a, t.cols) && h === b}">${a}×${b}</button>`).join("")
    + `<button type="button" data-w="${t.cols}" data-h="1" aria-pressed="${w === t.cols && h === 1}">Ganze Breite</button><button type="button" data-w="${t.cols}" data-h="2" aria-pressed="${w === t.cols && h === 2}">Breit ×2</button>`;
}
const wpCurrent = () => ({ title: wpq("wpTit").value.trim(), url: wpd.url, text: wpq("wpTxt").value, facts: wpd.facts, date: wpd.date, wd: wpd.wd });

/* Vorschau in der echten Größe der Kachel */
function wpPreview() {
  const t = S.trip, T = THEMES[t.theme] || THEMES.meer, gap = 10, colW = (CW - gap * (t.cols - 1)) / t.cols, rowH = (BOTTOM - 124 - gap * (GRID_ROWS - 1)) / GRID_ROWS;
  const w = Math.min(wpd.w, t.cols), h = wpd.h, r = { x: 8, y: 8, w: w * colW + (w - 1) * gap, h: h * rowH + (h - 1) * gap };
  const pg = new Pg(T); pg.W = r.w + 16; pg.H = r.h + 16;
  pg.ops = [{ k: "rect", x: 0, y: 0, w: pg.W, h: pg.H, fill: T.paper, stroke: null, sw: 0.6, r: 0, fo: undefined }];
  const warns = []; wikiDraw(pg, T, wpCurrent(), r, warns, 0);
  const sh = wpq("wpSheet"); sh.innerHTML = pageHtml(pg); sh.style.aspectRatio = `${pg.W} / ${pg.H}`;
  wpq("wpWarn").textContent = warns.length ? "⚠ " + warns[0].replace(/^Tag 1: /, "") : "";
}
let wpPrevT; const wpPreviewSoon = () => { clearTimeout(wpPrevT); wpPrevT = setTimeout(wpPreview, 120); };

function wpApply() {
  const tile = wpd.tile, d = wpd.d; if (!tile || !d) return;
  const c = wpCurrent();
  tile.wp = { title: c.title.slice(0, 200), url: validWpUrl(c.url) ? c.url : "", text: c.text.slice(0, 4000), date: c.date || isoOf(new Date()), wd: !!c.wd,
    facts: c.facts.filter((f) => (f.l || "").trim() || (f.v || "").trim()).slice(0, 12).map((f) => ({ l: f.l.trim().slice(0, 40), v: f.v.trim().slice(0, 80), on: !!f.on })) };
  tile.w = Math.min(wpd.w, S.trip.cols); tile.h = wpd.h;
  closeWikipedia(); tileChanged();
}

function bindWikipedia() {
  const modal = wpq("wp");
  wpq("wpGo").addEventListener("click", wpSearchRun);
  wpq("wpQ").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); wpSearchRun(); } });
  wpq("wpNearGo").addEventListener("click", wpNearRun);
  wpq("wpSort").addEventListener("click", () => { wpd.sort = wpd.sort === "views" ? "dist" : "views"; if (wpd.near) { wpd.hits = wpSortNear(wpd.near, wpd.sort); wpRenderHits(wpd.hits); const sb = wpq("wpSort"); sb.textContent = wpd.sort === "views" ? "nach Entfernung sortieren" : "nach Beliebtheit sortieren"; wpq("wpStatus").textContent = `${wpd.near.length} Artikel im Umkreis von ${wpq("wpRad").value} km, ${wpd.sort === "views" ? "beliebteste zuerst (Seitenaufrufe)" : "nächste zuerst"}. Auswählen:`; } });
  wpq("wpHits").addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) wpPick(+b.dataset.i); });
  wpq("wpTit").addEventListener("input", () => { wpPreviewSoon(); wpSyncOk(); });
  wpq("wpTxt").addEventListener("input", () => { wpPreviewSoon(); wpSyncOk(); });
  wpq("wpLen").addEventListener("click", (e) => { const b = e.target.closest("button[data-n]"); if (!b) return; wpq("wpTxt").value = wpCut(wpd.orig || wpq("wpTxt").value, +b.dataset.n); wpPreview(); wpSyncOk(); });
  wpq("wpFacts").addEventListener("input", (e) => { const el = e.target, f = wpd.facts[+el.dataset.k]; if (!f || el.dataset.f === "on") return; f[el.dataset.f] = el.value; wpPreviewSoon(); });
  wpq("wpFacts").addEventListener("change", (e) => { const el = e.target, f = wpd.facts[+el.dataset.k]; if (f && el.dataset.f === "on") { f.on = el.checked; wpPreview(); } });
  wpq("wpFacts").addEventListener("click", (e) => { const b = e.target.closest("button[data-f=del]"); if (b) { wpd.facts.splice(+b.dataset.k, 1); wpRenderFacts(); wpPreview(); } });
  wpq("wpAddFact").addEventListener("click", () => { wpd.facts.push({ l: "", v: "", on: true }); wpRenderFacts(); const rows = wpq("wpFacts").querySelectorAll(".fact"); const last = rows[rows.length - 1]; if (last) last.querySelector("input[data-f=l]").focus(); });
  wpq("wpSizes").addEventListener("click", (e) => { const b = e.target.closest("button[data-w]"); if (!b) return; wpd.w = +b.dataset.w; wpd.h = +b.dataset.h; wpRenderSizes(); wpPreview(); });
  wpq("wpOk").addEventListener("click", wpApply);
  wpq("wpCancel").addEventListener("click", closeWikipedia);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeWikipedia(); });
  document.addEventListener("keydown", (e) => { if (!modal.hidden && e.key === "Escape") closeWikipedia(); });
}
