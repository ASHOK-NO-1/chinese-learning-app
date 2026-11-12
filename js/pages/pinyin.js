// Pinyin Phonetics: a 5-step path for beginners — tones, initials, finals, every syllable, spelling rules.
import { icon } from "../icons.js";
import * as store from "../store.js";
import { speak, stop } from "../speech.js";
import { pinyinHTML } from "../pinyin.js";
import {
  TONES, DRILL, SANDHI, INITIAL_GROUPS, FINAL_GROUPS, RULES,
  CHART_INITIALS, CHART_FINALS, spell, tonesOf, withTone, syllablesFor,
} from "../data/phonetics.js";

const STEPS = [
  { id: "tones", title: "Tones", sub: "聲調" },
  { id: "initials", title: "Initials", sub: "聲母" },
  { id: "finals", title: "Finals", sub: "韻母" },
  { id: "syllables", title: "Syllables", sub: "拼音" },
  { id: "rules", title: "Spelling rules", sub: "規則" },
];
const STEP_KEY = "xue.pinyinStep";
const INITIAL_ROWS = [["", "b", "p", "m", "f"], ["d", "t", "n", "l"], ["g", "k", "h"], ["j", "q", "x"], ["zh", "ch", "sh", "r"], ["z", "c", "s"]];

let root, ctx, offSettings;
const ui = { step: "tones", speed: "slow", initial: "b", tone: "all", chart: false };
let playToken = 0;

export function mount(el, context) {
  root = el;
  ctx = context;
  try { ui.step = localStorage.getItem(STEP_KEY) || "tones"; } catch {}
  ui.speed = store.getSettings().pinyinSpeed || "slow";
  root.innerHTML = shell();
  wire();
  render();
  offSettings = store.onChange((w) => { if (w === "settings") renderZhuyin(); });
}

export function unmount() { offSettings?.(); stopAll(); }

// ------------------------------------------------------------------ layout
function shell() {
  return `
  <div class="page pinyin-page">
    <header class="page-head">
      <div>
        <div class="eyebrow">Start here · For beginners</div>
        <h1>Pinyin Phonetics <span lang="zh-Hant" class="h-zh">拼音</span></h1>
        <p>Learn the sounds of Mandarin step by step: the four tones, then the initial and final sounds that make every syllable. Tap anything to hear it.</p>
      </div>
      <div class="head-tools">
        <div class="seg" role="group" aria-label="Speed">
          <button type="button" data-speed="slow">Slow</button><button type="button" data-speed="normal">Normal</button>
        </div>
        <label class="chip-toggle"><input type="checkbox" id="zy"> <span lang="zh-Hant">ㄅㄆㄇ</span> Zhuyin</label>
        <button class="btn btn-sm" type="button" data-act="share">${icon("share")}Share</button>
      </div>
    </header>

    <nav class="steps" role="tablist" aria-label="Learning steps">
      ${STEPS.map((s, i) => `<button type="button" role="tab" class="step" data-step="${s.id}" id="step-${s.id}">
        <span class="step-n">${i + 1}</span><span class="step-t">${s.title}<small lang="zh-Hant">${s.sub}</small></span></button>`).join("")}
    </nav>

    <div id="step-body" role="tabpanel"></div>
  </div>`;
}

function render() {
  root.querySelectorAll(".step").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.step === ui.step)));
  root.querySelectorAll("[data-speed]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.speed === ui.speed)));
  const body = root.querySelector("#step-body");
  body.setAttribute("aria-labelledby", "step-" + ui.step);
  body.innerHTML = { tones, initials, finals, syllables, rules }[ui.step]() + nextButton();
  renderZhuyin();
  markTone();
}

function renderZhuyin() {
  const on = store.getSettings().showZhuyin !== false;
  root.querySelector("#zy").checked = on;
  root.classList.toggle("hide-zy", !on);
}

function nextButton() {
  const i = STEPS.findIndex((s) => s.id === ui.step);
  const next = STEPS[i + 1];
  const prev = STEPS[i - 1];
  return `<div class="step-nav">
    ${prev ? `<button class="btn btn-ghost" type="button" data-go="${prev.id}">← ${prev.title}</button>` : "<span></span>"}
    ${next ? `<button class="btn btn-primary" type="button" data-go="${next.id}">Next: ${next.title} →</button>` : `<button class="btn btn-primary" type="button" data-open="pronunciation">${icon("speaker")}Practise real words →</button>`}
  </div>`;
}

const playBtn = (zh, label, extra = "") =>
  `<button class="speak" type="button" data-say="${zh}" aria-label="Play ${label}" title="Listen" ${extra}>${icon("speaker")}</button>`;

// ------------------------------------------------------------------ step 1: tones
function contour(t) {
  const y = (l) => 70 - (l - 1) * 15;
  let d;
  if (t.pitch.length === 1) d = `M48 ${y(t.pitch[0])} L72 ${y(t.pitch[0])}`;
  else if (t.pitch.length === 2) d = `M16 ${y(t.pitch[0])} L108 ${y(t.pitch[1])}`;
  else d = `M16 ${y(t.pitch[0])} C34 ${y(t.pitch[1]) + 8}, 58 ${y(t.pitch[1]) + 10}, 108 ${y(t.pitch[2])}`;
  const grid = [1, 2, 3, 4, 5].map((l) => `<line x1="12" x2="112" y1="${y(l)}" y2="${y(l)}" class="g"/><text x="2" y="${y(l) + 3}">${l}</text>`).join("");
  return `<svg class="contour t${t.n}" viewBox="0 0 120 80" aria-hidden="true">${grid}
    <path d="${d}" class="ghost"/><path d="${d}" class="line" pathLength="1"/></svg>`;
}

function tones() {
  const cards = TONES.map((t) => `
    <article class="card tone-card t${t.n}${t.n === 5 ? " neutral" : ""}" data-tone="${t.n}">
      <header><span class="tbadge">${t.n === 5 ? "·" : t.n}</span><div><h3>${t.name}</h3><small>${t.short}</small></div></header>
      ${contour(t)}
      <div class="tone-ex">
        <span class="py big tones">${pinyinHTML(t.ex.py)}</span>
        <span class="zh" lang="zh-Hant">${t.ex.zh}</span>
        <span class="en">${t.ex.en}</span>
        ${playBtn(t.ex.zh, t.ex.py, `data-tone-card="${t.n}"`)}
      </div>
      <p class="tip">${t.tip}</p>
    </article>`).join("");

  const drill = `
    <table class="drill tones">
      <thead><tr><th></th>${[1, 2, 3, 4].map((n) => `<th><span class="tdot t${n}">${n}</span></th>`).join("")}<th></th></tr></thead>
      <tbody>${DRILL.map((r, ri) => `<tr>
        <th>${r.s}</th>
        ${r.zh.map((zh, i) => `<td><button type="button" class="tile" data-say="${zh}" title="${r.en[i]}">
          <span class="py t${i + 1}">${withTone(r.s, i + 1)}</span><span class="zh" lang="zh-Hant">${zh}</span><small>${r.en[i]}</small></button></td>`).join("")}
        <td><button class="icon-btn" type="button" data-drill="${ri}" aria-label="Play ${r.s} in all four tones" title="All four">${icon("play")}</button></td>
      </tr>`).join("")}</tbody>
    </table>`;

  const sandhi = SANDHI.map((s) => `
    <article class="card rule-card">
      <h3>${s.title}</h3><p>${s.rule}</p>
      <ul class="ex-list">${s.ex.map((e) => `<li>
        <span class="zh" lang="zh-Hant">${e.zh}</span>
        <span class="py tones">${pinyinHTML(e.written)}</span><span class="arrow">→ said</span>
        <span class="py tones said">${pinyinHTML(e.said)}</span>
        <span class="en">${e.en}</span>${playBtn(e.zh, e.en)}</li>`).join("")}</ul>
    </article>`).join("");

  return `
    <section class="ph-section">
      <div class="sec-head"><div><h2>The four tones</h2><p>Mandarin uses pitch to change meaning: <b>mā</b> (mother) and <b>mǎ</b> (horse) differ only in tone. The lines show how your voice moves from low (1) to high (5).</p></div>
        <button class="btn" type="button" data-act="four">${icon("play")}Hear mā · má · mǎ · mà</button></div>
      <div class="tone-grid">${cards}</div>
    </section>
    <section class="ph-section">
      <div class="sec-head"><div><h2>Tone drill</h2><p>Same sound, four tones, four different words. Tap each one, then press ▶ to hear the row.</p></div></div>
      <div class="card table-scroll">${drill}</div>
    </section>
    <section class="ph-section">
      <div class="sec-head"><div><h2>Tone changes in real speech</h2><p>A few tones change when words meet. Pinyin keeps the original tone; the voice says the changed one.</p></div></div>
      <div class="rule-grid">${sandhi}</div>
    </section>`;
}

// ------------------------------------------------------------------ steps 2 & 3: sound cards
function soundCard(item, kind) {
  const label = kind === "i" ? item.i : item.f;
  const alone = item.spell ? `<span class="alone">alone: <b>${item.spell}</b></span>` : "";
  const full = item.full ? `<span class="alone">full form: ${item.full}</span>` : "";
  return `<article class="card ph-card">
    <div class="ph-top">
      <span class="ph-letter">${label}</span><span class="zy" lang="zh-Hant">${item.zy}</span>
      ${item.air ? `<span class="badge air" title="Aspirated: say it with a puff of air">+ air</span>` : ""}
      ${item.pair ? `<span class="pair">pair: <b>${item.pair}</b></span>` : ""}
    </div>
    <button type="button" class="say-row" data-say="${item.say.zh}" aria-label="Play ${label}">
      <span class="speak as-icon">${icon("speaker")}</span>
      <span class="say-py tones">${pinyinHTML(item.say.py)}</span><span class="say-zh" lang="zh-Hant">${item.say.zh}</span>
    </button>
    <p class="tip">${item.tip}</p>
    <div class="ph-meta">${alone}${full}</div>
    <button type="button" class="ex-row" data-say="${item.ex.zh}" title="Example word">
      <span class="zh" lang="zh-Hant">${item.ex.zh}</span><span class="py tones">${pinyinHTML(item.ex.py)}</span><span class="en">${item.ex.en}</span>
      <span class="mini">${icon("speaker")}</span>
    </button>
  </article>`;
}

function groups(list, kind, intro) {
  return `<section class="ph-section"><div class="sec-head"><div>${intro}</div></div></section>` + list.map((g) => `
    <section class="ph-section">
      <div class="group-title"><h3>${g.title}</h3>${g.zh ? `<span lang="zh-Hant">${g.zh}</span>` : ""}<p>${g.desc}</p>
        <button class="btn btn-sm" type="button" data-group="${kind}:${g.title}">${icon("play")}Play all</button></div>
      <div class="ph-grid">${g.items.map((it) => soundCard(it, kind)).join("")}</div>
    </section>`).join("");
}

function initials() {
  return groups(INITIAL_GROUPS, "i", `<h2>Initials — the start of a syllable</h2>
    <p>21 consonant sounds, grouped by where your mouth makes them. Each is practised with a vowel, the way teachers in Taiwan say them: <b>bō pō mō fō</b>. Watch the <span class="badge air">+ air</span> pairs: b/p, d/t, g/k, j/q, zh/ch, z/c differ only by a puff of air.</p>`);
}

function finals() {
  return groups(FINAL_GROUPS, "f", `<h2>Finals — the end of a syllable</h2>
    <p>The vowel part of a syllable, with or without an n / ng ending. Learn the six simple vowels first, then the rest builds on them.</p>`);
}

// ------------------------------------------------------------------ step 4: syllables
function syllables() {
  const toneSeg = `<div class="seg tone-seg" role="group" aria-label="Tone">
    <button type="button" data-tone="all">All 4</button>
    ${[1, 2, 3, 4].map((n) => `<button type="button" data-tone="${n}"><span class="tdot t${n}">${n}</span> ${withTone("a", n)}</button>`).join("")}
  </div>`;
  const chips = INITIAL_ROWS.map((row) => `<div class="chip-row">${row.map((i) =>
    `<button type="button" class="ini-chip" data-ini="${i}" aria-pressed="${ui.initial === i}">${i || "none"}</button>`).join("")}</div>`).join("");
  return `
    <section class="ph-section">
      <div class="sec-head"><div><h2>Every syllable</h2><p>Choose a starting sound, then tap a syllable. With <b>All 4</b> you hear its tones in order (ā á ǎ à). Greyed tones don't exist for that syllable.</p></div>
        <button class="btn" type="button" data-act="chart">${icon("load")}${ui.chart ? "Hide full chart" : "Full chart"}</button></div>
      <div class="card explorer">
        <div class="explorer-tools">${toneSeg}</div>
        <div class="ini-chips">${chips}</div>
        <div class="syl-grid tones" id="syl-grid">${sylTiles()}</div>
      </div>
    </section>
    ${ui.chart ? `<section class="ph-section"><div class="card table-scroll chart-wrap">${chart()}</div></section>` : ""}`;
}

function sylTiles() {
  return syllablesFor(ui.initial).map((s) => {
    const t = tonesOf(s) || {};
    const shown = ui.tone === "all" ? s : withTone(s, ui.tone);
    const missing = ui.tone !== "all" && !t[ui.tone];
    const chars = [1, 2, 3, 4].map((n) => `<span class="t${n}${t[n] ? "" : " none"}" lang="zh-Hant">${t[n] || "·"}</span>`).join("");
    return `<button type="button" class="syl${missing ? " missing" : ""}" data-syl="${s}" ${missing ? 'aria-disabled="true"' : ""}>
      <span class="syl-py ${ui.tone === "all" ? "" : "t" + ui.tone}">${shown}</span><span class="syl-zh">${chars}</span></button>`;
  }).join("");
}

function chart() {
  const head = `<tr><th class="corner">final ↓ / initial →</th>${CHART_INITIALS.map((i) => `<th>${i || "–"}</th>`).join("")}</tr>`;
  const rows = CHART_FINALS.map((f) => `<tr><th>${f}</th>${CHART_INITIALS.map((i) => {
    const s = spell(i, f);
    return s && tonesOf(s) ? `<td><button type="button" data-syl="${s}">${s}</button></td>` : "<td></td>";
  }).join("")}</tr>`).join("");
  return `<table class="chart"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

// ------------------------------------------------------------------ step 5: rules
function rules() {
  return `<section class="ph-section"><div class="sec-head"><div><h2>Spelling rules</h2>
      <p>Pinyin has a few spelling habits that confuse beginners. Once you know them, you can read any pinyin.</p></div></div>
    <div class="rule-grid">${RULES.map((r) => `
      <article class="card rule-card"><h3>${r.title}</h3><p>${r.body}</p>
        <div class="ex-chips">${r.ex.map((e) => `<button type="button" class="ex-chip" data-say="${e.zh}">
          <span class="py tones">${pinyinHTML(e.py)}</span><span class="zh" lang="zh-Hant">${e.zh}</span></button>`).join("")}</div>
      </article>`).join("")}</div></section>`;
}

// ------------------------------------------------------------------ audio
function stopAll() { playToken++; stop(); root?.querySelectorAll(".playing").forEach((e) => e.classList.remove("playing")); }

async function say(zh, el) {
  stopAll();
  const token = playToken;
  el?.classList.add("playing");
  await speak(zh, ui.speed);
  if (token === playToken) el?.classList.remove("playing");
}

/** plays a list of [characters, element-to-highlight] one after another */
async function sequence(items, gap = 350) {
  stopAll();
  const token = playToken;
  for (const [zh, el] of items) {
    if (token !== playToken) return;
    el?.classList.add("playing");
    el?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    await speak(zh, ui.speed);
    el?.classList.remove("playing");
    if (token !== playToken) return;
    await new Promise((r) => setTimeout(r, gap));
  }
}

function playSyllable(s, el) {
  const t = tonesOf(s) || {};
  if (ui.tone === "all") {
    const list = [1, 2, 3, 4].filter((n) => t[n]).map((n) => [t[n], el]);
    return sequence(list, 250);
  }
  if (t[ui.tone]) return say(t[ui.tone], el);
  ctx.toast(`${withTone(s, ui.tone)} isn't used in Mandarin — try another tone.`);
}

// ------------------------------------------------------------------ events
function wire() {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !root.contains(b)) return;
    if (b.dataset.step) { setStep(b.dataset.step); return; }
    if (b.dataset.go) { setStep(b.dataset.go); root.querySelector(".steps").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (b.dataset.open) return ctx.openPage(b.dataset.open);
    if (b.dataset.speed) {
      ui.speed = b.dataset.speed;
      store.setSetting("pinyinSpeed", ui.speed);
      root.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      return;
    }
    if (b.dataset.toneCard) {
      const card = b.closest(".tone-card");
      return say(b.dataset.say, card);
    }
    if (b.dataset.say) return say(b.dataset.say, b.classList.contains("say-row") || b.classList.contains("ex-row") ? b.closest(".ph-card") || b : b);
    if (b.dataset.drill) {
      const row = DRILL[Number(b.dataset.drill)];
      const tiles = [...b.closest("tr").querySelectorAll(".tile")];
      return sequence(row.zh.map((zh, i) => [zh, tiles[i]]));
    }
    if (b.dataset.group) {
      const [kind, title] = b.dataset.group.split(":");
      const g = (kind === "i" ? INITIAL_GROUPS : FINAL_GROUPS).find((x) => x.title === title);
      const cards = [...b.closest(".ph-section").querySelectorAll(".ph-card")];
      return sequence(g.items.map((it, i) => [it.say.zh, cards[i]]));
    }
    if (b.dataset.ini !== undefined) {
      ui.initial = b.dataset.ini;
      root.querySelectorAll(".ini-chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      root.querySelector("#syl-grid").innerHTML = sylTiles();
      return;
    }
    if (b.dataset.tone) {
      ui.tone = b.dataset.tone === "all" ? "all" : Number(b.dataset.tone);
      markTone();
      root.querySelector("#syl-grid").innerHTML = sylTiles();
      return;
    }
    if (b.dataset.syl) return playSyllable(b.dataset.syl, b);
    const act = b.dataset.act;
    if (act === "four") {
      const cards = [...root.querySelectorAll(".tone-card")].slice(0, 4);
      return sequence(TONES.slice(0, 4).map((t, i) => [t.ex.zh, cards[i]]), 450);
    }
    if (act === "chart") { ui.chart = !ui.chart; render(); return; }
    if (act === "share") return ctx.share();
  });
  root.addEventListener("change", (e) => {
    if (e.target.id === "zy") store.setSetting("showZhuyin", e.target.checked);
  });
  // arrow keys between steps
  root.querySelector(".steps").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const i = STEPS.findIndex((s) => s.id === ui.step) + (e.key === "ArrowRight" ? 1 : -1);
    if (STEPS[i]) { setStep(STEPS[i].id); root.querySelector(`[data-step="${STEPS[i].id}"]`).focus(); }
  });
}

function markTone() {
  root.querySelectorAll(".tone-seg [data-tone]").forEach((x) => x.setAttribute("aria-pressed", String(String(ui.tone) === x.dataset.tone)));
}

function setStep(id) {
  stopAll();
  ui.step = id;
  try { localStorage.setItem(STEP_KEY, id); } catch {}
  render();
}
