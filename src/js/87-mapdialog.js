/* ---------- Fenster „Karte (Punkt)“: Position wählen ----------
   Die Karte lässt sich mit Maus oder Finger verschieben und mit +/− (oder Mausrad) zoomen; die Nadel in der Mitte zeigt die Position.
   Die Position kommt aus der Suche (Nominatim), vom Ort des Tages, von einem Foto mit GPS oder vom Gerät. „Übernehmen“ erzeugt das Kartenbild in der
   Größe der Kachel (tile.ptImg, im Projekt-PDF als Anhang) und speichert Position, Zoom, Beschriftung (tile.pt). Abbrechen ändert nichts. */
const pmd = { day: false, d: null, tile: null, lat: 48.1374, lon: 11.5755, z: 15, w: 2, h: 2, pos: [], hits: [], busy: 0, job: 0, credit: "" };
const pmq = (id) => document.getElementById(id);

/* Maße einer Kachel in pt (wie im Seitenraster) */
function tileRectPt(w, h) {
  const t = S.trip, gap = 10, colW = (CW - gap * (t.cols - 1)) / t.cols, rowH = (BOTTOM - 124 - gap * (GRID_ROWS - 1)) / GRID_ROWS, ww = Math.min(w, t.cols);
  return { w: ww * colW + (ww - 1) * gap, h: h * rowH + (h - 1) * gap };
}

function openPointMap(tile, d) {
  const pt = tile.pt, day = tile.mod === "tageskarte";
  Object.assign(pmd, { day, d, tile, w: tile.w, h: tile.h, hits: [], busy: 0, pos: wpPositions(d) });
  pmq("pmHead").textContent = day ? "Karte (Tag)" : "Karte (Punkt)"; pmq("pmMap").classList.toggle("day", day);
  pmq("pmHelp").textContent = day ? "Der Ausschnitt zeigt Start, Fotos mit GPS und den Ort des Tages als Weg. Mit Maus oder Finger verschieben, mit dem Mausrad oder +/− zoomen; „Auf den Tag einpassen“ stellt alle Orte ein." : "Die Karte mit Maus oder Finger verschieben, mit dem Mausrad oder +/− zoomen. Die Nadel in der Mitte zeigt die Position.";
  pmq("pmNameRow").hidden = day; pmq("pmFit").hidden = !day;
  if (pt) Object.assign(pmd, { lat: pt.lat, lon: pt.lon, z: pt.zoom });
  else if (day && pmFit(true)) { /* Tagesroute eingepasst */ }
  else {
    const p = pmd.pos.find((x) => x.lat != null);
    Object.assign(pmd, p ? { lat: p.lat, lon: p.lon } : { lat: 51.16, lon: 10.45 }, { z: p ? 15 : 6 }); // ohne Position: Deutschland
  }
  pmq("pmName").value = day ? "" : pt ? pt.name : (pmd.pos.find((x) => x.lat != null) || {}).n || "";
  pmq("pmQ").value = ""; pmq("pmHits").innerHTML = ""; pmq("pmStatus").textContent = "";
  pmq("pmPos").innerHTML = pmd.pos.map((p, i) => `<option value="${i}">${esc(p.l)}</option>`).join("");
  pmq("pm").hidden = false;
  pmRenderSizes(); pmRender();
}
/* Alle Orte des Tages in die Kachel einpassen; liefert false, wenn der Tag keine Orte mit Koordinaten hat */
function pmFit(quiet) {
  const pts = dayMapPoints(S.trip, S.trip.days.indexOf(pmd.d)), r = tileRectPt(pmd.w, pmd.h), f = fitDayMap(pts, r.w, r.h);
  if (!f) { if (!quiet) pmq("pmStatus").textContent = "Dieser Tag hat keine Orte mit Koordinaten (Ort über die Suche wählen oder Fotos mit GPS)."; return false; }
  Object.assign(pmd, { lat: f.lat, lon: f.lon, z: f.zoom }); if (!quiet) pmRender(); return true;
}
function closePointMap() { pmq("pm").hidden = true; pmd.d = pmd.tile = null; }

/* Ansicht neu malen (Kacheln werden zwischengespeichert, das Verschieben bleibt flüssig) */
async function pmRender() {
  const T = THEMES[S.trip.theme] || THEMES.meer, r = tileRectPt(pmd.w, pmd.h), cv = document.createElement("canvas"), job = ++pmd.job;
  cv.width = Math.round(r.w * 2); cv.height = Math.round(r.h * 2);
  pmq("pmStatus").textContent = "Karte wird geladen …";
  const res = await paintPointMap(cv, pmd.lat, pmd.lon, pmd.z, T);
  if (job !== pmd.job) return;
  if (pmd.day) drawDayOverlay(cv, dayMapPoints(S.trip, S.trip.days.indexOf(pmd.d)), pmd.lat, pmd.lon, pmd.z, T);
  const view = pmq("pmCv"); view.width = cv.width; view.height = cv.height; view.getContext("2d").drawImage(cv, 0, 0); view.style.transform = "";
  pmd.credit = res.credit;
  pmq("pmStatus").textContent = res.mode === "osm" ? res.credit : "Kartenkacheln sind nicht erreichbar (offline oder gesperrt): Es entsteht eine Schemakarte ohne Hintergrund. Die Position wird trotzdem gespeichert.";
  pmq("pmZ").textContent = pmd.z; pmq("pmCoord").textContent = `${pmd.lat.toFixed(5)}° ${pmd.lat >= 0 ? "N" : "S"}, ${Math.abs(pmd.lon).toFixed(5)}° ${pmd.lon >= 0 ? "O" : "W"}`;
  pmq("pmZm").disabled = pmd.z <= 2; pmq("pmZp").disabled = pmd.z >= 18;
}
function pmSetZoom(z) { pmd.z = clamp(z, 2, 18); pmRender(); }

function pmRenderSizes() {
  const t = S.trip, w = Math.min(pmd.w, t.cols), h = pmd.h;
  pmq("pmSizes").innerHTML = SIZES.map(([a, b]) => `<button type="button" data-w="${a}" data-h="${b}" aria-pressed="${w === Math.min(a, t.cols) && h === b}">${a}×${b}</button>`).join("")
    + `<button type="button" data-w="${t.cols}" data-h="1" aria-pressed="${w === t.cols && h === 1}">Ganze Breite</button><button type="button" data-w="${t.cols}" data-h="2" aria-pressed="${w === t.cols && h === 2}">Breit ×2</button>`;
}

async function pmSearch() {
  const q = pmq("pmQ").value.trim(), st = pmq("pmStatus"), box = pmq("pmHits"), id = ++pmd.busy; if (!q) return;
  st.textContent = "Suche …"; box.innerHTML = "";
  try {
    const hits = await searchPlace(q); if (id !== pmd.busy) return;
    pmd.hits = hits;
    box.innerHTML = hits.map((h, i) => `<button type="button" data-i="${i}"><b>${esc(h.name)}</b> <small>${esc((h.info || "").split(",").slice(1, 4).join(","))}</small></button>`).join("");
    st.textContent = hits.length ? "Treffer wählen:" : "Nichts gefunden. Anderen Suchbegriff versuchen.";
  } catch (e) { if (id === pmd.busy) st.textContent = "Die Ortssuche ist nicht erreichbar (kein Internet oder gesperrt). Die Karte lässt sich trotzdem verschieben."; }
}

async function pmApply() {
  const tile = pmd.tile, d = pmd.d; if (!tile || !d) return;
  const T = THEMES[S.trip.theme] || THEMES.meer, r = tileRectPt(pmd.w, pmd.h), cv = document.createElement("canvas"), btn = pmq("pmOk");
  cv.width = Math.round(r.w * 2); cv.height = Math.round(r.h * 2); btn.disabled = true;
  try {
    const res = await paintPointMap(cv, pmd.lat, pmd.lon, pmd.z, T);
    if (pmd.day) drawDayOverlay(cv, dayMapPoints(S.trip, S.trip.days.indexOf(d)), pmd.lat, pmd.lon, pmd.z, T);
    tile.pt = { lat: pmd.lat, lon: pmd.lon, zoom: pmd.z, name: pmq("pmName").value.trim().slice(0, 120), credit: res.credit };
    tile.ptImg = cv.toDataURL("image/jpeg", 0.85); tile.ptW = cv.width; tile.ptH = cv.height;
    tile.w = Math.min(pmd.w, S.trip.cols); tile.h = pmd.h;
    closePointMap(); tileChanged();
  } catch (e) { pmq("pmStatus").textContent = "Das Kartenbild konnte nicht erzeugt werden: " + (e.message || "Fehler"); }
  btn.disabled = false;
}

function bindPointMap() {
  const modal = pmq("pm"), map = pmq("pmMap");
  pmq("pmGo").addEventListener("click", pmSearch);
  pmq("pmQ").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); pmSearch(); } });
  pmq("pmHits").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]"), h = b && pmd.hits[+b.dataset.i]; if (!h) return;
    Object.assign(pmd, { lat: h.lat, lon: h.lon, z: Math.max(pmd.z, 14) }); pmq("pmName").value = h.name; pmq("pmHits").innerHTML = ""; pmRender();
  });
  pmq("pmPosGo").addEventListener("click", async () => {
    const p = pmd.pos[+pmq("pmPos").value]; if (!p) return;
    let at = p;
    if (p.here) {
      pmq("pmStatus").textContent = "Standort wird ermittelt (das Gerät fragt nach Erlaubnis) …";
      try { at = { ...p, ...(await wpHere()) }; } catch (e) { pmq("pmStatus").textContent = "Der Standort ist nicht verfügbar (keine Erlaubnis oder aus einer lokalen Datei nicht möglich)."; return; }
    }
    if (at.lat == null) return;
    Object.assign(pmd, { lat: at.lat, lon: at.lon }); if (at.n) pmq("pmName").value = at.n; pmRender();
  });
  pmq("pmFit").addEventListener("click", () => pmFit(false));
  pmq("pmZm").addEventListener("click", () => pmSetZoom(pmd.z - 1));
  pmq("pmZp").addEventListener("click", () => pmSetZoom(pmd.z + 1));
  let wheelT; map.addEventListener("wheel", (e) => { e.preventDefault(); clearTimeout(wheelT); const dz = e.deltaY < 0 ? 1 : -1; wheelT = setTimeout(() => pmSetZoom(pmd.z + dz), 120); }, { passive: false });
  /* Verschieben: Die Ansicht folgt dem Zeiger sofort (Transformation), beim Loslassen wird die Position neu berechnet und die Karte neu gemalt */
  let drag = null;
  map.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; map.setPointerCapture(e.pointerId); map.classList.add("drag"); });
  map.addEventListener("pointermove", (e) => { if (!drag) return; drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y; pmq("pmCv").style.transform = `translate(${drag.dx}px, ${drag.dy}px)`; });
  const end = () => {
    if (!drag) return; const d0 = drag; drag = null; map.classList.remove("drag");
    if (Math.hypot(d0.dx, d0.dy) < 3) { pmq("pmCv").style.transform = ""; return; }
    const r = tileRectPt(pmd.w, pmd.h), f = r.w / map.clientWidth, Z = pmd.z + 1, c = mapProj(pmd.lat, pmd.lon, Z); // 1 CSS-Pixel = f pt = 2f Kartenpunkte
    const p = mapInv(c.x - d0.dx * f * 2, c.y - d0.dy * f * 2, Z);
    pmd.lat = clamp(p.lat, -85, 85); pmd.lon = ((p.lon + 540) % 360) - 180; pmRender();
  };
  map.addEventListener("pointerup", end); map.addEventListener("pointercancel", end);
  pmq("pmSizes").addEventListener("click", (e) => { const b = e.target.closest("button[data-w]"); if (!b) return; pmd.w = +b.dataset.w; pmd.h = +b.dataset.h; pmRenderSizes(); pmRender(); });
  pmq("pmOk").addEventListener("click", pmApply);
  pmq("pmCancel").addEventListener("click", closePointMap);
  modal.addEventListener("click", (e) => { if (e.target === modal) closePointMap(); });
  document.addEventListener("keydown", (e) => { if (!modal.hidden && e.key === "Escape") closePointMap(); });
}
