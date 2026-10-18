/* ---------- Datenmodell ----------
   Eine Reise (`trip`) besteht aus Einstellungen, Tagen, Route und Karte.
   Alles ist einfaches JSON und wird als Projektdatei gespeichert. */

const CATS = [
  { id: "unterkunft", name: "Unterkunft" },
  { id: "essen", name: "Essen & Trinken" },
  { id: "transport", name: "Transport" },
  { id: "aktivitaeten", name: "Aktivitäten" },
  { id: "sonstiges", name: "Sonstiges" },
];
const WEATHER = [
  { id: "sun", name: "Sonnig" }, { id: "partly", name: "Heiter" }, { id: "cloud", name: "Bewölkt" },
  { id: "rain", name: "Regen" }, { id: "storm", name: "Gewitter" }, { id: "snow", name: "Schnee" }, { id: "fog", name: "Nebel" },
];
const weatherName = (id) => (WEATHER.find((w) => w.id === id) || {}).name || "";

const blankPlace = () => ({ name: "", lat: null, lon: null });

function newDay(date = "") {
  return {
    id: uid(), date, place: blankPlace(), from: "", km: "", drive: "", title: "", lodging: "",
    weather: "", tmin: "", tmax: "", wxAuto: null, wxExtra: "", text: "", plan: "",
    highlights: "", costs: [], photos: [],
  };
}

function newTrip(template = "reise") {
  return {
    format: 1, template: TEMPLATES[template] ? template : "reise", theme: "meer", title: "", subtitle: "", travelers: "", currency: "EUR", start: "",
    startPlace: blankPlace(), roundTrip: false,
    days: [], summary: "", summaryAuto: true,
    route: { auto: true, road: true, points: [], km: null, legs: [], mapSig: "" },
    mapImg: "", mapSource: "", mapUser: false, coverPhoto: "", projData: true, embed: "original", capWeather: true, wxLine: false, capNum: false, capDate: false, capPlace: false, capGps: false, capNote: true, capMarks: true, capFile: false, hashes: false, dpi: "150", placeMode: "auto", stripN: "auto", photoStyle: "shadow", ruled: true, costPage: true,
  };
}

/* Frühere Fassungen kannten die Vorlagen „Kurztrip“ und „Rundreise“ (Kurztrip mit einem Reiseziel für alle Tage).
   Beides ist jetzt die Vorlage „Reise“; das Reiseziel wandert als Ort in die Tage ohne Ortsangabe. */
function migrateTrip(t) {
  if (!t || typeof t !== "object") return t;
  const o = { ...t }, dest = o.destination;
  o.template = TEMPLATES[o.template] ? o.template : "reise";
  if (dest && typeof dest === "object" && typeof dest.name === "string" && dest.name && Array.isArray(o.days)) {
    o.days = o.days.map((d) => (d && typeof d === "object" && !(d.place && d.place.name) ? { ...d, place: { name: dest.name, lat: dest.lat, lon: dest.lon } } : d));
  }
  delete o.destination;
  return o;
}

/* Fehlende Felder ergänzen (beim Laden älterer oder fremder Dateien). */
function normalizeTrip(t) {
  t = migrateTrip(t);
  const base = newTrip(t.template);
  const out = { ...base, ...t };
  out.startPlace = { ...blankPlace(), ...(t.startPlace || {}) };
  out.route = { ...base.route, ...(t.route || {}) };
  if (!THEMES[out.theme]) out.theme = "meer";
  if (out.embed === "work") out.embed = "1600"; // frühere Bezeichnung
  out.days = (Array.isArray(t.days) ? t.days : []).map((d) => ({
    ...newDay(), ...d, place: { ...blankPlace(), ...(d.place || {}) },
    costs: Array.isArray(d.costs) ? d.costs.map((c) => ({ id: uid(), l: "", cat: "sonstiges", a: "", ...c })) : [],
    photos: Array.isArray(d.photos) ? d.photos : [],
  }));
  return out;
}

/* Ältere oder unvollständige Fotos ergänzen (Arbeitskopie `src` ist Pflicht). */
function normPhoto(p) {
  const bw = p.bw || p.w || 1, bh = p.bh || p.h || 1;
  const o = { id: uid(), name: "Foto", type: "", mod: 0, size: 0, file: null, src: "", vsrc: "", gps: null, day: "", time: "", dayFromFile: false, note: "", rot: 0, crop: null, marks: [], wx: null, weather: "", weatherSrc: "", wxTried: false, place: "", placeSrc: "", sha: "", ...p, bw, bh };
  o.w = o.w || bw; o.h = o.h || bh;
  return o;
}

/* ---------- Ableitungen ---------- */
const dayCosts = (d) => d.costs.reduce((s, c) => s + parseNum(c.a), 0);
const dayHighlights = (d) => String(d.highlights || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

/* Ort eines Tages; ohne Eintrag gilt der Ort des letzten Tages davor (mehrere Tage am selben Ort) */
function dayPlaceName(t, d) {
  if (d.place.name) return d.place.name;
  for (let k = t.days.indexOf(d) - 1; k >= 0; k--) if (t.days[k].place.name) return t.days[k].place.name;
  return "";
}
function dayFrom(t, i) {
  const d = t.days[i];
  if (d.from.trim()) return d.from.trim();
  for (let k = i - 1; k >= 0; k--) if (t.days[k].place.name) return t.days[k].place.name;
  return t.startPlace.name || "";
}

function tripStats(t) {
  const days = t.days, n = days.length;
  const dated = days.map((d) => d.date).filter((x) => parseIso(x)).sort();
  const start = dated[0] || t.start || "", end = dated[dated.length - 1] || "";
  const places = [], seen = new Set();
  const addP = (name) => {
    name = (name || "").trim();
    if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); places.push(name); }
  };
  days.forEach((d) => addP(d.place.name));
  // Strecke nur aus eingetragenen Kilometern oder der berechneten Straßenroute, keine Schätzung aus der Luftlinie
  let km = days.reduce((s, d) => s + parseNum(d.km), 0), kmEst = false;
  if (!km && t.route.km) km = t.route.km;
  const byCat = {}; let cost = 0;
  days.forEach((d) => d.costs.forEach((c) => { const a = parseNum(c.a); cost += a; byCat[c.cat] = (byCat[c.cat] || 0) + a; }));
  const temps = days.filter((d) => hasNum(d.tmin) || hasNum(d.tmax)).map((d) => (hasNum(d.tmin) && hasNum(d.tmax) ? (parseNum(d.tmin) + parseNum(d.tmax)) / 2 : parseNum(hasNum(d.tmin) ? d.tmin : d.tmax)));
  return {
    nDays: n, nights: Math.max(0, n - 1), start, end, range: fmtRange(start, end), places, km: Math.round(km), kmEst,
    cost, byCat, perDay: n ? cost / n : 0, photos: days.reduce((s, d) => s + d.photos.length, 0),
    avgT: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
    sunDays: days.filter((d) => d.weather === "sun" || d.weather === "partly").length,
  };
}

/* ---------- Route aus Tagen und Fotos ---------- */
function routeFromDays(t) {
  const pts = [];
  const push = (p, force, day = -1) => {
    if (!p || !p.name) return;
    const last = pts[pts.length - 1];
    if (!force && last && (last.name === p.name || (hasGeo(last) && hasGeo(p) && haversine(last, p) < 1))) return;
    pts.push({ id: uid(), name: p.name, lat: hasGeo(p) ? p.lat : null, lon: hasGeo(p) ? p.lon : null, day });
  };
  push(t.startPlace);
  for (const [di, d] of t.days.entries()) {
    let p = d.place;
    if (p.name && !hasGeo(p)) {
      const g = d.photos.find((x) => x.gps);
      if (g) p = { name: p.name, lat: g.gps.lat, lon: g.gps.lon };
    }
    push(p, false, di);
  }
  if (t.roundTrip && t.startPlace.name) push(t.startPlace, pts.length > 1 && pts[pts.length - 1].name !== t.startPlace.name);
  return pts;
}

function rebuildRoute(t) {
  if (t.route.auto) t.route.points = routeFromDays(t);
}

/* ---------- Zusammenfassung vorschlagen ---------- */
function suggestSummary(t) {
  const st = tripStats(t), out = [];
  const days = `${st.nDays} ${st.nDays === 1 ? "Tag" : "Tage"}`;
  if (!st.nDays) return "";
  const start = t.startPlace.name || "", seq = [...new Set([start, ...st.places].filter(Boolean))];
  const back = t.roundTrip && start ? " und zurück nach " + start : "";
  let route = "";
  if (st.places.length <= 1 && seq.length) route = ` nach ${st.places[0] || seq[0]}`;
  else if (seq.length >= 3) route = ` von ${seq[0]} über ${listDe(seq.slice(1, back ? undefined : -1))}${back ? "" : " nach " + seq[seq.length - 1]}${back}`;
  else if (seq.length === 2) route = ` von ${seq[0]} nach ${seq[1]}${back}`;
  out.push(`Reise${route}: ${days}${st.range ? " (" + st.range + ")" : ""}.`);
  const bits = [];
  if (st.places.length > 1) bits.push(`${st.places.length} Stationen`);
  if (st.km) bits.push(`${st.kmEst ? "etwa " : ""}${fmtNum(st.km)} km`);
  if (bits.length) out.push("Unterwegs: " + bits.join(", ") + ".");
  const hl = t.days.flatMap(dayHighlights).slice(0, 4);
  if (hl.length) out.push("Highlights: " + listDe(hl) + ".");
  if (st.cost > 0) out.push(`Gesamtkosten ${money(st.cost, t.currency)}, durchschnittlich ${money(st.perDay, t.currency)} pro Tag.`);
  if (st.avgT != null) out.push(`Wetter: durchschnittlich ${fmtNum(st.avgT)} °C${st.sunDays ? ", an " + st.sunDays + " von " + st.nDays + " Tagen sonnig bis heiter" : ""}.`);
  if (st.photos) out.push(`${st.photos} Fotos.`);
  return out.join(" ");
}

function refreshDerived(t) {
  rebuildRoute(t);
  if (t.summaryAuto) t.summary = suggestSummary(t);
}

/* ---------- Beispielreisen ---------- */
function demoTrip(kind) {
  const P = (name, lat, lon) => ({ name, lat, lon });
  const C = (l, cat, a) => ({ id: uid(), l, cat, a: String(a) });
  if (kind === "kurztrip") {
    const t = newTrip();
    Object.assign(t, {
      title: "Wochenende in Lissabon", subtitle: "Drei Tage Altstadt, Tram und Pastel de Nata", theme: "herbst", travelers: "Anna & Ben",
      start: "2026-06-12", startPlace: P("Berlin", 52.52, 13.405), roundTrip: true,
    });
    const mk = (i, o) => Object.assign(newDay(addDays("2026-06-12", i)), { place: P("Lissabon", 38.7223, -9.1393) }, o);
    t.days = [
      mk(0, { title: "Ankunft und Alfama", weather: "sun", tmin: "19", tmax: "27", lodging: "Hotel Bairro Alto", plan: "07:10 Flug ab Berlin\n10:15 Landung, mit der Metro in die Stadt\n13:00 Check-in im Hotel, Mittagessen\n15:00 Zu Fuß durch die Alfama\n17:30 Aussicht vom Miradouro das Portas do Sol\n20:30 Fado-Abend mit Sardinen vom Grill", text: "Der Fado ging unter die Haut. Nächstes Mal früher reservieren.", highlights: "Miradouro das Portas do Sol\nFado in der Alfama", costs: [C("Flug", "transport", 228), C("Metro", "transport", 9), C("Abendessen", "essen", 64)] }),
      mk(1, { title: "Belém und Tram 28", weather: "partly", tmin: "20", tmax: "25", lodging: "Hotel Bairro Alto", plan: "09:00 Tram 15 nach Belém\n10:00 Torre de Belém und Hieronymus-Kloster\n12:00 Pastéis de Belém, natürlich\n14:30 Tram 28 durch enge Gassen\n19:30 Sonnenuntergang am Tejo\n21:00 Tapas im Bairro Alto", text: "Vor den Pastéis steht man 20 Minuten an, es lohnt sich.", highlights: "Pastéis de Belém\nTram 28\nSonnenuntergang am Tejo", costs: [C("Eintritte", "aktivitaeten", 36), C("Mittagessen", "essen", 28), C("Abendessen", "essen", 52)] }),
      mk(2, { title: "Sintra und Heimflug", weather: "rain", tmin: "17", tmax: "21", lodging: "", plan: "08:30 Zug nach Sintra\n10:30 Palácio da Pena, im Nebel trotzdem schön\n14:00 Zurück nach Lissabon, Koffer holen\n17:00 Flughafen\n23:00 Landung in Berlin", text: "", highlights: "Palácio da Pena", costs: [C("Zug Sintra", "transport", 11), C("Eintritt Pena", "aktivitaeten", 28), C("Snacks", "essen", 18)] }),
    ];
    refreshDerived(t);
    return t;
  }
  const t = newTrip();
  Object.assign(t, {
    title: "Alpenrundreise 2026", subtitle: "Von München über Salzburg und das Salzkammergut nach Wien und zurück", theme: "meer", travelers: "Familie Mustermann",
    currency: "EUR", start: "2026-05-14", startPlace: P("München", 48.1351, 11.582), roundTrip: true,
  });
  const mk = (i, o) => Object.assign(newDay(addDays("2026-05-14", i)), o);
  t.days = [
    mk(0, { place: P("Salzburg", 47.8095, 13.055), title: "Auf nach Österreich", km: "145", drive: "1:45", weather: "sun", tmin: "11", tmax: "21", lodging: "Altstadthotel Salzburg", text: "Abfahrt um 8 Uhr, kaum Verkehr auf der A8. Nach dem Check-in zu Fuß durch die Altstadt, Festung Hohensalzburg mit der Standseilbahn.\nAbends Mozartkugeln und Nockerl im Sternbräu.", highlights: "Festung Hohensalzburg\nSalzburger Nockerl", costs: [C("Maut Vignette", "transport", 12.8), C("Hotel", "unterkunft", 138), C("Abendessen", "essen", 71.5)] }),
    mk(1, { place: P("Hallstatt", 47.5622, 13.6493), title: "Salzkammergut", from: "Salzburg", km: "75", drive: "1:15", weather: "partly", tmin: "9", tmax: "18", lodging: "Pension am See", text: "Über den Wolfgangsee nach Hallstatt. Am Vormittag war es noch ruhig im Ort, ab Mittag kamen die Reisebusse. Rundgang, dann mit der Seilbahn zum Skywalk.", highlights: "Skywalk Hallstatt\nFrühstück am Wolfgangsee", costs: [C("Parkplatz", "transport", 15), C("Seilbahn", "aktivitaeten", 62), C("Pension", "unterkunft", 124), C("Essen", "essen", 58)] }),
    mk(2, { place: P("Wien", 48.2082, 16.3738), title: "Donau und Wachau", km: "290", drive: "3:30", weather: "cloud", tmin: "10", tmax: "16", lodging: "Apartment Neubau", text: "Entlang der Donau durch die Wachau, Stopp in Melk. Am Nachmittag in Wien angekommen, Spaziergang durch den Prater.", highlights: "Stift Melk\nRiesenrad im Prater", costs: [C("Stift Melk", "aktivitaeten", 38), C("Apartment (2 Nächte)", "unterkunft", 260), C("Essen", "essen", 64)] }),
    mk(3, { place: P("Wien", 48.2082, 16.3738), title: "Wien zu Fuß", km: "", weather: "rain", tmin: "8", tmax: "13", lodging: "Apartment Neubau", text: "Regentag: Kunsthistorisches Museum, Kaffee im Café Central, am Abend Wiener Schnitzel.", highlights: "Kunsthistorisches Museum\nCafé Central", costs: [C("Museum", "aktivitaeten", 44), C("Café", "essen", 32), C("Abendessen", "essen", 88)] }),
    mk(4, { place: P("München", 48.1351, 11.582), title: "Heimfahrt", from: "Wien", km: "435", drive: "4:15", weather: "sun", tmin: "10", tmax: "22", lodging: "", text: "Früh los, Mittagspause in Linz. Am späten Nachmittag wieder zu Hause.", highlights: "Linzer Torte", costs: [C("Diesel", "transport", 92), C("Mittagessen", "essen", 46)] }),
  ];
  refreshDerived(t);
  return t;
}
