// Tone Quiz: hear a syllable or a two-syllable word and pick its tones. Rounds of 10.
import { icon } from "../icons.js";
import { speak, stop as stopVoice } from "../speech.js";
import { pinyinHTML, syllables, stripTones, toneOf, numbersToMarks } from "../pinyin.js";
import { CHART_INITIALS, syllablesFor, tonesOf, withTone } from "../data/phonetics.js";

const ROUND = 10;
const BEST = "xue.quizBest";
const LEVELS = [
  { id: "syl", label: "Single syllables", hint: "mā má mǎ mà" },
  { id: "word", label: "Two-syllable words", hint: "from your notebook" },
];
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

let root, ctx, level = "syl", speed = "normal", sylPool = [], wordPool = [], qs = [], i = 0, answered = false, score = 0, streak = 0, mistakes = [], keyHandler;

export async function mount(el, context) {
  root = el;
  ctx = context;
  // syllables where all four tones are real, common sounds
  for (const ini of CHART_INITIALS) for (const s of syllablesFor(ini)) {
    const t = tonesOf(s);
    if (t && t[1] && t[2] && t[3] && t[4]) sylPool.push(s);
  }
  // notebook words: 2 characters, tones 1-4 only, no tone changes in speech (3+3, 一, 不)
  const nb = await fetch("data/notebook-words.json").then((r) => r.json());
  const seen = new Set();
  for (const w of nb.words) {
    const zh = w.hanzi.replace(/[^一-鿿]/g, "");
    const sy = syllables(w.pinyin);
    if (zh.length !== 2 || sy.length !== 2 || /[一不]/.test(zh) || seen.has(zh)) continue;
    const tones = sy.map(toneOf);
    if (tones.includes(5) || (tones[0] === 3 && tones[1] === 3)) continue;
    seen.add(zh);
    wordPool.push({ zh, sy, tones, en: w.english });
  }
  root.innerHTML = shell();
  wire();
  newRound();
}

export function unmount() { stopVoice(); if (keyHandler) document.removeEventListener("keydown", keyHandler); }

function shell() {
  return `
  <div class="page quiz">
    <header class="page-head">
      <div>
        <div class="eyebrow">Ear training</div>
        <h1>Tone Quiz <span lang="zh-Hant" class="h-zh">聲調測驗</span></h1>
        <p>Listen, then choose the tones you heard. Start with single syllables, then move on to real two-syllable words from your notebook.</p>
      </div>
      <div class="head-tools">
        <div class="seg" role="group" aria-label="Level">${LEVELS.map((l) => `<button type="button" data-level="${l.id}" title="${l.hint}">${l.label}</button>`).join("")}</div>
        <div class="seg" role="group" aria-label="Speed"><button type="button" data-speed="slow">Slow</button><button type="button" data-speed="normal">Normal</button></div>
      </div>
    </header>
    <div class="card qz-score" id="qz-score"></div>
    <div id="qz-area"></div>
    <p class="fineprint">Keyboard: <b>1–4</b> choose · <b>R</b> or <b>Space</b> play again · <b>Enter</b> next question.</p>
  </div>`;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
function shuffle(a) { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; }

function makeQuestion() {
  if (level === "syl") {
    const s = pick(sylPool), t = 1 + Math.floor(Math.random() * 4);
    return { kind: "syl", base: s, say: tonesOf(s)[t], answer: t - 1, options: [1, 2, 3, 4].map((n) => withTone(s, n)), tones: [[1], [2], [3], [4]] };
  }
  const w = pick(wordPool);
  const key = (t) => t.join("");
  const opts = [w.tones];
  while (opts.length < 4) {
    const t = w.tones.map((x) => (Math.random() < 0.6 ? 1 + Math.floor(Math.random() * 4) : x));
    if (!opts.some((o) => key(o) === key(t)) && !(t[0] === 3 && t[1] === 3)) opts.push(t);
  }
  shuffle(opts);
  const spell = (t) => w.sy.map((s, k) => numbersToMarks(stripTones(s).replace(/ü/g, "v") + t[k])).join("");
  return { kind: "word", base: w.sy.map(stripTones).join(""), say: w.zh, en: w.en, answer: opts.findIndex((o) => key(o) === key(w.tones)), options: opts.map(spell), tones: opts };
}

function newRound() {
  qs = [];
  const used = new Set();
  while (qs.length < ROUND) {
    const q = makeQuestion();
    if (used.has(q.say) && used.size < (level === "syl" ? sylPool.length : wordPool.length)) continue;
    used.add(q.say);
    qs.push(q);
  }
  i = 0; score = 0; streak = 0; mistakes = [];
  root.querySelectorAll("[data-level]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.level === level)));
  root.querySelectorAll("[data-speed]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.speed === speed)));
  showQuestion();
}

function renderScore() {
  const best = read(BEST, {})[level] || 0;
  root.querySelector("#qz-score").innerHTML = `
    <span>Question <b>${Math.min(i + 1, ROUND)}</b> / ${ROUND}</span>
    <span>Score <b>${score}</b></span>
    <span>Streak <b>${streak}</b>${streak >= 3 ? " 🔥" : ""}</span>
    <span>Best <b>${best}</b> / ${ROUND}</span>
    <div class="qz-dots">${qs.map((q, k) => `<i class="${k < i ? (q.right ? "ok" : "no") : k === i ? "now" : ""}"></i>`).join("")}</div>`;
}

function showQuestion() {
  answered = false;
  renderScore();
  const q = qs[i];
  root.querySelector("#qz-area").innerHTML = `
    <div class="card qz-card">
      <button class="qz-play" type="button" data-act="play" aria-label="Play again">${icon("speaker")}</button>
      <div class="qz-base">${esc(q.base)}</div>
      <p class="qz-ask">${q.kind === "syl" ? "Which tone did you hear?" : "Which tones did you hear?"}</p>
      <div class="qz-opts tones">${q.options.map((o, k) => `<button type="button" class="qz-opt" data-opt="${k}">
        <kbd>${k + 1}</kbd><span class="py">${pinyinHTML(o)}</span><span class="qz-tn">${q.tones[k].map((t) => `<i class="tdot t${t}">${t}</i>`).join("")}</span></button>`).join("")}</div>
      <div class="qz-feedback" id="qz-fb"></div>
    </div>`;
  setTimeout(() => speak(q.say, speed), 250);
}

function answer(k) {
  if (answered) return;
  answered = true;
  const q = qs[i];
  q.right = k === q.answer;
  if (q.right) { score++; streak++; } else { streak = 0; mistakes.push({ ...q, chose: k }); }
  root.querySelectorAll(".qz-opt").forEach((b, n) => {
    b.disabled = true;
    if (n === q.answer) b.classList.add("right");
    else if (n === k) b.classList.add("wrong");
  });
  root.querySelector("#qz-fb").innerHTML = `
    <div class="qz-res ${q.right ? "ok" : "no"}">${icon(q.right ? "check" : "warn")}
      <div><strong>${q.right ? pick(["Correct!", "Nice ear!", "Right!", "好！ Good!"]) : "Not quite"}</strong>
      <p>It was <span class="tones">${pinyinHTML(q.options[q.answer])}</span> <span lang="zh-Hant" class="qz-zh">${esc(q.say)}</span>${q.en ? ` — ${esc(q.en)}` : ""}</p></div>
      <button class="btn btn-sm" type="button" data-act="play">${icon("speaker")}Again</button>
      <button class="btn btn-primary" type="button" data-act="next">${i + 1 < ROUND ? "Next →" : "See results"}</button></div>`;
  renderScore();
  root.querySelector("[data-act=next]").focus();
}

function finish() {
  const bests = read(BEST, {});
  const isBest = score > (bests[level] || 0);
  if (isBest) { bests[level] = score; try { localStorage.setItem(BEST, JSON.stringify(bests)); } catch {} }
  i = ROUND;
  renderScore();
  const msg = score === ROUND ? "Perfect score! 太棒了！" : score >= 8 ? "Great ear!" : score >= 5 ? "Good — keep practising." : "Tones take time — try Slow speed and the Tones step in Pinyin Phonetics.";
  root.querySelector("#qz-area").innerHTML = `
    <div class="card qz-done">
      <div class="qz-big">${score}<small>/${ROUND}</small></div>
      <h2>${msg}</h2>${isBest ? `<p class="badge">New best!</p>` : ""}
      ${mistakes.length ? `<h3>Review your mistakes</h3><ul class="qz-mistakes tones">${mistakes.map((m) => `<li>
        <button class="icon-btn" type="button" data-say="${esc(m.say)}" aria-label="Play">${icon("speaker")}</button>
        <span lang="zh-Hant" class="qz-zh">${esc(m.say)}</span>
        <span>you chose ${pinyinHTML(m.options[m.chose])}</span><span>→ correct ${pinyinHTML(m.options[m.answer])}</span></li>`).join("")}</ul>` : ""}
      <div class="fc-done-btns"><button class="btn btn-primary" type="button" data-act="again">${icon("play")}Play again</button>
      <button class="btn" type="button" data-open="pinyin">${icon("waves")}Review the tones</button></div>
    </div>`;
}

function wire() {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.open) return ctx.openPage(b.dataset.open);
    if (b.dataset.level) { level = b.dataset.level; return newRound(); }
    if (b.dataset.speed) { speed = b.dataset.speed; root.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); return; }
    if (b.dataset.opt) return answer(Number(b.dataset.opt));
    if (b.dataset.say) return speak(b.dataset.say, speed);
    const act = b.dataset.act;
    if (act === "play" && qs[i]) return speak(qs[i].say, speed);
    if (act === "next") { if (i + 1 < ROUND) { i++; showQuestion(); } else finish(); return; }
    if (act === "again") return newRound();
  });
  keyHandler = (e) => {
    if (!root.isConnected || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (["1", "2", "3", "4"].includes(e.key) && i < ROUND) answer(Number(e.key) - 1);
    else if ((e.key.toLowerCase() === "r" || e.code === "Space") && qs[i]) { e.preventDefault(); speak(qs[i].say, speed); }
    else if (e.key === "Enter" && answered && e.target.tagName !== "BUTTON") { if (i + 1 < ROUND) { i++; showQuestion(); } else finish(); }
  };
  document.addEventListener("keydown", keyHandler);
}
