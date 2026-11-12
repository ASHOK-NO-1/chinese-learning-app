// Chinese Speaking: press Start, speak Chinese, press Stop — see what was heard as
// characters, pinyin and English. "Say this" mode gives you a word and checks your pronunciation.
// Speech recognition = the browser's built-in service (Chrome/Edge/Safari; needs internet).
import { icon } from "../icons.js";
import * as store from "../store.js";
import { speak, stop as stopVoice } from "../speech.js";
import { pinyinHTML, syllables as pySyllables, stripTones, toneOf } from "../pinyin.js";
import { ensurePinyinData, toPinyin, syllablesOf } from "../zhpinyin.js";
import { translate, knownWords } from "../translate.js";

const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
const HISTORY_KEY = "xue.listenHistory";
const isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const strip = (s = "") => s.replace(/[\s，。！？、,.!?；;：:「」『』“”"'（）()…~～]/g, "");

let root, ctx;
const st = {
  mode: "free", lang: "zh-TW", recording: false, rec: null, userStopped: false, finals: "", interim: "",
  startedAt: 0, timer: null, media: null, chunks: [], audioUrl: "", stream: null,
  target: null, targets: [], topic: "all", result: null,
};

export async function mount(el, context) {
  root = el;
  ctx = context;
  const s = store.getSettings();
  st.lang = s.listenLang || "zh-TW";
  st.mode = s.listenMode || "free";
  root.innerHTML = shell();
  wire();
  renderMode();
  renderHistory();
  ensurePinyinData();
  await loadTargets();
  if (st.mode === "practice") nextTarget();
}

export function unmount() { stopRecording(true); stopVoice(); if (st.audioUrl) URL.revokeObjectURL(st.audioUrl); }

// ------------------------------------------------------------------ layout
function shell() {
  return `
  <div class="page listener">
    <header class="page-head">
      <div>
        <div class="eyebrow">Speaking practice</div>
        <h1>Chinese Speaking <span lang="zh-Hant" class="h-zh">說</span></h1>
        <p>Press <b>Start</b>, speak Chinese, then press <b>Stop</b>. The app shows what it heard — characters, pinyin and English — so you can check your pronunciation.</p>
      </div>
      <div class="head-tools">
        <div class="seg" role="group" aria-label="Mode">
          <button type="button" data-mode="free">Free speaking</button><button type="button" data-mode="practice">Say this</button>
        </div>
        <select class="select" id="lang" aria-label="Recognition language">
          <option value="zh-TW">Taiwan Mandarin 國語</option>
          <option value="zh-CN">Mainland Mandarin 普通话</option>
        </select>
      </div>
    </header>

    ${SR ? "" : `<div class="notice">${icon("warn")}<div><p><strong>This browser can't listen to speech.</strong></p>
      <p>Open the app in <b>Chrome</b> or <b>Edge</b> (PC or Android) or <b>Safari</b> (iPhone/iPad). Firefox doesn't support speech recognition.</p></div></div>`}

    <section class="card target" id="target" hidden>
      <div class="target-top">
        <span class="eyebrow">Say this</span>
        <select class="select" id="topic" aria-label="Practice words from"></select>
        <button class="btn btn-sm" type="button" data-act="next">${icon("shuffle")}Next word</button>
      </div>
      <div class="target-body" id="target-body"></div>
    </section>

    <section class="card recorder" id="recorder">
      <button type="button" class="mic" id="mic" ${SR ? "" : "disabled"} aria-label="Start recording">
        <span class="mic-ring"></span>${icon("mic")}
      </button>
      <div class="rec-info">
        <div class="rec-state" id="rec-state">Ready</div>
        <div class="rec-hint" id="rec-hint">Press <b>Start</b>, then speak clearly in Mandarin.</div>
        <div class="rec-live" id="rec-live" lang="zh-Hant" aria-live="polite"></div>
      </div>
      <button type="button" class="btn btn-primary rec-btn" id="rec-btn" ${SR ? "" : "disabled"}>${icon("mic")}Start</button>
    </section>

    <div id="verdict"></div>

    <section class="results" id="results" hidden>
      <article class="card res-block">
        <header><span class="res-label">Characters <span lang="zh-Hant">漢字</span></span>
          <span class="res-tools"><button class="icon-btn" type="button" data-act="hear" title="Hear it said correctly" aria-label="Hear it said correctly">${icon("speaker")}</button>
          <button class="icon-btn" type="button" data-copy="zh" title="Copy" aria-label="Copy characters">${icon("copy")}</button></span></header>
        <div class="res-zh" id="res-zh" lang="zh-Hant"></div>
      </article>
      <article class="card res-block">
        <header><span class="res-label">Pinyin <span lang="zh-Hant">拼音</span></span>
          <span class="res-tools"><button class="icon-btn" type="button" data-copy="py" title="Copy" aria-label="Copy pinyin">${icon("copy")}</button></span></header>
        <div class="res-py tones" id="res-py"></div>
      </article>
      <article class="card res-block">
        <header><span class="res-label">English</span><span class="res-src" id="res-src"></span></header>
        <div class="res-en" id="res-en"></div>
        <ul class="res-words" id="res-words"></ul>
      </article>
      <div class="res-actions">
        <div class="mine" id="mine"></div>
        <button class="btn" type="button" data-act="add">${icon("plus")}Add to My words</button>
        <button class="btn btn-ghost" type="button" data-act="again">${icon("mic")}Try again</button>
      </div>
    </section>

    <section class="ph-section history">
      <div class="sec-head"><div><h2>Recent</h2><p>What you said recently on this device.</p></div>
        <button class="btn btn-ghost btn-sm" type="button" data-act="clear">${icon("trash")}Clear</button></div>
      <ul class="card hist-list" id="hist"></ul>
    </section>

    <p class="fineprint">Speech is turned into text by your browser's speech service (Google in Chrome, Microsoft in Edge, Apple in Safari).
    English comes from your notebook, your browser's own translator, or the free MyMemory service. Speech recognition guesses whole words,
    so it's a good pronunciation check — but if a tone is slightly off it may still pick the word you meant.</p>
  </div>`;
}

// ------------------------------------------------------------------ mode & practice targets
function renderMode() {
  root.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === st.mode)));
  root.querySelector("#lang").value = st.lang;
  root.querySelector("#target").hidden = st.mode !== "practice";
  root.querySelector("#verdict").innerHTML = "";
}

async function loadTargets() {
  let nb = { topics: [], words: [] };
  try { nb = await (await fetch("data/notebook-words.json")).json(); } catch {}
  const mine = store.getWords().filter((w) => w.source === "user" && (w.hanzi || w.speakAs));
  st.targets = [
    ...nb.words.filter((w) => w.type !== "sentence" && strip(w.hanzi).length <= 6 && !w.check).map((w) => ({ ...w, topic: String(w.topic) })),
    ...mine.map((w) => ({ ...w, hanzi: w.hanzi || w.speakAs, topic: "mine" })),
  ];
  const counts = {};
  st.targets.forEach((t) => (counts[t.topic] = (counts[t.topic] || 0) + 1));
  root.querySelector("#topic").innerHTML = `<option value="all">All notebook words (${st.targets.length})</option>` +
    nb.topics.filter((t) => counts[String(t.id)]).map((t) => `<option value="${t.id}">${t.num} · ${esc(t.title)}</option>`).join("") +
    (counts.mine ? `<option value="mine">★ My words (${counts.mine})</option>` : "");
}

function nextTarget() {
  const pool = st.targets.filter((t) => st.topic === "all" || t.topic === st.topic);
  if (!pool.length) return;
  let t;
  do { t = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && st.target && t.id === st.target.id);
  st.target = t;
  root.querySelector("#target-body").innerHTML = `
    <div class="t-zh" lang="zh-Hant">${esc(t.hanzi)}</div>
    <div class="t-py tones">${pinyinHTML(t.pinyin)}</div>
    <div class="t-en">${esc(t.english)}</div>
    <div class="t-listen">
      <button class="btn btn-sm" type="button" data-say="slow">${icon("speaker")}Listen slowly</button>
      <button class="btn btn-sm" type="button" data-say="normal">${icon("speaker")}Normal</button>
    </div>`;
  root.querySelector("#verdict").innerHTML = "";
  root.querySelector("#results").hidden = true;
}

// ------------------------------------------------------------------ recording
async function startRecording() {
  if (!SR || st.recording) return;
  stopVoice();
  st.recording = true;
  st.userStopped = false;
  st.finals = "";
  st.interim = "";
  st.chunks = [];
  if (st.audioUrl) { URL.revokeObjectURL(st.audioUrl); st.audioUrl = ""; }
  root.querySelector("#verdict").innerHTML = "";
  setRecUI("listening");

  const rec = new SR();
  rec.lang = st.lang;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) st.finals += r[0].transcript;
      else interim += r[0].transcript;
    }
    st.interim = interim;
    root.querySelector("#rec-live").textContent = st.finals + interim;
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    st.error = {
      "not-allowed": "Microphone access is blocked. Click the 🔒/mic icon in the address bar and allow the microphone, then try again.",
      "service-not-allowed": "Microphone access is blocked for this site. Allow it in the browser's site settings.",
      "audio-capture": "No microphone was found. Plug one in or check your sound settings.",
      network: "Speech recognition needs an internet connection.",
      "language-not-supported": "This browser can't recognise this language — try the other Mandarin option.",
    }[e.error] || "Speech recognition stopped: " + e.error;
  };
  rec.onend = () => {
    // some phones stop after a short pause — keep listening until you press Stop (max 60 s)
    if (st.recording && !st.userStopped && !st.error && Date.now() - st.startedAt < 60000) {
      try { rec.start(); return; } catch {}
    }
    finish();
  };
  st.rec = rec;
  st.error = null;
  st.startedAt = Date.now();
  try { rec.start(); } catch (e) { st.error = String(e.message || e); finish(); return; }

  st.timer = setInterval(() => {
    const s = Math.floor((Date.now() - st.startedAt) / 1000);
    root.querySelector("#rec-state").textContent = `Listening… 0:${String(s).padStart(2, "0")}`;
    if (s >= 60) stopRecording();
  }, 250);

  // keep a copy of your own voice to play back (PC only by default: phones can't share the mic)
  if (store.getSettings().keepRecording ?? !isPhone) {
    const session = st.startedAt;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // if you already pressed Stop (or started again) while the browser was asking, don't record
      if (!st.recording || st.userStopped || st.startedAt !== session) { stream.getTracks().forEach((t) => t.stop()); return; }
      st.stream = stream;
      st.media = new MediaRecorder(stream);
      st.media.ondataavailable = (ev) => ev.data.size && st.chunks.push(ev.data);
      st.media.start();
    } catch { st.media = null; }
  }
}

function stopRecording(silent = false) {
  if (!st.recording) return;
  st.userStopped = true;
  setRecUI("working");
  try { st.rec?.stop(); } catch { finish(); }
  if (silent) { try { st.rec?.abort(); } catch {} }
}

function finish() {
  if (!st.recording) return;
  st.recording = false;
  clearInterval(st.timer);
  const mediaDone = new Promise((resolve) => {
    if (st.media && st.media.state !== "inactive") { st.media.onstop = resolve; st.media.stop(); } else resolve();
  });
  mediaDone.then(() => {
    st.stream?.getTracks().forEach((t) => t.stop());
    st.stream = null;
    if (st.chunks.length) st.audioUrl = URL.createObjectURL(new Blob(st.chunks, { type: st.chunks[0].type || "audio/webm" }));
    st.media = null;
    const text = (st.finals + st.interim).trim();
    setRecUI("ready");
    if (st.error) { showError(st.error); return; }
    if (!text) { showError("I didn't hear anything. Press Start, wait a moment, then speak a little louder and closer to the microphone."); return; }
    showResult(text);
  });
}

function setRecUI(state) {
  const btn = root.querySelector("#rec-btn");
  const mic = root.querySelector("#mic");
  const card = root.querySelector("#recorder");
  card.classList.toggle("on", state === "listening");
  card.classList.toggle("busy", state === "working");
  if (state === "listening") {
    btn.innerHTML = `${icon("stop")}Stop`;
    btn.classList.add("btn-stop");
    mic.setAttribute("aria-label", "Stop recording");
    root.querySelector("#rec-state").textContent = "Listening… 0:00";
    root.querySelector("#rec-hint").innerHTML = "Speak now. Press <b>Stop</b> when you've finished.";
    root.querySelector("#rec-live").textContent = "";
  } else if (state === "working") {
    root.querySelector("#rec-state").textContent = "Working it out…";
  } else {
    btn.innerHTML = `${icon("mic")}Start`;
    btn.classList.remove("btn-stop");
    mic.setAttribute("aria-label", "Start recording");
    root.querySelector("#rec-state").textContent = "Ready";
    root.querySelector("#rec-hint").innerHTML = "Press <b>Start</b>, then speak clearly in Mandarin.";
  }
}

function showError(msg) {
  root.querySelector("#verdict").innerHTML = `<div class="notice">${icon("warn")}<div><p><strong>${esc(msg)}</strong></p></div></div>`;
}

// ------------------------------------------------------------------ results
async function showResult(text) {
  await ensurePinyinData();
  const py = toPinyin(text);
  const res = { zh: text, py, en: "", t: Date.now() };
  st.result = res;
  const box = root.querySelector("#results");
  box.hidden = false;
  root.querySelector("#res-zh").textContent = text;
  root.querySelector("#res-py").innerHTML = pinyinHTML(py);
  root.querySelector("#res-en").innerHTML = `<span class="loading">Translating…</span>`;
  root.querySelector("#res-src").textContent = "";
  root.querySelector("#res-words").innerHTML = "";
  root.querySelector("#mine").innerHTML = st.audioUrl
    ? `<span class="mine-label">Your voice</span><audio controls src="${st.audioUrl}"></audio>` : "";
  if (st.mode === "practice" && st.target) renderVerdict(text);
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const [tr, words] = await Promise.all([
    translate(text, { lang: st.lang, online: navigator.onLine }),
    knownWords(text),
  ]);
  if (st.result !== res) return; // a newer recording replaced this one
  res.en = tr.en;
  if (tr.py) { res.py = tr.py; root.querySelector("#res-py").innerHTML = pinyinHTML(tr.py); } // your notebook's checked pinyin
  root.querySelector("#res-en").textContent = tr.en || (tr.error || "No translation available offline.");
  root.querySelector("#res-src").textContent = { notebook: "from your notebook", device: "browser translator", online: "MyMemory (online)" }[tr.source] || "";
  root.querySelector("#res-words").innerHTML = words.length > 1 || (words.length === 1 && strip(words[0].zh) !== strip(text))
    ? words.map((w) => `<li><span lang="zh-Hant">${esc(w.zh)}</span> ${esc(w.en)}</li>`).join("") : "";
  addHistory(res);
}

/** Compare what you said with the "Say this" word: same characters, or per-syllable sound + tone. */
function renderVerdict(heard) {
  const t = st.target;
  const out = root.querySelector("#verdict");
  if (strip(heard).includes(strip(t.hanzi))) {
    out.innerHTML = `<div class="verdict ok">${icon("check")}<div><strong>Great — I heard ${esc(t.hanzi)}!</strong><p>Your pronunciation of <b>${esc(t.pinyin)}</b> was understood. Try the next word.</p></div>
      <button class="btn btn-sm" type="button" data-act="next">Next word →</button></div>`;
    return;
  }
  const want = pySyllables(t.pinyin);
  const got = syllablesOf(heard).map((s) => s.toLowerCase());
  const base = (s) => stripTones(s).replace(/ü/g, "v");
  // find the stretch of what you said that best matches the target syllables
  let best = { score: -1, at: 0 };
  for (let at = 0; at <= Math.max(0, got.length - want.length); at++) {
    let score = 0;
    want.forEach((w, i) => { const g = got[at + i]; if (!g) return; if (base(g) === base(w)) score += (toneOf(g) === toneOf(w) || toneOf(w) === 5 || toneOf(g) === 5) ? 2 : 1; });
    if (score > best.score) best = { score, at };
  }
  const chips = want.map((w, i) => {
    const g = got[best.at + i] || "";
    let cls = "bad", why = "different sound";
    if (g && base(g) === base(w)) {
      const same = toneOf(g) === toneOf(w) || toneOf(w) === 5 || toneOf(g) === 5;
      cls = same ? "good" : "tone";
      why = same ? "correct" : `tone: heard ${["", "1st", "2nd", "3rd", "4th", "neutral"][toneOf(g)]}`;
    }
    return `<span class="syl-chip ${cls}" title="${why}"><b>${esc(w)}</b><small>${g ? esc(g) : "—"}</small></span>`;
  }).join("");
  const allGood = want.length && want.every((w, i) => { const g = got[best.at + i]; return g && base(g) === base(w) && (toneOf(g) === toneOf(w) || toneOf(w) === 5 || toneOf(g) === 5); });
  const anyClose = want.some((w, i) => { const g = got[best.at + i]; return g && base(g) === base(w); });
  const [cls, title, tip] = allGood
    ? ["ok", "The sounds and tones match!", "I heard a word that sounds the same but is written differently — your pronunciation is right."]
    : anyClose
      ? ["close", "Close — check the highlighted syllables.", "Orange = right sound, wrong tone. Red = a different sound. Listen slowly, then try again."]
      : ["miss", `I heard something else: ${heard}`, "Listen to the word slowly, copy the tones, and try again."];
  out.innerHTML = `<div class="verdict ${cls}">${icon(cls === "ok" ? "check" : "warn")}<div><strong>${esc(title)}</strong><p>${tip}</p>
    <div class="syl-chips">${chips}</div><small class="legend">top: target · bottom: what I heard</small></div></div>`;
}

// ------------------------------------------------------------------ history
function readHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } }
function addHistory(r) {
  const h = readHistory().filter((x) => x.zh !== r.zh);
  h.unshift({ zh: r.zh, py: r.py, en: r.en, t: r.t });
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20))); } catch {}
  renderHistory();
}
function renderHistory() {
  const h = readHistory();
  root.querySelector("#hist").innerHTML = h.length
    ? h.map((x, i) => `<li><button type="button" class="icon-btn" data-hist="${i}" aria-label="Hear ${esc(x.zh)}" title="Hear it said correctly">${icon("speaker")}</button>
        <span class="h-zh2" lang="zh-Hant">${esc(x.zh)}</span><span class="h-py tones">${pinyinHTML(x.py)}</span><span class="h-en">${esc(x.en || "")}</span>
        <time>${new Date(x.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></li>`).join("")
    : `<li class="empty-h">Nothing yet — press Start and say something like 你好 (nǐ hǎo).</li>`;
}

// ------------------------------------------------------------------ events
function wire() {
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "rec-btn" || b.id === "mic") return st.recording ? stopRecording() : startRecording();
    if (b.dataset.mode) {
      st.mode = b.dataset.mode;
      store.setSetting("listenMode", st.mode);
      renderMode();
      if (st.mode === "practice" && !st.target) nextTarget();
      return;
    }
    if (b.dataset.say && st.target) return speak(st.target.hanzi, b.dataset.say);
    if (b.dataset.hist !== undefined) return speak(readHistory()[Number(b.dataset.hist)].zh, "normal");
    if (b.dataset.copy && st.result) {
      try { await navigator.clipboard.writeText(b.dataset.copy === "zh" ? st.result.zh : st.result.py); ctx.toast("Copied"); } catch { ctx.toast("Couldn't copy"); }
      return;
    }
    const act = b.dataset.act;
    if (act === "next") return nextTarget();
    if (act === "hear" && st.result) return speak(st.result.zh, "normal");
    if (act === "again") { root.querySelector("#results").hidden = true; root.querySelector("#verdict").innerHTML = ""; return startRecording(); }
    if (act === "clear") { try { localStorage.removeItem(HISTORY_KEY); } catch {} renderHistory(); return; }
    if (act === "add" && st.result) {
      const r = st.result;
      const exists = store.getWords().some((w) => strip(w.hanzi) === strip(r.zh));
      if (exists) return ctx.toast("Already in your word list");
      store.addWord({ english: r.en || "(add English)", pinyin: r.py, hanzi: r.zh });
      ctx.toast("Added to My words (Chinese Pronunciation)", { label: "Open", run: () => ctx.openPage("pronunciation") });
    }
  });
  root.querySelector("#lang").addEventListener("change", (e) => { st.lang = e.target.value; store.setSetting("listenLang", st.lang); });
  root.querySelector("#topic").addEventListener("change", (e) => { st.topic = e.target.value; nextTarget(); });
  // Space bar starts/stops recording (when not typing in a field)
  root.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      st.recording ? stopRecording() : startRecording();
    }
  });
}
