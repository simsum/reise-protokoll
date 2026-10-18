/* ---------- Vorlagen nach Reiseart ----------
   Eine Vorlage legt fest, welche Felder ein Tag hat und wie die Tagesseite
   inhaltlich aufgebaut ist. Das Seitenlayout (Deckseite, Tagesseite, Kosten)
   liegt in 40-layout.js und ist für alle Vorlagen gleich gebaut.

   Neue Reiseart = ein Eintrag mehr:
     id, name, label     Kennung, Anzeigename, Beschriftung auf der Deckseite
     desc                Beschreibung in der Auswahl
     fixedPlace          true: ein Zielort für die ganze Reise (Kurztrip)
     defaultDays         Anzahl Tage bei „Tage erzeugen“
     dayFields           Felder im Tages-Editor (siehe DAY_FIELDS in 80-ui.js)
     dayHeader(t, i)     Unterzeile unter dem Tagestitel
     sections(d)         Textabschnitte der Tagesseite: [{label, paras[]}] oder Zeitleiste [{label, kind:"timeline", items:[{time,text}]}]
     strip               optional: Streckenleiste unter dem Kopf; strip(t, i) → {from, to, mid}
     info(t, i)          bis zu drei Infokästen [{label, value, ico}]
     stats(t, st)        optional: vier Kennzahlen der Deckseite [{v, l}] (sonst Standard)  */
const TEMPLATES = {
  kurztrip: {
    id: "kurztrip", name: "Kurztrip", label: "Kurztrip",
    desc: "Ein Ziel, wenige Tage. Tagesplan als Zeitleiste mit Uhrzeiten, dazu Notizen.",
    fixedPlace: true, defaultDays: 3,
    stats: (t, st) => [
      { v: `${st.nDays} ${st.nDays === 1 ? "Tag" : "Tage"}`, l: st.nDays > 1 ? `Dauer · ${st.nights} Nächte` : "Dauer" },
      { v: t.destination.name || st.places[0] || "–", l: "Reiseziel" },
      { v: st.cost > 0 ? money(st.cost, t.currency) : "–", l: "Kosten" },
      { v: st.cost > 0 ? money(st.perDay, t.currency) : String(st.photos || "–"), l: st.cost > 0 ? "Pro Tag" : "Fotos" },
    ],
    dayFields: ["title", "weather", "lodging", "plan", "text", "highlights", "costs", "photos"],
    dayHeader: (t) => t.destination.name || "",
    sections: (d) => [
      { label: "Tagesplan", kind: "timeline", items: parsePlan(d.plan) },
      { label: "Notizen", paras: String(d.text || "").split(/\r?\n/) },
    ],
    info: (t, i) => {
      const d = t.days[i];
      return [weatherInfo(d), { label: "Unterkunft", value: d.lodging, ico: "bed" },
        { label: "Tageskosten", value: dayCosts(d) ? money(dayCosts(d), t.currency) : "", ico: "euro" }];
    },
  },

  rundreise: {
    id: "rundreise", name: "Rundreise", label: "Rundreise",
    desc: "Mehrere Tage an einem oder an verschiedenen Orten. Tagebuch mit Streckenleiste (von – nach), Kilometern und Unterkunft.",
    fixedPlace: false, defaultDays: 7, strip: true,
    dayFields: ["place", "from", "km", "drive", "title", "weather", "lodging", "text", "highlights", "costs", "photos"],
    dayHeader: (t, i) => {
      const d = t.days[i], from = dayFrom(t, i), to = d.place.name;
      if (!to) return from;
      return !from || from === to ? to : from + " – " + to;
    },
    sections: (d) => [{ label: "Tagebuch", paras: String(d.text || "").split(/\r?\n/) }],
    info: (t, i) => {
      const d = t.days[i];
      return [weatherInfo(d), { label: "Unterkunft", value: d.lodging, ico: "bed" },
        { label: "Tageskosten", value: dayCosts(d) ? money(dayCosts(d), t.currency) : "", ico: "euro" }];
    },
    /* Streckenleiste unter dem Kopf: von – nach, Kilometer, Fahrzeit */
    strip: (t, i) => {
      const d = t.days[i], bits = [];
      if (hasNum(d.km) && parseNum(d.km) > 0) bits.push(fmtNum(parseNum(d.km)) + " km");
      if (d.drive.trim()) bits.push(d.drive.trim() + " h");
      return { from: dayFrom(t, i), to: d.place.name, mid: bits.join("  ·  ") };
    },
  },
};

function weatherInfo(d) {
  const bits = [];
  if (d.weather) bits.push(weatherName(d.weather));
  const a = hasNum(d.tmin), b = hasNum(d.tmax);
  if (a && b) bits.push(`${fmtNum(parseNum(d.tmin))}–${fmtNum(parseNum(d.tmax))} °C`);
  else if (a || b) bits.push(`${fmtNum(parseNum(a ? d.tmin : d.tmax))} °C`);
  return { label: "Wetter", value: bits.join(" · "), ico: d.weather || "sun" };
}

/* Tagesplan: jede Zeile ein Punkt, optional mit Uhrzeit vorn („9:30 Frühstück“, „14.00 – Museum“). */
function parsePlan(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^(\d{1,2})[:.](\d{2})(?:\s*(?:Uhr|h))?\s*[-–:]?\s*(.*)$/.exec(l);
    return m ? { time: `${m[1].padStart(2, "0")}:${m[2]}`, text: m[3] || "" } : { time: "", text: l };
  });
}
