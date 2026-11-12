// Chinese -> English for the Chinese Speaking page.
// 1) your notebook / own words (exact match)  2) the browser's on-device translator (private, newer Chrome)
// 3) MyMemory free translation service (online; sends the recognised text, nothing else).
import * as store from "./store.js";

let notebook = null;
const strip = (s = "") => s.replace(/[\s，。！？、,.!?；;：:「」『』“”"'（）()…~～]/g, "");

async function glossMap() {
  if (!notebook) {
    try { notebook = (await (await fetch("data/notebook-words.json")).json()).words; } catch { notebook = []; }
  }
  const map = new Map();
  for (const w of notebook) if (w.hanzi) map.set(strip(w.hanzi), { en: w.english, py: w.pinyin });
  for (const w of store.getWords()) if (w.hanzi) map.set(strip(w.hanzi), { en: w.english, py: w.pinyin }); // includes your own words
  return map;
}

/** Words inside the text that you already know from your notebook or own list: [{ zh, en }] */
export async function knownWords(text) {
  const map = await glossMap();
  const t = strip(text);
  const found = [];
  let i = 0;
  while (i < t.length) {
    let hit = null;
    for (let L = Math.min(8, t.length - i); L >= 1; L--) {
      const w = t.slice(i, i + L);
      if (map.has(w) && (L > 1 || !hit)) { hit = { zh: w, en: map.get(w).en }; break; }
    }
    if (hit) { if (!found.some((f) => f.zh === hit.zh)) found.push(hit); i += hit.zh.length; } else i++;
  }
  return found;
}

let deviceTranslator = null;
async function onDevice(text) {
  try {
    if (!("Translator" in self)) return null;
    if (!deviceTranslator) {
      const opts = { sourceLanguage: "zh", targetLanguage: "en" };
      if ((await self.Translator.availability(opts)) !== "available") return null; // don't trigger big downloads
      deviceTranslator = await self.Translator.create(opts);
    }
    return await deviceTranslator.translate(text);
  } catch { return null; }
}

async function myMemory(text, lang) {
  const url = "https://api.mymemory.translated.net/get?" +
    new URLSearchParams({ q: text, langpair: (lang === "zh-CN" ? "zh-CN" : "zh-TW") + "|en", mt: "1" });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Translation service error " + res.status);
  const d = await res.json();
  // the free service mixes in crowd-sourced entries; skip ones with markup and take the first clean answer
  const clean = (s = "") => s.replace(/<[^>]+>/g, "").replace(/^[-–\s"']+|["'\s]+$/g, "").trim();
  const cands = [d.responseData?.translatedText, ...(d.matches || []).map((m) => m.translation)]
    .filter((s) => s && !/<[^>]+>/.test(s)).map(clean).filter(Boolean);
  return cands[0] || null;
}

/**
 * Returns { en, source, py? } where source is "notebook" | "device" | "online" | "none".
 * py is set when the whole text is a word from your notebook / own list (its checked pinyin).
 */
export async function translate(text, { lang = "zh-TW", online = true } = {}) {
  const map = await glossMap();
  const exact = map.get(strip(text));
  if (exact) return { en: exact.en, py: exact.py, source: "notebook" };
  const dev = await onDevice(text);
  if (dev) return { en: dev, source: "device" };
  if (!online) return { en: "", source: "none" };
  try {
    const mm = await myMemory(text, lang);
    return mm ? { en: mm, source: "online" } : { en: "", source: "none" };
  } catch {
    return { en: "", source: "none", error: "No internet connection — the English couldn't be fetched." };
  }
}
