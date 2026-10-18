/* ---------- Fotos und Orte ----------
   Fotos werden auf 1600 px verkleinert und als JPEG in der Reise gespeichert.
   Aus EXIF kommen Aufnahmetag und GPS-Position. */
const PHOTO_EDGE = 1600;

function exifDay(raw) {
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(String(raw || ""));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

async function readPhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, PHOTO_EDGE / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  bmp.close && bmp.close();
  let gps = null, day = "";
  if (window.exifr) {
    try { const g = await exifr.gps(file); if (g && Number.isFinite(g.latitude)) gps = { lat: g.latitude, lon: g.longitude }; } catch (e) { /* kein GPS */ }
    try {
      const x = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"], reviveValues: false });
      day = exifDay(x && (x.DateTimeOriginal || x.CreateDate));
    } catch (e) { /* kein Datum */ }
  }
  if (!day && file.lastModified) day = isoOf(new Date(file.lastModified));
  return { id: uid(), name: file.name, src: cv.toDataURL("image/jpeg", 0.85), w: cv.width, h: cv.height, gps, day };
}

/* ---------- Nominatim (OpenStreetMap): Suche und Ortsname, höchstens eine Anfrage pro Sekunde ---------- */
let nomChain = Promise.resolve();
function nominatim(path) {
  const run = () => fetch("https://nominatim.openstreetmap.org/" + path, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) })
    .then((r) => { if (!r.ok) throw new Error("Nominatim " + r.status); return r.json(); });
  const p = nomChain.then(run, run);
  nomChain = p.then(() => new Promise((r) => setTimeout(r, 1100)), () => new Promise((r) => setTimeout(r, 1100)));
  return p;
}
const placeNameOf = (r) => {
  const a = r.address || {};
  return a.city || a.town || a.village || a.municipality || a.hamlet || a.county || r.name || String(r.display_name || "").split(",")[0];
};
async function searchPlace(q) {
  const r = await nominatim(`search?format=jsonv2&addressdetails=1&limit=6&accept-language=de&q=${encodeURIComponent(q)}`);
  return r.map((x) => ({ name: placeNameOf(x) || q, lat: +x.lat, lon: +x.lon, info: x.display_name }));
}
async function reversePlace(lat, lon) {
  const r = await nominatim(`reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=de&lat=${lat}&lon=${lon}`);
  return placeNameOf(r) || "";
}
