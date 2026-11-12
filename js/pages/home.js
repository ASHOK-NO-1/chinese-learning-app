// Home: welcome + quick links to features.
import { icon } from "../icons.js";
import { PAGES } from "./index.js";
import { currentVoice, voiceLabel, onVoicesChanged, isSupported, voicesSettled } from "../speech.js";
import { pinyinHTML } from "../pinyin.js";

let off = null;

export function mount(el, ctx) {
  const cards = PAGES.map((p) =>
    p.soon
      ? `<div class="card feature soon"><span class="ico">${icon(p.icon)}</span><h3>${p.title}</h3><p>Coming in a future version.</p></div>`
      : `<button type="button" class="card feature" data-open="${p.id}"><span class="ico">${icon(p.icon)}</span><h3>${p.title}</h3><p>${blurb(p.id)}</p></button>`
  ).join("");

  el.innerHTML = `
    <div class="page">
      <div class="card hero">
        <div>
          <div class="eyebrow">Mandarin for English speakers</div>
          <h1>歡迎 <span class="tones">${pinyinHTML("Huānyíng")}</span> — welcome!</h1>
          <p>Learn Mandarin from English. New to Chinese? Start with <strong>Pinyin Phonetics</strong> to master the tones and sounds, then practise real words from an NFU (Taiwan) class notebook with pinyin, characters and a native-sounding voice.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" type="button" data-open="pinyin">${icon("waves")}New? Start with Pinyin</button>
            <button class="btn" type="button" data-open="pronunciation">${icon("speaker")}Practise words</button>
            <button class="btn btn-ghost" type="button" data-share>${icon("share")}Share with friends</button>
          </div>
        </div>
        <div class="big-hanzi" aria-hidden="true">學</div>
      </div>

      <div class="grid-cards">${cards}</div>

      <div class="grid-cards">
        <div class="card feature">
          <h3>Reading the tone colours</h3>
          <p>Pinyin is coloured by tone so you can see the melody of each word.</p>
          <div class="tone-legend tones">
            <span><b class="t1">mā</b> 1st · high</span>
            <span><b class="t2">má</b> 2nd · rising</span>
            <span><b class="t3">mǎ</b> 3rd · dip</span>
            <span><b class="t4">mà</b> 4th · falling</span>
            <span><b class="t5">ma</b> neutral</span>
          </div>
        </div>
        <div class="card feature">
          <h3>Voice</h3>
          <p id="home-voice"></p>
          <p><button class="btn btn-sm" type="button" data-open="settings">${icon("settings")}Voice settings</button></p>
        </div>
      </div>
    </div>`;

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-share]")) return ctx.share();
    const b = e.target.closest("[data-open]");
    if (b) ctx.openPage(b.dataset.open);
  });

  const showVoice = () => {
    const v = currentVoice();
    el.querySelector("#home-voice").textContent = !isSupported()
      ? "This browser can't speak. Try Chrome or Edge."
      : v ? `Using ${voiceLabel(v)}.`
      : !voicesSettled() ? "Looking for a Mandarin voice…"
      : "No Mandarin voice installed yet — open Voice settings for a 1-minute fix.";
  };
  showVoice();
  off = onVoicesChanged(showVoice);
}

export function unmount() { off?.(); }

function blurb(id) {
  return {
    pronunciation: "Every notebook word with pinyin, characters and audio. Add your own words.",
    flashcards: "Remember words for good: flip cards and rate them — hard ones come back sooner, easy ones later.",
    quiz: "Train your ear: hear a syllable or word and pick the tones. Rounds of 10 with a score.",
    writing: "Watch the stroke order of any character, then write it yourself — each stroke is checked.",
    notebook: "Browse all 46 handwritten pages from the NFU course by topic, and hear the words on each page.",
    speaking: "Speak Chinese and see what the app heard — characters, pinyin and English. “Say this” checks your pronunciation.",
    pinyin: "Start here if you're new: the four tones, every initial and final sound, and nearly 400 syllables to tap and hear.",
  }[id] || "";
}
