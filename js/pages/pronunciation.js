// Chinese Pronunciation page: word table (English · Pinyin · Characters · Listen) with
// per-row Slow/Normal speed, search & topic filters, inline add / edit / delete.
import { icon } from "../icons.js";
import * as store from "../store.js";
import { speak, stop, currentVoice, voiceLabel, onVoicesChanged, isSupported, voicesSettled } from "../speech.js";
import { pinyinHTML, numbersToMarks, stripTones, syllables } from "../pinyin.js";
import { ensureDict, suggestHanzi, speakableText } from "../lookup.js";

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let root, ctx, offStore, offVoices;
const ui = { q: "", topic: "all", type: "all", editing: null, playAllTopic: null };
let playToken = 0;

export async function mount(el, context) {
  root = el;
  ctx = context;
  root.innerHTML = template();
  wire();
  if (store.isNotebookLoaded()) {
    try { await store.loadNotebook(); } catch (e) { ctx.toast(e.message); }
  }
  renderVoice();
  renderAll();
  offStore = store.onChange(() => renderAll());
  offVoices = onVoicesChanged(renderVoice);
  ensureDict(); // warm up the pinyin dictionary for the Add form
}

export function unmount() { offStore?.(); offVoices?.(); stopAll(); }

// ------------------------------------------------------------------ template
function template() {
  return `
  <div class="page">
    <header class="page-head">
      <div>
        <div class="eyebrow">Practise real words</div>
        <h1>Chinese Pronunciation</h1>
        <p>Every word from your notebook with English, pinyin and characters. Press the speaker to hear it — choose <b>Slow</b> to catch each tone, then <b>Normal</b> to hear natural speed.</p>
      </div>
      <div id="voice-chip"></div>
    </header>

    <div id="voice-notice"></div>

    <div class="card toolbar" role="toolbar" aria-label="Word list tools">
      <button class="btn btn-primary" type="button" id="btn-add">${icon("plus")}<span>Add word</span></button>
      <label class="search">${icon("search")}<input class="input" id="q" type="search" placeholder="Search English, pinyin or 漢字…" autocomplete="off" aria-label="Search words"></label>
      <select class="select" id="f-topic" aria-label="Filter by topic"></select>
      <select class="select" id="f-type" aria-label="Filter by type">
        <option value="all">Words, phrases & sentences</option>
        <option value="word">Words only</option>
        <option value="phrase">Phrases only</option>
        <option value="sentence">Sentences only</option>
      </select>
      <span class="spacer"></span>
      <span class="count" id="count"></span>
      <button class="icon-btn" type="button" id="btn-export" title="Export: save a backup of your words" aria-label="Export words">${icon("download")}</button>
      <button class="icon-btn" type="button" id="btn-import" title="Import: load a backup (e.g. from your phone)" aria-label="Import words">${icon("upload")}</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </div>

    <form class="card add-panel" id="add-form" hidden autocomplete="off">
      <h2>Add a new word</h2>
      <p>Type the English and the pinyin. Tone numbers work too — <b>ni3 hao3</b> becomes <b>nǐ hǎo</b>. Characters are optional: if you leave them empty the app finds them for you so the voice still says the right tones.</p>
      <div class="add-grid">
        <label class="field"><span>English</span><input class="input" name="english" required placeholder="e.g. hello"></label>
        <label class="field"><span>Pinyin</span><input class="input" name="pinyin" required placeholder="e.g. nǐ hǎo  or  ni3 hao3"></label>
        <label class="field field-zh"><span>Characters (optional)</span><input class="input hanzi" name="hanzi" lang="zh-Hant" placeholder="e.g. 你好"></label>
        <div class="add-actions">
          <button class="speak" type="button" id="add-preview" aria-label="Listen before adding" title="Listen">${icon("speaker")}</button>
          <button class="btn btn-primary" type="submit">${icon("check")}Add</button>
          <button class="btn btn-ghost" type="button" id="add-cancel">Cancel</button>
        </div>
      </div>
      <div class="suggest" id="add-suggest" aria-live="polite"></div>
    </form>

    <div class="card table-wrap" id="table-card">
      <table class="words">
        <thead><tr><th class="num">#</th><th>English</th><th>Pinyin</th><th>Characters</th><th>Listen</th><th class="act"><span class="visually-hidden">Actions</span></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
      <div class="empty" id="empty" hidden></div>
    </div>
  </div>`;
}

// ------------------------------------------------------------------ voice status
function renderVoice() {
  const chip = root.querySelector("#voice-chip");
  const notice = root.querySelector("#voice-notice");
  const v = currentVoice();
  if (!isSupported()) {
    chip.innerHTML = `<span class="chip warn"><span class="dot"></span>Speech not supported</span>`;
    notice.innerHTML = `<div class="notice">${icon("warn")}<div><p><strong>This browser can't speak.</strong></p><p>Open the app in Chrome, Edge or Safari.</p></div></div>`;
    return;
  }
  if (v) {
    chip.innerHTML = `<span class="chip" title="${esc(v.name)} (${esc(v.lang)})"><span class="dot"></span>Voice: ${esc(voiceLabel(v))}</span>`;
    notice.innerHTML = "";
  } else if (!voicesSettled()) {
    chip.innerHTML = `<span class="chip"><span class="dot" style="background:var(--faint)"></span>Looking for a Mandarin voice…</span>`;
    notice.innerHTML = "";
  } else {
    chip.innerHTML = `<span class="chip warn"><span class="dot"></span>No Mandarin voice <button type="button" data-open="settings">Fix</button></span>`;
    notice.innerHTML = `<div class="notice">${icon("warn")}<div><p><strong>Install a Chinese voice so words are spoken correctly.</strong></p><p>Windows: Settings → Time &amp; language → Speech → Add voices → “Chinese (Traditional, Taiwan)”. Android: Settings → Text-to-speech → Google → Install voice data → Chinese. Then reopen the app. <button class="btn btn-sm" type="button" data-open="settings">More help</button></p></div></div>`;
  }
}

// ------------------------------------------------------------------ list
function filtered() {
  const q = ui.q.trim().toLowerCase();
  const qPlain = stripTones(q).replace(/\s+/g, "");
  return store.getWords().filter((w) => {
    if (ui.topic !== "all" && String(w.topic) !== ui.topic) return false;
    if (ui.type !== "all" && (w.type || "word") !== ui.type) return false;
    if (!q) return true;
    const py = w.pinyin.toLowerCase();
    return (
      w.english.toLowerCase().includes(q) ||
      py.includes(q) ||
      stripTones(py).replace(/\s+/g, "").includes(qPlain) ||
      (w.hanzi || "").includes(ui.q.trim())
    );
  });
}

function renderAll() {
  renderTopicFilter();
  const words = filtered();
  const all = store.getWords();
  const tbody = root.querySelector("#rows");
  const empty = root.querySelector("#empty");
  const loaded = store.isNotebookLoaded();
  root.querySelector("#count").textContent = all.length ? `${words.length} of ${all.length}` : "";

  if (!all.length) {
    tbody.innerHTML = "";
    empty.hidden = false;
    empty.innerHTML = `
      <div class="big" lang="zh-Hant">學</div>
      <h2>Load your notebook words</h2>
      <p>${loaded ? "All notebook words are hidden." : "449 words, phrases and sentences from your 46 NFU notebook pages, grouped into 24 topics in notebook order."}</p>
      <button class="btn btn-primary" type="button" id="btn-load">${icon("load")}${loaded ? "Show notebook words again" : "Load notebook words"}</button>
      <p style="margin-top:14px">or <button class="btn btn-ghost btn-sm" type="button" data-act="add-first">add your own word</button></p>`;
    return;
  }
  if (!words.length) {
    tbody.innerHTML = "";
    empty.hidden = false;
    empty.innerHTML = `<h2>No matches</h2><p>Nothing matches “${esc(ui.q)}”. Try English, pinyin without tones (e.g. <b>xiexie</b>) or characters.</p>`;
    return;
  }
  empty.hidden = true;

  const topics = new Map(store.getTopics().map((t) => [String(t.id), t]));
  const tonesOn = store.getSettings().toneColors;
  const showZh = store.getSettings().showHanzi;
  root.querySelector(".words").classList.toggle("tones", tonesOn);
  root.querySelector(".words").classList.toggle("no-zh", !showZh);

  let html = "";
  let lastTopic = null;
  let n = 0;
  for (const w of words) {
    const tid = String(w.topic);
    if (tid !== lastTopic) {
      lastTopic = tid;
      const t = topics.get(tid) || { num: "", title: "" };
      const count = words.filter((x) => String(x.topic) === tid).length;
      const pages = t.pages ? (t.pages[0] === t.pages[1] ? `page ${t.pages[0]}` : `pages ${t.pages[0]}–${t.pages[1]}`) : "added by you";
      const playing = ui.playAllTopic === tid;
      html += `<tr class="group"><td colspan="6"><div class="group-head">
        <span class="gnum">${esc(t.num)}</span><h3>${esc(t.title)}</h3><span class="gmeta">${count} · ${pages}</span>
        <button class="btn btn-sm" type="button" data-act="play-topic" data-topic="${tid}">${icon(playing ? "stop" : "play")}${playing ? "Stop" : "Play all"}</button>
      </div></td></tr>`;
    }
    n++;
    html += ui.editing === w.id ? editRow(w, n) : row(w, n, showZh);
  }
  tbody.innerHTML = html;
}

function row(w, n, showZh) {
  const speed = store.getRowSpeed(w.id);
  let zh = esc(w.hanzi);
  if (!w.hanzi) {
    zh = w.speakAs && w.speakMethod === "dictionary"
      ? `<span style="opacity:.55">${esc(w.speakAs)}</span><span class="auto" title="Found from the pinyin">auto</span>`
      : `<span style="color:var(--faint)">—</span>`;
  }
  const note = w.note || "";
  return `<tr class="row" data-id="${w.id}">
    <td class="num">${n}</td>
    <td class="en">${esc(w.english)}${w.check ? `<span class="badge" title="Please check against your notebook (page ${w.page}): ${esc(w.checkWhy || "hard to read")}">check</span>` : ""}${w.source === "user" ? `<span class="badge">mine</span>` : ""}${note ? `<small>${esc(note)}</small>` : ""}</td>
    <td class="py">${pinyinHTML(w.pinyin)}</td>
    <td class="zh" lang="zh-Hant"${showZh ? "" : " hidden"}>${zh}</td>
    <td class="listen"><div class="listen-box">
      <button class="speak" type="button" data-act="speak" aria-label="Play ${esc(w.english)}" title="Listen">${icon("speaker")}</button>
      <div class="seg" role="group" aria-label="Speed">
        <button type="button" data-act="speed" data-speed="slow" aria-pressed="${speed === "slow"}">Slow</button>
        <button type="button" data-act="speed" data-speed="normal" aria-pressed="${speed !== "slow"}">Normal</button>
      </div>
    </div></td>
    <td class="act"><div class="row-menu">
      <button class="icon-btn" type="button" data-act="edit" aria-label="Edit" title="Edit">${icon("edit")}</button>
      <button class="icon-btn" type="button" data-act="delete" aria-label="${w.source === "user" ? "Delete" : "Hide"}" title="${w.source === "user" ? "Delete" : "Hide this word"}">${icon("trash")}</button>
    </div></td>
  </tr>`;
}

function editRow(w, n) {
  return `<tr class="row editing" data-id="${w.id}">
    <td class="num">${n}</td>
    <td><input class="input" data-f="english" value="${esc(w.english)}" aria-label="English"></td>
    <td><input class="input" data-f="pinyin" value="${esc(w.pinyin)}" aria-label="Pinyin"></td>
    <td><input class="input hanzi" data-f="hanzi" lang="zh-Hant" value="${esc(w.hanzi)}" aria-label="Characters"></td>
    <td colspan="2"><div class="add-actions">
      <button class="btn btn-primary btn-sm" type="button" data-act="save">${icon("check")}Save</button>
      <button class="btn btn-ghost btn-sm" type="button" data-act="cancel">Cancel</button>
    </div></td>
  </tr>`;
}

function renderTopicFilter() {
  const sel = root.querySelector("#f-topic");
  const topics = store.getTopics();
  const counts = {};
  store.getWords().forEach((w) => (counts[w.topic] = (counts[w.topic] || 0) + 1));
  const opts = [`<option value="all">All topics</option>`].concat(
    topics.filter((t) => counts[t.id]).map((t) => `<option value="${t.id}">${esc(t.num)} · ${esc(t.title)} (${counts[t.id]})</option>`)
  );
  const html = opts.join("");
  if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; }
  if (![...sel.options].some((o) => o.value === ui.topic)) ui.topic = "all";
  sel.value = ui.topic;
}

// ------------------------------------------------------------------ audio
function findWord(id) { return store.getWords().find((w) => w.id === id); }

async function playWord(w, btn, speed) {
  const text = speakableText(w);
  if (!text) { ctx.toast("Add characters or tone-marked pinyin so this can be spoken."); return; }
  root.querySelectorAll(".speak.playing").forEach((b) => b.classList.remove("playing"));
  btn?.classList.add("playing");
  await speak(text, speed || store.getRowSpeed(w.id));
  btn?.classList.remove("playing");
}

function stopAll() { playToken++; ui.playAllTopic = null; stop(); }

async function playTopic(tid) {
  if (ui.playAllTopic === tid) { stopAll(); renderAll(); return; }
  stopAll();
  const token = ++playToken;
  ui.playAllTopic = tid;
  renderAll();
  for (const w of filtered().filter((x) => String(x.topic) === tid)) {
    if (token !== playToken) return;
    const tr = root.querySelector(`tr[data-id="${w.id}"]`);
    tr?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    await playWord(w, tr?.querySelector(".speak"));
    await new Promise((r) => setTimeout(r, 450));
  }
  if (token === playToken) { ui.playAllTopic = null; renderAll(); }
}

// ------------------------------------------------------------------ events
function wire() {
  const $ = (s) => root.querySelector(s);

  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.open) return ctx.openPage(b.dataset.open);
    if (b.id === "btn-load") {
      b.disabled = true;
      try {
        if (store.isNotebookLoaded()) store.restoreHidden();
        await store.loadNotebook();
        ctx.toast(`Loaded ${store.getWords().filter((w) => w.source === "notebook").length} notebook words`);
      } catch (err) { ctx.toast(err.message); b.disabled = false; }
      return;
    }
    const act = b.dataset.act;
    if (!act) return;
    if (act === "add-first") return showAdd(true);
    if (act === "play-topic") return playTopic(b.dataset.topic);
    const tr = b.closest("tr[data-id]");
    const w = tr && findWord(tr.dataset.id);
    if (!w) return;
    if (act === "speak") {
      if (b.classList.contains("playing")) { stopAll(); b.classList.remove("playing"); return; }
      stopAll();
      return playWord(w, b);
    }
    if (act === "speed") {
      store.setRowSpeed(w.id, b.dataset.speed);
      b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      return;
    }
    if (act === "edit") { ui.editing = w.id; renderAll(); root.querySelector(`tr[data-id="${w.id}"] input`)?.focus(); return; }
    if (act === "cancel") { ui.editing = null; renderAll(); return; }
    if (act === "save") return saveEdit(tr, w);
    if (act === "delete") {
      const undo = store.removeWord(w);
      ctx.toast(w.source === "user" ? `Deleted “${w.english}”` : `Hid “${w.english}”`, { label: "Undo", run: undo });
    }
  });

  root.addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr.editing");
    if (!tr) return;
    if (e.key === "Enter") { e.preventDefault(); saveEdit(tr, findWord(tr.dataset.id)); }
    if (e.key === "Escape") { ui.editing = null; renderAll(); }
  });

  let qTimer;
  $("#q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { ui.q = e.target.value; renderAll(); }, 120); });
  $("#f-topic").addEventListener("change", (e) => { ui.topic = e.target.value; renderAll(); });
  $("#f-type").addEventListener("change", (e) => { ui.type = e.target.value; renderAll(); });

  // add form
  const form = $("#add-form");
  $("#btn-add").onclick = () => showAdd(form.hidden);
  $("#add-cancel").onclick = () => showAdd(false);
  form.pinyin.addEventListener("blur", () => { form.pinyin.value = numbersToMarks(form.pinyin.value); updateSuggest(); });
  let sTimer;
  form.addEventListener("input", () => { clearTimeout(sTimer); sTimer = setTimeout(updateSuggest, 200); });
  $("#add-preview").onclick = async (e) => {
    const p = numbersToMarks(form.pinyin.value.trim());
    const s = form.hanzi.value.trim() ? null : suggestHanzi(p);
    await playWord({ id: "_preview", pinyin: p, hanzi: form.hanzi.value.trim() || (s ? s.hanzi : "") }, e.currentTarget, store.getSettings().defaultSpeed);
  };
  root.querySelector("#add-suggest").addEventListener("click", (e) => {
    const b = e.target.closest("[data-use]");
    if (b) { form.hanzi.value = b.dataset.use; updateSuggest(); }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await ensureDict();
    const english = form.english.value.trim();
    const pinyin = numbersToMarks(form.pinyin.value.trim());
    const hanzi = form.hanzi.value.trim();
    if (!english || !pinyin) return;
    if (!syllables(pinyin).length) { ctx.toast("That pinyin doesn't look right — e.g. nǐ hǎo or ni3 hao3."); return; }
    const s = hanzi ? null : suggestHanzi(pinyin);
    const w = store.addWord({ english, pinyin, hanzi, speakAs: s?.hanzi || "", speakMethod: s?.method || "" });
    form.reset();
    updateSuggest();
    form.english.focus();
    ui.q = ""; $("#q").value = "";
    renderAll();
    const tr = root.querySelector(`tr[data-id="${w.id}"]`);
    tr?.scrollIntoView({ block: "center", behavior: "smooth" });
    ctx.toast(`Added “${english}” to My words`);
  });

  // backup
  $("#btn-export").onclick = () => {
    const blob = new Blob([JSON.stringify(store.exportData(), null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `xue-words-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $("#btn-import").onclick = () => $("#import-file").click();
  $("#import-file").onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try { const n = store.importData(JSON.parse(await f.text())); ctx.toast(`Imported ${n} new word${n === 1 ? "" : "s"}`); }
    catch (err) { ctx.toast(err.message || "Could not read that file"); }
  };
}

function showAdd(show) {
  const form = root.querySelector("#add-form");
  form.hidden = !show;
  if (show) { form.english.focus(); form.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
}

async function updateSuggest() {
  const form = root.querySelector("#add-form");
  const out = root.querySelector("#add-suggest");
  const p = numbersToMarks(form.pinyin.value.trim());
  if (!p) { out.innerHTML = ""; return; }
  const parts = [`<span class="tones" style="font-size:16px">${pinyinHTML(p)}</span>`];
  if (!/[̀-̌]|[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(p.normalize("NFC")) && !/[1-5]/.test(form.pinyin.value)) {
    parts.push(`<span>· no tone marks yet — add tones (ni3 hao3) for the best result</span>`);
  }
  if (!form.hanzi.value.trim()) {
    await ensureDict();
    const s = suggestHanzi(p);
    if (s && s.method === "dictionary") parts.push(`· characters: <span class="hanzi" lang="zh-Hant">${esc(s.hanzi)}</span> <button type="button" data-use="${esc(s.hanzi)}">Use these</button>`);
    else if (s) parts.push(`· the voice will read it as <span class="hanzi" lang="zh-Hant">${esc(s.hanzi)}</span> (same sounds)`);
  }
  out.innerHTML = parts.join(" ");
}

async function saveEdit(tr, w) {
  const get = (f) => tr.querySelector(`[data-f="${f}"]`).value.trim();
  const english = get("english"), pinyin = numbersToMarks(get("pinyin")), hanzi = get("hanzi");
  if (!english || !pinyin) { ctx.toast("English and pinyin can't be empty."); return; }
  await ensureDict();
  const s = hanzi ? null : suggestHanzi(pinyin);
  ui.editing = null;
  store.updateWord(w, { english, pinyin, hanzi, speakAs: s?.hanzi || "", speakMethod: s?.method || "" });
  ctx.toast("Saved");
}
