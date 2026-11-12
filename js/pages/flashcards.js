// Flashcards with spaced repetition (Leitner boxes): cards you know come back after longer gaps,
// cards you miss come back in the same session. Progress is saved on this device.
import { icon } from "../icons.js";
import * as store from "../store.js";
import { speak, stop as stopVoice } from "../speech.js";
import { pinyinHTML } from "../pinyin.js";

const KEY = "xue.cards";            // { id: { box, due, reps, lapses } }
const PREF = "xue.cardPrefs";       // { topic, mode, sentences }
const NEW_PER_SESSION = 15;
const DAY = 86400000;
const INTERVAL = [0, 1, 3, 7, 16, 35, 90];   // days for box 0..6
const MODES = [
  { id: "zh", label: "漢字 → English", hint: "See the characters, recall the meaning" },
  { id: "en", label: "English → 漢字", hint: "See the English, say the Chinese" },
  { id: "ear", label: "Listen → meaning", hint: "Hear it, recall the meaning" },
];
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let root, ctx, all = [], topics = [], prefs, queue = [], card = null, flipped = false, done = 0, keyHandler;

export async function mount(el, context) {
  root = el;
  ctx = context;
  prefs = { topic: "all", mode: "zh", sentences: false, ...read(PREF, {}) };
  const nb = await fetch("data/notebook-words.json").then((r) => r.json());
  topics = nb.topics;
  const mine = store.getWords().filter((w) => w.source === "user").map((w) => ({ ...w, hanzi: w.hanzi || w.speakAs, topic: "mine" }));
  all = [...nb.words.filter((w) => !w.check), ...mine].filter((w) => w.hanzi && w.english);
  root.innerHTML = shell();
  wire();
  startSession();
}

export function unmount() { stopVoice(); if (keyHandler) document.removeEventListener("keydown", keyHandler); }

function shell() {
  return `
  <div class="page flash">
    <header class="page-head">
      <div>
        <div class="eyebrow">Memory practice</div>
        <h1>Flashcards <span lang="zh-Hant" class="h-zh">字卡</span></h1>
        <p>Flip a card, then tell the app how well you knew it. Cards you find hard come back soon; easy ones come back days later. A few minutes a day is enough.</p>
      </div>
    </header>
    <div class="card fc-tools">
      <select class="select" id="fc-topic" aria-label="Cards from"></select>
      <div class="seg" role="group" aria-label="Card direction">${MODES.map((m) => `<button type="button" data-mode="${m.id}" title="${m.hint}">${m.label}</button>`).join("")}</div>
      <label class="chip-toggle"><input type="checkbox" id="fc-sent"> Include sentences</label>
      <span class="spacer"></span>
      <div class="fc-stats" id="fc-stats"></div>
    </div>
    <div class="fc-progress"><span id="fc-bar"></span></div>
    <div id="fc-area"></div>
    <p class="fineprint">Keyboard: <b>Space</b> flip · <b>1</b> Again · <b>2</b> Hard · <b>3</b> Good · <b>4</b> Easy · <b>S</b> speak. Progress is saved on this device.</p>
  </div>`;
}

// ------------------------------------------------------------------ deck & scheduling
function deck() {
  return all.filter((w) => (prefs.topic === "all" || String(w.topic) === String(prefs.topic))
    && (prefs.sentences || w.type !== "sentence"));
}

function stats(cards = deck()) {
  const s = read(KEY, {}), now = Date.now();
  let due = 0, fresh = 0, known = 0;
  for (const w of cards) {
    const c = s[w.id];
    if (!c) fresh++;
    else { if (c.due <= now) due++; if (c.box >= 3) known++; }
  }
  return { due, fresh, known, total: cards.length };
}

function startSession(extra = false) {
  const s = read(KEY, {}), now = Date.now();
  const cards = deck();
  const due = cards.filter((w) => s[w.id] && s[w.id].due <= now).sort((a, b) => s[a.id].due - s[b.id].due);
  const fresh = cards.filter((w) => !s[w.id]).slice(0, extra ? NEW_PER_SESSION * 2 : NEW_PER_SESSION);
  queue = [...due, ...fresh];
  if (extra && !queue.length) queue = shuffle(cards.slice()).slice(0, 20); // "study anyway": review a random set
  done = 0;
  renderTools();
  next();
}

function rate(r) {
  if (!card || !flipped) return;
  const s = read(KEY, {});
  const c = s[card.id] || { box: 0, due: 0, reps: 0, lapses: 0 };
  c.reps++;
  if (r === 1) { c.box = 0; c.lapses++; }
  else if (r === 2) c.box = Math.max(1, c.box);
  else if (r === 3) c.box = Math.min(6, c.box + 1);
  else c.box = Math.min(6, c.box + 2);
  c.due = Date.now() + (r === 1 ? 60000 : r === 2 ? Math.max(0.5, INTERVAL[c.box] / 2) * DAY : INTERVAL[c.box] * DAY);
  s[card.id] = c;
  write(KEY, s);
  if (r === 1) queue.splice(Math.min(queue.length, 3), 0, card);   // see it again in a moment
  done++;
  next();
}

function label(r, w) {
  const c = read(KEY, {})[w.id] || { box: 0 };
  const box = r === 1 ? 0 : r === 2 ? Math.max(1, c.box) : r === 3 ? Math.min(6, c.box + 1) : Math.min(6, c.box + 2);
  if (r === 1) return "again soon";
  const d = r === 2 ? Math.max(0.5, INTERVAL[box] / 2) : INTERVAL[box];
  return d < 1 ? "12 h" : d === 1 ? "1 day" : `${d} days`;
}

// ------------------------------------------------------------------ rendering
function renderTools() {
  const counts = {};
  all.forEach((w) => (counts[w.topic] = (counts[w.topic] || 0) + 1));
  root.querySelector("#fc-topic").innerHTML = `<option value="all">All words (${all.length})</option>` +
    topics.filter((t) => counts[t.id]).map((t) => `<option value="${t.id}">${t.num} · ${esc(t.title)}</option>`).join("") +
    (counts.mine ? `<option value="mine">★ My words (${counts.mine})</option>` : "");
  root.querySelector("#fc-topic").value = String(prefs.topic);
  root.querySelector("#fc-sent").checked = !!prefs.sentences;
  root.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === prefs.mode)));
  const st = stats();
  root.querySelector("#fc-stats").innerHTML =
    `<span title="Cards due for review"><b>${st.due}</b> due</span><span title="Cards you haven't seen"><b>${st.fresh}</b> new</span><span title="Cards you know well"><b>${st.known}</b> learned</span>`;
}

function next() {
  flipped = false;
  card = queue.shift() || null;
  const total = done + queue.length + (card ? 1 : 0);
  root.querySelector("#fc-bar").style.width = total ? `${(done / total) * 100}%` : "100%";
  renderTools();
  const area = root.querySelector("#fc-area");
  if (!card) {
    const st = stats();
    area.innerHTML = `<div class="card fc-done">
      <div class="big" lang="zh-Hant">棒</div><h2>${done ? `Nice work — ${done} card${done === 1 ? "" : "s"} done!` : "You're all caught up"}</h2>
      <p>${st.due ? `${st.due} more are due.` : "Nothing is due right now in this set."} ${st.fresh ? `${st.fresh} new cards are waiting.` : ""}</p>
      <div class="fc-done-btns"><button class="btn btn-primary" type="button" data-act="more">${icon("cards")}Study more</button>
      <button class="btn" type="button" data-open="quiz">${icon("quiz")}Try the Tone Quiz</button></div></div>`;
    return;
  }
  const isNew = !read(KEY, {})[card.id];
  const front = prefs.mode === "en"
    ? `<div class="fc-en big">${esc(card.english)}</div><p class="fc-ask">Say it in Chinese</p>`
    : prefs.mode === "ear"
      ? `<button class="fc-ear" type="button" data-act="speak" aria-label="Play again">${icon("speaker")}</button><p class="fc-ask">What does it mean?</p>`
      : `<div class="fc-zh" lang="zh-Hant">${esc(card.hanzi)}</div><p class="fc-ask">What does it mean?</p>`;
  const back = `<div class="fc-zh small" lang="zh-Hant">${esc(card.hanzi)}</div>
    <div class="fc-py tones">${pinyinHTML(card.pinyin)}</div>
    <div class="fc-en">${esc(card.english)}</div>${card.note ? `<p class="fc-note">${esc(card.note)}</p>` : ""}`;
  area.innerHTML = `
    <div class="fc-card" id="fc-card" tabindex="0" role="button" aria-label="Flip card">
      <div class="fc-inner">
        <div class="fc-face fc-front">${isNew ? `<span class="badge">new</span>` : ""}${front}<span class="fc-tap">Tap to flip</span></div>
        <div class="fc-face fc-back">${back}
          <button class="btn btn-sm fc-hear" type="button" data-act="speak">${icon("speaker")}Hear it</button></div>
      </div>
    </div>
    <div class="fc-rate" id="fc-rate">
      <button class="btn fc-flip" type="button" data-act="flip">Show answer <kbd>Space</kbd></button>
    </div>`;
  if (prefs.mode === "ear") speak(card.hanzi, "normal");
}

function flip() {
  if (!card || flipped) return;
  flipped = true;
  root.querySelector("#fc-card").classList.add("flipped");
  root.querySelector("#fc-rate").innerHTML = [[1, "Again", "again"], [2, "Hard", "hard"], [3, "Good", "good"], [4, "Easy", "easy"]]
    .map(([r, t, cls]) => `<button class="btn fc-${cls}" type="button" data-rate="${r}">${t}<small>${label(r, card)}</small></button>`).join("");
  if (prefs.mode !== "ear") speak(card.hanzi, "normal");
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ------------------------------------------------------------------ events
function wire() {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button, #fc-card");
    if (!b) return;
    if (b.dataset.open) return ctx.openPage(b.dataset.open);
    if (b.dataset.mode) { prefs.mode = b.dataset.mode; write(PREF, prefs); return startSession(); }
    if (b.dataset.rate) return rate(Number(b.dataset.rate));
    const act = b.dataset.act;
    if (act === "speak") { e.stopPropagation(); return card && speak(card.hanzi, "normal"); }
    if (act === "more") return startSession(true);
    if (act === "flip" || b.id === "fc-card") return flip();
  });
  root.querySelector("#fc-topic").addEventListener("change", (e) => { prefs.topic = e.target.value; write(PREF, prefs); startSession(); });
  root.querySelector("#fc-sent").addEventListener("change", (e) => { prefs.sentences = e.target.checked; write(PREF, prefs); startSession(); });
  keyHandler = (e) => {
    if (!root.isConnected || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); flipped ? null : flip(); }
    else if (["1", "2", "3", "4"].includes(e.key)) rate(Number(e.key));
    else if (e.key.toLowerCase() === "s" && card) speak(card.hanzi, "normal");
  };
  document.addEventListener("keydown", keyHandler);
}
