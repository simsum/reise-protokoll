/* ---------- Start ---------- */
(async function main() {
  let saved = null;
  try { saved = await idbGet("trip"); } catch (e) { /* kein Speicher verfügbar */ }
  if (saved && saved.days) { S.trip = normalizeTrip(saved); refreshDerived(S.trip); }
  else S.trip = demoTrip("rundreise");
  bindEditor(); bindPreviewTiles(); bindUndo(); bindWikipedia(); bindPointMap();
  resetUndo();
  renderPanel(); renderPreview();
  await initFonts();
  renderPanel(); renderPreview();
})();
