/* Direkte Wege zwischen Tagesdaten und Vorschau; ausschließlich UI-Zustand. */
function dayLabel(d, i) {
  return `Tag ${i + 1}${d.date ? " · " + d.date : ""}${d.title || d.place.name ? " · " + (d.title || d.place.name) : ""}`;
}
function jumpToDay(id) {
  if (!dayOf(id)) return;
  S.tab = "days"; S.open.add(id); renderPanel();
  const card = $(`details.day[data-day="${id}"]`);
  card.scrollIntoView({ block: "start" });
  $("summary", card).focus({ preventScroll: true });
  $("#dayJump").value = id;
}
function showPreviewPage(i) {
  const sheet = $(`#pages .sheet[data-pi="${i}"]`);
  if (!sheet) return;
  sheet.scrollIntoView({ block: "start", inline: "nearest" });
  $("#pageJump").value = String(i);
}
function updatePageNavigation() {
  const select = $("#pageJump"), previous = select.value;
  select.innerHTML = S.pages.map((pg, i) => {
    const d = pg.meta && dayOf(pg.meta.dayId);
    const label = d ? dayLabel(d, S.trip.days.indexOf(d)) : i === 0 ? "Deckseite" : pg.navigationLabel || "Übersicht";
    return `<option value="${i}">${i + 1} · ${esc(label)}${pg.meta && pg.meta.spill ? " · Fortsetzung" : ""}</option>`;
  }).join("");
  select.value = String(Math.min(+previous || 0, S.pages.length - 1));
}
function fitPreview() {
  const pages = $("#pages"), zoom = $("#zoom").value;
  if (zoom !== "fit") { document.documentElement.style.setProperty("--z", +zoom / 100); return; }
  const pg = S.pages[0]; if (!pg || !pages.clientWidth || !pages.clientHeight) return;
  const width = Math.min(720, pages.clientWidth - 32);
  const height = Math.max(80, pages.clientHeight - 44);
  document.documentElement.style.setProperty("--z", Math.min(1, height * pg.W / pg.H / width));
}
new ResizeObserver(() => fitPreview()).observe($("#pages"));
let pageScrollFrame;
$("#pages").addEventListener("scroll", () => {
  if (pageScrollFrame) return;
  pageScrollFrame = requestAnimationFrame(() => {
    pageScrollFrame = null;
    const top = $("#pages").getBoundingClientRect().top;
    let closest = 0, distance = Infinity;
    $$("#pages .sheet").forEach((sheet, i) => {
      const delta = Math.abs(sheet.getBoundingClientRect().top - top);
      if (delta < distance) { closest = i; distance = delta; }
    });
    $("#pageJump").value = String(closest);
  });
}, { passive: true });
