// Character Writing: watch the stroke order, then write the character yourself (finger or mouse);
// each stroke is checked. Uses Hanzi Writer (MIT, https://hanziwriter.org) + its stroke data, from the jsDelivr CDN.
import { icon } from "../icons.js";
import { speak } from "../speech.js";
import { pinyinHTML } from "../pinyin.js";
import { ensurePinyinData, segment } from "../zhpinyin.js";

const LIB = "https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.2/dist/hanzi-writer.min.js";
const DATA = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/";
const DONE_KEY = "xue.writingDone";
const PREF_KEY = "xue.writingTopic";
const HAN = /[一-鿿]/;
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const readSet = () => { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]")); } catch { return new Set(); } };

let root, ctx, words = [], topics = [], list = [], cur = "", writer = null, mode = "idle", outline = true, topic = "1", resizeObs;
let libLoading = null;

function loadLib() {
  if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
  libLoading = libLoading || new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = LIB;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve(window.HanziWriter);
    s.onerror = () => { libLoading = null; reject(new Error("Couldn't load the writing tool — check your internet connection.")); };
    document.head.append(s);
  });
  return libLoading;
}

export async function mount(el, context) {
  root = el;
  ctx = context;
  const nb = await fetch("data/notebook-words.json").then((r) => r.json());
  words = nb.words;
  topics = nb.topics.filter((t) => words.some((w) => w.topic === t.id && HAN.test(w.hanzi)));
  try { topic = localStorage.getItem(PREF_KEY) || String(topics[0].id); } catch {}
  root.innerHTML = shell();
  wire();
  ensurePinyinData();
  buildList();
  try {
    await loadLib();
    choose(list[0]);
  } catch (e) {
    root.querySelector("#wr-status").innerHTML = `<span class="err">${esc(e.message)}</span>`;
  }
  // redraw at the new size when the screen is resized/rotated (not while you're writing)
  let lastW = root.querySelector("#wr-box").clientWidth;
  resizeObs = new ResizeObserver(() => {
    const w = root.querySelector("#wr-box").clientWidth;
    if (writer && cur && mode !== "quiz" && Math.abs(w - lastW) > 24) { lastW = w; build(cur, true); }
  });
  resizeObs.observe(root.querySelector("#wr-box"));
}

export function unmount() { resizeObs?.disconnect(); writer?.cancelQuiz?.(); }

function shell() {
  return `
  <div class="page writing">
    <header class="page-head">
      <div>
        <div class="eyebrow">Write characters</div>
        <h1>Character Writing <span lang="zh-Hant" class="h-zh">寫字</span></h1>
        <p>Watch the stroke order, then write the character yourself with your finger or mouse. Each stroke is checked — after 3 misses you get a hint.</p>
      </div>
      <div class="head-tools">
        <select class="select" id="wr-topic" aria-label="Characters from">${topics.map((t) => `<option value="${t.id}">${t.num} · ${esc(t.title)}</option>`).join("")}</select>
        <label class="wr-type"><input class="input hanzi" id="wr-input" maxlength="2" placeholder="Type 字" lang="zh-Hant" aria-label="Type any character"></label>
      </div>
    </header>
    <div class="wr-layout">
      <section class="card wr-pad">
        <div class="wr-box" id="wr-box">
          <svg class="wr-grid" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
            <rect x="0.5" y="0.5" width="99" height="99"/><line x1="0" y1="50" x2="100" y2="50"/><line x1="50" y1="0" x2="50" y2="100"/>
            <line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/></svg>
          <div id="wr-target" class="wr-target"></div>
        </div>
        <div class="wr-status" id="wr-status" aria-live="polite">Loading…</div>
        <div class="wr-btns">
          <button class="btn" type="button" data-act="animate">${icon("play")}Stroke order</button>
          <button class="btn btn-primary" type="button" data-act="trace">${icon("pen")}Write it</button>
          <button class="btn" type="button" data-act="memory" title="Write without the grey outline">${icon("quiz")}From memory</button>
          <button class="icon-btn" type="button" data-act="outline" title="Show / hide outline" aria-label="Show or hide outline">${icon("search")}</button>
        </div>
      </section>
      <section class="card wr-info" id="wr-info"></section>
    </div>
    <section class="ph-section">
      <div class="sec-head"><div><h2>Characters in this topic</h2><p>✓ = you've written it correctly on this device.</p></div>
        <button class="btn btn-sm" type="button" data-act="nextchar">Next character →</button></div>
      <div class="card wr-chars" id="wr-chars"></div>
    </section>
    <p class="fineprint">Stroke data: Hanzi Writer / Make Me a Hanzi (open source), loaded from the jsDelivr CDN — needs internet the first time.</p>
  </div>`;
}

function buildList() {
  const seen = new Set();
  list = [];
  for (const w of words.filter((w) => String(w.topic) === String(topic))) {
    for (const ch of w.hanzi) if (HAN.test(ch) && !seen.has(ch)) { seen.add(ch); list.push(ch); }
  }
  root.querySelector("#wr-topic").value = String(topic);
  renderChips();
}

function renderChips() {
  const done = readSet();
  root.querySelector("#wr-chars").innerHTML = list.map((ch) => `<button type="button" class="wr-chip${ch === cur ? " on" : ""}${done.has(ch) ? " done" : ""}" data-ch="${ch}" lang="zh-Hant">${ch}</button>`).join("");
}

function colors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return { strokeColor: v("--text"), outlineColor: v("--wr-outline") || "#d4cec4", drawingColor: v("--accent"), highlightColor: v("--t4"), radicalColor: null };
}

function build(ch, keepMode = false) {
  if (!keepMode) mode = "idle";
  const box = root.querySelector("#wr-box");
  const size = Math.max(200, Math.min(360, box.clientWidth));
  const target = root.querySelector("#wr-target");
  target.innerHTML = "";
  writer = window.HanziWriter.create(target, ch, {
    width: size, height: size, padding: 14, showOutline: outline, showCharacter: mode !== "quiz",
    strokeAnimationSpeed: 1, delayBetweenStrokes: 220, ...colors(),
    charDataLoader: (c, onLoad, onError) => fetch(DATA + encodeURIComponent(c) + ".json").then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(onLoad).catch(onError),
    onLoadCharDataError: () => status(`<span class="err">Stroke data for ${esc(ch)} isn't available.</span>`),
  });
}

function status(html) { root.querySelector("#wr-status").innerHTML = html; }

async function choose(ch) {
  if (!ch || !window.HanziWriter) return;
  cur = ch;
  outline = true;
  build(ch);
  status(`Press <b>Stroke order</b> to watch, then <b>Write it</b>.`);
  renderChips();
  root.querySelector(`.wr-chip[data-ch="${ch}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  await ensurePinyinData();
  const py = segment(ch)[0]?.py || "";
  const own = words.find((w) => w.hanzi === ch);
  const using = words.filter((w) => w.hanzi.includes(ch) && w.hanzi !== ch).slice(0, 6);
  let strokes = "";
  try { strokes = (await window.HanziWriter.loadCharacterData(ch, { charDataLoader: (c, ok, err) => fetch(DATA + encodeURIComponent(c) + ".json").then((r) => r.json()).then(ok).catch(err) })).strokes.length; } catch {}
  if (cur !== ch) return;
  root.querySelector("#wr-info").innerHTML = `
    <div class="wr-big" lang="zh-Hant">${esc(ch)}</div>
    <div class="wr-py tones">${pinyinHTML(own ? own.pinyin : py)}</div>
    ${own ? `<div class="wr-en">${esc(own.english)}</div>` : ""}
    <div class="wr-meta">${strokes ? `${strokes} strokes` : ""}</div>
    <button class="btn btn-sm" type="button" data-say="${esc(ch)}">${icon("speaker")}Hear it</button>
    ${using.length ? `<h3>Used in</h3><div class="wr-words">${using.map((w) => `<button type="button" class="nb-chip" data-say="${esc(w.hanzi)}">
      <span class="zh" lang="zh-Hant">${esc(w.hanzi)}</span><span class="py tones">${pinyinHTML(w.pinyin)}</span><small>${esc(w.english)}</small></button>`).join("")}</div>` : ""}`;
}

function quiz(fromMemory) {
  if (!writer) return;
  writer.cancelQuiz();
  outline = !fromMemory;
  mode = "quiz";
  build(cur, true);
  let mistakes = 0;
  status(fromMemory ? "Write it from memory — no outline. Start with the first stroke." : "Trace the grey outline, stroke by stroke.");
  writer.quiz({
    leniency: 1.1,
    showHintAfterMisses: 3,
    highlightOnComplete: true,
    onMistake: (d) => { mistakes = d.totalMistakes; status(`Not quite — stroke ${d.strokeNum + 1}. ${d.mistakesOnStroke >= 3 ? "Follow the hint." : "Try again."}`); },
    onCorrectStroke: (d) => status(`Stroke ${d.strokeNum + 1} ✓ — ${d.strokesRemaining} to go`),
    onComplete: (d) => {
      mode = "idle";
      const done = readSet();
      done.add(cur);
      try { localStorage.setItem(DONE_KEY, JSON.stringify([...done])); } catch {}
      renderChips();
      status(d.totalMistakes === 0 ? `<b class="ok">Perfect!</b> No mistakes. ${fromMemory ? "" : "Now try it <b>From memory</b>."}`
        : `<b class="ok">Done!</b> ${d.totalMistakes} mistake${d.totalMistakes === 1 ? "" : "s"}. Try again or go to the next character.`);
      speak(cur, "normal");
    },
  });
}

function wire() {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.ch) return choose(b.dataset.ch);
    if (b.dataset.say) return speak(b.dataset.say, "normal");
    const act = b.dataset.act;
    if (!writer && act !== "nextchar") return;
    if (act === "animate") { writer.cancelQuiz(); outline = true; build(cur, true); status("Watch the order of the strokes…"); writer.animateCharacter({ onComplete: () => status("Now press <b>Write it</b> and copy the strokes.") }); }
    if (act === "trace") quiz(false);
    if (act === "memory") quiz(true);
    if (act === "outline") { outline = !outline; outline ? writer.showOutline() : writer.hideOutline(); }
    if (act === "nextchar") { const k = list.indexOf(cur); choose(list[(k + 1) % list.length]); }
  });
  root.querySelector("#wr-topic").addEventListener("change", (e) => {
    topic = e.target.value;
    try { localStorage.setItem(PREF_KEY, topic); } catch {}
    buildList();
    choose(list[0]);
  });
  root.querySelector("#wr-input").addEventListener("input", (e) => {
    const ch = [...e.target.value].find((c) => HAN.test(c));
    if (ch) { choose(ch); e.target.value = ""; e.target.blur(); }
  });
}
