// Text-to-speech using the device's built-in Mandarin voice (Web Speech API).
// We speak the CHINESE CHARACTERS, not the pinyin letters: the voice then applies the correct
// tones and the natural tone changes (e.g. 你好 nǐ hǎo is spoken ní hǎo) automatically.
import { getSettings } from "./store.js";

const supported = typeof window !== "undefined" && "speechSynthesis" in window;
let voices = [];
let current = null;          // the utterance being spoken (kept referenced: Chrome drops GC'd ones)
let currentDone = null;
const listeners = new Set();

function isMandarin(v) {
  const tag = (v.lang || "").toLowerCase().replace("_", "-");
  const text = (v.name + " " + tag).toLowerCase();
  if (/(hk|yue|cantonese|粵|廣東)/.test(text)) return false;     // Cantonese is a different language
  return tag.startsWith("zh") || tag.startsWith("cmn");
}

function score(v) {
  const tag = (v.lang || "").toLowerCase().replace("_", "-");
  let s = 0;
  if (tag.includes("tw") || tag.includes("hant")) s += 30;   // Taiwan Mandarin first (you studied in Taiwan)
  else if (tag.includes("cn") || tag.includes("hans")) s += 20;
  else s += 10;
  if (/natural|neural|online|enhanced|premium/i.test(v.name)) s += 15;
  if (/google/i.test(v.name)) s += 8;
  return s;
}

function refresh() {
  if (!supported) return;
  voices = speechSynthesis.getVoices().filter(isMandarin).sort((a, b) => score(b) - score(a));
  listeners.forEach((fn) => fn());
}

let settled = false; // true once voices were found, or we've waited long enough to be sure there are none

export function initSpeech() {
  if (!supported) { settled = true; return; }
  refresh();
  speechSynthesis.addEventListener?.("voiceschanged", () => { settled = settled || voices.length > 0; refresh(); });
  // browsers often fill the voice list a moment after load: keep checking for a few seconds
  [250, 700, 1500, 3000].forEach((ms, i, arr) =>
    setTimeout(() => {
      if (settled) return;
      voices = [];
      refresh();
      if (voices.length || i === arr.length - 1) { settled = true; listeners.forEach((fn) => fn()); }
    }, ms)
  );
  if (voices.length) settled = true;
}

/** false while we are still waiting for the browser to list its voices */
export function voicesSettled() { return settled; }

export function onVoicesChanged(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function isSupported() { return supported; }
export function mandarinVoices() { return voices.slice(); }

export function currentVoice() {
  const { voiceURI } = getSettings();
  return voices.find((v) => v.voiceURI === voiceURI) || voices[0] || null;
}

export function voiceLabel(v) {
  if (!v) return "No Mandarin voice found";
  const region = /tw|hant/i.test(v.lang) ? "Taiwan" : /cn|hans/i.test(v.lang) ? "Mainland" : v.lang;
  const name = v.name.replace(/^Microsoft\s+/, "").replace(/\s*-\s*Chinese.*$/i, "").replace(/\s*\(.*?\)\s*/g, " ").trim();
  return `${name} · ${region}`;
}

export function stop() {
  if (!supported) return;
  speechSynthesis.cancel();
  if (currentDone) { currentDone(); currentDone = null; }
  current = null;
}

/**
 * Speaks Chinese text. speed: "slow" | "normal". Resolves when finished (or stopped).
 */
export function speak(text, speed = "normal") {
  return new Promise((resolve) => {
    if (!supported || !text) return resolve(false);
    stop();
    const s = getSettings();
    const u = new SpeechSynthesisUtterance(text);
    const v = currentVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "zh-TW"; }
    u.rate = speed === "slow" ? s.slowRate : s.normalRate;
    u.pitch = 1;
    let finished = false;
    const done = () => { if (!finished) { finished = true; if (current === u) current = null; resolve(true); } };
    u.onend = done;
    u.onerror = done;
    current = u;
    currentDone = done;
    // small delay: Chrome sometimes ignores speak() right after cancel()
    setTimeout(() => speechSynthesis.speak(u), 30);
  });
}
