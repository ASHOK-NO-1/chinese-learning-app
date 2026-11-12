// Chinese characters -> pinyin (for showing what the Chinese Speaking page heard).
// Longest word match first (so 銀行 is yínháng, not yínxíng), then one character at a time.
let data = null, loading = null;

export function ensurePinyinData() {
  if (data) return Promise.resolve(data);
  loading = loading || fetch("data/hanzi-pinyin.json").then((r) => r.json()).then((d) => (data = d)).catch(() => { loading = null; return null; });
  return loading;
}

const HAN = /[㐀-鿿豈-﫿]/;

/**
 * Splits text into pieces: { zh, py } for Chinese (py = syllables joined, e.g. "yínháng"),
 * { zh, py: "" } for anything else (punctuation, Latin letters, digits).
 */
export function segment(text) {
  const out = [];
  const chars = Array.from(text || "");
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (!HAN.test(ch)) {
      // group non-Chinese runs together
      let j = i;
      while (j < chars.length && !HAN.test(chars[j])) j++;
      out.push({ zh: chars.slice(i, j).join(""), py: "" });
      i = j;
      continue;
    }
    let done = false;
    if (data) {
      for (let L = Math.min(4, chars.length - i); L >= 2; L--) {
        const w = chars.slice(i, i + L).join("");
        if (data.w[w]) { out.push({ zh: w, py: data.w[w].replace(/ /g, ""), syl: data.w[w].split(" ") }); i += L; done = true; break; }
      }
    }
    if (!done) {
      const p = (data && data.c[ch]) || "";
      out.push({ zh: ch, py: p, syl: p ? [p] : [] });
      i++;
    }
  }
  return out;
}

/** "我想去看電影" -> "wǒ xiǎng qù kàn diàn yǐng" style string (one space between syllables) */
export function toPinyin(text) {
  return segment(text).map((s) => (s.py ? s.syl.join(" ") : s.zh.trim())).filter(Boolean).join(" ")
    .replace(/\s+([，。！？、,.!?])/g, "$1");
}

/** syllables only, for comparing two pronunciations */
export function syllablesOf(text) {
  return segment(text).flatMap((s) => s.syl || []);
}
