/* ---------- Wettersymbole (Kachel „Wettersymbol“) ----------
   Farbige Vektorbilder im 100×100-Raster ohne Hintergrund (Pfade: gleich in Vorschau und PDF, beliebig scharf).
   Neues Symbol = ein Eintrag in SYMBOLS plus eine Zeichenfunktion in ART. */
const SYMBOLS = [
  { id: "sun", name: "Sonne" }, { id: "partly", name: "Heiter" }, { id: "cloud", name: "Bewölkt" }, { id: "rain", name: "Regen" },
  { id: "storm", name: "Gewitter" }, { id: "snow", name: "Schnee" }, { id: "fog", name: "Nebel" },
  { id: "moon", name: "Mond und Sterne" }, { id: "rainbow", name: "Regenbogen" }, { id: "wind", name: "Wind" },
];

/* Wolke aus Bézierkurven (absolute Koordinaten, Raster 100), verschoben auf (cx, cy) und skaliert mit k */
const CLOUD_SHAPE = [["M", 26, 72], ["C", 14, 72, 8, 63, 10, 55], ["C", 12, 47, 19, 43, 27, 44], ["C", 28, 32, 39, 24, 51, 26], ["C", 60, 27, 66, 33, 68, 41], ["C", 79, 40, 88, 48, 87, 58], ["C", 86, 67, 79, 72, 70, 72], ["Z"]];
const shapePath = (cmds, cx, cy, k) => cmds.map(([c, ...n]) => c + n.map((v, i) => +(((v - 50) * k + (i % 2 ? cy : cx))).toFixed(2)).join(" ")).join("");
const circPath = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const starPath = (x, y, r) => `M${x} ${y - r}L${x + r * 0.27} ${y - r * 0.27}L${x + r} ${y}L${x + r * 0.27} ${y + r * 0.27}L${x} ${y + r}L${x - r * 0.27} ${y + r * 0.27}L${x - r} ${y}L${x - r * 0.27} ${y - r * 0.27}Z`;

function drawSymbol(pg, id, x, y, s, T) {
  const P = (d, o = {}) => pg.ops.push({ k: "path", x, y, w: s, h: s, vw: 100, vh: 100, d, fill: o.fill || null, stroke: o.stroke || null, sw: o.sw || 0, fo: o.fo, so: o.so });
  const light = "#E3F3FA", mid = "#A9C9DB", edge = "#658DA5", drop = "#2489C8";
  const sunC = "#F7B51D", sunEdge = "#DB8511";
  const cloud = (cx, cy, k, fill) => P(shapePath(CLOUD_SHAPE, cx, cy, k), { fill, stroke: edge, sw: 2.2, so: 0.85 });
  const sun = (cx, cy, R) => {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r1 = R * 1.3, r2 = R * (i % 2 ? 1.62 : 1.9);
      P(`M${(cx + Math.cos(a) * r1).toFixed(2)} ${(cy + Math.sin(a) * r1).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)} ${(cy + Math.sin(a) * r2).toFixed(2)}`, { stroke: sunC, sw: R * 0.27 });
    }
    P(circPath(cx, cy, R), { fill: sunC, stroke: sunEdge, sw: 1.4, so: 0.6 });
    P(circPath(cx - R * 0.34, cy - R * 0.34, R * 0.36), { fill: "#FFFFFF", fo: 0.38 });
  };
  const art = {
    sun: () => { sun(50, 50, 18); },
    partly: () => { sun(36, 36, 13); cloud(54, 62, 0.9, light); },
    cloud: () => { cloud(66, 44, 0.66, mid); cloud(46, 60, 0.96, light); },
    rain: () => {
      cloud(50, 42, 0.98, light);
      [[34, 78, 29, 92], [50, 80, 45, 94], [66, 78, 61, 92]].forEach(([a, b, c, d]) => P(`M${a} ${b}L${c} ${d}`, { stroke: drop, sw: 4.6 }));
      [[42, 86, 39, 94], [58, 86, 55, 94]].forEach(([a, b, c, d]) => P(`M${a} ${b}L${c} ${d}`, { stroke: edge, sw: 3.4 }));
    },
    storm: () => {
      cloud(50, 40, 0.98, mid);
      P("M57 58L40 80H51L45 98L69 71H57L63 58Z", { fill: sunC, stroke: "#FFFFFF", sw: 2, so: 0.9 });
      P(`M30 78L27 86 M72 80L69 88`, { stroke: drop, sw: 3.6 });
    },
    snow: () => {
      cloud(50, 40, 0.98, light);
      [[32, 82], [50, 91], [68, 82]].forEach(([fx, fy]) => {
        P(`M${fx - 7} ${fy}h14M${fx - 3.5} ${fy - 6.06}l7 12.12M${fx + 3.5} ${fy - 6.06}l-7 12.12`, { stroke: drop, sw: 2.4 });
        P(circPath(fx, fy, 1.6), { fill: sunC });
      });
    },
    fog: () => {
      cloud(50, 36, 0.92, light);
      [[18, 82, 78, 0.95], [26, 91, 90, 0.7], [14, 100, 66, 0.45]].forEach(([a, b, c, o]) => P(`M${a} ${b - 14}H${c}`, { stroke: "#729CB1", sw: 5, so: o }));
    },
    moon: () => {
      P("M60 16A34 34 0 1 0 84 62A27 27 0 1 1 60 16Z", { fill: "#FFDB70", stroke: sunEdge, sw: 1.6, so: 0.7 });
      P(starPath(72, 30, 8), { fill: sunC }); P(starPath(84, 50, 5), { fill: sunC, fo: 0.85 }); P(starPath(66, 14, 4), { fill: sunC, fo: 0.7 });
    },
    rainbow: () => {
      const cols = ["#E95454", "#F5A623", "#54AF78", "#398DCF"];
      cols.forEach((c, i) => { const r = 38 - i * 6.4; P(`M${50 - r} 74A${r} ${r} 0 0 1 ${50 + r} 74`, { stroke: c, sw: 5.6 }); });
      cloud(22, 70, 0.5, light); cloud(78, 70, 0.5, light);
    },
    wind: () => {
      P("M12 38H58A9 9 0 1 0 49 29", { stroke: "#348FB8", sw: 4.8 });
      P("M12 54H78A10 10 0 1 1 68 64", { stroke: "#76BBD1", sw: 4.8 });
      P("M12 70H44A8 8 0 1 1 36 78", { stroke: sunC, sw: 4.8 });
    },
  };
  (art[id] || art.sun)();
}
