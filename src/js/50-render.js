/* ---------- Vorschau (HTML) und PDF aus dem Seitenmodell ---------- */

const FONT_CSS = {
  R: "font-family:Helvetica,Arial,'Liberation Sans',sans-serif", B: "font-family:Helvetica,Arial,'Liberation Sans',sans-serif;font-weight:700",
  I: "font-family:Helvetica,Arial,'Liberation Sans',sans-serif;font-style:italic", BI: "font-family:Helvetica,Arial,'Liberation Sans',sans-serif;font-weight:700;font-style:italic",
  S: "font-family:'Times New Roman',Times,'Liberation Serif',serif", SB: "font-family:'Times New Roman',Times,'Liberation Serif',serif;font-weight:700",
  SI: "font-family:'Times New Roman',Times,'Liberation Serif',serif;font-style:italic", C: "font-family:'Courier New',Courier,'Liberation Mono',monospace",
};

const rgba = (hex, a) => `rgba(${hexRgb(hex).join(",")},${a})`;

function pageHtml(pg) {
  const X = (v) => (v / pg.W * 100).toFixed(4) + "%", Y = (v) => (v / pg.H * 100).toFixed(4) + "%";
  const U = (v) => (v / pg.W * 100).toFixed(4) + "cqw";
  const box = (o) => `left:${X(o.x)};top:${Y(o.y)};width:${X(o.w)};height:${Y(o.h)}`;
  let h = "";
  for (const o of pg.ops) {
    if (o.k === "rect") {
      const st = o.stroke ? `border:${U(o.sw)} solid ${o.stroke};box-sizing:border-box;` : "";
      h += `<div class="ab" style="${box(o)};${o.fill ? "background:" + (o.fo != null ? rgba(o.fill, o.fo) : o.fill) + ";" : ""}${st}${o.r ? "border-radius:" + U(o.r) : ""}"></div>`;
    } else if (o.k === "line") {
      const horiz = o.y1 === o.y2;
      h += horiz
        ? `<div class="ab" style="left:${X(Math.min(o.x1, o.x2))};top:${Y(o.y1 - o.sw / 2)};width:${X(Math.abs(o.x2 - o.x1))};height:${Y(o.sw)};background:${o.c}"></div>`
        : `<svg class="ab" style="left:0;top:0;width:100%;height:100%" viewBox="0 0 ${pg.W} ${pg.H}" preserveAspectRatio="none"><line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${o.c}" stroke-width="${o.sw}"/></svg>`;
    } else if (o.k === "t") {
      const w = tw(o.text, o.f, o.s, o.ls), x = o.a === "c" ? o.x - w / 2 : o.a === "r" ? o.x - w : o.x;
      h += `<div class="ab t" style="left:${X(x)};top:${Y(o.y)};font-size:${U(o.s)};color:${o.c};${FONT_CSS[o.f]};${o.ls ? "letter-spacing:" + U(o.ls) + ";" : ""}">${esc(o.text)}</div>`;
    } else if (o.k === "path") {
      h += `<svg class="ab" style="${box(o)}" viewBox="0 0 ${o.vw} ${o.vh}"><path d="${o.d}" fill="${o.fill || "none"}" stroke="${o.stroke || "none"}" stroke-width="${o.sw}"${o.fo != null ? ` fill-opacity="${o.fo}"` : ""}${o.so != null ? ` stroke-opacity="${o.so}"` : ""} stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else if (o.k === "link") {
      h += `<a class="ab" href="${esc(o.url)}" target="_blank" rel="noopener" style="${box(o)}" aria-label="Projektseite"></a>`;
    } else if (o.k === "img") {
      h += `<img class="ab im" style="${box(o)}${o.r ? ";border-radius:" + U(o.r) : ""}" src="${o.src}" alt="">`;
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

/* attachments: [{name, bytes, mime, desc, rel, pid}] werden als Dateianhänge eingebettet (pid: Foto, dessen Seite eine Büroklammer bekommt). */
/* Klippfad (Rechteck, optional mit runden Ecken); x, y = linke untere Ecke in PDF-Koordinaten */
function clipOps(L, x, y, w, h, r) {
  if (!r) return [L.moveTo(x, y), L.lineTo(x + w, y), L.lineTo(x + w, y + h), L.lineTo(x, y + h), L.closePath(), L.clip(), L.endPath()];
  const k = 0.5523 * r;
  return [L.moveTo(x + r, y), L.lineTo(x + w - r, y), L.appendBezierCurve(x + w - r + k, y, x + w, y + r - k, x + w, y + r), L.lineTo(x + w, y + h - r),
    L.appendBezierCurve(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h), L.lineTo(x + r, y + h), L.appendBezierCurve(x + r - k, y + h, x, y + h - r + k, x, y + h - r),
    L.lineTo(x, y + r), L.appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y), L.closePath(), L.clip(), L.endPath()];
}

async function buildPdf(pages, meta, attachments, onProgress, hooks) {
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

  /* Anhänge vorbereiten */
  const ctx = doc.context, specs = new Map(), ef = [];
  for (const a of attachments || []) {
    const sref = ctx.register(ctx.stream(a.bytes, { Type: "EmbeddedFile", Subtype: a.mime, Params: { Size: a.bytes.length, ModDate: L.PDFString.fromDate(new Date()) } }));
    const fs = ctx.register(ctx.obj({ Type: "Filespec", F: L.PDFString.of(clean(a.name)), UF: L.PDFHexString.fromText(a.name), EF: { F: sref, UF: sref }, Desc: L.PDFHexString.fromText(a.desc || ""), AFRelationship: a.rel || "Data" }));
    ef.push({ key: a.name, fs });
    if (a.pid) specs.set(a.pid, { fs, name: a.name, size: a.bytes.length });
  }
  const clipped = new Set();

  for (let n = 0; n < pages.length; n++) {
    const pg = pages[n], page = doc.addPage([pg.W, pg.H]), Y = (y) => pg.H - y, annots = [];
    for (const o of pg.ops) {
      if (o.k === "rect") {
        const opt = {};
        if (o.fill) { opt.color = rgbOf(o.fill); if (o.fo != null) opt.opacity = o.fo; }
        if (o.stroke) { opt.borderColor = rgbOf(o.stroke); opt.borderWidth = o.sw; }
        if (o.r > 0) page.drawSvgPath(rrPath(o.w, o.h, o.r), { x: o.x, y: Y(o.y), ...opt });
        else page.drawRectangle({ x: o.x, y: Y(o.y + o.h), width: o.w, height: o.h, ...opt });
      } else if (o.k === "line") {
        page.drawLine({ start: { x: o.x1, y: Y(o.y1) }, end: { x: o.x2, y: Y(o.y2) }, thickness: o.sw, color: rgbOf(o.c) });
      } else if (o.k === "t") {
        const font = fonts[o.f], base = o.y + baseOf(o.f) * o.s;
        const w = tw(o.text, o.f, o.s, o.ls);
        let x = o.a === "c" ? o.x - w / 2 : o.a === "r" ? o.x - w : o.x;
        if (!o.ls) page.drawText(o.text, { x, y: Y(base), size: o.s, font, color: rgbOf(o.c) });
        else for (const ch of o.text) {
          page.drawText(ch, { x, y: Y(base), size: o.s, font, color: rgbOf(o.c) });
          x += font.widthOfTextAtSize(ch, o.s) + o.ls;
        }
      } else if (o.k === "link") {
        annots.push(ctx.register(ctx.obj({ Type: "Annot", Subtype: "Link", Rect: [o.x, Y(o.y + o.h), o.x + o.w, Y(o.y)], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: L.PDFString.of(o.url) } })));
      } else if (o.k === "path") {
        const opt = { x: o.x, y: Y(o.y), scale: o.w / o.vw, borderLineCap: L.LineCapStyle.Round };
        if (o.fill) { opt.color = rgbOf(o.fill); if (o.fo != null) opt.opacity = o.fo; }
        if (o.stroke) { opt.borderColor = rgbOf(o.stroke); opt.borderWidth = o.sw; if (o.so != null) opt.borderOpacity = o.so; }
        page.drawSvgPath(o.d, opt);
      } else if (o.k === "img") {
        let im = null;
        if (hooks && hooks.imageFor && o.pid) { try { const b = await hooks.imageFor(o); if (b) im = await doc.embedJpg(b); } catch (e) { console.warn("Bild", e); } }
        if (!im) im = await embed(o.src);
        const s = Math.max(o.w / im.width, o.h / im.height);
        const dw = im.width * s, dh = im.height * s;
        page.pushOperators(L.pushGraphicsState(), ...clipOps(L, o.x, Y(o.y + o.h), o.w, o.h, o.r || 0));
        page.drawImage(im, { x: o.x + (o.w - dw) / 2, y: Y(o.y + o.h) + (o.h - dh) / 2, width: dw, height: dh });
        page.pushOperators(L.popGraphicsState());
        const sp = o.pid && specs.get(o.pid);
        if (sp && !clipped.has(o.pid)) {
          clipped.add(o.pid);
          annots.push(ctx.register(ctx.obj({ Type: "Annot", Subtype: "FileAttachment", Rect: [o.x, Y(o.y) - 16, o.x + 12, Y(o.y)], FS: sp.fs, Name: "Paperclip",
            Contents: L.PDFHexString.fromText("Foto: " + sp.name), T: L.PDFHexString.fromText("Reise-Protokoll"), C: [0.12, 0.44, 0.55], F: 24, P: page.ref })));
        }
      }
    }
    if (annots.length) page.node.set(L.PDFName.of("Annots"), ctx.obj(annots));
    if (onProgress) onProgress(n + 1, pages.length);
  }
  if (ef.length) {
    const arr = [];
    ef.sort((a, b) => (a.key < b.key ? -1 : 1)).forEach((e) => arr.push(L.PDFHexString.fromText(e.key), e.fs));
    doc.catalog.set(L.PDFName.of("Names"), ctx.obj({ EmbeddedFiles: ctx.obj({ Names: ctx.obj(arr) }) }));
    doc.catalog.set(L.PDFName.of("AF"), ctx.obj(ef.map((e) => e.fs)));
  }
  if (ef.length) {
    const arr = [];
    ef.sort((a, b) => (a.key < b.key ? -1 : 1)).forEach((e) => arr.push(L.PDFHexString.fromText(e.key), e.fs));
    doc.catalog.set(L.PDFName.of("Names"), ctx.obj({ EmbeddedFiles: ctx.obj({ Names: ctx.obj(arr) }) }));
    doc.catalog.set(L.PDFName.of("AF"), ctx.obj(ef.map((e) => e.fs)));
  }
  return doc.save({ useObjectStreams: true });
}
