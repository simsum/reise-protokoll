/* ---------- Karte der Fahrstrecke ----------
   Die Karte wird einmal aus OpenStreetMap-Kacheln zusammengesetzt, mit der Route
   übermalt und als JPEG in der Reise gespeichert. Danach ist sie statisch.
   Gehen die Kacheln nicht (offline, gesperrt), entsteht eine Schemakarte. */
const MAP_W = 1236, MAP_H = 566, TILE = 256;
const mapProj = (lat, lon, z) => {
  const n = TILE * 2 ** z, s = Math.sin(lat * Math.PI / 180);
  return { x: (lon + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n };
};

function mapSignature(t) {
  return JSON.stringify([t.route.points.filter(hasGeo).map((p) => [p.name, +p.lat.toFixed(3), +p.lon.toFixed(3)]), !!t.route.road, t.theme]);
}

/* Straßenroute über OSRM (öffentlicher Demo-Server, nur für wenige Anfragen gedacht). */
async function osrmRoute(pts) {
  const q = pts.map((p) => p.lon.toFixed(5) + "," + p.lat.toFixed(5)).join(";");
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("OSRM " + r.status);
  const j = await r.json();
  if (!j.routes || !j.routes[0]) throw new Error("keine Route");
  const rt = j.routes[0];
  return {
    geom: rt.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })),
    km: rt.distance / 1000,
    legs: rt.legs.map((l) => ({ km: l.distance / 1000, min: l.duration / 60 })),
  };
}

function loadTile(z, x, y) {
  return new Promise((res) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    const to = setTimeout(() => res(null), 9000);
    im.onload = () => { clearTimeout(to); res(im); };
    im.onerror = () => { clearTimeout(to); res(null); };
    im.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  });
}

/* Liefert {src, w, h, mode: "osm"|"schema", legs?, km?} */
async function renderMap(t, { road = true, onStatus = () => {}, noTiles = false, pre = null } = {}) {
  const T = THEMES[t.theme] || THEMES.meer;
  const pts = t.route.points.filter(hasGeo);
  if (!pts.length) throw new Error("Keine Orte mit Koordinaten. Bitte Orte über die Suche wählen.");

  let geom = pts, info = pre || {};
  if (pre && pre.geom) geom = pre.geom;
  else if (road && pts.length > 1) {
    try { onStatus("Straßenroute wird berechnet …"); info = await osrmRoute(pts); geom = info.geom; }
    catch (e) { console.warn(e); onStatus("Straßenroute nicht verfügbar, es werden Luftlinien gezeichnet …"); }
  }

  /* Ausschnitt */
  const lats = geom.map((p) => p.lat), lons = geom.map((p) => p.lon);
  const pad = 70, bb = { a: Math.min(...lats), b: Math.max(...lats), c: Math.min(...lons), d: Math.max(...lons) };
  let z = 12;
  if (pts.length > 1 || geom.length > 1) {
    for (z = 15; z > 2; z--) {
      const p1 = mapProj(bb.b, bb.c, z), p2 = mapProj(bb.a, bb.d, z);
      if (p2.x - p1.x <= MAP_W - 2 * pad && p2.y - p1.y <= MAP_H - 2 * pad) break;
    }
  }
  const c1 = mapProj(bb.b, bb.c, z), c2 = mapProj(bb.a, bb.d, z);
  const ox = (c1.x + c2.x) / 2 - MAP_W / 2, oy = (c1.y + c2.y) / 2 - MAP_H / 2;
  const to = (p) => { const q = mapProj(p.lat, p.lon, z); return { x: q.x - ox, y: q.y - oy }; };

  const cv = document.createElement("canvas"); cv.width = MAP_W; cv.height = MAP_H;
  const g = cv.getContext("2d");
  g.fillStyle = mix(T.soft, "#FFFFFF", 0.4); g.fillRect(0, 0, MAP_W, MAP_H);

  /* Kacheln */
  if (!noTiles) onStatus("Kartenkacheln werden geladen …");
  const tx0 = Math.floor(ox / TILE), tx1 = Math.floor((ox + MAP_W) / TILE), ty0 = Math.floor(oy / TILE), ty1 = Math.floor((oy + MAP_H) / TILE);
  const jobs = [], nT = 2 ** z;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (ty < 0 || ty >= nT) continue;
    const wx = ((tx % nT) + nT) % nT;
    if (noTiles) continue;
    jobs.push(loadTile(z, wx, ty).then((im) => ({ im, tx, ty })));
  }
  const tiles = await Promise.all(jobs);
  const ok = tiles.filter((x) => x.im);
  let mode = ok.length >= Math.max(1, tiles.length * 0.7) ? "osm" : "schema";
  if (mode === "osm") for (const { im, tx, ty } of ok) g.drawImage(im, tx * TILE - ox, ty * TILE - oy);
  else drawSchemaGrid(g, T);

  /* Route */
  const path = (arr) => { g.beginPath(); arr.forEach((p, i) => { const q = to(p); i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }); };
  g.lineJoin = "round"; g.lineCap = "round";
  if (geom.length > 1) {
    path(geom); g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 13; g.stroke();
    path(geom); g.strokeStyle = T.accent; g.lineWidth = 7; g.stroke();
  }

  /* Marker mit Nummer und Name; doppelte Orte (Rückkehr zum Start) nur einmal */
  const marks = [];
  pts.forEach((p, i) => {
    const prev = marks.find((m) => haversine(m.p, p) < 1);
    if (prev) { prev.nums.push(i + 1); return; }
    marks.push({ p, nums: [i + 1], name: p.name });
  });
  g.textBaseline = "middle";
  const placed = [];
  for (const m of marks) {
    const q = to(m.p);
    g.beginPath(); g.arc(q.x, q.y, 19, 0, 7); g.fillStyle = "#fff"; g.fill();
    g.beginPath(); g.arc(q.x, q.y, 15, 0, 7); g.fillStyle = T.accent2; g.fill();
    g.fillStyle = T.ink; g.font = "700 17px Helvetica, Arial, sans-serif"; g.textAlign = "center";
    g.fillText(m.nums.length > 1 ? m.nums[0] + "/" + m.nums[m.nums.length - 1] : String(m.nums[0]), q.x, q.y + 1, 28);
    /* Beschriftung rechts, sonst links; bei Überlappung darunter */
    g.font = "700 21px Helvetica, Arial, sans-serif";
    const w = g.measureText(m.name).width;
    const cands = [[q.x + 26, q.y, "left"], [q.x - 26, q.y, "right"], [q.x, q.y + 38, "center"], [q.x, q.y - 38, "center"]];
    let pick = cands[0];
    for (const c of cands) {
      const x0 = c[2] === "left" ? c[0] : c[2] === "right" ? c[0] - w : c[0] - w / 2;
      const r = { x0, x1: x0 + w, y0: c[1] - 13, y1: c[1] + 13 };
      if (r.x0 < 8 || r.x1 > MAP_W - 8 || r.y0 < 8 || r.y1 > MAP_H - 8) continue;
      if (placed.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0)) continue;
      pick = c; placed.push(r); break;
    }
    g.textAlign = pick[2]; g.lineWidth = 6; g.strokeStyle = "rgba(255,255,255,.95)"; g.strokeText(m.name, pick[0], pick[1]);
    g.fillStyle = T.ink; g.fillText(m.name, pick[0], pick[1]);
  }

  /* Quellenangabe */
  const credit = mode === "osm" ? "© OpenStreetMap-Mitwirkende" : "Schemakarte (ohne Kartenhintergrund)";
  g.font = "15px Helvetica, Arial, sans-serif"; g.textAlign = "right"; g.textBaseline = "alphabetic";
  const cw = g.measureText(credit).width + 14;
  g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(MAP_W - cw, MAP_H - 24, cw, 24);
  g.fillStyle = "#333"; g.fillText(credit, MAP_W - 7, MAP_H - 7);

  let src;
  try { src = cv.toDataURL("image/jpeg", 0.88); }
  catch (e) { /* Canvas durch fremde Kacheln gesperrt: Schemakarte */ return renderMap(t, { noTiles: true, pre: { ...info, geom } }); }
  return { src, w: MAP_W, h: MAP_H, mode, km: info.km, legs: info.legs };
}

function drawSchemaGrid(g, T) {
  g.strokeStyle = mix(T.rule, "#FFFFFF", 0.3); g.lineWidth = 2;
  for (let x = 0; x < MAP_W; x += 103) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, MAP_H); g.stroke(); }
  for (let y = 0; y < MAP_H; y += 103) { g.beginPath(); g.moveTo(0, y); g.lineTo(MAP_W, y); g.stroke(); }
}
