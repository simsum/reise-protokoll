/* ---------- Rückgängig / Wiederholen für den Seitenaufbau ----------
   Gesichert wird der Seitenaufbau (Kacheln, Seiten, Kacheln pro Reihe), nicht Texte, Fotos oder Tage. changed() ruft trackLayout() nach jeder
   Änderung auf: Hat sich der Aufbau geändert, kommt der alte Stand auf den Rückgängig-Stapel. Änderungen kurz hintereinander
   (z. B. Tippen in einer Notiz) zählen als ein Schritt. */
const undoSt = { undo: [], redo: [], last: "", t: 0 };
const layoutState = () => JSON.stringify({ cols: S.trip.cols, days: S.trip.days.map((d) => [d.id, d.pages]) });

function resetUndo() { undoSt.undo = []; undoSt.redo = []; undoSt.last = layoutState(); undoSt.t = 0; syncUndoButtons(); }
function trackLayout() {
  const cur = layoutState();
  if (cur === undoSt.last) return;
  const now = Date.now();
  if (!undoSt.undo.length || now - undoSt.t > 600) undoSt.undo.push(undoSt.last);
  if (undoSt.undo.length > 100) undoSt.undo.shift();
  undoSt.redo = []; undoSt.last = cur; undoSt.t = now;
  syncUndoButtons();
}
function restoreLayout(state) {
  const o = JSON.parse(state), t = S.trip;
  t.cols = o.cols;
  for (const [id, pages] of o.days) { const d = dayOf(id); if (d) d.pages = pages; }
  undoSt.last = state; undoSt.t = 0;
  S.sel = null; if (typeof ia !== "undefined") ia = null;
  changed(); clearTimeout(prevTimer); renderPreview(); renderPanel(); syncUndoButtons();
}
function undoLayout() {
  if (!undoSt.undo.length) { toast("Nichts zum Rückgängigmachen."); return; }
  undoSt.redo.push(undoSt.last); restoreLayout(undoSt.undo.pop());
}
function redoLayout() {
  if (!undoSt.redo.length) { toast("Nichts zum Wiederholen."); return; }
  undoSt.undo.push(undoSt.last); restoreLayout(undoSt.redo.pop());
}
function syncUndoButtons() {
  const u = $("#undoBtn"), r = $("#redoBtn");
  if (u) u.disabled = !undoSt.undo.length;
  if (r) r.disabled = !undoSt.redo.length;
}
function bindUndo() {
  $("#undoBtn").addEventListener("click", undoLayout);
  $("#redoBtn").addEventListener("click", redoLayout);
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName || "") || !$("#editor").hidden) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); undoLayout(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redoLayout(); }
  });
}
