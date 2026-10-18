/* ---------- Schriften und Textmessung (identisch für Vorschau und PDF) ----------
   Das Layout misst Texte mit den Metriken der PDF-Standardschriften. Deshalb
   brechen Vorschau und PDF an denselben Stellen um. */
const FONT_NAMES = {
  R: "Helvetica", B: "HelveticaBold", I: "HelveticaOblique", BI: "HelveticaBoldOblique",
  S: "TimesRoman", SB: "TimesRomanBold", SI: "TimesRomanItalic", C: "Courier",
};
const isSerif = (f) => f[0] === "S";
const BASELINE = { sans: 0.8465, serif: 0.8375, mono: 0.7665 };
const baseOf = (f) => (f === "C" ? BASELINE.mono : isSerif(f) ? BASELINE.serif : BASELINE.sans); // Grundlinie unter der Oberkante bei line-height 1
const FM = { ready: false };

async function initFonts() {
  if (!window.PDFLib) return;
  try {
    const d = await PDFLib.PDFDocument.create();
    for (const k in FONT_NAMES) FM[k] = await d.embedFont(PDFLib.StandardFonts[FONT_NAMES[k]]);
    FM.charset = new Set(FM.R.getCharacterSet());
    FM.ready = true;
  } catch (e) { console.warn(e); }
}

const SUBST = { "→": "–", "←": "–", "≈": "~", "≤": "<=", "≥": ">=", "✓": "x", "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ı": "i", " ": " ", " ": " ", "\t": " " };
function clean(s) {
  s = String(s ?? "");
  if (!FM.ready) return s;
  return [...s].map((ch) => {
    if (FM.charset.has(ch.codePointAt(0))) return ch;
    if (SUBST[ch]) return SUBST[ch];
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return [...base].every((c) => FM.charset.has(c.codePointAt(0))) ? base : "?";
  }).join("");
}

function tw(s, f, size, ls = 0) {
  s = String(s);
  const w = FM.ready ? FM[f].widthOfTextAtSize(s, size) : s.length * size * 0.52;
  return w + ls * [...s].length;
}

function fitT(s, f, size, maxW, ls = 0) {
  s = clean(s);
  if (tw(s, f, size, ls) <= maxW) return s;
  while (s.length > 1 && tw(s + "…", f, size, ls) > maxW) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}

function breakWord(w, f, size, maxW) {
  const parts = []; let cur = "";
  for (const ch of w) {
    if (cur && tw(cur + ch, f, size) > maxW) { parts.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/* Bricht Text in Zeilen; jede Zeile des Eingabetextes ist ein Absatz (leere Zeile = Leerzeile). */
function wrapAll(text, f, size, maxW) {
  const out = [];
  for (const para of String(text ?? "").split(/\r?\n/)) {
    const words = clean(para).split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let cur = "";
    for (const w of words) {
      const parts = tw(w, f, size) > maxW ? breakWord(w, f, size, maxW) : [w];
      for (const part of parts) {
        const t = cur ? cur + " " + part : part;
        if (!cur || tw(t, f, size) <= maxW) cur = t; else { out.push(cur); cur = part; }
      }
    }
    out.push(cur);
  }
  return out;
}

/* Wie wrapAll, aber höchstens `maxLines` Zeilen; die letzte endet bei Bedarf mit „…“. */
function wrapMax(text, f, size, maxW, maxLines) {
  const lines = wrapAll(text, f, size, maxW);
  if (lines.length <= maxLines) return { lines, cut: false };
  const keep = lines.slice(0, maxLines);
  keep[maxLines - 1] = fitT(keep[maxLines - 1] + " …", f, size, maxW);
  return { lines: keep, cut: true };
}
