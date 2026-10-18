/* ---------- Farbschemata für die PDF-Vorlagen ----------
   Neues Schema = ein Eintrag mehr. Alle Farben als #RRGGBB. */
const THEMES = {
  meer:   { name: "Meer",   paper: "#FFFFFF", ink: "#1D2A33", muted: "#6B7A86", accent: "#1F6F8B", accent2: "#E0A458", soft: "#EEF4F7", rule: "#D5DFE5", onAccent: "#FFFFFF" },
  herbst: { name: "Herbst", paper: "#FFFBF5", ink: "#2E2420", muted: "#85746A", accent: "#B5482A", accent2: "#D9A441", soft: "#F8EFE6", rule: "#E6D7C8", onAccent: "#FFFFFF" },
  wald:   { name: "Wald",   paper: "#FFFFFF", ink: "#1F2A24", muted: "#6A7A70", accent: "#2F6B4F", accent2: "#C9A227", soft: "#EDF3EE", rule: "#D3DFD6", onAccent: "#FFFFFF" },
  nacht:  { name: "Nacht",  paper: "#FFFFFF", ink: "#1B1D2B", muted: "#6D7080", accent: "#2B2F57", accent2: "#E4572E", soft: "#EFEFF5", rule: "#D8D9E4", onAccent: "#FFFFFF" },
  mono:   { name: "Mono",   paper: "#FFFFFF", ink: "#1A1A1A", muted: "#777777", accent: "#222222", accent2: "#999999", soft: "#F2F2F2", rule: "#D9D9D9", onAccent: "#FFFFFF" },
};

/* Symbole im 24×24-Raster, nur Linien (gleiche Pfade in Vorschau und PDF). */
const CLOUD = "M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a3.8 3.8 0 0 1-.5 7.5z";
const ICONS = {
  sun: "M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z M12 1.5v3 M12 19.5v3 M1.5 12h3 M19.5 12h3 M4.6 4.6l2.1 2.1 M17.3 17.3l2.1 2.1 M4.6 19.4l2.1-2.1 M17.3 6.7l2.1-2.1",
  partly: "M8 3v1.6 M2.2 5.4l1.2 1.1 M13.8 5.4l-1.2 1.1 M3 11H1.5 M13 11a4 4 0 0 0-7.4-2 M8 20a4 4 0 0 1-.4-7.9A5.2 5.2 0 0 1 17.6 13a3.4 3.4 0 0 1-.4 7z",
  cloud: CLOUD,
  rain: "M7 15a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 7.5a3.8 3.8 0 0 1-.5 7.5z M8 18l-1 3 M12 18l-1 3 M16 18l-1 3",
  storm: "M7 15a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 7.5a3.8 3.8 0 0 1-.5 7.5z M12.5 13l-3 4.5h3.5l-2 4",
  snow: "M7 15a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 7.5a3.8 3.8 0 0 1-.5 7.5z M8 18.5v.01 M12 20.5v.01 M16 18.5v.01 M10 22v.01 M14 22v.01",
  fog: "M7 13a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 5.5a3.8 3.8 0 0 1-.5 7.5z M3 17h18 M5 21h14",
  bed: "M3 19V6 M3 15h18v4 M21 15v-3a3 3 0 0 0-3-3h-8v6 M6.5 11.5a1.5 1.5 0 1 0 0-3a1.5 1.5 0 1 0 0 3z",
  car: "M5 16l1.3-5.2A2 2 0 0 1 8.2 9.3h7.6a2 2 0 0 1 1.9 1.5L19 16 M3 16h18v3H3z M6.5 19v1.5 M17.5 19v1.5",
  euro: "M17.5 6.5A6.5 6.5 0 1 0 17.5 17.5 M5 10.5h8 M5 13.5h8",
  pin: "M12 21s6.5-5.7 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.3 12 21 12 21z M12 12.2a2.4 2.4 0 1 0 0-4.8a2.4 2.4 0 1 0 0 4.8z",
};
