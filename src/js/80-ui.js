/* ---------- Oberfläche ---------- */
const S = { trip: newTrip(), tab: "trip", open: new Set(), newPoint: blankPlace(), busy: false };

/* ---------- Zugriff auf Felder über Schlüssel ----------
   "title", "startPlace.name", "d:<tagId>.place.name", "d:<tagId>.costs.<id>.l", "route.points.<id>.name" */
function getRef(key) {
  const parts = key.split(".");
  let obj = S.trip;
  if (parts[0].startsWith("d:")) { obj = S.trip.days.find((d) => d.id === parts[0].slice(2)); parts.shift(); }
  else if (parts[0] === "$new") { obj = S.newPoint; parts.shift(); }
  for (let i = 0; i < parts.length - 1 && obj; i++) obj = Array.isArray(obj) ? obj.find((x) => x.id === parts[i]) : obj[parts[i]];
  return obj ? { obj, prop: parts[parts.length - 1] } : null;
}
const dayOf = (id) => S.trip.days.find((d) => d.id === id);

/* ---------- Bausteine ---------- */
const fld = (label, key, val, o = {}) => `<label class="f ${o.cls || ""}"><span>${label}</span>${o.rows
  ? `<textarea data-k="${key}" rows="${o.rows}" placeholder="${esc(o.ph || "")}">${esc(val)}</textarea>`
  : `<input data-k="${key}" type="${o.type || "text"}" value="${esc(val)}" placeholder="${esc(o.ph || "")}" ${o.inputmode ? `inputmode="${o.inputmode}"` : ""}>`}</label>`;
const selFld = (label, key, val, opts, o = {}) => `<label class="f ${o.cls || ""}"><span>${label}</span><select data-k="${key}">${opts.map(([v, n]) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;
const chk = (label, key, val) => `<label class="chk"><input type="checkbox" data-k="${key}" ${val ? "checked" : ""}> ${label}</label>`;
const geoText = (p) => (hasGeo(p) ? `✓ Position ${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}` : "Keine Position: Ort wird nicht auf der Karte gezeigt. „Suchen“ wählt einen Treffer.");
const placeFld = (label, key, p) => `<div class="f pp" data-pp="${key}"><span>${label}</span><div class="row"><input data-k="${key}.name" value="${esc(p.name)}" placeholder="Ort eingeben, dann Suchen"><button type="button" data-act="search" data-key="${key}">Suchen</button></div><small class="geo ${hasGeo(p) ? "ok" : ""}">${geoText(p)}</small><div class="res"></div></div>`;

/* ---------- Reiter „Reise“ ---------- */
function panelTrip() {
  const t = S.trip, tpl = TEMPLATES[t.template];
  return `<h3>Vorlage</h3><div class="tpls">${Object.values(TEMPLATES).map((x) => `<button class="tpl ${x.id === t.template ? "on" : ""}" data-act="tpl" data-id="${x.id}"><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></button>`).join("")}</div>
  <h3>Reise</h3>
  ${fld("Titel", "title", t.title, { ph: "z. B. Alpenrundreise 2026" })}
  ${fld("Untertitel", "subtitle", t.subtitle, { ph: "optional" })}
  ${fld("Reisende", "travelers", t.travelers, { ph: "z. B. Anna & Ben" })}
  <div class="row two">${fld("Reisebeginn", "start", t.start, { type: "date" })}${selFld("Währung", "currency", t.currency, [["EUR", "Euro (€)"], ["CHF", "Franken (CHF)"], ["USD", "US-Dollar ($)"], ["GBP", "Pfund (£)"], ["SEK", "Schwedische Kronen"], ["NOK", "Norwegische Kronen"], ["DKK", "Dänische Kronen"], ["PLN", "Złoty"], ["CZK", "Tschechische Kronen"]])}</div>
  ${placeFld("Startort (Heimat)", "startPlace", t.startPlace)}
  ${tpl.fixedPlace ? placeFld("Reiseziel", "destination", t.destination) : ""}
  ${chk("Rückreise zum Startort auf der Karte", "roundTrip", t.roundTrip)}
  <h3>Design</h3>
  <div class="btnrow"><label class="drop" style="padding:5px 10px;margin:0;display:inline-block">${t.coverPhoto ? "Titelfoto ändern …" : "Titelfoto wählen …"}<input type="file" accept="image/*" hidden id="coverFile"></label>${t.coverPhoto ? `<button data-act="delCover">Titelfoto entfernen</button>` : ""}</div>
  <div class="themes">${Object.entries(THEMES).map(([id, th]) => `<button class="theme ${id === t.theme ? "on" : ""}" data-act="theme" data-id="${id}"><i style="background:${th.accent}"></i>${esc(th.name)}</button>`).join("")}</div>
  <h3>Seiten</h3>
  ${chk("Linien zum Handschreiben in freien Textbereichen", "ruled", t.ruled)}
  ${chk("Kostenübersicht am Ende", "costPage", t.costPage)}`;
}

/* ---------- Reiter „Tage“ ---------- */
const DAY_FIELDS = {
  place: (d) => placeFld("Ort / Ziel des Tages", `d:${d.id}.place`, d.place),
  from: (d) => fld("Start (leer = vorheriger Ort)", `d:${d.id}.from`, d.from),
  km: (d) => fld("Kilometer", `d:${d.id}.km`, d.km, { inputmode: "decimal" }),
  drive: (d) => fld("Fahrzeit (Std:Min)", `d:${d.id}.drive`, d.drive, { ph: "2:30" }),
  title: (d) => fld("Titel des Tages", `d:${d.id}.title`, d.title, { ph: "z. B. Salzkammergut" }),
  weather: (d) => `<div class="wx">${selFld("Wetter", `d:${d.id}.weather`, d.weather, [["", "–"], ...WEATHER.map((w) => [w.id, w.name])])}${fld("Min °C", `d:${d.id}.tmin`, d.tmin, { inputmode: "decimal" })}${fld("Max °C", `d:${d.id}.tmax`, d.tmax, { inputmode: "decimal" })}</div>`,
  lodging: (d) => fld("Unterkunft", `d:${d.id}.lodging`, d.lodging),
  text: (d) => fld(S.trip.template === "kurztrip" ? "Notizen" : "Tagebuch", `d:${d.id}.text`, d.text, { rows: 7, ph: "Was haben wir erlebt?" }),
  plan: (d) => fld("Tagesplan (eine Zeile pro Punkt, Uhrzeit vorn)", `d:${d.id}.plan`, d.plan, { rows: 7, ph: "09:30 Frühstück im Café, 11:00 Stadtrundgang, …" }),
  highlights: (d) => fld("Highlights (eine pro Zeile)", `d:${d.id}.highlights`, d.highlights, { rows: 3 }),
  costs: (d) => `<div class="f"><span>Ausgaben <b data-sum="${d.id}">${dayCosts(d) ? "· " + money(dayCosts(d), S.trip.currency) : ""}</b></span>${d.costs.map((c) => `<div class="cost"><input data-k="d:${d.id}.costs.${c.id}.l" value="${esc(c.l)}" placeholder="Bezeichnung"><select data-k="d:${d.id}.costs.${c.id}.cat">${CATS.map((k) => `<option value="${k.id}" ${k.id === c.cat ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</select><input data-k="d:${d.id}.costs.${c.id}.a" value="${esc(c.a)}" inputmode="decimal" placeholder="0,00"><button class="ico" data-act="delCost" data-day="${d.id}" data-id="${c.id}" title="Entfernen">×</button></div>`).join("")}<button data-act="addCost" data-day="${d.id}">+ Ausgabe</button></div>`,
  photos: (d) => `<div class="f"><span>Fotos (${d.photos.length})</span><div class="thumbs">${d.photos.map((p) => `<div class="thumb"><img src="${p.src}" alt=""><button data-act="delPhoto" data-day="${d.id}" data-id="${p.id}" title="Entfernen">×</button></div>`).join("")}</div><label class="drop" style="padding:6px;margin:0">+ Fotos wählen<input type="file" accept="image/*" multiple hidden data-photos="${d.id}"></label></div>`,
};

function daySummary(i) {
  const d = S.trip.days[i], name = dayPlaceName(S.trip, d);
  return `Tag ${i + 1}${d.date ? ` <small>${esc(fmtDate(d.date, { weekday: "short", day: "numeric", month: "short" }))}</small>` : ""}${d.title || name ? ` · ${esc(d.title || name)}` : ""}`;
}

function panelDays() {
  const t = S.trip, tpl = TEMPLATES[t.template];
  const startDefault = t.days.length ? addDays(t.days[t.days.length - 1].date || t.start || isoOf(new Date()), 1) : t.start;
  return `<label class="drop" id="dropAll">Fotos hierher ziehen oder klicken: sie werden nach Aufnahmedatum den Tagen zugeordnet (fehlende Tage entstehen dabei)<input type="file" accept="image/*" multiple hidden id="photoAll"></label>
  <div class="btnrow"><button data-act="addDay">+ Tag hinzufügen</button>
    <span class="row" style="gap:4px">ab <input type="date" id="genStart" value="${esc(startDefault || "")}" style="border:1px solid var(--line);border-radius:8px;padding:5px"> <input type="number" id="genN" min="1" max="60" value="${tpl.defaultDays}" style="width:60px;border:1px solid var(--line);border-radius:8px;padding:5px"> Tage <button data-act="genDays">anlegen</button></span>
    <button data-act="sortDays" title="Nach Datum sortieren">Sortieren</button></div>
  ${t.days.map((d, i) => `<details class="day" data-day="${d.id}" ${S.open.has(d.id) ? "open" : ""}><summary><span class="dsum">${daySummary(i)}</span></summary><div class="body">
    ${fld("Datum", `d:${d.id}.date`, d.date, { type: "date" })}
    ${tpl.dayFields.map((k) => DAY_FIELDS[k](d)).join("")}
    <div class="btnrow"><button data-act="dayUp" data-day="${d.id}">↑ Nach oben</button><button data-act="dayDown" data-day="${d.id}">↓ Nach unten</button><button data-act="delDay" data-day="${d.id}">Tag löschen</button></div>
  </div></details>`).join("") || "<p><small>Noch keine Tage. Mit „Tag hinzufügen“ oder „anlegen“ beginnen.</small></p>"}`;
}

/* ---------- Reiter „Karte“ ---------- */
function mapStale(t) { return t.mapImg && !t.mapUser && t.route.mapSig !== mapSignature(t); }

function panelMap() {
  const t = S.trip, r = t.route;
  const canLegs = r.auto && r.legs && r.legs.length && r.legs.length === r.points.length - 1 && r.points.every(hasGeo) && !TEMPLATES[t.template].fixedPlace;
  return `<h3>Route</h3>
  ${chk("Orte automatisch aus Startort, Tagen und Foto-GPS bilden", "route.auto", r.auto)}
  ${r.points.length ? r.points.map((p, i) => `<div class="pt"><span class="n">${i + 1}</span>${placeFld("", `route.points.${p.id}`, p).replace("<span></span>", "")}<span class="row"><button class="ico" data-act="ptUp" data-id="${p.id}">↑</button><button class="ico" data-act="ptDown" data-id="${p.id}">↓</button><button class="ico" data-act="ptDel" data-id="${p.id}">×</button></span></div>`).join("") : "<p><small>Noch keine Orte. Startort, Tagesorte oder Fotos mit GPS liefern sie automatisch, oder unten von Hand ergänzen.</small></p>"}
  ${placeFld("Ort am Ende hinzufügen", "$new", S.newPoint)}
  <h3>Karte</h3>
  ${chk("Straßenroute berechnen (OSRM, sonst Luftlinie)", "route.road", r.road)}
  <div class="btnrow"><button class="primary" data-act="makeMap" id="mapBtn">Karte erzeugen</button><label class="drop" style="padding:5px 10px;margin:0;display:inline-block">Eigenes Bild …<input type="file" accept="image/*" hidden id="mapFile"></label>${t.mapImg ? `<button data-act="delMap">Karte entfernen</button>` : ""}${canLegs ? `<button data-act="applyLegs" title="Trägt Kilometer und Fahrzeit der berechneten Straßenroute in die Tage ein">km und Fahrzeit in Tage übernehmen</button>` : ""}</div>
  <small id="mapStatus"></small>
  ${mapStale(t) ? `<div class="note">Die Route hat sich seit dem Erzeugen der Karte geändert. Die Karte bleibt unverändert, bis du sie neu erzeugst.</div>` : ""}
  ${t.mapImg ? `<img class="mapimg" src="${t.mapImg}" alt="Karte">` : ""}
  <p><small>Die Karte wird einmal aus OpenStreetMap-Kacheln zusammengesetzt (© OpenStreetMap-Mitwirkende) und danach als festes Bild in der Reise gespeichert. Ohne Internet entsteht eine Schemakarte.</small></p>`;
}

/* ---------- Reiter „Zusammenfassung“ ---------- */
function panelSum() {
  const t = S.trip, st = tripStats(t);
  return `<h3>Text für die Deckseite</h3>
  ${fld("Zusammenfassung", "summary", t.summary, { rows: 9 })}
  ${chk("Automatisch aus Tagen und Fotos erzeugen (Änderungen schalten das aus)", "summaryAuto", t.summaryAuto)}
  <div class="btnrow"><button data-act="resum">Vorschlag neu erzeugen</button></div>
  <h3>Kennzahlen</h3>
  <div class="stat"><span>Dauer</span><b>${st.nDays} Tage${st.range ? " · " + esc(st.range) : ""}</b></div>
  <div class="stat"><span>Stationen</span><b>${st.places.length}</b></div>
  <div class="stat"><span>Strecke</span><b>${st.km ? (st.kmEst ? "etwa " : "") + fmtNum(st.km) + " km" : "–"}</b></div>
  <div class="stat"><span>Kosten</span><b>${st.cost ? money(st.cost, t.currency) : "–"}</b></div>
  <div class="stat"><span>Fotos</span><b>${st.photos}</b></div>`;
}

/* ---------- Rendern ---------- */
function renderPanel() {
  const el = $("#panel"), top = el.scrollTop;
  el.innerHTML = { trip: panelTrip, days: panelDays, map: panelMap, sum: panelSum }[S.tab]();
  el.scrollTop = top;
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === S.tab));
  if (S.tab === "days") bindDrop();
}

let prevTimer, saveTimer;
function schedulePreview() { clearTimeout(prevTimer); prevTimer = setTimeout(renderPreview, 220); }
function renderPreview() {
  const { pages, warns } = layoutTrip(S.trip);
  $("#pages").innerHTML = pages.map((pg) => `<div class="sheet" style="aspect-ratio:${pg.W}/${pg.H}">${pageHtml(pg)}</div>`).join("");
  $("#pageCount").textContent = `${pages.length} ${pages.length === 1 ? "Seite" : "Seiten"}`;
  $("#warn").textContent = warns.length ? "⚠ " + warns[0] + (warns.length > 1 ? ` (+${warns.length - 1})` : "") : "";
  $("#warn").title = warns.join("\n");
}

function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => idbSet("trip", S.trip).catch(() => {}), 600); }

/* Nach jeder Änderung: Abgeleitetes aktualisieren, Vorschau und Autosave anstoßen. */
function changed(key) {
  const t = S.trip;
  if (key && key.startsWith("route.points")) t.route.auto = false;
  if (key === "summary") t.summaryAuto = false;
  refreshDerived(t);
  if (key && key.startsWith("route.points")) { const c = $('[data-k="route.auto"]'); if (c) c.checked = false; }
  const sm = $('[data-k="summary"]'); if (sm && t.summaryAuto && document.activeElement !== sm) sm.value = t.summary;
  const sa = $('[data-k="summaryAuto"]'); if (sa) sa.checked = t.summaryAuto;
  schedulePreview(); scheduleSave();
}

/* ---------- Ereignisse ---------- */
document.addEventListener("input", (e) => {
  const el = e.target, key = el.dataset && el.dataset.k;
  if (!key) return;
  const r = getRef(key); if (!r) return;
  r.obj[r.prop] = el.type === "checkbox" ? el.checked : el.value;
  if (key === "route.auto" && el.checked) t_resetRoute();
  if (key === "summaryAuto" && el.checked) { S.trip.summary = suggestSummary(S.trip); const sm = $('[data-k="summary"]'); if (sm) sm.value = S.trip.summary; }
  const card = el.closest("details.day");
  if (card) {
    const i = S.trip.days.findIndex((d) => d.id === card.dataset.day);
    if (i >= 0) { $(".dsum", card).innerHTML = daySummary(i); const sum = $(`[data-sum="${card.dataset.day}"]`, card); if (sum) { const c = dayCosts(S.trip.days[i]); sum.textContent = c ? "· " + money(c, S.trip.currency) : ""; } }
  }
  if (key === "route.road" || key === "currency") { if (key === "currency") schedulePreview(); }
  changed(key);
});
function t_resetRoute() { S.trip.route.auto = true; rebuildRoute(S.trip); renderPanel(); }

document.addEventListener("toggle", (e) => {
  const d = e.target;
  if (d.matches && d.matches("details.day")) d.open ? S.open.add(d.dataset.day) : S.open.delete(d.dataset.day);
}, true);

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.matches("[data-photos]")) addPhotosToDay(el.dataset.photos, [...el.files]);
  else if (el.id === "photoAll") distributePhotos([...el.files]);
  else if (el.id === "mapFile") useOwnMap(el.files[0]);
  else if (el.id === "coverFile") useCover(el.files[0]);
  else if (el.id === "openFile") openProject(el.files[0]);
  else if (el.id === "demo") { if (el.value) loadTrip(demoTrip(el.value)); el.value = ""; }
  else if (el.id === "zoom") document.documentElement.style.setProperty("--z", el.value / 100);
  else if (el.dataset.k === "start" || el.dataset.k === "roundTrip" || el.dataset.k === "ruled" || el.dataset.k === "costPage") { /* nur Vorschau */ }
  if (el.dataset && el.dataset.k && /\.(weather|cat|date)$/.test(el.dataset.k)) renderPanel();
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act],[data-tab]");
  if (!b) return;
  if (b.dataset.tab) { S.tab = b.dataset.tab; renderPanel(); return; }
  const t = S.trip, id = b.dataset.id, dayId = b.dataset.day;
  switch (b.dataset.act) {
    case "tpl": {
      t.template = id;
      if (TEMPLATES[id].fixedPlace && !t.destination.name) { const d = t.days.find((x) => x.place.name); if (d) t.destination = { ...d.place }; }
      changed(); renderPanel(); break;
    }
    case "theme": t.theme = id; changed(); renderPanel(); break;
    case "addDay": {
      const last = t.days[t.days.length - 1], d = newDay(last && last.date ? addDays(last.date, 1) : t.start || "");
      if (TEMPLATES[t.template].fixedPlace) d.place = { ...t.destination };
      t.days.push(d); S.open.add(d.id); changed(); renderPanel(); break;
    }
    case "genDays": {
      const start = $("#genStart").value, n = clamp(parseInt($("#genN").value) || 0, 1, 60);
      if (!parseIso(start)) { toast("Bitte ein Startdatum wählen."); break; }
      for (let k = 0; k < n; k++) {
        const date = addDays(start, k);
        if (t.days.some((d) => d.date === date)) continue;
        const d = newDay(date); if (TEMPLATES[t.template].fixedPlace) d.place = { ...t.destination };
        t.days.push(d);
      }
      t.days.sort(byDate); if (!t.start) t.start = start;
      changed(); renderPanel(); break;
    }
    case "sortDays": t.days.sort(byDate); changed(); renderPanel(); break;
    case "delDay": if (confirm("Diesen Tag mit Text, Ausgaben und Fotos löschen?")) { t.days = t.days.filter((d) => d.id !== dayId); changed(); renderPanel(); } break;
    case "dayUp": case "dayDown": {
      const i = t.days.findIndex((d) => d.id === dayId), j = i + (b.dataset.act === "dayUp" ? -1 : 1);
      if (j >= 0 && j < t.days.length) { [t.days[i], t.days[j]] = [t.days[j], t.days[i]]; changed(); renderPanel(); }
      break;
    }
    case "addCost": dayOf(dayId).costs.push({ id: uid(), l: "", cat: "sonstiges", a: "" }); S.open.add(dayId); renderPanel(); break;
    case "delCost": { const d = dayOf(dayId); d.costs = d.costs.filter((c) => c.id !== id); changed(); renderPanel(); break; }
    case "delPhoto": { const d = dayOf(dayId); d.photos = d.photos.filter((p) => p.id !== id); changed(); renderPanel(); break; }
    case "search": doSearch(b.dataset.key, b.closest(".pp")); break;
    case "pick": pickPlace(b); break;
    case "ptUp": case "ptDown": {
      const pts = t.route.points, i = pts.findIndex((p) => p.id === id), j = i + (b.dataset.act === "ptUp" ? -1 : 1);
      if (j >= 0 && j < pts.length) { [pts[i], pts[j]] = [pts[j], pts[i]]; changed("route.points"); renderPanel(); }
      break;
    }
    case "ptDel": t.route.points = t.route.points.filter((p) => p.id !== id); changed("route.points"); renderPanel(); break;
    case "makeMap": makeMap(); break;
    case "delCover": t.coverPhoto = ""; changed(); renderPanel(); break;
    case "delMap": t.mapImg = ""; t.mapUser = false; changed(); renderPanel(); break;
    case "applyLegs": applyLegs(); break;
    case "resum": t.summary = suggestSummary(t); t.summaryAuto = true; changed(); renderPanel(); break;
    case "new": if (confirm("Alle Eingaben verwerfen und neu beginnen?")) loadTrip(newTrip(t.template), true); break;
    case "open": $("#openFile").click(); break;
    case "save": saveProject(); break;
    case "pdf": makePdf(); break;
  }
});

const byDate = (a, b) => (a.date || "9999").localeCompare(b.date || "9999");

/* ---------- Ortssuche ---------- */
async function doSearch(key, box) {
  const input = $(`[data-k="${key}.name"]`, box), res = $(".res", box), q = input.value.trim();
  if (!q) return;
  res.innerHTML = "<small>Suche …</small>";
  try {
    const list = await searchPlace(q);
    window._results = window._results || {}; window._results[key] = list;
    res.innerHTML = list.length ? list.map((r, i) => `<button data-act="pick" data-key="${esc(key)}" data-i="${i}">${esc(r.name)} <small>${esc(r.info.split(",").slice(1, 4).join(","))}</small></button>`).join("") : "<small>Nichts gefunden.</small>";
  } catch (e) { res.innerHTML = "<small>Die Suche ist nicht erreichbar (kein Internet oder gesperrt). Der Ort bleibt ohne Position.</small>"; }
}
function pickPlace(b) {
  const key = b.dataset.key, r = window._results[key][+b.dataset.i], t = S.trip;
  if (key === "$new") {
    t.route.points.push({ id: uid(), name: r.name, lat: r.lat, lon: r.lon, day: -1 }); t.route.auto = false;
    S.newPoint = blankPlace();
  } else {
    const ref = getRef(key + ".name"); if (!ref) return;
    const o = ref.obj; o.name = r.name; o.lat = r.lat; o.lon = r.lon;
    if (key.startsWith("route.points")) t.route.auto = false;
  }
  changed(key); renderPanel();
}

/* ---------- Fotos ---------- */
function bindDrop() {
  const z = $("#dropAll"); if (!z) return;
  z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("over"); });
  z.addEventListener("dragleave", () => z.classList.remove("over"));
  z.addEventListener("drop", (e) => { e.preventDefault(); z.classList.remove("over"); distributePhotos([...e.dataTransfer.files]); });
}
const isImg = (f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);

async function readAll(files) {
  const out = [];
  for (const f of files.filter(isImg)) {
    try { out.push(await readPhoto(f)); } catch (e) { toast(`„${f.name}“ konnte nicht gelesen werden (HEIC bitte vorher in JPEG wandeln).`); }
  }
  return out;
}
async function addPhotosToDay(dayId, files) {
  const d = dayOf(dayId); if (!d) return;
  toast("Fotos werden gelesen …", 20000);
  d.photos.push(...(await readAll(files)));
  S.open.add(dayId); changed(); renderPanel(); toast("Fotos hinzugefügt.");
}
async function distributePhotos(files) {
  const t = S.trip;
  toast("Fotos werden gelesen …", 60000);
  const list = (await readAll(files)).sort((a, b) => (a.day || "").localeCompare(b.day || ""));
  let made = 0, nameJobs = [];
  for (const p of list) {
    let d = p.day ? t.days.find((x) => x.date === p.day) : t.days[t.days.length - 1];
    if (!d) {
      d = newDay(p.day); if (TEMPLATES[t.template].fixedPlace) d.place = { ...t.destination };
      t.days.push(d); t.days.sort(byDate); made++;
      if (p.gps && !TEMPLATES[t.template].fixedPlace) nameJobs.push([d, p.gps]);
    }
    d.photos.push(p);
  }
  changed(); renderPanel();
  toast(`${list.length} Fotos zugeordnet${made ? `, ${made} neue Tage angelegt` : ""}.`);
  for (const [d, g] of nameJobs) {
    try { const name = await reversePlace(g.lat, g.lon); if (name && !d.place.name) { d.place = { name, lat: g.lat, lon: g.lon }; changed(); if (S.tab === "days") renderPanel(); } } catch (e) { break; }
  }
}

/* ---------- Karte ---------- */
async function makeMap() {
  const t = S.trip, btn = $("#mapBtn"), st = $("#mapStatus");
  if (btn) btn.disabled = true;
  try {
    const r = await renderMap(t, { road: t.route.road, onStatus: (m) => { const e = $("#mapStatus"); if (e) e.textContent = m; } });
    t.mapImg = r.src; t.mapW = r.w; t.mapH = r.h; t.mapUser = false; t.route.mapSig = mapSignature(t);
    if (r.legs) { t.route.legs = r.legs; t.route.km = r.km; }
    changed(); renderPanel();
    toast(r.mode === "osm" ? "Karte erzeugt." : "Karte erzeugt, aber ohne Kartenhintergrund (Kacheln nicht erreichbar).");
  } catch (e) { if (st) st.textContent = e.message; toast(e.message); if (btn) btn.disabled = false; }
}
async function useOwnMap(file) {
  if (!file) return;
  try {
    const bmp = await createImageBitmap(file), s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    S.trip.mapImg = cv.toDataURL("image/jpeg", 0.9); S.trip.mapW = cv.width; S.trip.mapH = cv.height; S.trip.mapUser = true;
    changed(); renderPanel(); toast("Eigenes Kartenbild übernommen (wird auf der Deckseite zugeschnitten eingepasst).");
  } catch (e) { toast("Das Bild konnte nicht gelesen werden."); }
}
/* Titelfoto: auf das Seitenverhältnis des Farbbalkens zuschneiden und abdunkeln, damit weiße Schrift lesbar bleibt. */
async function useCover(file) {
  if (!file) return;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const W = 1500, H = Math.round(W * 290 / PW), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), k = Math.max(W / bmp.width, H / bmp.height);
    g.drawImage(bmp, (W - bmp.width * k) / 2, (H - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(0,0,0,.35)"); gr.addColorStop(1, "rgba(0,0,0,.68)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    S.trip.coverPhoto = cv.toDataURL("image/jpeg", 0.88); S.trip.coverW = W; S.trip.coverH = H;
    changed(); renderPanel(); toast("Titelfoto übernommen.");
  } catch (e) { toast("Das Bild konnte nicht gelesen werden."); }
}
function applyLegs() {
  const t = S.trip, pts = t.route.points, legs = t.route.legs;
  let n = 0;
  legs.forEach((leg, k) => {
    const di = pts[k + 1] && pts[k + 1].day;
    if (di == null || di < 0 || !t.days[di]) return;
    const d = t.days[di];
    d.km = String(Math.round(leg.km));
    const m = Math.round(leg.min); d.drive = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
    n++;
  });
  changed(); renderPanel(); toast(n ? `Kilometer und Fahrzeit für ${n} Tage eingetragen.` : "Keine passenden Tage gefunden.");
}

/* ---------- Projekt: speichern, öffnen, PDF ---------- */
function loadTrip(t, fresh) {
  S.trip = normalizeTrip(t); S.open = new Set(); S.newPoint = blankPlace();
  if (!fresh && S.trip.days[0]) S.open.add(S.trip.days[0].id);
  refreshDerived(S.trip);
  S.tab = fresh ? "trip" : "trip";
  renderPanel(); renderPreview(); scheduleSave();
}
function saveProject() {
  download(new Blob([JSON.stringify(S.trip)], { type: "application/json" }), safeName(S.trip.title) + ".reise.json");
  toast("Projektdatei gespeichert (mit Fotos und Karte).");
}
async function openProject(file) {
  if (!file) return;
  try {
    const t = JSON.parse(await file.text());
    if (!t || !Array.isArray(t.days)) throw new Error("kein Reiseprojekt");
    loadTrip(t); toast("Projekt geöffnet.");
  } catch (e) { toast("Die Datei ist kein gültiges Reise-Projekt."); }
  $("#openFile").value = "";
}
async function makePdf() {
  const btn = $("#pdfBtn"); if (S.busy) return;
  if (!window.PDFLib) { toast("Die PDF-Bibliothek konnte nicht geladen werden (Internet nötig)."); return; }
  S.busy = true; btn.disabled = true;
  try {
    const { pages } = layoutTrip(S.trip);
    const bytes = await buildPdf(pages, { title: S.trip.title, author: S.trip.travelers }, (n, N) => (btn.textContent = `Seite ${n}/${N} …`));
    download(new Blob([bytes], { type: "application/pdf" }), safeName(S.trip.title) + ".pdf");
    toast("PDF erstellt.");
  } catch (e) { console.error(e); toast("PDF-Fehler: " + e.message); }
  S.busy = false; btn.disabled = false; btn.textContent = "PDF erstellen";
}

/* ---------- Autosave im Browser (IndexedDB, wegen der Fotos) ---------- */
function idb() {
  return new Promise((res, rej) => {
    const q = indexedDB.open("reise-protokoll", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("kv");
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
const idbSet = (k, v) => idb().then((db) => new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }));
const idbGet = (k) => idb().then((db) => new Promise((res, rej) => { const r = db.transaction("kv").objectStore("kv").get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
