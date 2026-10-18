"use strict";

/* ---------- Kleine Helfer ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- Datum (immer als ISO-Text JJJJ-MM-TT, Rechnen in UTC) ---------- */
function parseIso(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
  const d = new Date(s + "T12:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d; // z. B. 2026-02-31 ist ungültig
}
const isoOf = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => isoOf(new Date(parseIso(iso).getTime() + n * 864e5));
const diffDays = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 864e5);
function fmtDate(iso, opt) {
  const d = parseIso(iso);
  return d ? d.toLocaleDateString("de-DE", { timeZone: "UTC", ...opt }) : "";
}
const fmtLong = (iso) => fmtDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
function fmtRange(a, b) {
  if (!parseIso(a)) return "";
  if (!parseIso(b) || a === b) return fmtDate(a, { day: "numeric", month: "long", year: "numeric" });
  const x = parseIso(a), y = parseIso(b);
  if (x.getUTCFullYear() !== y.getUTCFullYear()) return fmtDate(a, { day: "numeric", month: "long", year: "numeric" }) + " – " + fmtDate(b, { day: "numeric", month: "long", year: "numeric" });
  if (x.getUTCMonth() !== y.getUTCMonth()) return fmtDate(a, { day: "numeric", month: "long" }) + " – " + fmtDate(b, { day: "numeric", month: "long", year: "numeric" });
  return x.getUTCDate() + ". – " + fmtDate(b, { day: "numeric", month: "long", year: "numeric" });
}

/* ---------- Zahlen ---------- */
function parseNum(v) {
  let s = String(v ?? "").trim().replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
const hasNum = (v) => String(v ?? "").trim() !== "" && Number.isFinite(parseFloat(String(v).replace(",", ".")));
const fmtNum = (n, d = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n, cur) => fmtNum(n, Math.abs(n - Math.round(n)) > 0.004 ? 2 : 0) + " " + (cur || "EUR").replace("EUR", "€");
const listDe = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " und " + a[a.length - 1]);

/* ---------- Geo ---------- */
function haversine(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const hasGeo = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon);

/* ---------- Farben ---------- */
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function mix(a, b, t) {
  const x = hexRgb(a), y = hexRgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/* ---------- Benachrichtigung ---------- */
let toastTimer;
function toast(msg, ms = 3500) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

/* ---------- Dateien ---------- */
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safeName = (s) => (String(s || "Reise").replace(/[\\/:*?"<>|]+/g, " ").trim() || "Reise").slice(0, 80);
