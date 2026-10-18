/* ---------- Wetter zur Aufnahmezeit (wie im Foto-Protokoll) ----------
   Für Fotos mit EXIF-Aufnahmezeit und GPS wird das Wetter der nächsten vollen Stunde abgefragt:
   zuerst Bright Sky (DWD, Station im Umkreis von 30 km), sonst Open-Meteo. Die Kamerazeit hat keine
   Zeitzone und gilt als Ortszeit am Aufnahmeort. Aus den Fotos eines Tages entstehen Wetter und
   Temperaturspanne des Tages (nur solange sie nicht von Hand geändert wurden). */
let wxState = "unknown"; // unknown | ok | blocked
const wxCache = new Map();
let wxChain = Promise.resolve(), wxLast = 0;
const wxNum = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const WX_ICON = { "clear-day": "sonnig", "clear-night": "klar", "partly-cloudy-day": "teils bewölkt", "partly-cloudy-night": "teils bewölkt", cloudy: "bewölkt", fog: "Nebel", wind: "windig", rain: "Regen", sleet: "Schneeregen", snow: "Schnee", hail: "Hagel", thunderstorm: "Gewitter" };
const WX_COND = { dry: "trocken", fog: "Nebel", rain: "Regen", sleet: "Schneeregen", snow: "Schnee", hail: "Hagel", thunderstorm: "Gewitter" };
const WMO_DE = { 1: "heiter", 2: "teils bewölkt", 3: "bedeckt", 45: "Nebel", 48: "Reifnebel", 51: "leichter Nieselregen", 53: "Nieselregen", 55: "starker Nieselregen", 56: "gefrierender Nieselregen", 57: "gefrierender Nieselregen",
  61: "leichter Regen", 63: "Regen", 65: "starker Regen", 66: "gefrierender Regen", 67: "gefrierender Regen", 71: "leichter Schneefall", 73: "Schneefall", 75: "starker Schneefall", 77: "Schneegriesel",
  80: "leichte Regenschauer", 81: "Regenschauer", 82: "starke Regenschauer", 85: "Schneeschauer", 86: "starke Schneeschauer", 95: "Gewitter", 96: "Gewitter mit Hagel", 99: "Gewitter mit Hagel" };
/* Zuordnung zu den Wettersymbolen der Tagesseite (WEATHER in 10-model.js) */
const KIND_OF_ICON = { "clear-day": "sun", "clear-night": "sun", "partly-cloudy-day": "partly", "partly-cloudy-night": "partly", cloudy: "cloud", fog: "fog", wind: "cloud", rain: "rain", sleet: "snow", snow: "snow", hail: "storm", thunderstorm: "storm" };
const kindOfWmo = (c) => (c === 0 ? "sun" : c === 1 || c === 2 ? "partly" : c === 3 ? "cloud" : c === 45 || c === 48 ? "fog" : c >= 95 ? "storm" : (c >= 71 && c <= 77) || c === 85 || c === 86 ? "snow" : c >= 51 ? "rain" : "");
const kindOfCloud = (c) => (c === null ? "" : c < 25 ? "sun" : c < 60 ? "partly" : "cloud");
const DIRS = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
const wxCloudWord = (c) => (c === null ? "" : c < 15 ? "klar" : c < 40 ? "heiter" : c < 75 ? "teils bewölkt" : c < 95 ? "überwiegend bewölkt" : "bedeckt");

/* Kurze Zeile (unter dem Foto) und volle Zeile (Hinweis im Editor) */
function wxText(x, full) {
  if (!x) return "";
  const n0 = (v) => String(Math.round(v)), n1 = (v) => fmtNum(v, 1), has = (v) => wxNum(v) !== null;
  const parts = [x.cond || ""];
  if (has(x.t)) parts.push(n1(x.t) + " °C" + (full && has(x.feels) && Math.abs(x.feels - x.t) >= 1 ? ` (gefühlt ${n1(x.feels)} °C)` : ""));
  if (has(x.wind)) parts.push(`Wind ${n0(x.wind)} km/h` + (has(x.dir) ? " aus " + compass(x.dir) : "") + (full && has(x.gust) && x.gust > x.wind + 1 ? `, Böen ${n0(x.gust)} km/h` : ""));
  if (has(x.rain) && x.rain > 0) parts.push(`Niederschlag ${n1(x.rain)} mm/h`);
  if (full) {
    if (has(x.hum)) parts.push(`Luftfeuchte ${n0(x.hum)} %`);
    if (has(x.press)) parts.push(`Luftdruck ${n0(x.press)} hPa`);
    parts.push("Quelle: " + (x.src === "brightsky" ? (x.station ? `DWD Station ${x.station}${has(x.dist) ? " (" + n1(x.dist / 1000) + " km)" : ""}` : "DWD") : x.model === "era5" ? "Open-Meteo, ERA5-Modell" : "Open-Meteo"));
  } else parts.push(x.src === "brightsky" ? "DWD" : "Open-Meteo");
  return parts.filter(Boolean).join(" · ");
}

/* nächste volle Stunde als Wandzeit (die Uhrzeit wird nur zum Rechnen als UTC behandelt) */
function wxHour(day, time) {
  const [y, m, d] = day.split("-").map(Number), [H, M] = time.split(":").map(Number), q = (n) => String(n).padStart(2, "0");
  const t = new Date(Date.UTC(y, m - 1, d, H, M + 30));
  return { day: `${t.getUTCFullYear()}-${q(t.getUTCMonth() + 1)}-${q(t.getUTCDate())}`, hh: q(t.getUTCHours()) };
}

async function brightSky(g, h) {
  const ts = `${h.day}T${h.hh}:00`;
  const r = await fetch(`https://api.brightsky.dev/weather?lat=${g.lat.toFixed(4)}&lon=${g.lon.toFixed(4)}&date=${ts}&last_date=${ts}&tz=Europe/Berlin&max_dist=30000`, { signal: AbortSignal.timeout(12000) });
  if (r.status === 404) return null; // keine Station im Umkreis (z. B. im Ausland)
  if (!r.ok) throw new Error("Bright Sky " + r.status);
  const j = await r.json(), w = j.weather && j.weather[0];
  if (!w || wxNum(w.temperature) === null) return null;
  const st = (j.sources || []).find((s) => s.id === w.source_id), cl = wxNum(w.cloud_cover);
  return { src: "brightsky", kind: KIND_OF_ICON[w.icon] || kindOfCloud(cl), cond: WX_ICON[w.icon] || WX_COND[w.condition] || wxCloudWord(cl), t: wxNum(w.temperature), hum: wxNum(w.relative_humidity),
    wind: wxNum(w.wind_speed), dir: wxNum(w.wind_direction), gust: wxNum(w.wind_gust_speed), rain: wxNum(w.precipitation), cloud: cl, press: wxNum(w.pressure_msl),
    station: st ? clipStr(st.station_name, 60) : "", dist: st ? wxNum(st.distance) : null };
}

async function openMeteo(g, h) {
  const age = (Date.now() - Date.UTC(+h.day.slice(0, 4), +h.day.slice(5, 7) - 1, +h.day.slice(8, 10))) / 864e5;
  if (age < -1) return null; // Datum in der Zukunft: kein Wetter
  const era5 = age > 80; // die Vorhersage-Schnittstelle reicht rund 90 Tage zurück, ältere Tage kommen aus dem Archiv
  const vars = "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day";
  const r = await fetch(`https://${era5 ? "archive-api" : "api"}.open-meteo.com/v1/${era5 ? "archive" : "forecast"}?latitude=${g.lat.toFixed(4)}&longitude=${g.lon.toFixed(4)}&start_date=${h.day}&end_date=${h.day}&hourly=${vars}&timezone=auto`, { signal: AbortSignal.timeout(12000) });
  if (r.status === 400) return null;
  if (!r.ok) throw new Error("Open-Meteo " + r.status);
  const j = await r.json(), hr = j.hourly, i = hr && Array.isArray(hr.time) ? hr.time.indexOf(`${h.day}T${h.hh}:00`) : -1;
  if (i < 0) return null;
  const v = (k) => wxNum(hr[k] && hr[k][i]);
  if (v("temperature_2m") === null) return null;
  const code = v("weather_code");
  return { src: "openmeteo", model: era5 ? "era5" : "", kind: kindOfWmo(code) || kindOfCloud(v("cloud_cover")), cond: code === 0 ? (v("is_day") === 0 ? "klar" : "sonnig") : WMO_DE[code] || wxCloudWord(v("cloud_cover")),
    t: v("temperature_2m"), feels: v("apparent_temperature"), hum: v("relative_humidity_2m"), wind: v("wind_speed_10m"), dir: v("wind_direction_10m"), gust: v("wind_gusts_10m"),
    rain: v("precipitation"), cloud: v("cloud_cover"), press: v("pressure_msl") };
}

async function fetchWx(g, h) { // Bright Sky zuerst, bei fehlender Station oder Fehler Open-Meteo
  let netErr = null;
  try { const r = await brightSky(g, h); if (r) return r; } catch (e) { netErr = e; }
  try { return await openMeteo(g, h); } catch (e) { throw netErr || e; }
}

/* Detailzeile des Tages (Tagesseite): eigener Text, sonst Mittelwerte aus den Wetterdaten der Fotos */
function dayWxDetail(d) {
  const extra = (d.wxExtra || "").trim();
  if (extra) return extra;
  const ws = d.photos.map((p) => p.wx).filter(Boolean);
  if (!ws.length) return "";
  const vals = (k) => ws.map((x) => x[k]).filter((v) => v != null);
  const avg = (k) => { const v = vals(k); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const mx = (k) => { const v = vals(k); return v.length ? Math.max(...v) : null; };
  const n0 = (v) => String(Math.round(v)), n1 = (v) => fmtNum(v, 1), parts = [];
  const fe = vals("feels");
  if (fe.length && Math.abs(avg("feels") - avg("t")) >= 1) parts.push(`gefühlt ${n0(Math.min(...fe))}–${n0(Math.max(...fe))} °C`);
  const wind = avg("wind");
  if (wind != null) {
    const dirs = vals("dir"), gust = mx("gust");
    const dir = dirs.length ? (Math.atan2(dirs.reduce((s, a) => s + Math.sin(a * Math.PI / 180), 0), dirs.reduce((s, a) => s + Math.cos(a * Math.PI / 180), 0)) * 180) / Math.PI : null;
    parts.push(`Wind Ø ${n0(wind)} km/h${dir != null ? " aus " + compass(dir) : ""}${gust != null && gust > wind + 1 ? `, Böen bis ${n0(gust)} km/h` : ""}`);
  }
  const rain = mx("rain");
  if (rain != null) parts.push(rain > 0 ? `Niederschlag bis ${n1(rain)} mm/h` : "kein Niederschlag");
  if (avg("cloud") != null) parts.push(`Bewölkung Ø ${n0(avg("cloud"))} %`);
  if (avg("hum") != null) parts.push(`Luftfeuchte Ø ${n0(avg("hum"))} %`);
  if (avg("press") != null) parts.push(`Luftdruck ${n0(avg("press"))} hPa`);
  if (!parts.length) return "";
  const src = [...new Set(ws.map((x) => (x.src === "brightsky" ? "DWD" + (x.station ? ` (${x.station})` : "") : "Open-Meteo")))].join(", ");
  return parts.join(" · ") + " · Quelle: " + src;
}

/* ---------- Anwendung auf Fotos und Tage ---------- */
const ownerDay = (p) => S.trip.days.find((d) => d.photos.includes(p));
const wxWanted = (p) => S.trip.capWeather && p.gps && p.day && p.time && !p.dayFromFile && p.weatherSrc !== "manual" && !p.wx && !p.wxTried && !!ownerDay(p);
const wxMayFill = (d) => d.wxAuto === true || (d.wxAuto == null && !d.weather && !String(d.tmin).trim() && !String(d.tmax).trim());
const KIND_PRIO = ["storm", "snow", "rain", "fog", "cloud", "partly", "sun"];

/* Wetter und Temperaturspanne eines Tages aus den Fotos (Mehrheit der Wetterlagen, bei Gleichstand die „schlechtere“) */
function deriveDayWeather(d) {
  if (!wxMayFill(d)) return false;
  const ws = d.photos.map((p) => p.wx).filter((x) => x && x.t != null);
  if (!ws.length) return false;
  const ts = ws.map((x) => x.t), count = {};
  ws.forEach((x) => { if (x.kind) count[x.kind] = (count[x.kind] || 0) + 1; });
  const best = KIND_PRIO.filter((k) => count[k]).sort((a, b) => count[b] - count[a])[0];
  d.tmin = String(Math.round(Math.min(...ts))); d.tmax = String(Math.round(Math.max(...ts)));
  if (best) d.weather = best;
  d.wxAuto = true;
  return true;
}

function queueWeather(p) { wxChain = wxChain.then(() => resolveWeather(p)).catch(() => {}); }
function queueAllWeather() { S.trip.days.forEach((d) => d.photos.forEach(queueWeather)); }

async function resolveWeather(p) {
  if (!wxWanted(p) || wxState === "blocked") return;
  const h = wxHour(p.day, p.time), key = `${p.gps.lat.toFixed(2)},${p.gps.lon.toFixed(2)},${h.day}T${h.hh}`;
  let wx = wxCache.get(key);
  if (!wx) {
    const wait = 350 - (Date.now() - wxLast); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    wxLast = Date.now();
    try { wx = await fetchWx(p.gps, h); if (wx) wxCache.set(key, wx); wxState = "ok"; }
    catch (e) {
      console.warn("Wetter", e);
      if (wxState !== "ok") { wxState = "blocked"; toast("Wetterdaten sind nicht erreichbar (kein Internet oder gesperrt)."); }
      return;
    }
  }
  if (!wxWanted(p)) return;
  p.wxTried = true;
  if (wx) { p.wx = { ...wx }; p.weather = wxText(wx); p.weatherSrc = wx.src; const d = ownerDay(p); if (d) deriveDayWeather(d); }
  changed(); if (S.tab === "days") renderPanel();
}

/* Wetter eines Tages neu aus den Fotos ermitteln (hebt eine manuelle Änderung auf) */
function resetDayWeather(d) {
  wxState = "unknown"; d.wxAuto = true;
  d.photos.forEach((p) => { if (p.weatherSrc !== "manual") { p.wx = null; p.weather = ""; p.weatherSrc = ""; } p.wxTried = false; });
  d.photos.forEach(queueWeather);
}
