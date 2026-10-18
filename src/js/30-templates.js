/* ---------- Vorlagen ----------
   Es gibt eine Vorlage „Reise“ für alle Reisearten (Kurztrip mit einem Ziel, Rundreise mit vielen Orten, Mischformen):
   Ein Tag zeigt nur, was eingetragen ist. Streckenleiste (nur mit Kilometern oder Fahrzeit), Tagesplan als Zeitleiste,
   Tagebuch, Highlights, Ausgaben und Fotos. Das Seitenlayout (Deckseite, Tagesseite, Kosten) liegt in 40-layout.js.

   Weitere Vorlage = ein Eintrag mehr (die Auswahl erscheint in der Oberfläche, sobald es mehr als eine gibt):
     id, name, label     Kennung, Anzeigename, Beschriftung auf der Deckseite
     desc                Beschreibung in der Auswahl
     defaultDays         Anzahl Tage bei „Tage anlegen“
     dayFields           Felder im Tages-Editor (siehe DAY_FIELDS in 80-ui.js)
     dayHeader(t, i)     Unterzeile unter dem Tagestitel
     sections(d)         Textabschnitte der Tagesseite: [{label, paras[]}] oder Zeitleiste [{label, kind:"timeline", items:[{time,text}]}]
     strip(t, i)         optional: Streckenleiste unter dem Kopf → {from, to, mid} oder null
     info(t, i)          bis zu drei Infokästen [{label, value, ico}]
     stats(t, st)        optional: vier Kennzahlen der Deckseite [{v, l}] (sonst Standard)  */
const TEMPLATES = {
  reise: {
    id: "reise", name: "Reise", label: "Reise",
    desc: "Für jede Reise: Kurztrip oder Rundreise. Tage zeigen nur, was eingetragen ist.",
    defaultDays: 5,
    dayFields: ["place", "from", "km", "drive", "title", "weather", "lodging", "plan", "text", "highlights", "costs", "photos"],
    dayHeader: (t, i) => {
      const d = t.days[i], from = dayFrom(t, i), to = dayPlaceName(t, d);
      return from && to && from !== to ? from + " – " + to : to || from;
    },
    sections: (d) => [
      { label: "Tagesplan", kind: "timeline", items: parsePlan(d.plan) },
      { label: "Tagebuch", paras: String(d.text || "").split(/\r?\n/) },
    ],
    info: (t, i) => {
      const d = t.days[i];
      return [weatherInfo(d), { label: "Unterkunft", value: d.lodging, ico: "bed" },
        { label: "Tageskosten", value: dayCosts(d) ? money(dayCosts(d), t.currency) : "", ico: "euro" }];
    },
    /* Streckenleiste unter dem Kopf: von – nach, Kilometer, Fahrzeit. Ohne Kilometer und Fahrzeit entfällt sie. */
    strip: (t, i) => {
      const d = t.days[i], bits = [];
      if (hasNum(d.km) && parseNum(d.km) > 0) bits.push(fmtNum(parseNum(d.km)) + " km");
      if (d.drive.trim()) bits.push(d.drive.trim() + " h");
      if (!bits.length) return null;
      return { from: dayFrom(t, i), to: dayPlaceName(t, d), mid: bits.join("  ·  ") };
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
