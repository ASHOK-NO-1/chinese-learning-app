// Finds Chinese characters for typed pinyin, so new words can be pronounced with correct tones
// even when you only know the pinyin. Uses data/pinyin-dict.json (~30,000 common words),
// then falls back to one sound-alike character per syllable.
import { syllables, stripTones, toneOf, charForSyllable } from "./pinyin.js";

let dict = null;
let toneless = null; // "nihao" -> ["nǐhǎo", ...]
let loading = null;

export function ensureDict() {
  if (dict) return Promise.resolve(dict);
  if (!loading) {
    loading = fetch("data/pinyin-dict.json")
      .then((r) => r.json())
      .then((d) => {
        dict = d;
        toneless = new Map();
        for (const k of Object.keys(d)) {
          const t = stripTones(k);
          if (!toneless.has(t)) toneless.set(t, []);
          toneless.get(t).push(k);
        }
        return d;
      })
      .catch(() => { loading = null; return null; });
  }
  return loading;
}

// does a dictionary key match the typed syllables, allowing neutral-tone differences (xièxie ~ xièxiè)?
function looseMatch(typedSyls) {
  const cands = toneless.get(stripTones(typedSyls.join(""))) || [];
  for (const k of cands) {
    const ks = syllables(k);
    if (ks.length !== typedSyls.length) continue;
    const ok = ks.every((s, i) => {
      const a = toneOf(s), b = toneOf(typedSyls[i]);
      return a === b || a === 5 || b === 5;
    });
    if (ok) return dict[k];
  }
  return null;
}

/**
 * Suggests characters for pinyin. Returns { hanzi, method } where method is
 * "dictionary" (real word(s) found) or "sound" (sound-alike characters, tones still correct).
 */
export function suggestHanzi(pinyinText) {
  const syls = syllables(pinyinText);
  if (!syls.length) return null;
  const n = syls.length;
  // dynamic programming over syllables: prefer few, long dictionary words
  const best = new Array(n + 1).fill(null);
  best[0] = { cost: 0, parts: [], sound: false };
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - 6); j < i; j++) {
      if (!best[j]) continue;
      const chunk = syls.slice(j, i);
      let word = null, cost = 0, sound = false;
      if (dict) {
        word = dict[chunk.join("")];
        if (word) cost = 1;
        else { word = looseMatch(chunk); if (word) cost = 1.3; }
      }
      if (!word && i - j === 1) { word = charForSyllable(chunk[0]); cost = 2.5; sound = true; }
      if (!word) continue;
      const c = best[j].cost + cost;
      if (!best[i] || c < best[i].cost) best[i] = { cost: c, parts: best[j].parts.concat(word), sound: best[j].sound || sound };
    }
  }
  const r = best[n];
  if (!r || r.parts.some((p) => !p)) return null;
  // only a single whole-word match is trustworthy as "the characters"; glued pieces are
  // right in SOUND (and tone) but may be the wrong characters, so they're used for the voice only
  return { hanzi: r.parts.join(""), method: !r.sound && r.parts.length === 1 ? "dictionary" : "sound" };
}

/** What to feed the voice for a word. */
export function speakableText(word) {
  if (word.hanzi) return word.hanzi;
  if (word.speakAs) return word.speakAs;
  const s = suggestHanzi(word.pinyin);
  return s ? s.hanzi : "";
}
