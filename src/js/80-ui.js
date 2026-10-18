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
  ${chk("Kostenübersicht am Ende", "costPage", t.costPage)}
  <h3>Fotos: Beschriftung unter den Bildern</h3>
  ${chk("Fotonummer (Foto 1, Foto 2 …)", "capNum", t.capNum)}
  ${chk("Datum und Uhrzeit", "capDate", t.capDate)}
  ${chk("Ort", "capPlace", t.capPlace)}
  ${chk("GPS-Koordinaten (im PDF als Link zur Karte)", "capGps", t.capGps)}
  ${chk("Wetter zur Aufnahmezeit", "wxLine", t.wxLine)}
  ${chk("Bildunterschrift / Bemerkung", "capNote", t.capNote)}
  ${chk("Notizen zu nummerierten Markierungen", "capMarks", t.capMarks)}
  ${chk("Dateiname", "capFile", t.capFile)}
  <h3>Fotos auf den Seiten</h3>
  ${selFld("Fotos auf der Tagesseite (weitere kommen auf Fotoseiten)", "stripN", String(t.stripN), [["auto", "Automatisch: Freiraum unter dem Text nutzen"], ["0", "Keine, nur Fotoseiten"], ["1", "1 Foto"], ["2", "2 Fotos"], ["3", "3 Fotos"]])}
  ${selFld("Aussehen der Fotos", "photoStyle", t.photoStyle, [["shadow", "Schatten und abgerundete Ecken"], ["frame", "Weißer Rand mit Schatten"], ["plain", "Schlicht mit dünnem Rand"]])}
  ${selFld("Bildauflösung auf der Seite", "dpi", t.dpi, [["110", "110 dpi – klein, für den Bildschirm"], ["150", "150 dpi – Standard"], ["220", "220 dpi – guter Druck"], ["300", "300 dpi – sehr scharf, großes PDF"]])}
  <h3>Originale & Qualität</h3>
  ${selFld("Fotos im PDF einbetten", "embed", t.embed, [["original", "Originaldateien (volle Qualität, mit EXIF)"], ["3200", "Verkleinert auf 3200 px (leicht, ca. 1,2 MB je Foto)"], ["2400", "Verkleinert auf 2400 px (mittel, ca. 0,7 MB)"], ["1600", "Verkleinert auf 1600 px (stark, ca. 0,3 MB)"]])}
  ${chk("Bearbeitungsdaten und Fotos im PDF speichern (PDF lässt sich später wieder öffnen und weiterbearbeiten)", "projData", t.projData)}
  ${chk("Prüfsummen-Seite (SHA-256) anhängen: belegt später, dass ein Foto unverändert ist", "hashes", t.hashes)}
  <small>${embedEstimate(t)}</small>
  <h3>Ort und Wetter aus den Fotodaten</h3>
  ${selFld("Ort aus GPS", "placeMode", t.placeMode, [["auto", "OpenStreetMap (Straße, Hausnummer), sonst offline"], ["offline", "Nur offline (nächster Ort aus der eingebauten Liste)"], ["off", "Aus"]])}
  ${chk("Wetter aus den Fotodaten ermitteln (Koordinaten und Aufnahmedatum gehen dafür an DWD/Bright Sky bzw. Open-Meteo)", "capWeather", t.capWeather)}`;
}

function embedEstimate(t) {
  const ph = t.days.flatMap((d) => d.photos);
  if (!ph.length) return "Noch keine Fotos.";
  const orig = ph.reduce((s, p) => s + (p.file ? p.file.size : p.size || 0), 0), work = ph.reduce((s, p) => s + p.src.length * 0.75, 0);
  const mb = (n) => fmtNum(n / 1048576, 1) + " MB";
  const per = { 3200: 1.2, 2400: 0.7, 1600: 0.3 }[t.embed], est = t.embed === "original" ? (orig || work) : Math.min(orig || Infinity, per * 1048576 * ph.length);
  return `${ph.length} Fotos: etwa ${mb(est)} zusätzlich im PDF${t.projData ? "" : " (nur wenn die Bearbeitungsdaten gespeichert werden)"}.`;
}

/* ---------- Reiter „Tage“ ---------- */
const DAY_FIELDS = {
  place: (d) => placeFld("Ort / Ziel des Tages", `d:${d.id}.place`, d.place),
  from: (d) => fld("Start (leer = vorheriger Ort)", `d:${d.id}.from`, d.from),
  km: (d) => fld("Kilometer", `d:${d.id}.km`, d.km, { inputmode: "decimal" }),
  drive: (d) => fld("Fahrzeit (Std:Min)", `d:${d.id}.drive`, d.drive, { ph: "2:30" }),
  title: (d) => fld("Titel des Tages", `d:${d.id}.title`, d.title, { ph: "z. B. Salzkammergut" }),
  weather: (d) => `<div class="wx">${selFld("Wetter", `d:${d.id}.weather`, d.weather, [["", "–"], ...WEATHER.map((w) => [w.id, w.name])])}${fld("Min °C", `d:${d.id}.tmin`, d.tmin, { inputmode: "decimal" })}${fld("Max °C", `d:${d.id}.tmax`, d.tmax, { inputmode: "decimal" })}</div>${fld("Wetter-Details (optional, ersetzt die Zeile aus den Fotodaten)", `d:${d.id}.wxExtra`, d.wxExtra, { ph: "z. B. Wind Ø 12 km/h aus SW, am Nachmittag Schauer" })}${wxHint(d)}`,
  lodging: (d) => fld("Unterkunft", `d:${d.id}.lodging`, d.lodging),
  text: (d) => fld(S.trip.template === "kurztrip" ? "Notizen" : "Tagebuch", `d:${d.id}.text`, d.text, { rows: 7, ph: "Was haben wir erlebt?" }),
  plan: (d) => fld("Tagesplan (eine Zeile pro Punkt, Uhrzeit vorn)", `d:${d.id}.plan`, d.plan, { rows: 7, ph: "09:30 Frühstück im Café, 11:00 Stadtrundgang, …" }),
  highlights: (d) => fld("Highlights (eine pro Zeile)", `d:${d.id}.highlights`, d.highlights, { rows: 3 }),
  costs: (d) => `<div class="f"><span>Ausgaben <b data-sum="${d.id}">${dayCosts(d) ? "· " + money(dayCosts(d), S.trip.currency) : ""}</b></span>${d.costs.map((c) => `<div class="cost"><input data-k="d:${d.id}.costs.${c.id}.l" value="${esc(c.l)}" placeholder="Bezeichnung"><select data-k="d:${d.id}.costs.${c.id}.cat">${CATS.map((k) => `<option value="${k.id}" ${k.id === c.cat ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</select><input data-k="d:${d.id}.costs.${c.id}.a" value="${esc(c.a)}" inputmode="decimal" placeholder="0,00"><button class="ico" data-act="delCost" data-day="${d.id}" data-id="${c.id}" title="Entfernen">×</button></div>`).join("")}<button data-act="addCost" data-day="${d.id}">+ Ausgabe</button></div>`,
  photos: (d) => `<div class="f"><span>Fotos (${d.photos.length})</span>${d.photos.map((p) => photoCard(d, p)).join("")}<label class="drop" style="padding:6px;margin:0">+ Fotos wählen<input type="file" accept="image/*,.heic,.heif" multiple hidden data-photos="${d.id}"></label></div>`,
};

/* Hinweis unter dem Wetter eines Tages: automatisch aus Fotodaten oder Knopf zum Ermitteln */
function wxHint(d) {
  if (!S.trip.capWeather) return "";
  const can = d.photos.some((p) => p.gps && p.day && p.time && !p.dayFromFile);
  if (!can) return "";
  const n = d.photos.filter((p) => p.wx).length;
  return `<div class="wxhint"><small>${d.wxAuto && n ? `Aus ${n} Fotodaten ermittelt (DWD/Open-Meteo).` : "Wetter lässt sich aus den Fotodaten ermitteln."}</small> <button class="ghost" data-act="resetWx" data-day="${d.id}">${n ? "neu ermitteln" : "ermitteln"}</button></div>`;
}

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

/* Änderung aus dem Hintergrund (Ort, Wetter): Vorschau aktualisieren, die Seitenleiste nur neu zeichnen, wenn gerade nicht getippt wird */
let softT;
function softChanged() {
  changed();
  clearTimeout(softT);
  softT = setTimeout(function again() {
    const a = document.activeElement;
    if (a && $("#panel").contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { softT = setTimeout(again, 1500); return; }
    if (S.tab === "days" || S.tab === "trip") renderPanel();
  }, 400);
}

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
  if (/^d:[^.]+\.(weather|tmin|tmax)$/.test(key)) { const wd = dayOf(key.split(".")[0].slice(2)); if (wd) wd.wxAuto = false; }
  if (key === "capWeather" && el.checked) { wxState = "unknown"; queueAllWeather(); }
  if (key === "stripN") r.obj[r.prop] = el.value === "auto" ? "auto" : +el.value;
  if (key === "placeMode") reresolvePlaces();
  if (/^d:[^.]+\.photos\.[^.]+\.place$/.test(key)) { r.obj.placeSrc = el.value ? "manual" : ""; if (!el.value) queuePlace(r.obj); }
  if (/^d:[^.]+\.photos\.[^.]+\.weather$/.test(key)) { r.obj.weatherSrc = el.value ? "manual" : ""; if (!el.value) { r.obj.wx = null; r.obj.wxTried = false; queueWeather(r.obj); } }
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
  else if (el.id === "photoAll" || el.id === "photoGlobal") { addPhotos([...el.files]); el.value = ""; }
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
    case "resetWx": { const d = dayOf(dayId); if (d) { wxState = "unknown"; resetDayWeather(d); toast("Wetter wird aus den Fotodaten ermittelt …"); } break; }
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
    case "addPhotos": $("#photoGlobal").click(); break;
    case "photoMark": { const p = dayOf(dayId).photos.find((x) => x.id === id); if (p) openEditor(p); break; }
    case "photoRotL": case "photoRotR": { const p = dayOf(dayId).photos.find((x) => x.id === id); if (p) { await rotatePhoto(p, b.dataset.act === "photoRotR" ? 1 : -1); changed(); renderPanel(); } break; }
    case "photoUp": case "photoDown": {
      const d = dayOf(dayId), i = d.photos.findIndex((x) => x.id === id), j = i + (b.dataset.act === "photoUp" ? -1 : 1);
      if (j >= 0 && j < d.photos.length) { [d.photos[i], d.photos[j]] = [d.photos[j], d.photos[i]]; changed(); renderPanel(); }
      break;
    }
    case "pdf": makePdf(); break;
  }
});

/* Dateien irgendwo auf die Seite ziehen: PDF = Projekt öffnen, Bilder = Fotos hinzufügen */
["dragenter", "dragover"].forEach((ev) => document.addEventListener(ev, (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); document.body.classList.add("dragging"); } }));
["dragleave", "drop"].forEach((ev) => document.addEventListener(ev, (e) => { if (ev === "dragleave" && e.relatedTarget) return; document.body.classList.remove("dragging"); }));
document.addEventListener("drop", (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const files = [...e.dataTransfer.files], pdf = files.find(isPdfFile);
  if (pdf) openProject(pdf); else addPhotos(files);
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
}

/* Dateien einlesen (mit Fortschritt); Fehler zählen, nicht abbrechen */
async function readPhotos(files) {
  const out = []; let bad = 0, k = 0;
  for (const f of files) {
    toast(`Fotos werden gelesen … ${++k}/${files.length}`, 120000);
    try { out.push(await makePhoto(f)); } catch (e) { console.warn(f.name, e); bad++; }
  }
  return { list: out, bad };
}
const photoSort = (a, b) => (a.day + " " + a.time).localeCompare(b.day + " " + b.time);

async function addPhotosToDay(dayId, files) {
  const d = dayOf(dayId); if (!d) return;
  const { list, bad } = await readPhotos(files.filter(isImageFile));
  d.photos.push(...list); d.photos.sort(photoSort);
  S.open.add(dayId); changed(); renderPanel(); queueAllWeather(); queueAllPlaces();
  toast(bad ? `${list.length} Fotos hinzugefügt, ${bad} nicht lesbar.` : `${list.length} Fotos hinzugefügt.`);
}

/* Mehrere Fotos auf einmal: Tage entstehen aus den Aufnahmedaten, Orte aus dem GPS der Fotos. */
async function addPhotos(files) {
  const imgs = [...files].filter(isImageFile), t = S.trip, fixed = TEMPLATES[t.template].fixedPlace;
  if (!imgs.length) { toast("Keine Bilddateien gefunden."); return; }
  const { list, bad } = await readPhotos(imgs);
  list.sort(photoSort);
  const made = [], touched = new Set();
  for (const p of list) {
    let d = p.day ? t.days.find((x) => x.date === p.day) : t.days[t.days.length - 1];
    if (!d) {
      d = newDay(p.day); if (fixed) d.place = { ...t.destination };
      t.days.push(d); t.days.sort(byDate); made.push(d);
    }
    d.photos.push(p); touched.add(d);
  }
  touched.forEach((d) => d.photos.sort(photoSort));
  const first = made.length ? made.slice().sort(byDate)[0] : null;
  if (!t.start && first && first.date) t.start = first.date;
  const noDate = list.filter((p) => p.dayFromFile).length;
  changed(); S.tab = "days"; made.forEach((d) => S.open.add(d.id)); renderPanel(); queueAllWeather(); queueAllPlaces();
  toast(`${list.length} Fotos zugeordnet${made.length ? `, ${made.length} ${made.length === 1 ? "neuer Tag" : "neue Tage"} angelegt` : ""}${bad ? `, ${bad} nicht lesbar` : ""}${noDate ? `. Bei ${noDate} fehlte das Aufnahmedatum (Dateidatum verwendet)` : ""}.`, 8000);
  /* Orte der neuen Tage aus dem GPS des jeweils letzten Fotos (Abendort), langsam im Hintergrund */
  for (const d of made) {
    const g = d.photos.filter((p) => p.gps).map((p) => p.gps).pop();
    if (!g || (fixed ? t.destination.name : d.place.name)) continue;
    try {
      const name = await reversePlace(g.lat, g.lon);
      if (!name) continue;
      if (fixed) { if (!t.destination.name) { t.destination = { name, lat: g.lat, lon: g.lon }; t.days.forEach((x) => { if (!x.place.name) x.place = { ...t.destination }; }); } }
      else if (!d.place.name) d.place = { name, lat: g.lat, lon: g.lon };
      changed(); if (S.tab === "days") renderPanel();
    } catch (e) { break; }
  }
}

/* ---------- Foto-Karten im Tages-Editor ---------- */
function photoCard(d, p) {
  const nm = NUMS(p).length, info = [p.day ? fmtDate(p.day, { day: "numeric", month: "short" }) + (p.time ? " " + p.time.slice(0, 5) : "") : "", p.gps ? "GPS" : "", nm ? `${nm} Nummern` : "", p.marks.length - nm > 0 ? "Markierungen" : ""].filter(Boolean).join(" · ");
  const k = `d:${d.id}.photos.${p.id}`;
  return `<div class="pcard"><img class="pthumb" src="${p.vsrc || p.src}" alt=""><div class="pbody">
    <input data-k="${k}.note" value="${esc(p.note)}" placeholder="Bildunterschrift / Anmerkung">
    <input data-k="${k}.place" value="${esc(p.place)}" placeholder="Ort (aus GPS, änderbar)" style="margin-top:3px">
    <input data-k="${k}.weather" value="${esc(p.weather)}" placeholder="Wetter (aus Aufnahmezeit und GPS, änderbar)" style="margin-top:3px">
    <small>${esc(p.name)}${info ? " · " + esc(info) : ""}</small>
    <div class="btnrow" style="margin:4px 0 0"><button data-act="photoMark" data-day="${d.id}" data-id="${p.id}">Markieren …</button><button class="ico" data-act="photoRotL" data-day="${d.id}" data-id="${p.id}" title="Links drehen">⟲</button><button class="ico" data-act="photoRotR" data-day="${d.id}" data-id="${p.id}" title="Rechts drehen">⟳</button><button class="ico" data-act="photoUp" data-day="${d.id}" data-id="${p.id}" title="Früher">↑</button><button class="ico" data-act="photoDown" data-day="${d.id}" data-id="${p.id}" title="Später">↓</button><button class="ico" data-act="delPhoto" data-day="${d.id}" data-id="${p.id}" title="Entfernen">×</button></div></div></div>`;
}

/* ---------- Editor: Markieren, Drehen, Ausschnitt (wie im Foto-Protokoll) ---------- */
let edP = null, edTool = "circle", edColor = "#E3242B", edDraft = null, edCrop = false, edRect = null, edStart = null, edFull = "";
try { const s = JSON.parse(localStorage.getItem("reiseprotokoll.ed") || "null"); if (s) { edTool = s.t || edTool; edColor = s.c || edColor; } } catch (e) { /* ohne Speicher */ }
function syncEdButtons() {
  $$("#edTool button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === edTool)));
  $$("#edColor button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === edColor)));
  try { localStorage.setItem("reiseprotokoll.ed", JSON.stringify({ t: edTool, c: edColor })); } catch (e) { /* ohne Speicher */ }
}
async function openEditor(p) {
  edP = p; edCrop = false; edRect = null; edStart = null;
  $("#edName").textContent = p.name;
  syncEdButtons();
  await edLoadImage();
  $("#editor").hidden = false;
}
/* Ansicht (gedreht, zugeschnitten); im Ausschnitt-Modus das ganze gedrehte Bild */
async function edLoadImage() {
  const p = edP; if (!p) return;
  if (edCrop) {
    const [rw, rh] = rotDims(p), c = document.createElement("canvas"); c.width = rw; c.height = rh;
    const bmp = await bitmapOf(p); drawView(c.getContext("2d"), bmp, p, rw, rh, true); bmp.close();
    edFull = c.toDataURL("image/jpeg", 0.85);
  }
  const v = viewBox(p, edCrop);
  $("#edPic").src = edCrop ? edFull : p.vsrc || p.src;
  $("#edImg").style.aspectRatio = `${v.w} / ${v.h}`;
  $("#edSvg").setAttribute("viewBox", `0 0 ${v.w} ${v.h}`);
  $("#editor").classList.toggle("cropping", edCrop);
  $("#edCrop").setAttribute("aria-pressed", String(edCrop));
  $("#edCropReset").disabled = !p.crop;
  $("#edHint").hidden = edCrop; $("#edHintCrop").hidden = !edCrop;
  drawEd(); renderEdNotes();
}
function closeEditor() {
  $("#editor").hidden = true; edDraft = null; edRect = null; edCrop = false; edStart = null; edP = null;
  changed(); renderPanel();
}
function cropOverlay() {
  const [rw, rh] = rotDims(edP), c = edRect || edP.crop; if (!c) return "";
  return `<path d="M0 0H${rw}V${rh}H0Z M${c.x} ${c.y}h${c.w}v${c.h}h${-c.w}Z" fill="rgba(0,0,0,.55)" fill-rule="evenodd"/>`
    + `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
}
function drawEd() {
  if (!edP) return;
  $("#edSvg").innerHTML = marksSvgInner(edP, { full: edCrop, extra: edDraft }) + (edCrop ? cropOverlay() : "");
  $("#edUndo").disabled = !edP.marks.length; $("#edClear").disabled = !edP.marks.length;
  const v = viewBox(edP, edCrop), n = NUMS(edP).length;
  $("#edImg").style.width = `min(100%, calc((100dvh - ${250 + (n ? 30 + 40 * Math.min(n, 4) : 0)}px) * ${(v.w / v.h).toFixed(4)}))`;
}
function renderEdNotes() {
  const box = $("#edNotes"), nums = NUMS(edP);
  box.hidden = !nums.length;
  box.innerHTML = nums.length ? `<span class="lbl">Notizen zu den Nummern</span>` + nums.map((m, k) =>
    `<div class="nrow"><span class="bdg2" style="background:${m.c};color:${numInk(m.c)}">${k + 1}</span><input type="text" data-k="${k}" value="${esc(m.note || "")}" placeholder="Was ist hier? z. B. schöner Aussichtspunkt" aria-label="Notiz zu Nummer ${k + 1}"><button type="button" data-k="${k}" aria-label="Nummer ${k + 1} entfernen">×</button></div>`).join("") : "";
  drawEd();
}
function edPoint(e) {
  const rc = $("#edSvg").getBoundingClientRect(), v = viewBox(edP, edCrop);
  return { x: clamp((e.clientX - rc.left) / rc.width * v.w, 0, v.w), y: clamp((e.clientY - rc.top) / rc.height * v.h, 0, v.h) };
}
const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
function shapeFrom(a, b) {
  const base = Math.min(edP.w, edP.h), d = Math.hypot(b.x - a.x, b.y - a.y), drag = d > base * 0.02;
  if (edTool === "circle") return { t: "circle", x: a.x, y: a.y, r: drag ? d : base * 0.075, c: edColor };
  if (edTool === "num") return { t: "num", x: a.x, y: a.y, r: drag ? Math.min(base * 0.09, Math.max(base * 0.02, d)) : base * 0.036, c: edColor, note: "" };
  if (drag) return { t: "arrow", x: a.x, y: a.y, x2: b.x, y2: b.y, c: edColor };
  let vx = edP.w / 2 - a.x, vy = edP.h / 2 - a.y; const l = Math.hypot(vx, vy);
  if (l < base * 0.05) { vx = -1; vy = -1; }
  const n = Math.hypot(vx, vy);
  return { t: "arrow", x: a.x, y: a.y, x2: a.x + vx / n * base * 0.2, y2: a.y + vy / n * base * 0.2, c: edColor };
}
function bindEditor() {
  const svg = $("#edSvg");
  svg.addEventListener("pointerdown", (e) => {
    if (!edP) return; e.preventDefault(); svg.setPointerCapture(e.pointerId); edStart = edPoint(e);
    if (edCrop) { edRect = null; return; }
    edDraft = shapeFrom(edStart, edStart); drawEd();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!edStart) return;
    if (edCrop) { edRect = rectOf(edStart, edPoint(e)); drawEd(); return; }
    edDraft = shapeFrom(edStart, edPoint(e)); drawEd();
  });
  svg.addEventListener("pointerup", async (e) => {
    if (!edStart) return;
    if (edCrop) {
      const r = rectOf(edStart, edPoint(e)); edStart = null; edRect = null;
      const [rw, rh] = rotDims(edP);
      if (r.w > rw * 0.05 && r.h > rh * 0.05) { edCrop = false; await setCrop(edP, r); await edLoadImage(); } else drawEd();
      return;
    }
    const m = shapeFrom(edStart, edPoint(e));
    edP.marks.push(unviewMark(edP, m)); edStart = null; edDraft = null; drawEd(); if (m.t === "num") renderEdNotes();
  });
  svg.addEventListener("pointercancel", () => { edStart = null; edDraft = null; edRect = null; drawEd(); });
  $("#edNotes").addEventListener("input", (e) => { const k = e.target.dataset.k; if (k != null && edP) NUMS(edP)[+k].note = e.target.value; });
  $("#edNotes").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]"); if (!b || !edP) return;
    const m = NUMS(edP)[+b.dataset.k]; edP.marks.splice(edP.marks.indexOf(m), 1); renderEdNotes();
  });
  $("#edRotL").addEventListener("click", async () => { await rotatePhoto(edP, -1); await edLoadImage(); });
  $("#edRotR").addEventListener("click", async () => { await rotatePhoto(edP, 1); await edLoadImage(); });
  $("#edCrop").addEventListener("click", async () => { edCrop = !edCrop; edRect = null; await edLoadImage(); });
  $("#edCropReset").addEventListener("click", async () => { edCrop = false; await setCrop(edP, null); await edLoadImage(); });
  $("#edTool").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { edTool = b.dataset.v; syncEdButtons(); } });
  $("#edColor").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { edColor = b.dataset.v; syncEdButtons(); } });
  $("#edUndo").addEventListener("click", () => { edP.marks.pop(); renderEdNotes(); });
  $("#edClear").addEventListener("click", () => { edP.marks = []; renderEdNotes(); });
  $("#edDone").addEventListener("click", closeEditor);
  $("#editor").addEventListener("click", (e) => { if (e.target.id === "editor") closeEditor(); });
  document.addEventListener("keydown", (e) => {
    if ($("#editor").hidden) return;
    if (e.key === "Escape") closeEditor();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && e.target.tagName !== "INPUT") { e.preventDefault(); edP.marks.pop(); renderEdNotes(); }
  });
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
    t.mapSource = r.source;
    toast(r.mode !== "osm" ? "Karte erzeugt, aber ohne Kartenhintergrund (Kartenserver nicht erreichbar)."
      : r.blocked ? `Karte erzeugt. Ein Kartenserver hat die Kacheln gesperrt (OpenStreetMap verlangt einen Referer, den lokale Dateien nicht senden), deshalb stammen sie von ${r.sourceName}.` : "Karte erzeugt.", r.blocked || r.mode !== "osm" ? 10000 : 3500);
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

/* ---------- Projekt: öffnen und PDF erstellen ---------- */
function loadTrip(t, fresh) {
  S.trip = normalizeTrip(t); S.open = new Set(); S.newPoint = blankPlace();
  if (!fresh && S.trip.days[0]) S.open.add(S.trip.days[0].id);
  refreshDerived(S.trip);
  S.tab = "trip";
  renderPanel(); renderPreview(); scheduleSave();
  queueAllWeather(); queueAllPlaces();
}
const hasContent = () => S.trip.days.length > 0 || S.trip.title.trim() !== "";

/* Ein Projekt-PDF öffnen (Einstellungen, Tage, Fotos, Karte kommen aus den Anhängen) */
async function openProject(file) {
  if (!file) return;
  if (hasContent() && !confirm("Das aktuelle Projekt wird durch das PDF ersetzt. Fortfahren?")) return;
  try {
    toast("PDF wird gelesen …", 120000);
    const r = await readProjectPdf(file, (n, N) => toast(`Fotos werden geladen … ${n}/${N}`, 120000));
    loadTrip(r.trip);
    const warn = [r.missing ? `${r.missing} Fotos fehlen im PDF` : "", r.unreadable ? `${r.unreadable} Fotos nicht lesbar` : ""].filter(Boolean).join(", ");
    toast(warn ? `Projekt geöffnet (${warn}).` : "Projekt geöffnet.", warn ? 9000 : 3500);
  } catch (e) { console.warn(e); toast(e.message || "Das PDF konnte nicht geöffnet werden.", 10000); }
  const f = $("#openFile"); if (f) f.value = "";
}

async function makePdf() {
  const btn = $("#pdfBtn"); if (S.busy) return;
  if (!window.PDFLib) { toast("Die PDF-Bibliothek konnte nicht geladen werden (Internet nötig)."); return; }
  S.busy = true; btn.disabled = true;
  try {
    const t = S.trip, { pages } = layoutTrip(t);
    const atts = t.projData ? await collectAttachments(t, (n, N) => (btn.textContent = `Fotos ${n}/${N} …`)) : [];
    const dpi = +t.dpi || 150, cache = new Map(), byId = new Map(t.days.flatMap((d) => d.photos).map((p) => [p.id, p]));
    const imageFor = async (op) => {
      const p = byId.get(op.pid); if (!p) return null;
      const key = `${op.pid}|${Math.round(op.w)}|${Math.round(op.h)}`;
      if (!cache.has(key)) cache.set(key, await renderPhotoPx(p, op, dpi));
      return cache.get(key);
    };
    const bytes = await buildPdf(pages, { title: t.title, author: t.travelers }, atts, (n, N) => (btn.textContent = `Seite ${n}/${N} …`), { imageFor });
    download(new Blob([bytes], { type: "application/pdf" }), safeName(t.title) + ".pdf");
    toast(`PDF erstellt (${fmtNum(bytes.length / 1048576, 1)} MB${t.projData ? ", mit Bearbeitungsdaten" : ""}).`);
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
