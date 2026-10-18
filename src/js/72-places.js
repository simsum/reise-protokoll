/* ---------- Ort eines Fotos aus dem GPS (wie im Foto-Protokoll) ----------
   placeMode: "auto" = OpenStreetMap (Straße, Hausnummer, PLZ, Ort), sonst offline der nächste Ort aus der eingebauten Liste;
   "offline" = nur die Liste; "off" = keine Ortsangabe. Eine von Hand eingegebene Angabe (placeSrc "manual") gewinnt immer. */
let osmState = "unknown"; // unknown | ok | blocked
const osmCache = new Map();
let placeChain = Promise.resolve();
let regionName = null;
try { regionName = new Intl.DisplayNames(["de"], { type: "region" }); } catch (e) { /* ältere Browser */ }

async function osmPlace(g) {
  const key = g.lat.toFixed(4) + "," + g.lon.toFixed(4);
  if (osmCache.has(key)) return osmCache.get(key);
  const j = await nominatim(`reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=de&lat=${g.lat}&lon=${g.lon}`);
  const a = j.address || {};
  const street = [a.road || a.pedestrian || a.footway || a.path || a.square || a.place, a.house_number].filter(Boolean).join(" ");
  const town = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || "";
  const part = a.suburb && town && a.suburb !== town ? `${town}-${a.suburb}` : town;
  let s = [street, [a.postcode, part].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (a.country_code && a.country_code !== "de" && a.country) s += ", " + a.country;
  s = s || j.display_name || "";
  osmCache.set(key, s);
  return s;
}

/* Offline-Ortsliste (GeoNames, gzip + Base64 im Dokument), beim ersten Bedarf entpackt und in ein 1°-Raster einsortiert */
let orte = null;
function loadOrte() {
  if (orte) return orte;
  orte = (async () => {
    const b64 = document.getElementById("orte-data").textContent.trim();
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const text = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const rows = text.split("\n"), n = rows.length;
    const lat = new Float32Array(n), lon = new Float32Array(n), name = new Array(n), cc = new Array(n), grid = new Map();
    let la = 0, lo = 0;
    for (let i = 0; i < n; i++) {
      const r = rows[i].split("\t");
      la += +r[0]; lo += +r[1];
      lat[i] = la / 1000; lon[i] = lo / 1000; name[i] = r[2]; cc[i] = r[3];
      const k = Math.floor(lat[i]) * 1000 + Math.floor(lon[i]);
      let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(i);
    }
    return { lat, lon, name, cc, grid };
  })();
  return orte;
}
function flatDist(a1, o1, a2, o2) {
  const R = 6371, r = Math.PI / 180, x = (o2 - o1) * r * Math.cos(((a1 + a2) / 2) * r), y = (a2 - a1) * r;
  return Math.sqrt(x * x + y * y) * R;
}
async function offlinePlace(g) {
  const O = await loadOrte();
  let best = -1, bd = Infinity;
  for (let ring = 1; ring <= 3 && best < 0; ring++) {
    const cy = Math.floor(g.lat), cx = Math.floor(g.lon);
    for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
      const a = O.grid.get((cy + dy) * 1000 + (cx + dx)); if (!a) continue;
      for (const i of a) { const d = flatDist(g.lat, g.lon, O.lat[i], O.lon[i]); if (d < bd) { bd = d; best = i; } }
    }
  }
  if (best < 0) return "";
  const country = O.cc[best] === "DE" ? "" : (regionName ? regionName.of(O.cc[best]) : O.cc[best]);
  const where = bd < 1.5 ? O.name[best] : `bei ${O.name[best]} (${bd < 10 ? fmtNum(bd, 1) : Math.round(bd)} km)`;
  return [where, country].filter(Boolean).join(", ");
}

/* ---------- Anwendung auf Fotos ---------- */
const placeWanted = (p) => p.gps && p.placeSrc !== "manual" && !p.place && !!ownerDay(p);
async function resolvePlace(p) {
  const mode = S.trip.placeMode;
  if (!placeWanted(p) || mode === "off") return;
  if (mode === "auto" && osmState !== "blocked") {
    try {
      const r = await osmPlace(p.gps);
      osmState = "ok";
      if (r && placeWanted(p)) { p.place = r; p.placeSrc = "osm"; softChanged(); return; }
    } catch (e) {
      if (osmState !== "ok") { osmState = "blocked"; toast("Adressen sind nicht erreichbar (kein Internet oder gesperrt), es wird der nächste Ort aus der eingebauten Liste verwendet."); }
    }
  }
  const o = await offlinePlace(p.gps).catch(() => "");
  if (o && placeWanted(p)) { p.place = o; p.placeSrc = "offline"; softChanged(); }
}
function queuePlace(p) { placeChain = placeChain.then(() => resolvePlace(p)).catch(() => {}); }
function queueAllPlaces() { S.trip.days.forEach((d) => d.photos.forEach(queuePlace)); }
/* Ermittlung neu starten (Einstellung geändert): alles außer manuellen Angaben verwerfen */
function reresolvePlaces() {
  osmState = "unknown";
  S.trip.days.forEach((d) => d.photos.forEach((p) => { if (p.placeSrc !== "manual") { p.place = ""; p.placeSrc = ""; } }));
  queueAllPlaces(); softChanged();
}
