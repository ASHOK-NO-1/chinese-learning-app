// Settings: voice, speeds, display, menu side, data.
import { icon } from "../icons.js";
import * as store from "../store.js";
import { mandarinVoices, currentVoice, voiceLabel, onVoicesChanged, speak, isSupported } from "../speech.js";
import * as sync from "../sync.js";

const escapeHTML = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let off = [];

export function mount(el, ctx) {
  el.innerHTML = `
  <div class="page">
    <header class="page-head"><div><div class="eyebrow">Preferences</div><h1>Settings</h1>
      <p>Saved on this device only.</p></div></header>
    <div class="settings">

      <section class="card set-card">
        <h2>Voice</h2>
        <p>The app speaks the Chinese characters with your device's Mandarin voice, so tones and tone changes come out right.</p>
        <div class="set-row">
          <div class="lbl"><strong>Mandarin voice</strong><small id="voice-count"></small></div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select class="select" id="voice"></select>
            <button class="speak" type="button" id="test" aria-label="Test voice" title="Test: 你好，我是你的中文老師。">${icon("speaker")}</button>
          </div>
        </div>
        <div class="set-row">
          <div class="lbl"><strong>Normal speed</strong><small>1.0 = the voice's natural speed</small></div>
          <div class="range"><input type="range" id="normalRate" min="0.6" max="1.3" step="0.05"><output id="normalRate-out"></output></div>
        </div>
        <div class="set-row">
          <div class="lbl"><strong>Slow speed</strong><small>Used when a row is set to Slow</small></div>
          <div class="range"><input type="range" id="slowRate" min="0.3" max="0.9" step="0.05"><output id="slowRate-out"></output></div>
        </div>
        <div class="set-row">
          <div class="lbl"><strong>Default speed for each word</strong><small>Rows you haven't switched yet</small></div>
          <div class="seg" role="group" aria-label="Default speed">
            <button type="button" data-default="slow">Slow</button><button type="button" data-default="normal">Normal</button>
          </div>
        </div>
        <div class="help" id="voice-help"></div>
      </section>

      <section class="card set-card">
        <h2>Display</h2>
        <div class="set-row">
          <div class="lbl"><strong>Colour pinyin by tone</strong><small>red 1 · orange 2 · green 3 · blue 4 · grey neutral</small></div>
          <label class="switch"><input type="checkbox" id="toneColors" aria-label="Colour pinyin by tone"><span></span></label>
        </div>
        <div class="set-row">
          <div class="lbl"><strong>Show Chinese characters</strong><small>Hide them to practise from pinyin only</small></div>
          <label class="switch"><input type="checkbox" id="showHanzi" aria-label="Show Chinese characters"><span></span></label>
        </div>
        <div class="set-row">
          <div class="lbl"><strong>Theme</strong></div>
          <select class="select" id="theme"><option value="auto">Match device</option><option value="light">Light</option><option value="dark">Dark</option></select>
        </div>
        <div class="set-row">
          <div class="lbl"><strong>Menu position</strong><small>Side of the screen for the main menu</small></div>
          <select class="select" id="navSide"><option value="left">Left</option><option value="right">Right</option></select>
        </div>
      </section>

      <section class="card set-card" id="sync-card"></section>

      <section class="card set-card">
        <h2>Your data</h2>
        <p>Words are always kept on this device too, so the app works offline. <b>Export</b> / <b>Import</b> on the Pronunciation page make a backup file.</p>
        <div class="set-row">
          <div class="lbl"><strong>Hidden notebook words</strong><small id="hidden-count"></small></div>
          <button class="btn btn-sm" type="button" id="restore">Restore all &amp; undo edits</button>
        </div>
      </section>
    </div>
  </div>`;

  const $ = (s) => el.querySelector(s);
  const s0 = store.getSettings();

  // voices
  const fillVoices = () => {
    const vs = mandarinVoices();
    const cur = currentVoice();
    $("#voice").innerHTML = vs.length
      ? vs.map((v) => `<option value="${v.voiceURI}">${voiceLabel(v)} (${v.lang})</option>`).join("")
      : `<option value="">No Mandarin voice installed</option>`;
    if (cur) $("#voice").value = cur.voiceURI;
    $("#voice-count").textContent = vs.length ? `${vs.length} Mandarin voice${vs.length > 1 ? "s" : ""} on this device` : "None found yet";
    $("#voice-help").innerHTML = `
      <p><strong>${vs.length ? "Want a better voice?" : "No Mandarin voice yet — here's the 1-minute fix:"}</strong></p>
      <ol>
        <li><b>Windows PC:</b> Settings → Time &amp; language → Speech → <i>Manage voices / Add voices</i> → add <b>Chinese (Traditional, Taiwan)</b> (and/or Simplified, China). Restart the browser. Tip: <b>Microsoft Edge</b> also offers free high-quality “Natural” online voices (e.g. HsiaoChen).</li>
        <li><b>Android phone:</b> Settings → System → Languages → Text-to-speech output → Google → ⚙ → Install voice data → <b>Chinese (Taiwan)</b> or <b>Chinese (Mandarin)</b>. Use Chrome.</li>
        <li><b>iPhone / iPad:</b> Settings → Accessibility → Spoken Content → Voices → Chinese (Taiwan) → download a voice.</li>
      </ol>
      <p>Avoid voices labelled <i>Hong Kong / Cantonese</i> — that's a different language. The app hides them.</p>`;
  };
  fillVoices();
  off.push(onVoicesChanged(fillVoices));
  $("#voice").onchange = (e) => store.setSetting("voiceURI", e.target.value);
  $("#test").onclick = async (e) => {
    if (!isSupported()) return ctx.toast("This browser can't speak.");
    e.currentTarget.classList.add("playing");
    await speak("你好，我是你的中文老師。", "normal");
    $("#test").classList.remove("playing");
  };

  // speeds
  for (const id of ["normalRate", "slowRate"]) {
    const input = $("#" + id), out = $(`#${id}-out`);
    input.value = s0[id];
    out.textContent = Number(s0[id]).toFixed(2) + "×";
    input.oninput = () => { out.textContent = Number(input.value).toFixed(2) + "×"; };
    input.onchange = async () => {
      store.setSetting(id, Number(input.value));
      await speak("謝謝", id === "slowRate" ? "slow" : "normal");
    };
  }
  const markDefault = () => el.querySelectorAll("[data-default]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.default === store.getSettings().defaultSpeed)));
  markDefault();
  el.querySelectorAll("[data-default]").forEach((b) => (b.onclick = () => { store.setSetting("defaultSpeed", b.dataset.default); markDefault(); }));

  // display
  for (const id of ["toneColors", "showHanzi"]) {
    $("#" + id).checked = !!s0[id];
    $("#" + id).onchange = (e) => store.setSetting(id, e.target.checked);
  }
  for (const id of ["theme", "navSide"]) {
    $("#" + id).value = s0[id];
    $("#" + id).onchange = (e) => store.setSetting(id, e.target.value);
  }

  // cloud sync
  const renderSync = (st) => {
    const card = $("#sync-card");
    const head = `<h2>Cloud sync</h2>`;
    if (!sync.isConfigured()) {
      card.innerHTML = `${head}<p>Not set up yet. Once the app's Firebase project is connected, you'll sign in with Google here and your own words, edits and hidden words will follow you to every device.</p>`;
      return;
    }
    const when = st.at ? st.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    const states = {
      connecting: ["busy", "Connecting…"], syncing: ["busy", "Syncing…"],
      synced: ["ok", `Synced${when ? " at " + when : ""}`], error: ["err", st.error || "Sync problem"],
      "signed-out": ["", "Off — sign in to sync"], off: ["", "Off"],
    };
    const [cls, label] = states[st.state] || states.off;
    const stateHTML = `<span class="sync-state ${cls}"><span class="dot"></span>${escapeHTML(label)}</span>`;
    if (!st.user) {
      card.innerHTML = `${head}
        <p>Sign in with your Google account and your own words, edits and hidden words follow you to every phone and PC where you sign in. Free; your words stay private to your account.</p>
        <div class="set-row"><div class="lbl">${stateHTML}</div>
          <button class="btn btn-google" type="button" id="sync-in"${st.state === "connecting" ? " disabled" : ""}>${icon("google")}Sign in with Google</button></div>`;
      $("#sync-in").onclick = async () => {
        try { await sync.signIn(); } catch { /* status already shows the reason */ }
      };
      return;
    }
    const initial = (st.user.name || st.user.email || "?").trim()[0].toUpperCase();
    card.innerHTML = `${head}
      <p>Your own words, edits and hidden words sync automatically on every device where you're signed in.</p>
      <div class="set-row">
        <div class="sync-user">${st.user.photo ? `<img src="${escapeHTML(st.user.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${escapeHTML(initial)}</span>`}
          <div class="lbl"><strong>${escapeHTML(st.user.name || "Signed in")}</strong><small>${escapeHTML(st.user.email || "")}</small></div></div>
        <button class="btn btn-sm" type="button" id="sync-out">Sign out</button>
      </div>
      <div class="set-row"><div class="lbl">${stateHTML}</div>
        <button class="btn btn-sm" type="button" id="sync-now">${icon("cloudSync")}Sync now</button></div>`;
    $("#sync-out").onclick = async () => { await sync.signOut(); ctx.toast("Signed out — your words stay on this device"); };
    $("#sync-now").onclick = () => sync.syncNow();
  };
  renderSync(sync.getStatus());
  off.push(sync.onSyncChange(renderSync));

  // data
  const showHidden = () => ($("#hidden-count").textContent = `${store.hiddenCount()} hidden`);
  showHidden();
  off.push(store.onChange(showHidden));
  $("#restore").onclick = () => { store.restoreHidden(); ctx.toast("All notebook words restored"); };
}

export function unmount() { off.forEach((f) => f()); off = []; }
