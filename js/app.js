// App shell: side menu, browser-style tabs (pages open as tabs, not pop-ups), theme, PWA.
import { PAGES, FOOTER_PAGES, ALL_PAGES, HOME } from "./pages/index.js";
import { icon } from "./icons.js";
import { getSettings, setSetting, getTabs, saveTabs, onChange } from "./store.js";
import { initSpeech } from "./speech.js";
import { initSync, onSyncChange, isConfigured } from "./sync.js";

const $ = (s) => document.querySelector(s);
const app = $("#app");
const tabsEl = $("#tabs");
const viewsEl = $("#views");
const open = new Map(); // id -> { tab, view, module }
let active = null;

// ---------------- toast (used by pages via ctx.toast) ----------------
let toastTimer;
function toast(message, action) {
  const el = $("#toast");
  el.innerHTML = "";
  el.append(document.createTextNode(message));
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.onclick = () => { el.hidden = true; action.run(); };
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), action ? 6000 : 3000);
}

// ---------------- share the app (phone share sheet, or copy the link) ----------------
const SHARE_URL = "https://ashok-no-1.github.io/chinese-learning-app/";
async function share() {
  const data = { title: "Xué 學 · Learn Chinese", text: "Learn Mandarin pinyin, tones and words — free app:", url: SHARE_URL };
  try {
    if (navigator.share) { await navigator.share(data); return; }
  } catch (e) {
    if (e.name === "AbortError") return; // closed the share sheet
  }
  try {
    await navigator.clipboard.writeText(SHARE_URL);
    toast("Link copied — paste it to your friends");
  } catch {
    toast("Share this link: " + SHARE_URL);
  }
}

// ---------------- side menu ----------------
function navButton(p) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "nav-item" + (p.soon ? " soon" : "");
  b.dataset.page = p.id;
  b.innerHTML = `${icon(p.icon)}<span>${p.menu || p.title}</span>${p.soon ? '<span class="pill">Soon</span>' : ""}`;
  if (p.soon) {
    b.setAttribute("aria-disabled", "true");
    b.title = "Coming in a future version";
  } else {
    b.onclick = () => { openPage(p.id); closeNav(); };
  }
  return b;
}

function buildNav() {
  const nav = $("#nav");
  const label = document.createElement("div");
  label.className = "nav-label";
  label.textContent = "Learn";
  nav.append(label, ...PAGES.map(navButton));
  $("#nav-footer").append(...FOOTER_PAGES.map(navButton));
  $("#brand").onclick = () => { openPage(HOME.id); closeNav(); };
}

function markNav() {
  document.querySelectorAll(".nav-item").forEach((b) => {
    if (b.dataset.page === active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

// mobile drawer
function openNav() { app.classList.add("nav-open"); $("#scrim").hidden = false; $("#menu-btn").setAttribute("aria-expanded", "true"); }
function closeNav() { app.classList.remove("nav-open"); $("#scrim").hidden = true; $("#menu-btn").setAttribute("aria-expanded", "false"); }
$("#menu-btn").onclick = () => (app.classList.contains("nav-open") ? closeNav() : openNav());
$("#scrim").onclick = closeNav;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNav(); });

// ---------------- tabs ----------------
function persistTabs() { saveTabs({ open: [...open.keys()], active }); }

// One tab at a time: opening a page replaces the current one (only your latest page is shown).
function removeTab(id) {
  const entry = open.get(id);
  if (!entry) return;
  entry.module?.unmount?.();
  entry.tab.remove();
  entry.view.remove();
  open.delete(id);
}

async function openPage(id) {
  const page = ALL_PAGES.find((p) => p.id === id && !p.soon);
  if (!page) return;
  for (const other of [...open.keys()]) if (other !== id) removeTab(other);
  if (!open.has(id)) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab";
    tab.setAttribute("role", "tab");
    tab.id = "tab-" + id;
    tab.setAttribute("aria-controls", "view-" + id);
    tab.innerHTML = `${icon(page.icon)}<span class="tab-title">${page.title}</span>` +
      (page.pinned ? "" : `<span class="tab-close" role="button" aria-label="Close ${page.title}" title="Close">${icon("close")}</span>`);
    tab.onclick = (e) => {
      if (e.target.closest(".tab-close")) closePage(id);
      else activate(id);
    };
    tab.onauxclick = (e) => { if (e.button === 1 && !page.pinned) closePage(id); };
    tabsEl.append(tab);

    const view = document.createElement("section");
    view.className = "view";
    view.id = "view-" + id;
    view.setAttribute("role", "tabpanel");
    view.setAttribute("aria-labelledby", tab.id);
    view.hidden = true;
    viewsEl.append(view);

    const entry = { tab, view, module: null };
    open.set(id, entry);
    activate(id);
    try {
      entry.module = await page.load();
      await entry.module.mount(view, { toast, openPage, share });
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div class="page"><div class="notice">${icon("warn")}<div><p><strong>This page could not open.</strong></p><p>${String(err.message || err)}</p></div></div></div>`;
    }
  } else {
    activate(id);
  }
}

function activate(id) {
  active = id;
  for (const [pid, { tab, view }] of open) {
    const on = pid === id;
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
    view.hidden = !on;
  }
  open.get(id)?.tab.scrollIntoView({ block: "nearest", inline: "nearest" });
  markNav();
  persistTabs();
}

// closing the page's tab goes back to Home
function closePage(id) {
  removeTab(id);
  if (!open.size) openPage(HOME.id);
  else persistTabs();
}

// keyboard: arrow keys move between tabs
tabsEl.addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const ids = [...open.keys()];
  const i = ids.indexOf(active) + (e.key === "ArrowRight" ? 1 : -1);
  if (ids[i]) { activate(ids[i]); open.get(ids[i]).tab.focus(); }
});

// ---------------- theme & menu side ----------------
function applyLook() {
  const s = getSettings();
  const root = document.documentElement;
  if (s.theme === "auto") delete root.dataset.theme; else root.dataset.theme = s.theme;
  root.dataset.navSide = s.navSide;
  const dark = s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  $("#theme-btn").innerHTML = icon(dark ? "sun" : "moon");
}
$("#theme-btn").onclick = () => {
  const s = getSettings();
  const dark = s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  setSetting("theme", dark ? "light" : "dark");
};
onChange((what) => { if (what === "settings") applyLook(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyLook);

// ---------------- cloud sync indicator ----------------
function renderSync(st) {
  const b = $("#sync-btn");
  if (!isConfigured()) { b.hidden = true; return; }
  b.hidden = false;
  const map = {
    "signed-out": ["cloudOff", "", "Cloud sync is off — tap to sign in"],
    connecting: ["cloud", "busy", "Connecting…"],
    syncing: ["cloudSync", "busy", "Syncing…"],
    synced: ["cloudCheck", "ok", "Synced"],
    error: ["cloudOff", "err", "Sync problem — tap for details"],
  };
  const [ic, cls, label] = map[st.state] || ["cloud", "", "Cloud sync"];
  b.className = "icon-btn sync-btn " + cls;
  b.innerHTML = icon(ic);
  b.title = label;
  b.setAttribute("aria-label", label);
}
$("#sync-btn").onclick = () => openPage("settings");
onSyncChange(renderSync);

// ---------------- start ----------------
buildNav();
applyLook();
initSpeech();
initSync();
// reopen the page you were on last time (or Home)
const saved = getTabs();
const renamed = { listener: "speaking" }; // pages renamed in later versions
const savedId = saved && (renamed[saved.active] || saved.active);
const last = savedId && ALL_PAGES.some((p) => p.id === savedId && !p.soon) ? savedId : HOME.id;
await openPage(last);

// offline support + "Install app" (service worker needs http://localhost or https)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
