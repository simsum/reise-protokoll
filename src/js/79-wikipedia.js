/* ---------- Wikipedia-Auszug mit Kennzahlen (Kachel „Wikipedia-Auszug“) ----------
   Suche und Einleitungstext kommen von der deutschen Wikipedia (MediaWiki-API), Kennzahlen (Einwohner, Fläche, Gründung …) aus Wikidata.
   Beide Dienste sind für Browser freigegeben (CORS). Ins Netz geht nur der Suchbegriff bzw. die Kennung des Artikels, nie Fotos oder Reisedaten.
   Der Auszug wird in der Kachel gespeichert (tile.wp), liegt also im Projekt-PDF und funktioniert danach offline.
   Lizenz: Wikipedia-Text CC BY-SA 4.0, Wikidata CC0. Die Quellenzeile steht immer auf der Kachel. */
const WP_HOST = "de.wikipedia.org";
const WP_URL_RE = /^https:\/\/de\.wikipedia\.org\/wiki\/[A-Za-z0-9_%().,'!~*:;@&=+$-]+$/;
const validWpUrl = (u) => typeof u === "string" && u.length < 400 && WP_URL_RE.test(u); // nur geprüfte Artikeladressen werden im PDF verlinkt

/* Wikimedia meldet bei Last „cirrussearch-too-busy-error“ (Suche und Umkreissuche): dann zweimal nach kurzer Pause erneut versuchen */
async function wpJson(url, tries = 3) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  if (j && j.error) {
    if (/too-busy/.test(j.error.code) && tries > 1) { await new Promise((res) => setTimeout(res, 1300)); return wpJson(url, tries - 1); }
    throw new Error(j.error.code || "Fehler");
  }
  return j;
}
const wpErrText = (e) => (/too-busy/.test((e && e.message) || "") ? "Wikipedia ist gerade überlastet. Bitte in einem Moment noch einmal versuchen." : "Wikipedia ist nicht erreichbar (kein Internet oder gesperrt).");
const wpApi = (p) => `https://${WP_HOST}/w/api.php?` + new URLSearchParams({ ...p, format: "json", formatversion: "2", origin: "*" });

/* Suche: Titel, Kurzbeschreibung, Wikidata-Kennung (sortiert nach Treffergüte) */
async function wpSearch(q) {
  q = String(q || "").trim();
  if (!q) return [];
  const j = await wpJson(wpApi({ action: "query", generator: "search", gsrsearch: q, gsrlimit: "8", prop: "description|pageprops", ppprop: "wikibase_item" }));
  return ((j.query && j.query.pages) || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0))
    .map((p) => ({ title: p.title, desc: p.description || "", qid: (p.pageprops && p.pageprops.wikibase_item) || "" }));
}

/* Artikel: Einleitungstext (reiner Text), Kurzbeschreibung, Adresse, Wikidata-Kennung */
async function wpArticle(title) {
  const j = await wpJson(wpApi({ action: "query", prop: "extracts|pageprops|info|description", exintro: "1", explaintext: "1", redirects: "1", inprop: "url", ppprop: "wikibase_item", titles: title }));
  const p = ((j.query && j.query.pages) || [])[0];
  if (!p || p.missing) throw new Error("Artikel nicht gefunden");
  return { title: p.title, text: p.extract || "", desc: p.description || "", url: p.canonicalurl || p.fullurl || "", qid: (p.pageprops && p.pageprops.wikibase_item) || "" };
}

/* In der Nähe: Artikel mit Koordinaten im Umkreis (höchstens 10 km, 100 Treffer), dazu Kurzbeschreibung und Seitenaufrufe der letzten 30 Tage als Maß für
   die Beliebtheit (Sehenswürdigkeiten stehen so vor Straßen und Behörden). onPartial(items) wird zuerst mit der Entfernungsliste, dann mit jeder Ergänzung aufgerufen. */
async function wpNearby(lat, lon, radiusM, onPartial) {
  const g = await wpJson(wpApi({ action: "query", list: "geosearch", gscoord: `${lat}|${lon}`, gsradius: String(clamp(Math.round(radiusM), 10, 10000)), gslimit: "100" }));
  const items = ((g.query && g.query.geosearch) || []).map((x) => ({ title: x.title, dist: x.dist, desc: "", qid: "", views: null }));
  if (!items.length) return items;
  if (onPartial) onPartial(items);
  const byTitle = new Map(items.map((i) => [i.title, i]));
  /* je 50 Titel (Grenze der API), die Blöcke laufen gleichzeitig; die Seitenaufrufe kommen in mehreren Runden (Fortsetzung) */
  const enrich = async (chunk) => {
    const base = { action: "query", titles: chunk.map((i) => i.title).join("|"), prop: "description|pageprops|pageviews", ppprop: "wikibase_item", pvipdays: "30" };
    let params = base;
    try {
      for (let n = 0; n < 12; n++) {
        const j = await wpJson(wpApi(params));
        for (const p of (j.query && j.query.pages) || []) {
          const it = byTitle.get(p.title); if (!it) continue;
          if (p.description) it.desc = p.description;
          if (p.pageprops && p.pageprops.wikibase_item) it.qid = p.pageprops.wikibase_item;
          if (p.pageviews) it.views = Object.values(p.pageviews).reduce((a, b) => a + (b || 0), 0);
        }
        if (onPartial) onPartial(items);
        if (!j.continue) break;
        params = { ...base, ...j.continue };
      }
    } catch (e) { /* ohne Beliebtheit: Liste bleibt nach Entfernung sortiert */ }
  };
  const chunks = []; for (let k = 0; k < items.length; k += 50) chunks.push(items.slice(k, k + 50));
  await Promise.all(chunks.map(enrich));
  return items;
}
const wpDist = (m) => (m >= 1000 ? (m / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " km" : Math.round(m) + " m");
/* Sortierung: "views" = beliebteste zuerst (ohne Zahl hinten), "dist" = nächste zuerst */
const wpSortNear = (items, by) => items.slice().sort((a, b) => (by === "views" && (b.views ?? -1) !== (a.views ?? -1) ? (b.views ?? -1) - (a.views ?? -1) : a.dist - b.dist));

/* ---------- Text aufbereiten ---------- */
/* Aussprache in eckigen Klammern, Einzelnachweise und Klammern mit Zeichen, die das PDF nicht kennt (Lautschrift, andere Schriften), entfallen */
function wpTidy(text) {
  let t = String(text || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  t = t.replace(/\s*\[[^\]]*\]/g, "");
  t = t.replace(/\s*\(([^()]*)\)/g, (m, g) => (FM.ready && /\?/.test(clean(g)) && !/\?/.test(g) ? "" : m));
  t = t.replace(/\(\s*[,;:]\s*/g, "(").replace(/\s*[,;:]\s*\)/g, ")").replace(/\(\s*\)/g, "").replace(/ {2,}/g, " ").replace(/\s+([,.;:])/g, "$1"); // Reste nach dem Entfernen
  return t.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}

const WP_ABBR = ["z. B.", "u. a.", "d. h.", "v. Chr.", "n. Chr.", "u. Ä.", "o. Ä.", "s. o.", "s. u.", "i. d. R.", "bzw.", "ca.", "Nr.", "St.", "Dr.", "Prof.", "usw.", "vgl.", "Jh.", "Mio.", "Mrd.", "geb.", "gest.", "evtl.", "ggf.", "etc.", "Hl.", "Abb.", "Bd.", "Hrsg.", "engl.", "lat.", "frz.", "ital.", "österr.", "Chr.", "Str.", "Tel.", "Inc.", "Co.", "Mt.", "Ltd."];
function wpSentences(par) {
  let s = String(par);
  for (const a of WP_ABBR) s = s.split(a).join(a.replace(/\./g, "\u0001"));
  s = s.replace(/\b(\d{1,2})\.(?=\s)/g, "$1\u0001"); // Ordnungszahlen („am 14. Juni“)
  return s.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"(\[0-9])/).map((x) => x.replace(/\u0001/g, "."));
}
/* die ersten n Sätze (n = 0: alles); Absätze bleiben erhalten */
function wpCut(text, n) {
  if (!n) return text;
  const out = []; let left = n;
  for (const par of String(text).split("\n")) {
    if (!par.trim()) continue;
    const take = wpSentences(par).slice(0, left);
    out.push(take.join(" ")); left -= take.length;
    if (left <= 0) break;
  }
  return out.join("\n");
}

/* ---------- Kennzahlen aus Wikidata ---------- */
const WD_SPECS = [
  { p: "P1082", key: "pop", kind: "pop" }, { p: "P2046", key: "area", kind: "area" }, { p: "P571", key: "inc", kind: "time" }, { p: "P1249", key: "first", kind: "time" },
  { p: "P2044", key: "elev", kind: "len" }, { p: "P2048", key: "height", kind: "len" }, { p: "P1619", key: "open", kind: "time" },
  { p: "P84", key: "arch", kind: "item" }, { p: "P1435", key: "prot", kind: "item" }, { p: "P17", key: "country", kind: "item" }, { p: "P131", key: "region", kind: "item" },
];
const WD_LABEL = { pop: "Einwohner", area: "Fläche", inc: "Baujahr", first: "Erste Erwähnung", elev: "Höhe ü. NN", height: "Höhe", open: "Eröffnung", arch: "Architekt", prot: "Schutzstatus", country: "Land", region: "Region" };
const WD_MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WD_AREA = { Q712226: 1, Q25343: 1e-6, Q35852: 0.01 }, WD_LEN = { Q11573: 1, Q174728: 0.01, Q828224: 1000, Q253276: 1609.344 }; // Einheit → km² bzw. m
const wdUnit = (u) => String(u || "").split("/").pop();

function wdTime(v) {
  const m = /^([+-])(\d+)-(\d\d)-(\d\d)T/.exec((v && v.time) || ""); if (!m) return "";
  const y = +m[2], era = m[1] === "-" ? " v. Chr." : "", p = v.precision || 9;
  if (p >= 11) return `${m[4]}.${m[3]}.${y}${era}`;
  if (p === 10) return `${WD_MONTHS[+m[3] - 1] || ""} ${y}${era}`.trim();
  if (p === 9) return `${y}${era}`;
  if (p === 8) return `${Math.floor(y / 10) * 10}er${era}`;
  if (p === 7) return `${Math.ceil(y / 100)}. Jh.${era}`;
  if (p === 6) return `${Math.ceil(y / 1000)}. Jt.${era}`;
  return `${y}${era}`;
}
const wdNum = (n, d) => n.toLocaleString("de-DE", { maximumFractionDigits: d });
function wdQty(v, kind) {
  const n = parseFloat(v && v.amount); if (!Number.isFinite(n)) return "";
  const u = wdUnit(v.unit);
  if (kind === "pop") return wdNum(Math.round(n), 0);
  if (kind === "area") { const f = WD_AREA[u]; if (!f) return ""; const km = n * f; return wdNum(km, km >= 1000 ? 0 : km >= 10 ? 1 : 2) + " km²"; }
  if (kind === "len") { const f = WD_LEN[u]; if (!f) return ""; const m = n * f; return wdNum(m, m >= 100 ? 0 : 1) + " m"; }
  return "";
}
const wdQualTime = (c) => { const q = c.qualifiers && c.qualifiers.P585 && c.qualifiers.P585[0] && c.qualifiers.P585[0].datavalue; return q && q.value && q.value.time ? q.value.time : ""; };

/* Aussagen auswählen: bevorzugte, sonst ohne Enddatum (nicht Historisches); bei Einwohnern und Fläche die mit dem neuesten Stand */
function wdPick(arr, kind) {
  const ok = (arr || []).filter((c) => c.rank !== "deprecated" && c.mainsnak && c.mainsnak.snaktype === "value" && c.mainsnak.datavalue);
  if (!ok.length) return [];
  const pref = ok.filter((c) => c.rank === "preferred");
  let list = pref.length ? pref : ok.filter((c) => !(c.qualifiers && c.qualifiers.P582));
  if (!list.length) list = ok;
  if (kind === "pop" || kind === "area") list = list.slice().sort((a, b) => wdQualTime(b).localeCompare(wdQualTime(a)));
  return kind === "item" ? list.slice(0, 2) : list.slice(0, 1);
}

/* Liefert [{k, l, v}] in sinnvoller Reihenfolge (Einwohner, Fläche, Gründung …) */
async function wdFacts(qid) {
  const url = (p) => "https://www.wikidata.org/w/api.php?" + new URLSearchParams({ ...p, format: "json", origin: "*" });
  const j = await wpJson(url({ action: "wbgetentities", ids: qid, props: "claims" }));
  const claims = (j.entities && j.entities[qid] && j.entities[qid].claims) || {};
  const picked = WD_SPECS.map((s) => ({ s, list: wdPick(claims[s.p], s.kind) })).filter((x) => x.list.length);
  const ids = [...new Set(picked.filter((x) => x.s.kind === "item").flatMap((x) => x.list.map((c) => c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.id)).filter(Boolean))];
  let labels = {};
  if (ids.length) {
    try {
      const lj = await wpJson(url({ action: "wbgetentities", ids: ids.join("|"), props: "labels", languages: "de", languagefallback: "1" }));
      for (const id of ids) { const e = lj.entities && lj.entities[id], l = e && e.labels && (e.labels.de || Object.values(e.labels)[0]); if (l) labels[id] = l.value; }
    } catch (e) { labels = {}; }
  }
  const hasPop = picked.some((x) => x.s.key === "pop"), out = [];
  for (const { s, list } of picked) {
    const c = list[0], dv = c.mainsnak.datavalue.value;
    let v = "", l = WD_LABEL[s.key];
    if (s.kind === "time") v = wdTime(dv);
    else if (s.kind === "item") v = list.map((x) => labels[x.mainsnak.datavalue.value && x.mainsnak.datavalue.value.id]).filter(Boolean).join(", ");
    else v = wdQty(dv, s.kind);
    if (!v) continue;
    if (s.key === "inc" && hasPop) l = "Gegründet";
    if (s.key === "pop") { const yr = /^[+-](\d{4})/.exec(wdQualTime(c)); if (yr) l += ` (${+yr[1]})`; }
    out.push({ k: s.key, l, v });
  }
  return out;
}

/* ---------- Zeichnen (Kachel und Vorschau-Fenster) ---------- */
function wpSource(wp) {
  const date = wp.date ? fmtDate(wp.date, { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const wd = wp.wd && (wp.facts || []).some((f) => f.on);
  return `Quelle: Wikipedia, „${wp.title || "Artikel"}“, CC BY-SA 4.0${wd ? "; Kennzahlen: Wikidata, CC0" : ""}${date ? ", abgerufen " + date : ""}`;
}

function wikiDraw(pg, T, wp, r, warns, i) {
  const facts = (wp.facts || []).filter((f) => f.on && (f.l || f.v)), gap = 6;
  let y = r.y;
  pg.label(r.x, y, "Wikipedia"); y += 13;
  if (wp.title) {
    const ts = r.w >= 190 ? 14 : 12, tl = wrapMax(wp.title, "SB", ts, r.w, r.h >= 140 ? 2 : 1);
    tl.lines.forEach((l, k) => pg.text(r.x, y + k * ts * 1.15, l, { f: "SB", s: ts }));
    y += tl.lines.length * ts * 1.15 + 5;
  }
  const sl = wrapMax(wpSource(wp), "R", 6.3, r.w, 2).lines, srcH = sl.length * 8 + 2, bottom = r.y + r.h - srcH;
  if (facts.length) {
    const cols = clamp(Math.floor((r.w + gap) / (74 + gap)), 1, Math.min(4, facts.length)), bw = (r.w - gap * (cols - 1)) / cols, bh = 30;
    const maxRows = Math.max(0, Math.floor((bottom - y - (wp.text && wp.text.trim() ? 26 : 0) + gap) / (bh + gap))), rows = Math.min(Math.ceil(facts.length / cols), maxRows);
    if (rows * cols < facts.length) warns.push(`Tag ${i + 1}: Nicht alle Kennzahlen der Wikipedia-Kachel passen hinein.`);
    facts.slice(0, rows * cols).forEach((f, k) => {
      const x = r.x + (k % cols) * (bw + gap), yy = y + Math.floor(k / cols) * (bh + gap);
      pg.rect(x, yy, bw, bh, { fill: T.soft, r: 6 });
      let vs = 11.5; while (vs > 8 && tw(f.v || "–", "SB", vs) > bw - 14) vs -= 0.5; // lange Werte erst verkleinern, dann kürzen
      pg.text(x + 7, yy + 5 + (11.5 - vs) / 2, fitT(f.v || "–", "SB", vs, bw - 14), { f: "SB", s: vs, c: T.accent });
      pg.text(x + 7, yy + 20, fitT((f.l || "").toUpperCase(), "B", 5.8, bw - 14, 0.8), { f: "B", s: 5.8, c: T.muted, ls: 0.8 });
    });
    if (rows) y += rows * (bh + gap) + 2;
  }
  if (wp.text && wp.text.trim()) {
    const avail = bottom - y - 3;
    if (avail < 14) warns.push(`Tag ${i + 1}: Der Wikipedia-Text passt nicht in die Kachel, bitte die Kachel vergrößern.`);
    else if (!drawParas(pg, wp.text, { x: r.x, y, w: r.w, h: avail }, 0, 10, 6.5)) warns.push(`Tag ${i + 1}: Der Wikipedia-Text ist für die Kachel zu lang und wird gekürzt.`);
  }
  sl.forEach((l, k) => pg.text(r.x, r.y + r.h - srcH + 1 + k * 8, l, { s: 6.3, c: T.muted }));
  if (validWpUrl(wp.url)) pg.link(r.x, r.y + r.h - srcH, r.w, srcH, wp.url);
}
