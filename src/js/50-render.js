/* ---------- Vorschau (HTML) und PDF aus dem Seitenmodell ---------- */

const FONT_CSS = {
  R: "font-family:Helvetica,Arial,'Liberation Sans',sans-serif", B: "font-family:Helvetica,Arial,'Liberation Sans',sans-serif;font-weight:700",
  I: "font-family:Helvetica,Arial,'Liberation Sans',sans-serif;font-style:italic", BI: "font-family:Helvetica,Arial,'Liberation Sans',sans-serif;font-weight:700;font-style:italic",
  S: "font-family:'Times New Roman',Times,'Liberation Serif',serif", SB: "font-family:'Times New Roman',Times,'Liberation Serif',serif;font-weight:700",
  SI: "font-family:'Times New Roman',Times,'Liberation Serif',serif;font-style:italic",
};

function pageHtml(pg) {
  const X = (v) => (v / pg.W * 100).toFixed(4) + "%", Y = (v) => (v / pg.H * 100).toFixed(4) + "%";
  const U = (v) => (v / pg.W * 100).toFixed(4) + "cqw";
  const box = (o) => `left:${X(o.x)};top:${Y(o.y)};width:${X(o.w)};height:${Y(o.h)}`;
  let h = "";
  for (const o of pg.ops) {
    if (o.k === "rect") {
      const st = o.stroke ? `border:${U(o.sw)} solid ${o.stroke};box-sizing:border-box;` : "";
      h += `<div class="ab" style="${box(o)};${o.fill ? "background:" + o.fill + ";" : ""}${st}${o.r ? "border-radius:" + U(o.r) : ""}"></div>`;
    } else if (o.k === "line") {
      const horiz = o.y1 === o.y2;
      h += horiz
        ? `<div class="ab" style="left:${X(Math.min(o.x1, o.x2))};top:${Y(o.y1 - o.sw / 2)};width:${X(Math.abs(o.x2 - o.x1))};height:${Y(o.sw)};background:${o.c}"></div>`
        : `<svg class="ab" style="left:0;top:0;width:100%;height:100%" viewBox="0 0 ${pg.W} ${pg.H}" preserveAspectRatio="none"><line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${o.c}" stroke-width="${o.sw}"/></svg>`;
    } else if (o.k === "t") {
      const w = tw(o.text, o.f, o.s, o.ls), x = o.a === "c" ? o.x - w / 2 : o.a === "r" ? o.x - w : o.x;
      h += `<div class="ab t" style="left:${X(x)};top:${Y(o.y)};font-size:${U(o.s)};color:${o.c};${FONT_CSS[o.f]};${o.ls ? "letter-spacing:" + U(o.ls) + ";" : ""}">${esc(o.text)}</div>`;
    } else if (o.k === "path") {
      h += `<svg class="ab" style="${box(o)}" viewBox="0 0 ${o.vw} ${o.vh}"><path d="${o.d}" fill="${o.fill || "none"}" stroke="${o.stroke || "none"}" stroke-width="${o.sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else if (o.k === "img") {
      h += `<img class="ab im" style="${box(o)}" src="${o.src}" alt="">`;
    }
  }
  return h;
}

/* ---------- PDF ---------- */
function bytesOfDataUrl(u) {
  const b = atob(u.slice(u.indexOf(",") + 1)), a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}

async function buildPdf(pages, meta, onProgress) {
  const L = PDFLib, doc = await L.PDFDocument.create();
  doc.setTitle(meta.title || "Reiseprotokoll"); doc.setCreator("Reise-Protokoll"); doc.setProducer("Reise-Protokoll (pdf-lib)");
  if (meta.author) doc.setAuthor(meta.author);
  const fonts = {};
  for (const k in FONT_NAMES) fonts[k] = await doc.embedFont(L.StandardFonts[FONT_NAMES[k]]);
  const rgbOf = (hex) => { const [r, g, b] = hexRgb(hex); return L.rgb(r / 255, g / 255, b / 255); };
  const imgs = new Map();
  const embed = async (src) => {
    if (!imgs.has(src)) imgs.set(src, /^data:image\/png/.test(src) ? await doc.embedPng(bytesOfDataUrl(src)) : await doc.embedJpg(bytesOfDataUrl(src)));
    return imgs.get(src);
  };
  const rrPath = (w, h, r) => `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;

  for (let n = 0; n < pages.length; n++) {
    const pg = pages[n], page = doc.addPage([pg.W, pg.H]), Y = (y) => pg.H - y;
    for (const o of pg.ops) {
      if (o.k === "rect") {
        const opt = {};
        if (o.fill) opt.color = rgbOf(o.fill);
        if (o.stroke) { opt.borderColor = rgbOf(o.stroke); opt.borderWidth = o.sw; }
        if (o.r > 0) page.drawSvgPath(rrPath(o.w, o.h, o.r), { x: o.x, y: Y(o.y), ...opt });
        else page.drawRectangle({ x: o.x, y: Y(o.y + o.h), width: o.w, height: o.h, ...opt });
      } else if (o.k === "line") {
        page.drawLine({ start: { x: o.x1, y: Y(o.y1) }, end: { x: o.x2, y: Y(o.y2) }, thickness: o.sw, color: rgbOf(o.c) });
      } else if (o.k === "t") {
        const font = fonts[o.f], base = o.y + (isSerif(o.f) ? BASELINE.serif : BASELINE.sans) * o.s;
        const w = tw(o.text, o.f, o.s, o.ls);
        let x = o.a === "c" ? o.x - w / 2 : o.a === "r" ? o.x - w : o.x;
        if (!o.ls) page.drawText(o.text, { x, y: Y(base), size: o.s, font, color: rgbOf(o.c) });
        else for (const ch of o.text) {
          page.drawText(ch, { x, y: Y(base), size: o.s, font, color: rgbOf(o.c) });
          x += font.widthOfTextAtSize(ch, o.s) + o.ls;
        }
      } else if (o.k === "path") {
        const opt = { x: o.x, y: Y(o.y), scale: o.w / o.vw, borderLineCap: L.LineCapStyle.Round };
        if (o.fill) opt.color = rgbOf(o.fill);
        if (o.stroke) { opt.borderColor = rgbOf(o.stroke); opt.borderWidth = o.sw; }
        page.drawSvgPath(o.d, opt);
      } else if (o.k === "img") {
        const im = await embed(o.src), s = Math.max(o.w / im.width, o.h / im.height);
        const dw = im.width * s, dh = im.height * s;
        page.pushOperators(L.pushGraphicsState(), L.moveTo(o.x, Y(o.y + o.h)), L.lineTo(o.x + o.w, Y(o.y + o.h)),
          L.lineTo(o.x + o.w, Y(o.y)), L.lineTo(o.x, Y(o.y)), L.closePath(), L.clip(), L.endPath());
        page.drawImage(im, { x: o.x + (o.w - dw) / 2, y: Y(o.y + o.h) + (o.h - dh) / 2, width: dw, height: dh });
        page.pushOperators(L.popGraphicsState());
      }
    }
    if (onProgress) onProgress(n + 1, pages.length);
  }
  return doc.save({ useObjectStreams: true });
}
