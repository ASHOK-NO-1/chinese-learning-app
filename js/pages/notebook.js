// My Notebook: the 46 handwritten NFU notebook pages, browsable by topic, with the words on each page.
// (Online copy: two email addresses and the teacher's name are hidden.)
import { icon } from "../icons.js";
import { speak } from "../speech.js";
import { pinyinHTML } from "../pinyin.js";

const PAGE_KEY = "xue.nbPage";
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let root, ctx, pages = [], topics = [], words = [], cur = 1, zoom = false, keyHandler, swiped = false;

export async function mount(el, context) {
  root = el;
  ctx = context;
  root.innerHTML = `<div class="page"><p class="muted">Loading your notebook…</p></div>`;
  const [p, w] = await Promise.all([
    fetch("data/notebook-pages.json").then((r) => r.json()),
    fetch("data/notebook-words.json").then((r) => r.json()),
  ]);
  pages = p.pages;
  topics = w.topics;
  words = w.words;
  try { cur = Math.min(46, Math.max(1, Number(localStorage.getItem(PAGE_KEY)) || 1)); } catch {}
  root.innerHTML = shell();
  wire();
  show(cur);
}

export function unmount() { if (keyHandler) document.removeEventListener("keydown", keyHandler); }

function shell() {
  const parts = [1, 2, 3].map((part) => {
    const ts = topics.filter((t) => t.part === part);
    return `<div class="nb-part"><div class="nb-part-title">Part ${part} · ${esc(ts[0].partTitle)}</div>
      ${ts.map((t) => `<button type="button" class="nb-topic" data-topic="${t.id}"><span class="gnum">${t.num}</span>
        <span class="nb-t">${esc(t.title)}<small>${t.pages[0] === t.pages[1] ? "p. " + t.pages[0] : "p. " + t.pages[0] + "–" + t.pages[1]}</small></span></button>`).join("")}</div>`;
  }).join("");
  return `
  <div class="page notebook">
    <header class="page-head">
      <div>
        <div class="eyebrow">Your class notebook</div>
        <h1>My Notebook <span lang="zh-Hant" class="h-zh">筆記</span></h1>
        <p>All 46 handwritten pages from the NFU Mandarin course, by topic. Swipe or use ← → to turn pages, tap the page to zoom, and tap a word below to hear it.</p>
      </div>
      <div class="head-tools">
        <a class="btn btn-sm" href="notebook/Chinese_Class_NFU_Notes.pdf" download>${icon("download")}Download PDF</a>
        <button class="btn btn-sm" type="button" data-act="share">${icon("share")}Share</button>
      </div>
    </header>
    <div class="nb-layout">
      <aside class="card nb-toc" aria-label="Topics">
        <select class="select nb-select" id="nb-select" aria-label="Topic">${topics.map((t) => `<option value="${t.id}">${t.num} · ${esc(t.title)}</option>`).join("")}</select>
        <div class="nb-toc-list">${parts}</div>
      </aside>
      <section class="nb-main">
        <div class="card nb-viewer">
          <div class="nb-bar">
            <button class="icon-btn" type="button" data-act="prev" aria-label="Previous page">‹</button>
            <div class="nb-where"><b id="nb-num"></b><span id="nb-topic"></span></div>
            <button class="icon-btn" type="button" data-act="zoom" aria-label="Zoom" title="Zoom (or tap the page)" id="nb-zoom">${icon("search")}</button>
            <button class="icon-btn" type="button" data-act="next" aria-label="Next page">›</button>
          </div>
          <div class="nb-stage" id="nb-stage"><img id="nb-img" alt="" draggable="false"></div>
        </div>
        <div class="card nb-words">
          <h2>Words on this page</h2>
          <div class="nb-chips tones" id="nb-chips"></div>
        </div>
        <div class="nb-thumbs" id="nb-thumbs">${pages.map((p) => `<button type="button" class="nb-thumb" data-page="${p.page}" aria-label="Page ${p.page}">
          <img src="notebook/thumbs/p${String(p.page).padStart(2, "0")}.jpg" alt="" loading="lazy" width="90" height="120"><span>${p.page}</span></button>`).join("")}</div>
      </section>
    </div>
  </div>`;
}

function show(n) {
  cur = Math.min(pages.length, Math.max(1, n));
  try { localStorage.setItem(PAGE_KEY, String(cur)); } catch {}
  const p = pages[cur - 1];
  const t = topics.find((x) => x.id === p.topic);
  const img = root.querySelector("#nb-img");
  img.src = `notebook/pages/p${String(cur).padStart(2, "0")}.jpg`;
  img.width = p.w; img.height = p.h;
  img.alt = `Notebook page ${cur}: ${t.title}`;
  root.querySelector("#nb-num").textContent = `Page ${cur} of ${pages.length}`;
  root.querySelector("#nb-topic").textContent = `${t.num} · ${t.title}`;
  root.querySelector("#nb-select").value = t.id;
  root.querySelectorAll(".nb-topic").forEach((b) => b.setAttribute("aria-current", String(Number(b.dataset.topic) === t.id)));
  root.querySelectorAll(".nb-thumb").forEach((b) => b.setAttribute("aria-current", String(Number(b.dataset.page) === cur)));
  root.querySelector(`.nb-thumb[data-page="${cur}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  root.querySelector("#nb-stage").scrollTop = 0;
  const ws = words.filter((w) => w.page === cur);
  root.querySelector("#nb-chips").innerHTML = ws.length
    ? ws.map((w) => `<button type="button" class="nb-chip" data-say="${esc(w.hanzi)}"><span class="zh" lang="zh-Hant">${esc(w.hanzi)}</span>
        <span class="py">${pinyinHTML(w.pinyin)}</span><small>${esc(w.english)}</small></button>`).join("")
    : `<p class="muted">This page is about pronunciation rules — see Pinyin Phonetics.</p>`;
  // preload the next page so turning feels instant
  if (cur < pages.length) { const pre = new Image(); pre.src = `notebook/pages/p${String(cur + 1).padStart(2, "0")}.jpg`; }
}

function setZoom(on) {
  zoom = on;
  root.querySelector(".nb-viewer").classList.toggle("zoomed", zoom);
}

function wire() {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button, #nb-img");
    if (!b) return;
    if (b.id === "nb-img") { if (swiped) { swiped = false; return; } return setZoom(!zoom); }
    if (b.dataset.topic) { const t = topics.find((x) => x.id === Number(b.dataset.topic)); setZoom(false); return show(t.pages[0]); }
    if (b.dataset.page) { setZoom(false); return show(Number(b.dataset.page)); }
    if (b.dataset.say) { b.classList.add("playing"); return speak(b.dataset.say, "normal").then(() => b.classList.remove("playing")); }
    const act = b.dataset.act;
    if (act === "prev") return show(cur - 1);
    if (act === "next") return show(cur + 1);
    if (act === "zoom") return setZoom(!zoom);
    if (act === "share") return ctx.share();
  });
  root.querySelector("#nb-select").addEventListener("change", (e) => {
    const t = topics.find((x) => x.id === Number(e.target.value));
    setZoom(false);
    show(t.pages[0]);
  });
  keyHandler = (e) => {
    if (!root.isConnected || root.closest("[hidden]") || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") show(cur - 1);
    if (e.key === "ArrowRight") show(cur + 1);
  };
  document.addEventListener("keydown", keyHandler);
  // swipe to turn pages (only when not zoomed, so zoomed pages can be panned)
  const stage = root.querySelector("#nb-stage");
  let x0 = null, y0 = null;
  stage.addEventListener("pointerdown", (e) => { if (!zoom) { x0 = e.clientX; y0 = e.clientY; } });
  stage.addEventListener("pointerup", (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; show(cur + (dx < 0 ? 1 : -1)); setTimeout(() => (swiped = false), 400); }
  });
}
