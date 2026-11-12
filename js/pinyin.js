// Pinyin helpers: tone numbers -> tone marks, splitting into syllables, finding each syllable's tone.
import { SYLLABLE_CHARS } from "./data/syllables.js";

const TONE_MARK = { "̄": 1, "́": 2, "̌": 3, "̀": 4 }; // combining macron, acute, caron, grave
const MARK_OF = ["", "̄", "́", "̌", "̀"];

/** "nǐ hǎo" -> "ni hao" (keeps ü) */
export function stripTones(s) {
  return s.normalize("NFD").replace(/[̄́̌̀]/g, "").normalize("NFC");
}

/** tone 1-4 from the mark on a syllable, 5 = neutral (no mark) */
export function toneOf(syl) {
  for (const ch of syl.normalize("NFD")) if (TONE_MARK[ch]) return TONE_MARK[ch];
  return 5;
}

// every valid toneless syllable, e.g. "zhong", "lü", plus erhua/interjections
const VALID = new Set(Object.keys(SYLLABLE_CHARS).map((k) => stripTones(k)));
["r", "er", "n", "ng", "m", "hm", "yo", "lüe", "nüe", "lue", "nue", "ei", "o"].forEach((s) => VALID.add(s));

/** Converts tone numbers to marks: "ni3 hao3" / "nv3" / "lu:4" -> "nǐ hǎo" / "nǚ" / "lǜ". Leaves marked text alone. */
export function numbersToMarks(text) {
  return text.replace(/([a-zA-ZüÜ:]+?)([1-5])(?![0-9])/g, (m, syl, n) => {
    let s = syl.replace(/u:|v/g, "ü").replace(/U:|V/g, "Ü");
    const tone = Number(n);
    if (tone === 5) return s;
    const lower = s.toLowerCase();
    let i = lower.indexOf("a");
    if (i < 0) i = lower.indexOf("e");
    if (i < 0) i = lower.indexOf("ou");
    if (i < 0) {
      for (let k = lower.length - 1; k >= 0; k--) if ("iouü".includes(lower[k])) { i = k; break; }
    }
    if (i < 0) return m; // no vowel (e.g. "m2") - leave as typed
    return (s.slice(0, i + 1) + MARK_OF[tone]).normalize("NFC") + s.slice(i + 1);
  });
}

/**
 * Splits pinyin text into pieces: syllables (with tone) and separators.
 * Works for spaced ("zhōu mò") and joined ("zhōumò") pinyin.
 */
export function splitPinyin(text) {
  const out = [];
  const norm = (text || "").normalize("NFC");
  const re = /[A-Za-zÀ-ɏ̀-ͯü]+|[^A-Za-zÀ-ɏ̀-ͯü]+/g;
  for (const token of norm.match(re) || []) {
    if (!/[A-Za-zÀ-ɏü]/.test(token)) { out.push({ text: token, sep: true }); continue; }
    let i = 0;
    const chars = Array.from(token);
    while (i < chars.length) {
      let len = 0;
      for (let L = Math.min(6, chars.length - i); L >= 1; L--) {
        const piece = chars.slice(i, i + L).join("");
        if (VALID.has(stripTones(piece).toLowerCase())) {
          // don't steal a vowel-initial syllable's consonant (xian + g... vs xi + ang): prefer split that leaves a valid rest
          const rest = chars.slice(i + L).join("");
          if (L > 1 && rest && /^[aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(rest)) {
            const shorter = chars.slice(i, i + L - 1).join("");
            if (VALID.has(stripTones(shorter).toLowerCase())) continue;
          }
          len = L;
          break;
        }
      }
      if (!len) len = 1;
      const piece = chars.slice(i, i + len).join("");
      out.push({ text: piece, tone: toneOf(piece) });
      i += len;
    }
  }
  return out;
}

/** Only the syllables, lower-case, toned: "Nǐ hǎo!" -> ["nǐ","hǎo"] */
export function syllables(text) {
  return splitPinyin(text).filter((p) => !p.sep && p.text.length).map((p) => p.text.toLowerCase());
}

/** Lookup key: toned syllables joined, lower-case: "Zhōu mò" -> "zhōumò" */
export function pinyinKey(text) { return syllables(text).join(""); }

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** HTML with one <span class="tN"> per syllable, for tone colouring */
export function pinyinHTML(text) {
  return splitPinyin(text)
    .map((p) => (p.sep ? esc(p.text) : `<span class="s t${p.tone}">${esc(p.text)}</span>`))
    .join("");
}

/** A character that sounds like this syllable (fallback for words without characters) */
export function charForSyllable(syl) {
  const s = syl.toLowerCase();
  if (SYLLABLE_CHARS[s]) return SYLLABLE_CHARS[s];
  const base = stripTones(s);
  if (SYLLABLE_CHARS[base]) return SYLLABLE_CHARS[base];
  // neutral-tone syllable without its own entry: use the 1st-4th tone version closest in sound
  for (const t of [1, 2, 3, 4]) {
    const marked = numbersToMarks(base.replace(/ü/g, "v") + t);
    if (SYLLABLE_CHARS[marked]) return SYLLABLE_CHARS[marked];
  }
  return "";
}
